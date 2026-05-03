import { Router, type IRouter } from "express";
import { db, apiKeysTable, inboxesTable, domainsTable, emailsTable, usersTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { generateApiKey } from "../lib/api-key-auth";
import { generateDomainToken, verifyDomainTxt, verifyRecordValue } from "../lib/domain-verify";
import { invalidateDomainCache } from "../lib/domain-cache";
import { attachUser, requireUser, requirePro, type AuthedRequest } from "../middlewares/clerk-auth";

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
    createdAt: u?.createdAt?.toISOString() ?? null,
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

// === Custom domains (requires Pro) ===
router.get("/account/domains", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const rows = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.userId, r.userId!))
    .orderBy(desc(domainsTable.createdAt));
  res.json(
    rows.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      verificationToken: d.verificationToken,
      verificationRecord: d.verificationToken ? verifyRecordValue(d.verificationToken) : null,
      createdAt: d.createdAt.toISOString(),
    })),
  );
});

router.post("/account/domains", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const name = String(req.body?.name ?? "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) {
    res.status(400).json({ error: "Invalid domain name" });
    return;
  }
  const token = generateDomainToken();
  try {
    const [row] = await db
      .insert(domainsTable)
      .values({
        name,
        userId: r.userId!,
        status: "pending",
        isPublic: false,
        verificationToken: token,
      })
      .returning();
    if (!row) { res.status(500).json({ error: "Insert failed" }); return; }
    res.status(201).json({
      id: row.id,
      name: row.name,
      status: row.status,
      verificationToken: row.verificationToken,
      verificationRecord: verifyRecordValue(token),
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
  if (!domain.verificationToken) { res.status(400).json({ error: "No verification token" }); return; }

  const result = await verifyDomainTxt(domain.name, domain.verificationToken);
  if (!result.ok) {
    res.status(400).json({
      ok: false,
      error: "TXT record not found. Please add the verification record and wait for DNS propagation.",
      expected: verifyRecordValue(domain.verificationToken),
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
