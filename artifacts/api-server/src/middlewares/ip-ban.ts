import type { Request, Response, NextFunction } from "express";
import { db, bannedIpsTable } from "@workspace/db";
import { eq, or, isNull, gt } from "drizzle-orm";

const banCache = new Map<string, { banned: boolean; expires: number }>();
const BAN_CACHE_TTL_MS = 30_000;
const BAN_CACHE_MAX = 50_000;

export function invalidateBanCache(ip?: string): void {
  if (ip) banCache.delete(ip);
  else banCache.clear();
}

export async function ipBanMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = (req.ip || req.socket.remoteAddress || "").toString();
  if (!ip) { next(); return; }

  const now = Date.now();
  const cached = banCache.get(ip);
  if (cached && cached.expires > now) {
    if (cached.banned) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    next();
    return;
  }

  try {
    const [row] = await db
      .select({ id: bannedIpsTable.id })
      .from(bannedIpsTable)
      .where(eq(bannedIpsTable.ip, ip))
      .limit(1);

    let banned = false;
    if (row) {
      const [active] = await db
        .select({ id: bannedIpsTable.id })
        .from(bannedIpsTable)
        .where(
          eq(bannedIpsTable.ip, ip),
        )
        .limit(1);
      if (active) {
        const [stillActive] = await db
          .select({ id: bannedIpsTable.id, expiresAt: bannedIpsTable.expiresAt })
          .from(bannedIpsTable)
          .where(eq(bannedIpsTable.ip, ip))
          .limit(1);
        if (stillActive) {
          banned = stillActive.expiresAt === null || stillActive.expiresAt > new Date();
        }
      }
    }

    if (banCache.size >= BAN_CACHE_MAX) {
      const first = banCache.keys().next().value;
      if (first !== undefined) banCache.delete(first);
    }
    banCache.set(ip, { banned, expires: now + BAN_CACHE_TTL_MS });

    if (banned) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } catch {
    // On DB error, allow request to proceed
  }
  next();
}
