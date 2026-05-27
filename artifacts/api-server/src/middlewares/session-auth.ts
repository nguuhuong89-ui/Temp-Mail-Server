import type { Request, Response, NextFunction } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

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

const USER_CACHE_MAX = 10_000;
const userCache = new Map<string, { plan: string; role: string; expires: number }>();
const USER_TTL_MS = 30_000;

async function loadUser(userId: string): Promise<{ plan: string; role: string } | null> {
  const now = Date.now();
  const cached = userCache.get(userId);
  if (cached && cached.expires > now) return { plan: cached.plan, role: cached.role };

  const [existing] = await db
    .select({ plan: usersTable.plan, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!existing) return null;

  const plan = (existing.role === "admin" || existing.role === "super_admin") ? "pro" : existing.plan;
  const result = { plan, role: existing.role };
  if (userCache.size >= USER_CACHE_MAX) {
    const first = userCache.keys().next().value;
    if (first !== undefined) userCache.delete(first);
  }
  userCache.set(userId, { ...result, expires: now + USER_TTL_MS });
  return result;
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.["session"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (!token) { next(); return; }

  try {
    const [session] = await db
      .select({ userId: sessionsTable.userId })
      .from(sessionsTable)
      .where(and(eq(sessionsTable.id, token), gt(sessionsTable.expiresAt, new Date())))
      .limit(1);

    if (!session) { next(); return; }

    const user = await loadUser(session.userId);
    if (!user) { next(); return; }

    const r = req as AuthedRequest;
    r.userId = session.userId;
    r.userPlan = user.plan;
    r.userRole = user.role as Role;
  } catch (err) {
    req.log?.warn?.({ err: (err as Error)?.message }, "attachUser failed");
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
