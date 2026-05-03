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
