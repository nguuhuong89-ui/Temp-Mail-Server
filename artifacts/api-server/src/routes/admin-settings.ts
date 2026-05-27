import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runtimeSettings } from "../lib/runtime-settings";
import { logAudit } from "../lib/audit";
import type { AuthedRequest } from "../middlewares/clerk-auth";

const router: IRouter = Router();

router.get("/system-settings", (_req, res) => {
  res.json({ ...runtimeSettings });
});

router.put("/system-settings", (req, res) => {
  const r = req as AuthedRequest;
  const { anonRetentionHours, emailRetentionDays } = req.body ?? {};
  if (typeof anonRetentionHours === "number" && anonRetentionHours > 0) {
    runtimeSettings.anonRetentionHours = Math.max(1, Math.min(24 * 28, Math.round(anonRetentionHours)));
  }
  if (typeof emailRetentionDays === "number" && emailRetentionDays > 0) {
    runtimeSettings.emailRetentionDays = Math.max(1, Math.min(365, Math.round(emailRetentionDays)));
  }
  void logAudit({ action: "settings.update", actorId: r.userId ?? "admin", targetType: "settings", metadata: { ...runtimeSettings }, req });
  res.json({ ...runtimeSettings });
});

router.get("/system-settings/purge-preview", async (_req, res) => {
  const anonCutoff = new Date(Date.now() - runtimeSettings.anonRetentionHours * 60 * 60 * 1000);
  const allCutoff = new Date(Date.now() - runtimeSettings.emailRetentionDays * 24 * 60 * 60 * 1000);
  const [anonRow, allRow, expiredRow] = await Promise.all([
    db.execute(sql`
      SELECT count(*)::int AS count FROM emails
      WHERE received_at < ${anonCutoff}
      AND to_address IN (SELECT address FROM inboxes WHERE owner_user_id IS NULL)
    `),
    db.execute(sql`SELECT count(*)::int AS count FROM emails WHERE received_at < ${allCutoff}`),
    db.execute(sql`SELECT count(*)::int AS count FROM inboxes WHERE expires_at < now()`),
  ]);
  res.json({
    anonEmailsToDelete: Number((anonRow.rows as Array<{ count: number }>)[0]?.count ?? 0),
    allOldEmailsToDelete: Number((allRow.rows as Array<{ count: number }>)[0]?.count ?? 0),
    expiredInboxesToDelete: Number((expiredRow.rows as Array<{ count: number }>)[0]?.count ?? 0),
    anonCutoff: anonCutoff.toISOString(),
    allCutoff: allCutoff.toISOString(),
  });
});

router.post("/system-settings/purge-anon", async (req, res) => {
  const r = req as AuthedRequest;
  const cutoff = new Date(Date.now() - runtimeSettings.anonRetentionHours * 60 * 60 * 1000);
  const result = await db.execute(sql`
    DELETE FROM emails
    WHERE received_at < ${cutoff}
    AND to_address IN (SELECT address FROM inboxes WHERE owner_user_id IS NULL)
  `);
  const deleted = result.rowCount ?? 0;
  await logAudit({ action: "purge.anon_emails", actorId: r.userId ?? "admin", targetType: "emails", metadata: { deleted, cutoff: cutoff.toISOString() }, req });
  res.json({ deleted, cutoff: cutoff.toISOString() });
});

router.post("/system-settings/purge-old", async (req, res) => {
  const r = req as AuthedRequest;
  const cutoff = new Date(Date.now() - runtimeSettings.emailRetentionDays * 24 * 60 * 60 * 1000);
  const result = await db.execute(sql`DELETE FROM emails WHERE received_at < ${cutoff}`);
  const deleted = result.rowCount ?? 0;
  await logAudit({ action: "purge.old_emails", actorId: r.userId ?? "admin", targetType: "emails", metadata: { deleted, cutoff: cutoff.toISOString() }, req });
  res.json({ deleted, cutoff: cutoff.toISOString() });
});

export default router;
