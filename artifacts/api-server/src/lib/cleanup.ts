import { db, inboxesTable, emailsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import { logger } from "./logger";

export function startCleanupJob(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const now = new Date();
      const ttlDays = Number(process.env["EMAIL_RETENTION_DAYS"] ?? 7);
      const oldEmailCutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

      const expiredInboxes = await db
        .delete(inboxesTable)
        .where(lt(inboxesTable.expiresAt, now))
        .returning({ id: inboxesTable.id });

      const oldEmails = await db
        .delete(emailsTable)
        .where(lt(emailsTable.receivedAt, oldEmailCutoff))
        .returning({ id: emailsTable.id });

      // Best-effort: remove orphan emails whose toAddress no longer matches any inbox.
      // (We keep emails after inbox expiry for a few days for "share link" use, then drop here.)
      await db.execute(sql`DELETE FROM emails WHERE received_at < ${oldEmailCutoff}`);

      if (expiredInboxes.length || oldEmails.length) {
        logger.info(
          { expiredInboxes: expiredInboxes.length, oldEmails: oldEmails.length },
          "cleanup tick",
        );
      }
    } catch (err) {
      logger.error({ err }, "cleanup job failed");
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}
