import app from "./app";
import { logger } from "./lib/logger";
import { startSmtpServer } from "./lib/smtp";
import { startCleanupJob } from "./lib/cleanup";
import { assertProductionAdminConfig } from "./middlewares/admin-auth";

assertProductionAdminConfig();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "HTTP server listening");
});

// Set SMTP_PORT=0 (or any non-positive value) to disable the embedded SMTP
// listener. Replit Autoscale/VM deployments cannot accept inbound SMTP
// (port 25 is not exposed publicly), so the listener is only useful in
// self-host (Docker) or local dev.
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
