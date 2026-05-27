import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { db, usersTable, apiKeysTable, inboxesTable, domainsTable, emailsTable, auditLogsTable } from "@workspace/db";
import { eq, sql, desc, inArray, isNull } from "drizzle-orm";
import { invalidateUserCache } from "../middlewares/session-auth";
import { invalidateDomainCache } from "../lib/domain-cache";
import { logAudit } from "../lib/audit";
import { type AuthedRequest, ROLES } from "../middlewares/session-auth";

const router: IRouter = Router();

router.get("/users", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        plan: usersTable.plan,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
        apiKeyCount: sql<number>`(select count(*) from ${apiKeysTable} where ${apiKeysTable.userId} = ${usersTable.id})::int`,
        inboxCount: sql<number>`(select count(*) from ${inboxesTable} where ${inboxesTable.ownerUserId} = ${usersTable.id})::int`,
        domainCount: sql<number>`(select count(*) from ${domainsTable} where ${domainsTable.userId} = ${usersTable.id})::int`,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    res.json(
      rows.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        apiKeyCount: Number(u.apiKeyCount ?? 0),
        inboxCount: Number(u.inboxCount ?? 0),
        domainCount: Number(u.domainCount ?? 0),
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to fetch users", detail: message });
  }
});

router.patch("/users/:id", async (req, res) => {
  const r = req as AuthedRequest;
  const id = String(req.params["id"]);
  const { plan, role } = req.body ?? {};
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (plan === "free" || plan === "pro") patch["plan"] = plan;
  if (typeof role === "string" && (ROLES as readonly string[]).includes(role)) patch["role"] = role;
  if (Object.keys(patch).length === 1) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  // Invariant: admin/super_admin role always implies pro plan.
  if (patch["role"] === "admin" || patch["role"] === "super_admin") patch["plan"] = "pro";
  // If demoting an admin to user without specifying plan, leave plan as-is.
  const [row] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "User not found" }); return; }
  invalidateUserCache(id);
  if (patch["plan"] === "free") invalidateDomainCache();
  await logAudit({ action: "user.update", actorId: r.userId ?? "admin", targetType: "user", targetId: id, metadata: { plan: row.plan, role: row.role }, req });
  res.json({
    id: row.id,
    displayName: row.displayName,
    plan: row.plan,
    role: row.role,
    updatedAt: row.updatedAt.toISOString(),
  });
});

// POST /users/sync — refresh user list (no-op, kept for API compatibility)
router.post("/users/sync", async (_req, res) => {
  const rows = await db.select({ id: usersTable.id }).from(usersTable);
  res.json({ total: rows.length });
});

// POST /users/promote — set role=admin (and plan=pro) by user ID
router.post("/users/promote", async (req, res) => {
  const { userId, role } = req.body ?? {};
  if (typeof userId !== "string" || !userId) {
    res.status(400).json({ error: "userId required" }); return;
  }
  const targetRole = role === "user" ? "user" : "admin";
  const targetPlan = targetRole === "admin" ? "pro" : "free";

  const [row] = await db
    .update(usersTable)
    .set({ role: targetRole, plan: targetPlan, updatedAt: new Date() })
    .where(eq(usersTable.id, userId.trim()))
    .returning();

  if (!row) {
    res.status(404).json({ error: "User not found" }); return;
  }
  invalidateUserCache(row.id);
  if (targetPlan === "free") invalidateDomainCache();
  res.json({ ok: true, id: row.id, role: targetRole, plan: targetPlan });
});

// DELETE /users/:id — remove user + all their data
router.delete("/users/:id", async (req, res) => {
  const r = req as AuthedRequest;
  const id = String(req.params["id"]);

  // Get all inboxes owned by this user
  const ownedInboxes = await db
    .select({ address: inboxesTable.address })
    .from(inboxesTable)
    .where(eq(inboxesTable.ownerUserId, id));
  const addresses = ownedInboxes.map((r) => r.address);

  // Cascade delete
  if (addresses.length > 0) {
    await db.delete(emailsTable).where(inArray(emailsTable.toAddress, addresses));
    await db.delete(inboxesTable).where(eq(inboxesTable.ownerUserId, id));
  }
  await db.delete(apiKeysTable).where(eq(apiKeysTable.userId, id));
  await db.delete(domainsTable).where(eq(domainsTable.userId, id));
  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();

  if (!deleted) { res.status(404).json({ error: "User not found" }); return; }
  invalidateUserCache(id);
  invalidateDomainCache();
  await logAudit({ action: "user.delete", actorId: r.userId ?? "admin", targetType: "user", targetId: id, metadata: { deletedUserId: deleted.id, displayName: deleted.displayName }, req });
  res.json({ ok: true, deleted: id });
});

// GET /users/:id/detail — full user detail view for admin
router.get("/users/:id/detail", async (req, res) => {
  const id = String(req.params["id"]);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [userInboxes, userDomains, userApiKeys, recentEmails, recentAudit] = await Promise.all([
    db
      .select({
        id: inboxesTable.id,
        address: inboxesTable.address,
        createdAt: inboxesTable.createdAt,
        expiresAt: inboxesTable.expiresAt,
        emailCount: sql<number>`(SELECT count(*)::int FROM emails WHERE to_address = ${inboxesTable.address})`,
      })
      .from(inboxesTable)
      .where(eq(inboxesTable.ownerUserId, id))
      .orderBy(desc(inboxesTable.createdAt))
      .limit(50),
    db
      .select({
        id: domainsTable.id,
        name: domainsTable.name,
        status: domainsTable.status,
        createdAt: domainsTable.createdAt,
      })
      .from(domainsTable)
      .where(eq(domainsTable.userId, id))
      .orderBy(desc(domainsTable.createdAt)),
    db
      .select({
        id: apiKeysTable.id,
        name: apiKeysTable.name,
        prefix: apiKeysTable.prefix,
        createdAt: apiKeysTable.createdAt,
        lastUsedAt: apiKeysTable.lastUsedAt,
        revokedAt: apiKeysTable.revokedAt,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, id))
      .orderBy(desc(apiKeysTable.createdAt)),
    db
      .select({
        id: emailsTable.id,
        toAddress: emailsTable.toAddress,
        fromAddress: emailsTable.fromAddress,
        subject: emailsTable.subject,
        receivedAt: emailsTable.receivedAt,
      })
      .from(emailsTable)
      .where(sql`${emailsTable.toAddress} IN (SELECT address FROM inboxes WHERE owner_user_id = ${id})`)
      .orderBy(desc(emailsTable.receivedAt))
      .limit(20),
    db
      .select({
        id: auditLogsTable.id,
        action: auditLogsTable.action,
        targetType: auditLogsTable.targetType,
        targetId: auditLogsTable.targetId,
        createdAt: auditLogsTable.createdAt,
      })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.actorId, id))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(20),
  ]);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      role: user.role,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      deletedAt: user.deletedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    inboxes: userInboxes.map((i) => ({
      ...i,
      emailCount: Number(i.emailCount ?? 0),
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    })),
    domains: userDomains.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
    apiKeys: userApiKeys.map((k) => ({
      ...k,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
    })),
    recentEmails: recentEmails.map((e) => ({
      ...e,
      receivedAt: e.receivedAt.toISOString(),
    })),
    recentAudit: recentAudit.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

// POST /users/generate-codes — assign auth_code to existing users who don't have one
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 20;

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

function formatCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}`;
}

router.post("/users/generate-codes", async (req, res) => {
  const r = req as AuthedRequest;
  const usersWithoutCode = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(isNull(usersTable.authCode));

  if (usersWithoutCode.length === 0) {
    res.json({ ok: true, generated: 0, users: [] });
    return;
  }

  const results: Array<{ id: string; code: string }> = [];
  for (const user of usersWithoutCode) {
    const code = generateCode();
    await db.update(usersTable).set({ authCode: code }).where(eq(usersTable.id, user.id));
    results.push({ id: user.id, code: formatCode(code) });
  }

  await logAudit({
    action: "admin.generate_codes",
    actorId: r.userId ?? "admin",
    targetType: "bulk",
    targetId: String(results.length),
    metadata: { count: results.length },
    req,
  });

  res.json({ ok: true, generated: results.length, users: results });
});

export default router;
