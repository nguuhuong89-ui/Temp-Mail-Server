import { Router, type IRouter, type Request, type Response } from "express";
import { db, inboxesTable, emailsTable, domainsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  generateLocalPart,
  generateToken,
  defaultExpiry,
  isValidLocalPart,
} from "../lib/inbox-utils";
import { emailBus, type EmailEvent } from "../lib/events";
import { ensureDefaultDomain, lookupDomain } from "../lib/domain-cache";

const router: IRouter = Router();

router.post("/inbox/random", async (_req, res) => {
  const domain = await ensureDefaultDomain(process.env["MAIL_DOMAIN"] ?? "tempmail.local");
  for (let attempt = 0; attempt < 5; attempt++) {
    const local = generateLocalPart();
    const address = `${local}@${domain}`.toLowerCase();
    const token = generateToken();
    const expiresAt = defaultExpiry();
    try {
      const [row] = await db
        .insert(inboxesTable)
        .values({ address, token, expiresAt })
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
  void lookupDomain;
  const address = `${localPart}@${domain.name}`.toLowerCase();
  const token = generateToken();
  const expiresAt = defaultExpiry();
  try {
    const [row] = await db
      .insert(inboxesTable)
      .values({ address, token, expiresAt })
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

router.delete("/inbox/:address", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
  await db.delete(emailsTable).where(eq(emailsTable.toAddress, address));
  await db.delete(inboxesTable).where(eq(inboxesTable.address, address));
  res.status(204).end();
});

router.post("/inbox/:address/refresh", async (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
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

router.get("/inbox/:address/stream", (req, res) => {
  const address = String(req.params["address"]).toLowerCase();
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

  emailBus.on(address, onEvent);
  req.on("close", () => {
    clearInterval(heartbeat);
    emailBus.off(address, onEvent);
  });
});

export default router;
