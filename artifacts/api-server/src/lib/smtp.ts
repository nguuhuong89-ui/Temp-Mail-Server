import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { db, emailsTable, inboxesTable } from "@workspace/db";
import { logger } from "./logger";
import { emitEmailReceived } from "./events";
import { defaultExpiry, generateToken, makePreview } from "./inbox-utils";
import { lookupDomain } from "./domain-cache";
import { isSenderBlocked } from "./blocklist-cache";
import { fireEmailWebhook } from "./webhooks";

export function startSmtpServer(port: number): SMTPServer {
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    size: 5 * 1024 * 1024, // 5MB cap
    onRcptTo(address, _session, callback) {
      const domainName = address.address.split("@")[1]?.toLowerCase() ?? "";
      if (!domainName) {
        callback(new Error("550 Invalid recipient"));
        return;
      }
      lookupDomain(domainName)
        .then((d) => {
          if (!d || d.status !== "active") {
            callback(new Error("550 Recipient domain not served"));
            return;
          }
          callback();
        })
        .catch((err) => {
          logger.error({ err }, "RCPT lookup failed");
          callback(new Error("451 Temporary lookup failure"));
        });
    },
    onData(stream, session, callback) {
      simpleParser(stream as unknown as NodeJS.ReadableStream)
        .then(async (parsed) => {
          const parsedFrom = parsed.from?.value?.[0]?.address;
          const envelopeFrom =
            session.envelope.mailFrom && typeof session.envelope.mailFrom === "object"
              ? session.envelope.mailFrom.address
              : "";
          const fromAddress = parsedFrom || envelopeFrom || "";
          const subject = parsed.subject ?? "";
          const text = parsed.text ?? "";
          const html =
            typeof parsed.html === "string" ? parsed.html : parsed.html === false ? "" : "";
          const hasAttachments = (parsed.attachments?.length ?? 0) > 0;
          const preview = makePreview(text || (html ? html.replace(/<[^>]+>/g, " ") : ""));

          if (fromAddress && (await isSenderBlocked(fromAddress))) {
            logger.warn({ fromAddress }, "Rejected mail from blocked sender");
            callback();
            return;
          }

          for (const rcpt of session.envelope.rcptTo) {
            const toAddress = rcpt.address.toLowerCase();
            const domainName = toAddress.split("@")[1] ?? "";
            const domain = await lookupDomain(domainName);
            if (!domain || domain.status !== "active") {
              logger.warn({ toAddress }, "Rejected mail for inactive/unknown domain");
              continue;
            }
            // Auto-create inbox row so address shows up in UI history
            await db
              .insert(inboxesTable)
              .values({
                address: toAddress,
                token: generateToken(),
                expiresAt: defaultExpiry(),
              })
              .onConflictDoNothing();

            const [row] = await db
              .insert(emailsTable)
              .values({
                toAddress,
                fromAddress: fromAddress || "unknown@unknown",
                subject,
                textBody: text,
                htmlBody: html,
                preview,
                hasAttachments,
                domainId: domain.id,
              })
              .returning();
            if (row) {
              emitEmailReceived({
                toAddress,
                emailId: row.id,
                fromAddress: row.fromAddress,
                subject: row.subject,
                receivedAt: row.receivedAt.toISOString(),
              });
              // Fire optional per-domain webhook (non-blocking).
              if (domain.webhookUrl) {
                fireEmailWebhook(domain.webhookUrl, {
                  event: "email.received",
                  emailId: row.id,
                  toAddress: row.toAddress,
                  fromAddress: row.fromAddress,
                  subject: row.subject,
                  preview: row.preview,
                  hasAttachments: row.hasAttachments,
                  receivedAt: row.receivedAt.toISOString(),
                });
              }
            }
          }
          callback();
        })
        .catch((err) => {
          logger.error({ err }, "Failed to parse incoming email");
          callback(new Error("Parse error"));
        });
    },
  });

  server.on("error", (err) => {
    logger.error({ err }, "SMTP server error");
  });

  server.listen(port, () => {
    logger.info({ port }, "SMTP server listening");
  });

  return server;
}
