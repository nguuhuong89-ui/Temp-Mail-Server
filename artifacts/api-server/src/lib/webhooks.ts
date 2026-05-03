import { promises as dns } from "node:dns";
import net from "node:net";
import { logger } from "./logger";

const PRIVATE_HOST_PATTERNS = [/^localhost$/i, /\.local$/i, /\.internal$/i];

function isPrivateOrReservedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map((n) => parseInt(n, 10));
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (net.isIP(mapped) === 4) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true;
}

export function isSafeWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (net.isIP(host) && isPrivateOrReservedIp(host)) return false;
  for (const re of PRIVATE_HOST_PATTERNS) {
    if (re.test(host)) return false;
  }
  return true;
}

async function resolveAndCheckSafe(host: string): Promise<boolean> {
  if (net.isIP(host)) return !isPrivateOrReservedIp(host);
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records.length) return false;
    for (const r of records) {
      if (isPrivateOrReservedIp(r.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export type EmailWebhookPayload = {
  event: "email.received";
  emailId: number;
  toAddress: string;
  fromAddress: string;
  subject: string;
  preview: string;
  hasAttachments: boolean;
  receivedAt: string;
};

export function fireEmailWebhook(url: string | null | undefined, payload: EmailWebhookPayload): void {
  if (!url) return;
  if (!isSafeWebhookUrl(url)) {
    logger.warn({ url }, "skipping unsafe webhook url (host policy)");
    return;
  }
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  resolveAndCheckSafe(host)
    .then((ok) => {
      if (!ok) {
        logger.warn({ url }, "skipping unsafe webhook url (resolved to private/reserved IP)");
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "tempmail-webhook/1" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then((r) => {
          if (!r.ok) logger.warn({ url, status: r.status }, "webhook responded non-2xx");
        })
        .catch((err) => {
          logger.warn({ url, err: err?.message }, "webhook delivery failed");
        })
        .finally(() => clearTimeout(timeout));
    })
    .catch((err) => {
      logger.warn({ url, err: err?.message }, "webhook DNS check failed");
    });
}
