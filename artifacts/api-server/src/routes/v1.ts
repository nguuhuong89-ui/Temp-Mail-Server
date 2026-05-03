import { Router, type IRouter, type Request } from "express";
import { db, inboxesTable, emailsTable, domainsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  generateLocalPart,
  generateToken,
  defaultExpiry,
  isValidLocalPart,
} from "../lib/inbox-utils";
import { ensureDefaultDomain } from "../lib/domain-cache";
import { apiKeyAuth } from "../lib/api-key-auth";
import { extractCodeFromEmail } from "../lib/code-extract";
import { emailBus, type EmailEvent } from "../lib/events";

const router: IRouter = Router();

router.use("/v1", apiKeyAuth);

function ownerId(req: Request): number {
  return (req as Request & { apiKeyId?: number }).apiKeyId!;
}

function ownerUserId(req: Request): string | null {
  return (req as Request & { apiKeyUserId?: string | null }).apiKeyUserId ?? null;
}

async function loadOwnedInbox(address: string, owner: number) {
  const [row] = await db
    .select()
    .from(inboxesTable)
    .where(eq(inboxesTable.address, address))
    .limit(1);
  if (!row || row.ownerApiKeyId !== owner) return { status: 404 as const };
  return { status: 200 as const, inbox: row };
}

// POST /v1/inboxes  body: { localPart?, domain?, ttlMinutes? }
router.post("/v1/inboxes", async (req, res) => {
  const localPart: string | undefined = req.body?.localPart;
  const domainName: string | undefined = req.body?.domain;
  const owner = ownerId(req);

  let ttlMinutes: number | undefined;
  if (req.body?.ttlMinutes !== undefined && req.body?.ttlMinutes !== null) {
    const n = Number(req.body.ttlMinutes);
    if (!Number.isFinite(n) || n < 1 || n > 60 * 24 * 7) {
      res.status(400).json({ error: "ttlMinutes must be between 1 and 10080" });
      return;
    }
    ttlMinutes = n;
  }

  let domain: string;
  if (domainName) {
    const [d] = await db
      .select()
      .from(domainsTable)
      .where(eq(domainsTable.name, domainName.toLowerCase()))
      .limit(1);
    if (!d) {
      res.status(400).json({ error: "Unknown domain" });
      return;
    }
    if (d.status !== "active") {
      res.status(400).json({ error: "Domain not active" });
      return;
    }
    // Private (custom) domains may only be used by the API key whose owner
    // verified the domain.
    if (!d.isPublic) {
      const u = ownerUserId(req);
      if (!u || d.userId !== u) {
        res.status(403).json({ error: "Domain not available" });
        return;
      }
    }
    domain = d.name;
  } else {
    domain = await ensureDefaultDomain(process.env["MAIL_DOMAIN"] ?? "tempmail.local");
  }

  const expiresAt = ttlMinutes ? new Date(Date.now() + ttlMinutes * 60_000) : defaultExpiry();

  if (localPart) {
    if (!isValidLocalPart(localPart)) {
      res.status(400).json({ error: "Invalid localPart" });
      return;
    }
    const address = `${localPart}@${domain}`.toLowerCase();
    try {
      const [row] = await db
        .insert(inboxesTable)
        .values({ address, token: generateToken(), expiresAt, ownerApiKeyId: owner })
        .returning();
      if (!row) {
        res.status(500).json({ error: "Insert failed" });
        return;
      }
      res.status(201).json(serializeInbox(row));
    } catch {
      res.status(409).json({ error: "Address already taken" });
    }
    return;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const local = generateLocalPart();
    const address = `${local}@${domain}`.toLowerCase();
    try {
      const [row] = await db
        .insert(inboxesTable)
        .values({ address, token: generateToken(), expiresAt, ownerApiKeyId: owner })
        .returning();
      if (!row) continue;
      res.status(201).json(serializeInbox(row));
      return;
    } catch {
      // collision, retry
    }
  }
  res.status(500).json({ error: "Could not allocate address" });
});

// GET /v1/inboxes — list inboxes owned by this key
router.get("/v1/inboxes", async (req, res) => {
  const rows = await db
    .select()
    .from(inboxesTable)
    .where(eq(inboxesTable.ownerApiKeyId, ownerId(req)))
    .orderBy(desc(inboxesTable.createdAt))
    .limit(100);
  res.json(rows.map(serializeInbox));
});

router.get("/v1/inboxes/:address", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const r = await loadOwnedInbox(address, ownerId(req));
  if (r.status === 404) { res.status(404).json({ error: "Inbox not found" }); return; }

  res.json(serializeInbox(r.inbox));
});

router.delete("/v1/inboxes/:address", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const r = await loadOwnedInbox(address, ownerId(req));
  if (r.status === 404) { res.status(404).json({ error: "Inbox not found" }); return; }

  await db.delete(emailsTable).where(eq(emailsTable.toAddress, address));
  await db.delete(inboxesTable).where(eq(inboxesTable.address, address));
  res.status(204).end();
});

router.get("/v1/inboxes/:address/emails", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const r = await loadOwnedInbox(address, ownerId(req));
  if (r.status === 404) { res.status(404).json({ error: "Inbox not found" }); return; }

  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 50), 1), 100);
  const rows = await db
    .select({
      id: emailsTable.id,
      toAddress: emailsTable.toAddress,
      fromAddress: emailsTable.fromAddress,
      subject: emailsTable.subject,
      preview: emailsTable.preview,
      hasAttachments: emailsTable.hasAttachments,
      receivedAt: emailsTable.receivedAt,
    })
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address))
    .orderBy(desc(emailsTable.receivedAt))
    .limit(limit);
  res.json({
    address,
    count: rows.length,
    emails: rows.map((e) => ({ ...e, receivedAt: e.receivedAt.toISOString() })),
  });
});

router.get("/v1/inboxes/:address/emails/:id", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const r = await loadOwnedInbox(address, ownerId(req));
  if (r.status === 404) { res.status(404).json({ error: "Inbox not found" }); return; }

  const [row] = await db
    .select()
    .from(emailsTable)
    .where(and(eq(emailsTable.id, id), eq(emailsTable.toAddress, address)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Email not found" }); return; }
  res.json({
    id: row.id,
    toAddress: row.toAddress,
    fromAddress: row.fromAddress,
    subject: row.subject,
    preview: row.preview,
    textBody: row.textBody,
    htmlBody: row.htmlBody,
    hasAttachments: row.hasAttachments,
    receivedAt: row.receivedAt.toISOString(),
  });
});

router.delete("/v1/inboxes/:address/emails/:id", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const r = await loadOwnedInbox(address, ownerId(req));
  if (r.status === 404) { res.status(404).json({ error: "Inbox not found" }); return; }

  const result = await db
    .delete(emailsTable)
    .where(and(eq(emailsTable.id, id), eq(emailsTable.toAddress, address)))
    .returning({ id: emailsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Email not found" }); return; }
  res.status(204).end();
});

// Helpers shared by both code-lookup endpoints.
const MAX_PATTERN_LEN = 200;
function parseIntInRange(value: unknown, def: number, min: number, max: number): number | null {
  if (value === undefined) return def;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}
function readPattern(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  if (value.length === 0) return undefined;
  if (value.length > MAX_PATTERN_LEN) return null;
  return value;
}

// GET /v1/inboxes/:address/latest-code?lookback=10&pattern=
// Synchronously scans the most recent N emails of an inbox and returns the
// best-guess verification code. 404 if no code found.
router.get("/v1/inboxes/:address/latest-code", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const r = await loadOwnedInbox(address, ownerId(req));
  if (r.status === 404) { res.status(404).json({ error: "Inbox not found" }); return; }

  const lookback = parseIntInRange(req.query["lookback"], 10, 1, 50);
  if (lookback === null) { res.status(400).json({ error: "Invalid `lookback` (1–50)" }); return; }
  const pattern = readPattern(req.query["pattern"]);
  if (pattern === null) { res.status(400).json({ error: `Invalid \`pattern\` (max ${MAX_PATTERN_LEN} chars)` }); return; }

  const rows = await db
    .select({
      id: emailsTable.id,
      subject: emailsTable.subject,
      fromAddress: emailsTable.fromAddress,
      textBody: emailsTable.textBody,
      htmlBody: emailsTable.htmlBody,
      receivedAt: emailsTable.receivedAt,
    })
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address))
    .orderBy(desc(emailsTable.receivedAt))
    .limit(lookback);

  for (const row of rows) {
    const found = extractCodeFromEmail(row, pattern);
    if (found) {
      res.json({
        code: found.code,
        source: found.source,
        emailId: row.id,
        fromAddress: row.fromAddress,
        subject: row.subject,
        receivedAt: row.receivedAt.toISOString(),
      });
      return;
    }
  }
  res.status(404).json({ error: "No verification code found", scanned: rows.length });
});

// GET /v1/inboxes/:address/wait-for-code?timeout=30&since=<iso>&pattern=
// Long-polls (max 60s) until a new email containing a verification code
// arrives. `since` (ISO timestamp) ignores emails older than that — clients
// should pass the time they sent the signup request.
const MAX_WAIT_MS = 60_000;
router.get("/v1/inboxes/:address/wait-for-code", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const r = await loadOwnedInbox(address, ownerId(req));
  if (r.status === 404) { res.status(404).json({ error: "Inbox not found" }); return; }

  const timeoutSec = parseIntInRange(req.query["timeout"], 30, 1, 60);
  if (timeoutSec === null) { res.status(400).json({ error: "Invalid `timeout` (1–60 seconds)" }); return; }
  const timeoutMs = timeoutSec * 1000;
  const pattern = readPattern(req.query["pattern"]);
  if (pattern === null) { res.status(400).json({ error: `Invalid \`pattern\` (max ${MAX_PATTERN_LEN} chars)` }); return; }
  const sinceParam = typeof req.query["since"] === "string" ? req.query["since"] : null;
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 5 * 60_000);
  if (Number.isNaN(since.getTime())) { res.status(400).json({ error: "Invalid `since` timestamp" }); return; }

  // Fast path: a matching code is already sitting in the inbox.
  const existing = await scanForCode(address, since, pattern);
  if (existing) { res.json(existing); return; }

  // Slow path: subscribe to the inbox event bus and resolve when a matching
  // email arrives, or timeout.
  const aborted = { value: false };
  const result = await new Promise<Awaited<ReturnType<typeof scanForCode>> | null>(
    (resolve) => {
      let settled = false;
      let scanInFlight = false;
      let pendingScan = false;
      const runScan = async (ev: EmailEvent) => {
        if (settled) return;
        if (scanInFlight) { pendingScan = true; return; }
        scanInFlight = true;
        try {
          const found = await scanForCode(address, since, pattern, ev.emailId);
          if (settled) return;
          if (found) { settled = true; cleanup(); resolve(found); return; }
        } finally {
          scanInFlight = false;
        }
        if (pendingScan && !settled) {
          pendingScan = false;
          // Coalesce: re-scan once more without a specific id to catch any
          // events that arrived during the previous query.
          await runScan(ev);
        }
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(null);
      }, timeoutMs);
      function cleanup() {
        clearTimeout(timer);
        emailBus.off(address, runScan);
        req.off("close", onClose);
      }
      const onClose = () => {
        if (settled) return;
        settled = true;
        aborted.value = true;
        cleanup();
        resolve(null);
      };
      emailBus.on(address, runScan);
      req.on("close", onClose);
    },
  );

  // Client may have hung up — don't try to write to a closed socket.
  if (aborted.value || res.writableEnded) return;
  if (!result) { res.status(408).json({ error: "Timed out waiting for code" }); return; }
  res.json(result);
});

async function scanForCode(
  address: string,
  since: Date,
  pattern: string | undefined,
  preferEmailId?: number,
) {
  const rows = await db
    .select({
      id: emailsTable.id,
      subject: emailsTable.subject,
      fromAddress: emailsTable.fromAddress,
      textBody: emailsTable.textBody,
      htmlBody: emailsTable.htmlBody,
      receivedAt: emailsTable.receivedAt,
    })
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address))
    .orderBy(desc(emailsTable.receivedAt))
    .limit(20);
  const recent = rows.filter((r) => r.receivedAt.getTime() >= since.getTime());
  // If we got here from a notification, prefer that specific email first.
  const ordered = preferEmailId
    ? [...recent].sort((a, b) => (a.id === preferEmailId ? -1 : b.id === preferEmailId ? 1 : 0))
    : recent;
  for (const row of ordered) {
    const found = extractCodeFromEmail(row, pattern);
    if (found) {
      return {
        code: found.code,
        source: found.source,
        emailId: row.id,
        fromAddress: row.fromAddress,
        subject: row.subject,
        receivedAt: row.receivedAt.toISOString(),
      };
    }
  }
  return null;
}

router.get("/v1/domains", async (req, res) => {
  const u = ownerUserId(req);
  const rows = await db
    .select({
      name: domainsTable.name,
      status: domainsTable.status,
      isPublic: domainsTable.isPublic,
      userId: domainsTable.userId,
    })
    .from(domainsTable)
    .where(eq(domainsTable.status, "active"));
  // Hide private custom domains from other tenants — only the verified owner
  // can see (and use) them.
  const visible = rows
    .filter((d) => d.isPublic || (u !== null && d.userId === u))
    .map(({ userId: _userId, ...rest }) => rest);
  res.json(visible);
});

function serializeInbox(row: typeof inboxesTable.$inferSelect) {
  return {
    address: row.address,
    token: row.token,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export default router;
