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
  const maxConnections = Number(process.env["SMTP_MAX_CONNECTIONS"] ?? 100);
  const socketTimeout = Number(process.env["SMTP_SOCKET_TIMEOUT"] ?? 60_000);

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    size: 5 * 1024 * 1024, // 5MB cap
    maxClients: maxConnections,
    socketTimeout,
    closeTimeout: 3_000,
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

          // Pre-resolve all recipient domains in one batch (cache is shared so
          // this effectively just de-duplicates the cache read).
          const recipients = session.envelope.rcptTo.map((r) => r.address.toLowerCase());
          const domainNames = [...new Set(recipients.map((a) => a.split("@")[1] ?? ""))];
          const domainMap = new Map<string, Awaited<ReturnType<typeof lookupDomain>>>();
          await Promise.all(
            domainNames.map(async (dn) => {
              domainMap.set(dn, await lookupDomain(dn));
            }),
          );

          // Process all recipients in parallel for faster delivery
          await Promise.all(
            recipients.map(async (toAddress) => {
              const domainName = toAddress.split("@")[1] ?? "";
              const domain = domainMap.get(domainName);
              if (!domain || domain.status !== "active") {
                logger.warn({ toAddress }, "Rejected mail for inactive/unknown domain");
                return;
              }
              // Insert email first (the latency-critical path), auto-create
              // inbox in parallel — inbox upsert is fire-and-forget.
              const [, [row]] = await Promise.all([
                db
                  .insert(inboxesTable)
                  .values({
                    address: toAddress,
                    token: generateToken(),
                    expiresAt: defaultExpiry(),
                  })
                  .onConflictDoNothing(),
                db
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
                  .returning(),
              ]);
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
            }),
          );
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
