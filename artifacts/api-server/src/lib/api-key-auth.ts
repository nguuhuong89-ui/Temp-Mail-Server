import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { logger } from "./logger";

const KEY_PREFIX = "tm_live_";
const PREFIX_VISIBLE_LEN = KEY_PREFIX.length + 6;

export type GeneratedApiKey = { plaintext: string; prefix: string; keyHash: string };

export function generateApiKey(): GeneratedApiKey {
  const secret = crypto.randomBytes(24).toString("hex");
  const plaintext = `${KEY_PREFIX}${secret}`;
  const prefix = plaintext.slice(0, PREFIX_VISIBLE_LEN);
  const keyHash = sha256(plaintext);
  return { plaintext, prefix, keyHash };
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function extractKey(req: Request): string | null {
  const header = req.header("x-api-key");
  if (header) return header.trim();
  const auth = req.header("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (m) return m[1]!.trim();
  }
  return null;
}

const MAX_DEBOUNCE_ENTRIES = 10_000;
const lastUsedDebounce = new Map<number, number>();
const LAST_USED_INTERVAL_MS = 60_000;

type CachedKey = { id: number; keyHash: string; userId: string | null; expires: number };
const keyLookupCache = new Map<string, CachedKey>();
const KEY_CACHE_TTL_MS = 30_000;
const KEY_CACHE_MAX = 5_000;

export function invalidateApiKeyCache(hash?: string): void {
  if (hash) keyLookupCache.delete(hash);
  else keyLookupCache.clear();
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const provided = extractKey(req);
  if (!provided || !provided.startsWith(KEY_PREFIX)) {
    res.status(401).json({ error: "API key required (header: X-API-Key or Authorization: Bearer ...)" });
    return;
  }
  const hash = sha256(provided);

  const now = Date.now();
  let cached = keyLookupCache.get(hash);
  if (!cached || cached.expires < now) {
    const [row] = await db
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.keyHash, hash), isNull(apiKeysTable.revokedAt)))
      .limit(1);
    if (!row || !safeEqual(row.keyHash, hash)) {
      keyLookupCache.delete(hash);
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }
    if (keyLookupCache.size >= KEY_CACHE_MAX) {
      const first = keyLookupCache.keys().next().value;
      if (first !== undefined) keyLookupCache.delete(first);
    }
    cached = { id: row.id, keyHash: row.keyHash, userId: row.userId, expires: now + KEY_CACHE_TTL_MS };
    keyLookupCache.set(hash, cached);
  }

  (req as Request & { apiKeyId?: number; apiKeyUserId?: string | null }).apiKeyId = cached.id;
  (req as Request & { apiKeyUserId?: string | null }).apiKeyUserId = cached.userId;
  const last = lastUsedDebounce.get(cached.id) ?? 0;
  if (now - last > LAST_USED_INTERVAL_MS) {
    if (lastUsedDebounce.size >= MAX_DEBOUNCE_ENTRIES) {
      const first = lastUsedDebounce.keys().next().value;
      if (first !== undefined) lastUsedDebounce.delete(first);
    }
    lastUsedDebounce.set(cached.id, now);
    db.update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, cached.id))
      .catch((err) => logger.warn({ err: err?.message }, "failed to update api key lastUsedAt"));
  }
  next();
}
