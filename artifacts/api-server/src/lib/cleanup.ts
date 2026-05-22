import { db, inboxesTable, emailsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { runtimeSettings } from "./runtime-settings";

export function startCleanupJob(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const now = new Date();
      const allCutoff = new Date(Date.now() - runtimeSettings.emailRetentionDays * 24 * 60 * 60 * 1000);
      const anonCutoff = new Date(Date.now() - runtimeSettings.anonRetentionHours * 60 * 60 * 1000);

      const expiredInboxes = await db
        .delete(inboxesTable)
        .where(lt(inboxesTable.expiresAt, now))
        .returning({ id: inboxesTable.id });

      // Delete anonymous emails faster (shorter retention)
      await db.execute(sql`
        DELETE FROM emails
        WHERE received_at < ${anonCutoff}
        AND to_address IN (SELECT address FROM inboxes WHERE owner_user_id IS NULL)
      `);

      // Delete all emails older than global retention limit
      const oldEmails = await db
        .delete(emailsTable)
        .where(lt(emailsTable.receivedAt, allCutoff))
        .returning({ id: emailsTable.id });

      if (expiredInboxes.length || oldEmails.length) {
        logger.info(
          { expiredInboxes: expiredInboxes.length, oldEmails: oldEmails.length, anonCutoffHours: runtimeSettings.anonRetentionHours },
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
