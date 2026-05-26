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

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const provided = extractKey(req);
  if (!provided || !provided.startsWith(KEY_PREFIX)) {
    res.status(401).json({ error: "API key required (header: X-API-Key or Authorization: Bearer ...)" });
    return;
  }
  const hash = sha256(provided);
  const [row] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, hash), isNull(apiKeysTable.revokedAt)))
    .limit(1);
  if (!row || !safeEqual(row.keyHash, hash)) {
    res.status(401).json({ error: "Invalid or revoked API key" });
    return;
  }
  (req as Request & { apiKeyId?: number; apiKeyUserId?: string | null }).apiKeyId = row.id;
  (req as Request & { apiKeyUserId?: string | null }).apiKeyUserId = row.userId;
  const now = Date.now();
  const last = lastUsedDebounce.get(row.id) ?? 0;
  if (now - last > LAST_USED_INTERVAL_MS) {
    if (lastUsedDebounce.size >= MAX_DEBOUNCE_ENTRIES) {
      // Evict oldest entries when the map grows too large.
      let oldest = Infinity;
      let oldestKey: number | undefined;
      for (const [k, v] of lastUsedDebounce) {
        if (v < oldest) { oldest = v; oldestKey = k; }
      }
      if (oldestKey !== undefined) lastUsedDebounce.delete(oldestKey);
    }
    lastUsedDebounce.set(row.id, now);
    db.update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, row.id))
      .catch((err) => logger.warn({ err: err?.message }, "failed to update api key lastUsedAt"));
  }
  next();
}
