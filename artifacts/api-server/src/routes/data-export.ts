import { Router, type IRouter } from "express";
import { db, usersTable, inboxesTable, emailsTable, domainsTable, apiKeysTable, auditLogsTable, webhooksTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { attachUser, requireUser, type AuthedRequest } from "../middlewares/clerk-auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.use("/account/export", attachUser);

router.get("/account/export", requireUser, async (req, res) => {
  const r = req as AuthedRequest;
  const userId = r.userId!;

  const [
    [user],
    inboxes,
    emails,
    domains,
    apiKeys,
    webhooks,
    auditLogs,
  ] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select({
      id: inboxesTable.id,
      address: inboxesTable.address,
      createdAt: inboxesTable.createdAt,
      expiresAt: inboxesTable.expiresAt,
    }).from(inboxesTable).where(eq(inboxesTable.ownerUserId, userId)).orderBy(desc(inboxesTable.createdAt)),
    db.select({
      id: emailsTable.id,
      toAddress: emailsTable.toAddress,
      fromAddress: emailsTable.fromAddress,
      subject: emailsTable.subject,
      preview: emailsTable.preview,
      receivedAt: emailsTable.receivedAt,
    }).from(emailsTable)
      .where(sql`${emailsTable.toAddress} IN (SELECT address FROM inboxes WHERE owner_user_id = ${userId})`)
      .orderBy(desc(emailsTable.receivedAt))
      .limit(1000),
    db.select({
      id: domainsTable.id,
      name: domainsTable.name,
      status: domainsTable.status,
      createdAt: domainsTable.createdAt,
    }).from(domainsTable).where(eq(domainsTable.userId, userId)),
    db.select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      prefix: apiKeysTable.prefix,
      createdAt: apiKeysTable.createdAt,
      revokedAt: apiKeysTable.revokedAt,
    }).from(apiKeysTable).where(eq(apiKeysTable.userId, userId)),
    db.select({
      id: webhooksTable.id,
      url: webhooksTable.url,
      events: webhooksTable.events,
      isActive: webhooksTable.isActive,
      createdAt: webhooksTable.createdAt,
    }).from(webhooksTable).where(eq(webhooksTable.userId, userId)),
    db.select({
      id: auditLogsTable.id,
      action: auditLogsTable.action,
      targetType: auditLogsTable.targetType,
      targetId: auditLogsTable.targetId,
      createdAt: auditLogsTable.createdAt,
    }).from(auditLogsTable).where(eq(auditLogsTable.actorId, userId)).orderBy(desc(auditLogsTable.createdAt)).limit(200),
  ]);

  await logAudit({ action: "account.data_export", actorId: userId, targetType: "user", targetId: userId, req });

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: user ? {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    } : null,
    inboxes: inboxes.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString() })),
    emails: emails.map((e) => ({ ...e, receivedAt: e.receivedAt.toISOString() })),
    domains: domains.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
    apiKeys: apiKeys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), revokedAt: k.revokedAt?.toISOString() ?? null })),
    webhooks: webhooks.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() })),
    auditLog: auditLogs.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="tempmail-data-export-${userId.slice(0, 8)}.json"`);
  res.json(exportData);
});

export default router;
