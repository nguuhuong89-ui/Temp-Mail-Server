import { Router, type IRouter } from "express";
import { networkInterfaces } from "node:os";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, and, lt, isNull } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { checkAdminToken, isAdminAuthConfigured } from "../middlewares/admin-auth";
import { type AuthedRequest, requireUser } from "../middlewares/session-auth";
import { generateTotp } from "../lib/totp";

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

// --- Password hashing (scrypt, no external deps) ---

const scryptAsync = promisify(crypto.scrypt);
const SALT_LEN = 16;
const KEY_LEN = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedKey] = hash.split(":");
  if (!salt || !storedKey) return false;
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(storedKey, "hex"), key);
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
    .select({ id: usersTable.id, deletedAt: usersTable.deletedAt, totpEnabled: usersTable.totpEnabled, totpSecret: usersTable.totpSecret })
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

  // Check 2FA if enabled
  if (user.totpEnabled && user.totpSecret) {
    const totpCode = String(req.body?.totpCode ?? "").replace(/\s/g, "");
    if (!totpCode) {
      res.status(200).json({ ok: false, requires2FA: true, message: "2FA code required" });
      return;
    }
    const { code: expectedCode } = generateTotp(user.totpSecret);
    if (totpCode !== expectedCode) {
      // Check previous period for clock drift
      const { code: prevCode } = generateTotp(user.totpSecret, { timestamp: Math.floor(Date.now() / 1000) - 30 });
      if (totpCode !== prevCode) {
        res.status(401).json({ error: "Invalid 2FA code" });
        return;
      }
    }
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
      totpEnabled: usersTable.totpEnabled,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    ...user,
    hasPassword: !!(await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.id, r.userId!))
      .limit(1)
      .then((rows) => rows[0]?.passwordHash)),
  });
});

// --- Email + Password auth ---

router.post("/auth/login-email", loginLimiter, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      passwordHash: usersTable.passwordHash,
      deletedAt: usersTable.deletedAt,
      totpEnabled: usersTable.totpEnabled,
      totpSecret: usersTable.totpSecret,
    })
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Check 2FA if enabled
  if (user.totpEnabled && user.totpSecret) {
    const totpCode = String(req.body?.totpCode ?? "").replace(/\s/g, "");
    if (!totpCode) {
      res.status(200).json({ ok: false, requires2FA: true, message: "2FA code required" });
      return;
    }
    const { code: expectedCode } = generateTotp(user.totpSecret);
    if (totpCode !== expectedCode) {
      const { code: prevCode } = generateTotp(user.totpSecret, { timestamp: Math.floor(Date.now() / 1000) - 30 });
      if (totpCode !== prevCode) {
        res.status(401).json({ error: "Invalid 2FA code" });
        return;
      }
    }
  }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

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

// Link email + set password (for existing users)
router.post("/auth/link-email", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  // Check if email is already used by another user
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deletedAt)))
    .limit(1);
  if (existing && existing.id !== r.userId) {
    res.status(409).json({ error: "Email already in use by another account" });
    return;
  }

  const hash = await hashPassword(password);
  await db
    .update(usersTable)
    .set({ email, passwordHash: hash, updatedAt: new Date() })
    .where(eq(usersTable.id, r.userId!));

  res.json({ ok: true, email });
});

// Change password (for users who already have one)
router.post("/auth/change-password", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");

  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select({ passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);

  if (user?.passwordHash) {
    if (!currentPassword) {
      res.status(400).json({ error: "Current password required" });
      return;
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
  }

  const hash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(usersTable.id, r.userId!));

  res.json({ ok: true });
});

// --- 2FA (TOTP) endpoints ---

function generateBase32Secret(): string {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(20);
  let result = "";
  for (let i = 0; i < 20; i++) {
    result += B32[bytes[i]! % 32];
  }
  return result;
}

// Generate 2FA secret (setup, not yet enabled)
router.post("/auth/2fa/setup", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const [user] = await db
    .select({ totpEnabled: usersTable.totpEnabled })
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.totpEnabled) { res.status(400).json({ error: "2FA already enabled" }); return; }

  const secret = generateBase32Secret();
  await db.update(usersTable).set({ totpSecret: secret }).where(eq(usersTable.id, r.userId!));

  const issuer = "TempMail";
  const otpauthUri = `otpauth://totp/${issuer}:${r.userId}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;

  res.json({ secret, otpauthUri });
});

// Verify TOTP and enable 2FA
router.post("/auth/2fa/enable", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const totpCode = String(req.body?.code ?? "").replace(/\s/g, "");
  if (!totpCode || totpCode.length !== 6) {
    res.status(400).json({ error: "6-digit code required" });
    return;
  }

  const [user] = await db
    .select({ totpSecret: usersTable.totpSecret, totpEnabled: usersTable.totpEnabled })
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);
  if (!user || !user.totpSecret) {
    res.status(400).json({ error: "Run /auth/2fa/setup first" });
    return;
  }
  if (user.totpEnabled) {
    res.status(400).json({ error: "2FA already enabled" });
    return;
  }

  const { code: expected } = generateTotp(user.totpSecret);
  if (totpCode !== expected) {
    const { code: prev } = generateTotp(user.totpSecret, { timestamp: Math.floor(Date.now() / 1000) - 30 });
    if (totpCode !== prev) {
      res.status(401).json({ error: "Invalid code" });
      return;
    }
  }

  await db.update(usersTable).set({ totpEnabled: true }).where(eq(usersTable.id, r.userId!));
  res.json({ ok: true, message: "2FA enabled" });
});

// Disable 2FA
router.post("/auth/2fa/disable", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const totpCode = String(req.body?.code ?? "").replace(/\s/g, "");

  const [user] = await db
    .select({ totpSecret: usersTable.totpSecret, totpEnabled: usersTable.totpEnabled })
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: "2FA not enabled" });
    return;
  }

  // Verify current TOTP to disable
  if (!totpCode || totpCode.length !== 6) {
    res.status(400).json({ error: "Current 6-digit code required to disable 2FA" });
    return;
  }
  const { code: expected } = generateTotp(user.totpSecret);
  if (totpCode !== expected) {
    const { code: prev } = generateTotp(user.totpSecret, { timestamp: Math.floor(Date.now() / 1000) - 30 });
    if (totpCode !== prev) {
      res.status(401).json({ error: "Invalid code" });
      return;
    }
  }

  await db.update(usersTable).set({ totpEnabled: false, totpSecret: null }).where(eq(usersTable.id, r.userId!));
  res.json({ ok: true, message: "2FA disabled" });
});

// Check 2FA status
router.get("/auth/2fa/status", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const [user] = await db
    .select({ totpEnabled: usersTable.totpEnabled })
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);
  res.json({ enabled: user?.totpEnabled ?? false });
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
