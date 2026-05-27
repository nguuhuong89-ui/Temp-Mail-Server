import { Router, type IRouter } from "express";
import { db, apiKeysTable, inboxesTable, domainsTable, emailsTable, usersTable, auditLogsTable, savedInboxesTable } from "@workspace/db";
import { and, eq, desc, sql, isNull } from "drizzle-orm";
import { generateApiKey } from "../lib/api-key-auth";
import { verifyDomainMx } from "../lib/domain-verify";
import { invalidateDomainCache } from "../lib/domain-cache";
import { attachUser, requireUser, requirePro, type AuthedRequest } from "../middlewares/session-auth";

const router: IRouter = Router();

router.use("/account", attachUser);

router.get("/account/me", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const [u] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, r.userId!))
    .limit(1);
  res.json({
    id: r.userId,
    plan: r.userPlan,
    role: r.userRole,
    email: u?.email ?? null,
    displayName: u?.displayName ?? null,
    avatarUrl: u?.avatarUrl ?? null,
    lastLoginAt: u?.lastLoginAt?.toISOString() ?? null,
    createdAt: u?.createdAt?.toISOString() ?? null,
  });
});

router.patch("/account/me", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const { displayName, avatarUrl } = req.body ?? {};
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof displayName === "string") patch["displayName"] = displayName.trim().slice(0, 100) || null;
  if (typeof avatarUrl === "string") patch["avatarUrl"] = avatarUrl.trim().slice(0, 500) || null;
  if (Object.keys(patch).length === 1) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [row] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, r.userId!))
    .returning();
  if (!row) { res.status(404).json({ error: "User not found" }); return; }
  res.json({
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.delete("/account/me", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const [row] = await db
    .update(usersTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(usersTable.id, r.userId!), isNull(usersTable.deletedAt)))
    .returning();
  if (!row) { res.status(404).json({ error: "User not found or already deleted" }); return; }
  await db.insert(auditLogsTable).values({
    action: "account.self_delete",
    actorId: r.userId!,
    targetType: "user",
    targetId: r.userId!,
    ipAddress: req.ip ?? null,
  });
  res.json({ ok: true, deletedAt: row.deletedAt?.toISOString() });
});

// === Usage stats ===
router.get("/account/usage", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const [[inboxRow], [emailRow], [domainRow], [apiKeyRow]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(inboxesTable).where(eq(inboxesTable.ownerUserId, r.userId!)),
    db.select({ count: sql<number>`count(*)::int` }).from(emailsTable)
      .where(sql`${emailsTable.toAddress} IN (SELECT address FROM inboxes WHERE owner_user_id = ${r.userId})`),
    db.select({ count: sql<number>`count(*)::int` }).from(domainsTable).where(eq(domainsTable.userId, r.userId!)),
    db.select({ count: sql<number>`count(*)::int` }).from(apiKeysTable).where(eq(apiKeysTable.userId, r.userId!)),
  ]);
  res.json({
    inboxCount: Number(inboxRow?.count ?? 0),
    emailCount: Number(emailRow?.count ?? 0),
    domainCount: Number(domainRow?.count ?? 0),
    apiKeyCount: Number(apiKeyRow?.count ?? 0),
  });
});

// === API keys (requires Pro) ===
router.get("/account/api-keys", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const rows = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, r.userId!))
    .orderBy(desc(apiKeysTable.createdAt));
  res.json(
    rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
    })),
  );
});

router.post("/account/api-keys", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const name = String(req.body?.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const { plaintext, prefix, keyHash } = generateApiKey();
  const [row] = await db
    .insert(apiKeysTable)
    .values({ name, prefix, keyHash, userId: r.userId! })
    .returning();
  if (!row) { res.status(500).json({ error: "Failed to create key" }); return; }
  res.status(201).json({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    plaintext,
    createdAt: row.createdAt.toISOString(),
  });
});

router.post("/account/api-keys/:id/revoke", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [row] = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, r.userId!)))
    .returning();
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json({ ok: true });
});

router.delete("/account/api-keys/:id", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "invalid id" }); return; }
  await db
    .delete(apiKeysTable)
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, r.userId!)));
  res.status(204).end();
});

// === Inbox history (any signed-in user) ===
router.get("/account/inboxes", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const rows = await db
    .select({
      id: inboxesTable.id,
      address: inboxesTable.address,
      token: inboxesTable.token,
      createdAt: inboxesTable.createdAt,
      expiresAt: inboxesTable.expiresAt,
      emailCount: sql<number>`count(${emailsTable.id})::int`,
    })
    .from(inboxesTable)
    .leftJoin(emailsTable, eq(emailsTable.toAddress, inboxesTable.address))
    .where(eq(inboxesTable.ownerUserId, r.userId!))
    .groupBy(inboxesTable.id)
    .orderBy(desc(inboxesTable.createdAt))
    .limit(200);
  res.json(
    rows.map((i) => ({
      id: i.id,
      address: i.address,
      token: i.token,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      emailCount: Number(i.emailCount ?? 0),
    })),
  );
});

router.delete("/account/inboxes/:address", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const address = String(req.params["address"]).toLowerCase();
  const [inbox] = await db
    .select()
    .from(inboxesTable)
    .where(eq(inboxesTable.address, address))
    .limit(1);
  if (!inbox || inbox.ownerUserId !== r.userId) {
    res.status(404).json({ error: "Inbox not found" });
    return;
  }
  await db.delete(emailsTable).where(eq(emailsTable.toAddress, address));
  await db.delete(inboxesTable).where(eq(inboxesTable.address, address));
  res.status(204).end();
});

// === Saved inboxes (persistent, server-side) ===
router.get("/account/saved-inboxes", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const rows = await db
    .select({
      id: savedInboxesTable.id,
      address: savedInboxesTable.address,
      label: savedInboxesTable.label,
      savedAt: savedInboxesTable.createdAt,
      inboxCreatedAt: inboxesTable.createdAt,
      emailCount: sql<number>`count(${emailsTable.id})::int`,
      lastEmailAt: sql<string | null>`max(${emailsTable.receivedAt})::text`,
    })
    .from(savedInboxesTable)
    .leftJoin(inboxesTable, eq(inboxesTable.address, savedInboxesTable.address))
    .leftJoin(emailsTable, eq(emailsTable.toAddress, savedInboxesTable.address))
    .where(eq(savedInboxesTable.userId, r.userId!))
    .groupBy(savedInboxesTable.id, inboxesTable.createdAt)
    .orderBy(desc(savedInboxesTable.createdAt))
    .limit(100);
  res.json(
    rows.map((r) => ({
      id: r.id,
      address: r.address,
      label: r.label,
      savedAt: r.savedAt.toISOString(),
      inboxCreatedAt: r.inboxCreatedAt?.toISOString() ?? null,
      emailCount: Number(r.emailCount ?? 0),
      lastEmailAt: r.lastEmailAt ?? null,
    })),
  );
});

router.post("/account/saved-inboxes", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const { address, label } = req.body ?? {};
  if (typeof address !== "string" || !address.includes("@")) {
    res.status(400).json({ error: "Valid address required" });
    return;
  }
  const trimLabel = typeof label === "string" ? label.trim().slice(0, 100) || null : null;
  try {
    const [row] = await db
      .insert(savedInboxesTable)
      .values({ userId: r.userId!, address: address.toLowerCase(), label: trimLabel })
      .returning();
    if (!row) { res.status(500).json({ error: "Insert failed" }); return; }
    res.status(201).json({
      id: row.id,
      address: row.address,
      label: row.label,
      savedAt: row.createdAt.toISOString(),
    });
  } catch {
    res.status(409).json({ error: "Already saved" });
  }
});

router.patch("/account/saved-inboxes/:id", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { label } = req.body ?? {};
  if (typeof label !== "string") { res.status(400).json({ error: "label required" }); return; }
  const [row] = await db
    .update(savedInboxesTable)
    .set({ label: label.trim().slice(0, 100) || null })
    .where(and(eq(savedInboxesTable.id, id), eq(savedInboxesTable.userId, r.userId!)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: row.id, address: row.address, label: row.label });
});

router.delete("/account/saved-inboxes/:id", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db
    .delete(savedInboxesTable)
    .where(and(eq(savedInboxesTable.id, id), eq(savedInboxesTable.userId, r.userId!)))
    .returning({ id: savedInboxesTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

// === Custom domains (requires Pro) ===
const MAIL_HOST = process.env["MAIL_DOMAIN"] || "mail.vnsi.app";

router.get("/account/domains", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const rows = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.userId, r.userId!))
    .orderBy(desc(domainsTable.createdAt));

  let serverIp: string = process.env["SERVER_IP"] ?? "";
  if (!serverIp) {
    const { networkInterfaces } = await import("node:os");
    const nets = networkInterfaces();
    for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces ?? []) {
        if (iface.family === "IPv4" && !iface.internal) {
          const ip = iface.address;
          if (!ip.startsWith("172.") && !ip.startsWith("10.") && !ip.startsWith("192.168.")) {
            serverIp = ip;
            break;
          }
          if (!serverIp) serverIp = ip;
        }
      }
      if (serverIp && !serverIp.startsWith("172.") && !serverIp.startsWith("10.")) break;
    }
  }

  res.json({
    domains: rows.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      mxHost: MAIL_HOST,
      createdAt: d.createdAt.toISOString(),
    })),
    serverIp: serverIp || null,
    mailDomain: MAIL_HOST,
  });
});

router.post("/account/domains", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const name = String(req.body?.name ?? "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) {
    res.status(400).json({ error: "Invalid domain name" });
    return;
  }
  try {
    const [row] = await db
      .insert(domainsTable)
      .values({
        name,
        userId: r.userId!,
        status: "pending",
        isPublic: false,
      })
      .returning();
    if (!row) { res.status(500).json({ error: "Insert failed" }); return; }
    res.status(201).json({
      id: row.id,
      name: row.name,
      status: row.status,
      mxHost: MAIL_HOST,
      verifiedAt: null,
      createdAt: row.createdAt.toISOString(),
    });
  } catch {
    res.status(409).json({ error: "Domain already exists" });
  }
});

router.post("/account/domains/:id/verify", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(and(eq(domainsTable.id, id), eq(domainsTable.userId, r.userId!)))
    .limit(1);
  if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

  const result = await verifyDomainMx(domain.name, MAIL_HOST);
  if (!result.ok) {
    res.status(400).json({
      ok: false,
      error: `MX record not found. Please add an MX record pointing to ${MAIL_HOST} and wait for DNS propagation.`,
      expectedMx: MAIL_HOST,
      foundRecords: result.records,
      dnsError: result.error,
    });
    return;
  }
  await db
    .update(domainsTable)
    .set({ status: "active", verifiedAt: new Date() })
    .where(eq(domainsTable.id, id));
  invalidateDomainCache();
  res.json({ ok: true, verifiedAt: new Date().toISOString() });
});

router.delete("/account/domains/:id", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const result = await db
    .delete(domainsTable)
    .where(and(eq(domainsTable.id, id), eq(domainsTable.userId, r.userId!)))
    .returning({ id: domainsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Domain not found" }); return; }
  invalidateDomainCache();
  res.status(204).end();
});

export default router;
