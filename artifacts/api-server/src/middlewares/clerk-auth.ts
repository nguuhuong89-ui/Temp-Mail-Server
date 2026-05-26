import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const ROLES = ["user", "moderator", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_HIERARCHY: Record<Role, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  super_admin: 3,
};

export type AuthedRequest = Request & {
  userId?: string;
  userPlan?: string;
  userRole?: Role;
};

const clerkClient = createClerkClient({
  secretKey: process.env["CLERK_SECRET_KEY"] ?? "",
});

const userCache = new Map<string, { plan: string; role: string; expires: number }>();
const USER_TTL_MS = 30_000;

async function loadOrCreateUser(userId: string): Promise<{ plan: string; role: string }> {
  const now = Date.now();
  const cached = userCache.get(userId);
  if (cached && cached.expires > now) return { plan: cached.plan, role: cached.role };

  const [existing] = await db
    .select({ plan: usersTable.plan, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing) {
    // Invariant: admin/super_admin role implies pro plan.
    const plan = (existing.role === "admin" || existing.role === "super_admin") ? "pro" : existing.plan;
    const result = { plan, role: existing.role };
    userCache.set(userId, { ...result, expires: now + USER_TTL_MS });
    return result;
  }

  let email: string | null = null;
  try {
    const u = await clerkClient.users.getUser(userId);
    email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    // ignore — clerk may be unreachable; we still create a stub row
  }

  const adminEmails = (process.env["ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const role = email && adminEmails.includes(email.toLowerCase()) ? "admin" : "user";
  const plan = role === "admin" ? "pro" : "free";

  await db
    .insert(usersTable)
    .values({ id: userId, email, plan, role })
    .onConflictDoNothing();

  userCache.set(userId, { plan, role, expires: now + USER_TTL_MS });
  return { plan, role };
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    next();
    return;
  }
  try {
    const { plan, role } = await loadOrCreateUser(userId);
    const r = req as AuthedRequest;
    r.userId = userId;
    r.userPlan = plan;
    r.userRole = role as Role;
  } catch (err) {
    req.log.warn({ err: (err as Error)?.message }, "attachUser failed");
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const r = req as AuthedRequest;
  if (!r.userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  next();
}

export function requirePro(req: Request, res: Response, next: NextFunction): void {
  const r = req as AuthedRequest;
  if (!r.userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  if (r.userPlan !== "pro") {
    res.status(403).json({ error: "Pro plan required", code: "plan_required" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const r = req as AuthedRequest;
  if (!r.userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  if (r.userRole !== "admin" && r.userRole !== "super_admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = req as AuthedRequest;
    if (!r.userId) {
      res.status(401).json({ error: "Sign-in required" });
      return;
    }
    const userLevel = ROLE_HIERARCHY[r.userRole ?? "user"];
    const minLevel = Math.min(...roles.map((role) => ROLE_HIERARCHY[role]));
    if (userLevel < minLevel) {
      res.status(403).json({ error: `Requires ${roles.join(" or ")} role` });
      return;
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const r = req as AuthedRequest;
  if (!r.userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  if (r.userRole !== "super_admin") {
    res.status(403).json({ error: "Super admin only" });
    return;
  }
  next();
}
