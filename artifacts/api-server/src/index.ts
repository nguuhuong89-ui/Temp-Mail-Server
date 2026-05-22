import app from "./app";
import { logger } from "./lib/logger";
import { startSmtpServer } from "./lib/smtp";
import { startCleanupJob } from "./lib/cleanup";
import { assertProductionAdminConfig } from "./middlewares/admin-auth";
import { initDb } from "./lib/db-init";

assertProductionAdminConfig();

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function main() {
  logger.info("Initialising database schema");
  try {
    await initDb();
    logger.info("Database schema ready");
  } catch (err) {
    logger.error({ err }, "Database init failed — tables may not exist, continuing anyway");
  }

  app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "HTTP server listening");
  });

  const smtpPort = Number(process.env["SMTP_PORT"] ?? 2525);
  if (!Number.isNaN(smtpPort) && smtpPort > 0) {
    try {
      startSmtpServer(smtpPort);
    } catch (err) {
      logger.error({ err, smtpPort }, "Failed to start SMTP server");
    }
  } else {
    logger.info({ smtpPort }, "SMTP server disabled (SMTP_PORT<=0)");
  }

  startCleanupJob();
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
