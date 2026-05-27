import { Router, type IRouter } from "express";
import { getRateLimitStats, getEffectiveLimits, setCustomLimits, type RateLimitConfig } from "../lib/rate-limiter";
import { logAudit } from "../lib/audit";
import type { AuthedRequest } from "../middlewares/session-auth";

const router: IRouter = Router();

router.get("/rate-limits", (_req, res) => {
  res.json({
    limits: getEffectiveLimits(),
    stats: getRateLimitStats(),
  });
});

router.put("/rate-limits", (req, res) => {
  const r = req as AuthedRequest;
  const { limits } = req.body ?? {};
  if (!limits || typeof limits !== "object") {
    res.status(400).json({ error: "limits object required" });
    return;
  }
  const parsed: Record<string, RateLimitConfig> = {};
  for (const [key, val] of Object.entries(limits)) {
    const v = val as Record<string, unknown>;
    if (typeof v.maxRequests === "number" && v.maxRequests > 0) {
      parsed[key] = {
        maxRequests: Math.round(v.maxRequests),
        windowMs: typeof v.windowMs === "number" ? Math.round(v.windowMs) : undefined,
      };
    }
  }
  setCustomLimits(parsed);
  void logAudit({ action: "rate_limits.update", actorId: r.userId ?? "admin", targetType: "settings", metadata: parsed, req });
  res.json({ limits: getEffectiveLimits() });
});

export default router;
