import { Router, type IRouter } from "express";
import { networkInterfaces } from "node:os";
import crypto from "node:crypto";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { checkAdminToken, isAdminAuthConfigured } from "../middlewares/admin-auth";
import { type AuthedRequest, requireUser } from "../middlewares/clerk-auth";

const router: IRouter = Router();

// --- Helpers ---

const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz"; // 23 chars (removed i, l, o to avoid confusion)
const CODE_LENGTH = 20;
const SESSION_DAYS = 30;

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}-${code.slice(16, 20)}`;
}

function generateSessionId(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateUserId(): string {
  return `usr_${crypto.randomBytes(12).toString("hex")}`;
}

// --- Rate limiting for auth ---

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  keyGenerator: (req) => req.ip ?? "unknown",
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many accounts created. Please try again later." },
  keyGenerator: (req) => req.ip ?? "unknown",
});

// --- Auth endpoints ---

router.post("/auth/register", registerLimiter, async (_req, res) => {
  try {
    const code = generateCode();
    const userId = generateUserId();

    await db.insert(usersTable).values({
      id: userId,
      authCode: code,
      plan: "free",
      role: "user",
    });

    // Auto-login: create session
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(sessionsTable).values({ id: sessionId, userId, expiresAt });

    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(201).json({
      ok: true,
      code: formatCode(code),
      userId,
      message: "Save this code! It is your only way to log in.",
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed", detail: (err as Error)?.message });
  }
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const rawCode = String(req.body?.code ?? "").replace(/[\s-]/g, "").toLowerCase();
  if (rawCode.length !== CODE_LENGTH) {
    res.status(400).json({ error: "Invalid code format" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, deletedAt: usersTable.deletedAt })
    .from(usersTable)
    .where(eq(usersTable.authCode, rawCode))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid code" });
    return;
  }

  if (user.deletedAt) {
    res.status(403).json({ error: "Account has been deleted" });
    return;
  }

  // Update last login
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  // Create session
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ id: sessionId, userId: user.id, expiresAt });

  res.cookie("session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });

  res.json({ ok: true, userId: user.id });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.["session"];
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, token)).catch(() => {});
  }
  res.clearCookie("session", { path: "/" });
  res.json({ ok: true });
});

router.get("/auth/me", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      plan: usersTable.plan,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

// --- Cleanup expired sessions (called periodically) ---
export async function cleanupExpiredSessions(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
}

// --- Existing admin endpoints ---

router.get("/admin/auth/status", (_req, res) => {
  res.json({ required: isAdminAuthConfigured() });
});

router.get("/admin/server-info", (_req, res) => {
  let serverIp: string = process.env["SERVER_IP"] ?? "";
  if (!serverIp) {
    const nets = networkInterfaces();
    outer: for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces ?? []) {
        if (iface.family === "IPv4" && !iface.internal) {
          const ip = iface.address;
          if (!ip.startsWith("172.") && !ip.startsWith("10.") && !ip.startsWith("192.168.")) {
            serverIp = ip;
            break outer;
          }
          if (!serverIp) serverIp = ip;
        }
      }
    }
  }
  res.json({
    serverIp: serverIp || "Unknown",
    smtpPort: Number(process.env["SMTP_PORT"] ?? 25),
    mailDomain: process.env["MAIL_DOMAIN"] ?? "",
  });
});

router.post("/admin/auth/login", (req, res) => {
  const token =
    (typeof req.body?.token === "string" ? req.body.token : "") ||
    req.header("x-admin-token") ||
    "";
  if (!checkAdminToken(token)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  res.json({ ok: true });
});

export default router;
