import { Router, type IRouter, type Request, type Response } from "express";
import { db, inboxesTable, emailsTable, domainsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  generateLocalPart,
  generateToken,
  defaultExpiry,
  isValidLocalPart,
} from "../lib/inbox-utils";
import { emailBus, type EmailEvent } from "../lib/events";
import { ensureDefaultDomain, lookupDomain } from "../lib/domain-cache";

const router: IRouter = Router();

router.post("/inbox/random", async (req, res) => {
  const userId = (req as Request & { userId?: string }).userId ?? null;
  const rawDomainId = req.body?.domainId;
  if (rawDomainId !== undefined && rawDomainId !== null) {
    if (typeof rawDomainId !== "number" || !Number.isInteger(rawDomainId)) {
      res.status(400).json({ error: "domainId must be an integer" });
      return;
    }
  }
  const requestedDomainId =
    typeof rawDomainId === "number" && Number.isInteger(rawDomainId) ? rawDomainId : null;
  let domain: string;
  if (requestedDomainId !== null) {
    const [row] = await db
      .select()
      .from(domainsTable)
      .where(eq(domainsTable.id, requestedDomainId))
      .limit(1);
    if (!row || row.status !== "active" || !row.isPublic) {
      res.status(400).json({ error: "Domain not available" });
      return;
    }
    domain = row.name;
  } else {
    domain = await ensureDefaultDomain(process.env["MAIL_DOMAIN"] ?? "tempmail.local");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const local = generateLocalPart();
    const address = `${local}@${domain}`.toLowerCase();
    const token = generateToken();
    const expiresAt = defaultExpiry();
    try {
      const [row] = await db
        .insert(inboxesTable)
        .values({ address, token, expiresAt, ownerUserId: userId })
        .returning();
      if (!row) continue;
      res.json({
        address: row.address,
        token: row.token,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      });
      return;
    } catch {
      // collision, retry
    }
  }
  res.status(500).json({ error: "Could not allocate address" });
});

router.post("/inbox/custom", async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: string }).userId ?? null;
  const { localPart, domainId } = req.body ?? {};
  if (typeof localPart !== "string" || !isValidLocalPart(localPart)) {
    res.status(400).json({ error: "Invalid local part" });
    return;
  }
  if (typeof domainId !== "number") {
    res.status(400).json({ error: "domainId required" });
    return;
  }
  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.id, domainId))
    .limit(1);
  if (!domain) {
    res.status(400).json({ error: "Unknown domain" });
    return;
  }
  if (domain.status !== "active") {
    res.status(400).json({ error: "Domain not active" });
    return;
  }
  // Private (custom) domains may only be used by their owner.
  if (!domain.isPublic && (!userId || domain.userId !== userId)) {
    res.status(403).json({ error: "Domain not available" });
    return;
  }
  void lookupDomain;
  const address = `${localPart}@${domain.name}`.toLowerCase();
  const token = generateToken();
  const expiresAt = defaultExpiry();
  try {
    const [row] = await db
      .insert(inboxesTable)
      .values({ address, token, expiresAt, ownerUserId: userId })
      .returning();
    if (!row) {
      res.status(500).json({ error: "Insert failed" });
      return;
    }
    res.json({
      address: row.address,
      token: row.token,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    });
  } catch {
    res.status(409).json({ error: "Address already taken" });
  }
});

router.get("/inbox/:address", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  let [inbox] = await db
    .select()
    .from(inboxesTable)
    .where(eq(inboxesTable.address, address))
    .limit(1);
  if (inbox) {
    const userId = (req as Request & { userId?: string }).userId ?? null;
    if (inbox.ownerApiKeyId !== null) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }
    if (inbox.ownerUserId !== null && inbox.ownerUserId !== userId) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }
  }
  if (!inbox) {
    // Allow viewing addresses that received mail but were never explicitly created
    const anyMail = await db
      .select({ id: emailsTable.id })
      .from(emailsTable)
      .where(eq(emailsTable.toAddress, address))
      .limit(1);
    if (anyMail.length === 0) {
      res.status(404).json({ error: "Inbox not found" });
      return;
    }
    const [created] = await db
      .insert(inboxesTable)
      .values({
        address,
        token: generateToken(),
        expiresAt: defaultExpiry(),
      })
      .onConflictDoNothing()
      .returning();
    inbox = created!;
  }
  const emails = await db
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
    .limit(100);
  res.json({
    address: inbox.address,
    createdAt: inbox.createdAt.toISOString(),
    expiresAt: inbox.expiresAt.toISOString(),
    emails: emails.map((e) => ({
      id: e.id,
      toAddress: e.toAddress,
      fromAddress: e.fromAddress,
      subject: e.subject,
      preview: e.preview,
      hasAttachments: e.hasAttachments,
      receivedAt: e.receivedAt.toISOString(),
    })),
  });
});

/**
 * Returns true if the inbox exists AND is owned by someone other than the
 * currently signed-in user (either an API key, or a different account user).
 * Public inbox routes use this to short-circuit with 404 — no existence oracle.
 */
async function isOwnedByOther(req: Request, address: string): Promise<boolean> {
  const [row] = await db
    .select({
      apiKeyOwner: inboxesTable.ownerApiKeyId,
      userOwner: inboxesTable.ownerUserId,
    })
    .from(inboxesTable)
    .where(eq(inboxesTable.address, address))
    .limit(1);
  if (!row) return false;
  if (row.apiKeyOwner !== null) return true;
  if (row.userOwner !== null) {
    const userId = (req as Request & { userId?: string }).userId ?? null;
    if (row.userOwner !== userId) return true;
  }
  return false;
}

router.delete("/inbox/:address", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  if (await isOwnedByOther(req, address)) {
    res.status(404).json({ error: "Inbox not found" });
    return;
  }
  await db.delete(emailsTable).where(eq(emailsTable.toAddress, address));
  await db.delete(inboxesTable).where(eq(inboxesTable.address, address));
  res.status(204).end();
});

router.delete("/inbox/:address/emails", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  if (await isOwnedByOther(req, address)) {
    res.status(404).json({ error: "Inbox not found" });
    return;
  }
  const result = await db
    .delete(emailsTable)
    .where(eq(emailsTable.toAddress, address))
    .returning({ id: emailsTable.id });
  res.json({ deleted: result.length });
});

router.delete("/inbox/:address/emails/:id", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (await isOwnedByOther(req, address)) {
    res.status(404).json({ error: "Email not found" });
    return;
  }
  const result = await db
    .delete(emailsTable)
    .where(and(eq(emailsTable.id, id), eq(emailsTable.toAddress, address)))
    .returning({ id: emailsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Email not found" });
    return;
  }
  res.status(204).end();
});

router.post("/inbox/:address/refresh", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  if (await isOwnedByOther(req, address)) {
    res.status(404).json({ error: "Inbox not found" });
    return;
  }
  const newExpiry = defaultExpiry();
  const [updated] = await db
    .update(inboxesTable)
    .set({ expiresAt: newExpiry })
    .where(eq(inboxesTable.address, address))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Inbox not found" });
    return;
  }
  res.json({
    address: updated.address,
    token: updated.token,
    createdAt: updated.createdAt.toISOString(),
    expiresAt: updated.expiresAt.toISOString(),
  });
});

// Per-IP and global concurrent SSE connection caps to prevent socket/event-loop
// exhaustion via unbounded long-lived streams.
const MAX_SSE_PER_IP = Number(process.env["SSE_MAX_PER_IP"] ?? 5);
const MAX_SSE_TOTAL = Number(process.env["SSE_MAX_TOTAL"] ?? 2000);
const SSE_IDLE_TIMEOUT_MS = Number(process.env["SSE_IDLE_TIMEOUT_MS"] ?? 30 * 60 * 1000);
const sseConnectionsByIp = new Map<string, number>();
let sseTotalConnections = 0;

router.get("/inbox/:address/stream", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();

  if (await isOwnedByOther(req, address)) {
    res.status(404).json({ error: "Inbox not found" });
    return;
  }
  if (sseTotalConnections >= MAX_SSE_TOTAL) {
    res.status(503).json({ error: "Server SSE capacity reached" });
    return;
  }
  const ipCount = sseConnectionsByIp.get(ip) ?? 0;
  if (ipCount >= MAX_SSE_PER_IP) {
    res.status(429).json({ error: "Too many active streams from this client" });
    return;
  }
  sseConnectionsByIp.set(ip, ipCount + 1);
  sseTotalConnections++;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write(`: connected\n\n`);

  const onEvent = (ev: EmailEvent) => {
    res.write(`event: email\n`);
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);
  const idleTimer = setTimeout(() => {
    res.end();
  }, SSE_IDLE_TIMEOUT_MS);

  emailBus.on(address, onEvent);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    clearTimeout(idleTimer);
    emailBus.off(address, onEvent);
    const remaining = (sseConnectionsByIp.get(ip) ?? 1) - 1;
    if (remaining <= 0) sseConnectionsByIp.delete(ip);
    else sseConnectionsByIp.set(ip, remaining);
    sseTotalConnections = Math.max(0, sseTotalConnections - 1);
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
});

export default router;
