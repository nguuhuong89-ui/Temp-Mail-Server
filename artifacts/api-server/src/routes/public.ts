import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { db, domainsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { generateTotp, parseOtpAuthUri } from "../lib/totp";

const router: IRouter = Router();

const totpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});

// Public list of domains usable on the home-page picker.
// Returns ONLY id+name for active+public domains. No webhookUrl, no userId.
router.get("/public/domains", async (_req, res) => {
  const rows = await db
    .select({ id: domainsTable.id, name: domainsTable.name })
    .from(domainsTable)
    .where(and(eq(domainsTable.status, "active"), eq(domainsTable.isPublic, true)))
    .orderBy(domainsTable.name);
  res.json(rows);
});

// Stateless TOTP generator. Accepts a base32 secret OR an otpauth:// URI.
router.get("/totp", totpLimiter, (req, res) => {
  const raw = typeof req.query["secret"] === "string" ? req.query["secret"].trim() : "";
  if (!raw) {
    res.status(400).json({ error: "secret required" });
    return;
  }
  if (raw.length > 512) {
    res.status(400).json({ error: "secret too long" });
    return;
  }
  let secret = raw;
  let digits: number | undefined;
  let period: number | undefined;
  let algorithm: "sha1" | "sha256" | "sha512" | undefined;
  const parsed = parseOtpAuthUri(raw);
  if (parsed) {
    secret = parsed.secret;
    digits = parsed.digits;
    period = parsed.period;
    algorithm = parsed.algorithm;
  }
  // Bound user-controlled options to safe ranges (DoS hardening).
  if (digits !== undefined && (!Number.isInteger(digits) || digits < 6 || digits > 8)) {
    res.status(400).json({ error: "digits must be 6, 7, or 8" });
    return;
  }
  if (period !== undefined && (!Number.isInteger(period) || period < 15 || period > 120)) {
    res.status(400).json({ error: "period must be between 15 and 120 seconds" });
    return;
  }
  try {
    const result = generateTotp(secret, { digits, period, algorithm });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid secret" });
  }
});

export default router;
