const counters = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 50_000;

export interface RateLimitConfig {
  maxRequests: number;
  windowMs?: number;
}

const defaultLimits: Record<string, RateLimitConfig> = {
  "inbox.create": { maxRequests: 30 },
  "api.request": { maxRequests: 120 },
  "email.fetch": { maxRequests: 60 },
};

let customLimits: Record<string, RateLimitConfig> = {};

export function setCustomLimits(limits: Record<string, RateLimitConfig>): void {
  customLimits = limits;
}

export function getEffectiveLimits(): Record<string, RateLimitConfig> {
  return { ...defaultLimits, ...customLimits };
}

export function checkRateLimit(key: string, action: string): { allowed: boolean; remaining: number; limit: number } {
  const config = customLimits[action] ?? defaultLimits[action];
  if (!config) return { allowed: true, remaining: 999, limit: 999 };

  const windowMs = config.windowMs ?? WINDOW_MS;
  const now = Date.now();
  const compositeKey = `${action}:${key}`;
  const entry = counters.get(compositeKey);

  if (!entry || now - entry.windowStart > windowMs) {
    counters.set(compositeKey, { count: 1, windowStart: now });
    if (counters.size > MAX_ENTRIES) {
      const cutoff = now - windowMs * 2;
      for (const [k, v] of counters) {
        if (v.windowStart < cutoff) counters.delete(k);
      }
    }
    return { allowed: true, remaining: config.maxRequests - 1, limit: config.maxRequests };
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  return { allowed: entry.count <= config.maxRequests, remaining, limit: config.maxRequests };
}

export function getRateLimitStats(): Array<{ key: string; action: string; count: number; windowStart: number }> {
  const now = Date.now();
  const result: Array<{ key: string; action: string; count: number; windowStart: number }> = [];
  for (const [compositeKey, entry] of counters) {
    if (now - entry.windowStart > WINDOW_MS * 2) continue;
    const idx = compositeKey.indexOf(":");
    result.push({
      key: compositeKey.slice(idx + 1),
      action: compositeKey.slice(0, idx),
      count: entry.count,
      windowStart: entry.windowStart,
    });
  }
  result.sort((a, b) => b.count - a.count);
  return result.slice(0, 100);
}
