import { Router, type IRouter } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, gte, lte, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/audit-logs", async (req, res) => {
  const page = Math.max(1, Number(req.query["page"] ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query["limit"] ?? 50) || 50));
  const offset = (page - 1) * limit;
  const action = typeof req.query["action"] === "string" ? req.query["action"] : "";
  const actorId = typeof req.query["actorId"] === "string" ? req.query["actorId"] : "";
  const from = typeof req.query["from"] === "string" ? req.query["from"] : "";
  const to = typeof req.query["to"] === "string" ? req.query["to"] : "";

  const conditions: SQL[] = [];
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (actorId) conditions.push(eq(auditLogsTable.actorId, actorId));
  if (from) {
    const dt = new Date(from);
    if (!isNaN(dt.getTime())) conditions.push(gte(auditLogsTable.createdAt, dt));
  }
  if (to) {
    const dt = new Date(to);
    if (!isNaN(dt.getTime())) conditions.push(lte(auditLogsTable.createdAt, dt));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: auditLogsTable.id,
        action: auditLogsTable.action,
        actorId: auditLogsTable.actorId,
        targetType: auditLogsTable.targetType,
        targetId: auditLogsTable.targetId,
        metadata: auditLogsTable.metadata,
        ipAddress: auditLogsTable.ipAddress,
        createdAt: auditLogsTable.createdAt,
        actorDisplayName: usersTable.displayName,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.actorId, usersTable.id))
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(auditLogsTable).where(where),
  ]);

  res.json({
    total: Number(countRow?.total ?? 0),
    page,
    limit,
    logs: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorId: r.actorId,
      actorDisplayName: r.actorDisplayName ?? null,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.get("/audit-logs/actions", async (_req, res) => {
  const rows = await db
    .selectDistinct({ action: auditLogsTable.action })
    .from(auditLogsTable)
    .orderBy(auditLogsTable.action);
  res.json(rows.map((r) => r.action));
});

export default router;
