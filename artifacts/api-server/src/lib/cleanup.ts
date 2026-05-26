import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { runtimeSettings } from "./runtime-settings";

const BATCH_SIZE = 1000;

async function batchDeleteInboxes(cutoff: Date): Promise<number> {
  let total = 0;
  for (;;) {
    const result = await db.execute(sql`
      DELETE FROM inboxes WHERE id IN (
        SELECT id FROM inboxes WHERE expires_at < ${cutoff} LIMIT ${BATCH_SIZE}
      )
    `);
    const count = Number(result.rowCount ?? 0);
    total += count;
    if (count < BATCH_SIZE) break;
  }
  return total;
}

async function batchDeleteEmails(cutoff: Date): Promise<number> {
  let total = 0;
  for (;;) {
    const result = await db.execute(sql`
      DELETE FROM emails WHERE id IN (
        SELECT id FROM emails WHERE received_at < ${cutoff} LIMIT ${BATCH_SIZE}
      )
    `);
    const count = Number(result.rowCount ?? 0);
    total += count;
    if (count < BATCH_SIZE) break;
  }
  return total;
}

export function startCleanupJob(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const now = new Date();
      const allCutoff = new Date(Date.now() - runtimeSettings.emailRetentionDays * 24 * 60 * 60 * 1000);
      const anonCutoff = new Date(Date.now() - runtimeSettings.anonRetentionHours * 60 * 60 * 1000);

      const expiredInboxes = await batchDeleteInboxes(now);

      // Delete anonymous emails faster (shorter retention) — batched
      await db.execute(sql`
        DELETE FROM emails WHERE id IN (
          SELECT e.id FROM emails e
          JOIN inboxes i ON i.address = e.to_address
          WHERE e.received_at < ${anonCutoff} AND i.owner_user_id IS NULL
          LIMIT ${BATCH_SIZE}
        )
      `);

      const oldEmails = await batchDeleteEmails(allCutoff);

      if (expiredInboxes || oldEmails) {
        logger.info(
          { expiredInboxes, oldEmails, anonCutoffHours: runtimeSettings.anonRetentionHours },
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
