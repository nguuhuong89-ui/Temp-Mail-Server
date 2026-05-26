import { Router, type IRouter } from "express";
import { db, emailsTable } from "@workspace/db";
import { and, eq, desc, ilike, or, inArray, lt, gte, sql, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/emails", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50) || 50, 200);
  const domainIdRaw = req.query["domainId"];
  const search =
    typeof req.query["search"] === "string" ? req.query["search"] : undefined;
  const conditions: SQL[] = [];
  if (domainIdRaw !== undefined) {
    const d = Number(domainIdRaw);
    if (!Number.isNaN(d)) conditions.push(eq(emailsTable.domainId, d));
  }
  if (search) {
    const like = `%${search}%`;
    const cond = or(
      ilike(emailsTable.subject, like),
      ilike(emailsTable.fromAddress, like),
      ilike(emailsTable.toAddress, like),
    );
    if (cond) conditions.push(cond);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
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
    .where(where)
    .orderBy(desc(emailsTable.receivedAt))
    .limit(limit);
  res.json(
    rows.map((r) => ({ ...r, receivedAt: r.receivedAt.toISOString() })),
  );
});

// Static paths must be registered before parameterized /:id routes,
// otherwise Express matches "paginated" / "bulk" as an :id value.

router.get("/emails/paginated", async (req, res) => {
  const page = Math.max(1, Number(req.query["page"] ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query["limit"] ?? 50) || 50));
  const offset = (page - 1) * limit;
  const domainIdRaw = req.query["domainId"];
  const search = typeof req.query["search"] === "string" ? req.query["search"] : undefined;
  const before = typeof req.query["before"] === "string" ? req.query["before"] : undefined;
  const after = typeof req.query["after"] === "string" ? req.query["after"] : undefined;

  const conditions: SQL[] = [];
  if (domainIdRaw !== undefined) {
    const d = Number(domainIdRaw);
    if (!Number.isNaN(d)) conditions.push(eq(emailsTable.domainId, d));
  }
  if (search) {
    const like = `%${search}%`;
    const cond = or(ilike(emailsTable.subject, like), ilike(emailsTable.fromAddress, like), ilike(emailsTable.toAddress, like));
    if (cond) conditions.push(cond);
  }
  if (before) {
    const dt = new Date(before);
    if (!isNaN(dt.getTime())) conditions.push(lt(emailsTable.receivedAt, dt));
  }
  if (after) {
    const dt = new Date(after);
    if (!isNaN(dt.getTime())) conditions.push(gte(emailsTable.receivedAt, dt));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db.select({ id: emailsTable.id, toAddress: emailsTable.toAddress, fromAddress: emailsTable.fromAddress, subject: emailsTable.subject, preview: emailsTable.preview, hasAttachments: emailsTable.hasAttachments, receivedAt: emailsTable.receivedAt, domainId: emailsTable.domainId })
      .from(emailsTable).where(where).orderBy(desc(emailsTable.receivedAt)).limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(emailsTable).where(where),
  ]);
  res.json({
    total: Number(countRow?.total ?? 0),
    page,
    limit,
    emails: rows.map((r) => ({ ...r, receivedAt: r.receivedAt.toISOString() })),
  });
});

router.delete("/emails/bulk", async (req, res) => {
  const { ids, domainId, before, after, search } = req.body ?? {};
  const conditions: SQL[] = [];

  if (Array.isArray(ids) && ids.length > 0) {
    const validIds = (ids as unknown[]).map(Number).filter((n) => Number.isFinite(n));
    if (validIds.length > 0) conditions.push(inArray(emailsTable.id, validIds));
  } else {
    if (domainId != null) {
      const d = Number(domainId);
      if (!Number.isNaN(d)) conditions.push(eq(emailsTable.domainId, d));
    }
    if (typeof before === "string" && before) {
      const dt = new Date(before);
      if (!isNaN(dt.getTime())) conditions.push(lt(emailsTable.receivedAt, dt));
    }
    if (typeof after === "string" && after) {
      const dt = new Date(after);
      if (!isNaN(dt.getTime())) conditions.push(gte(emailsTable.receivedAt, dt));
    }
    if (typeof search === "string" && search.trim()) {
      const like = `%${search.trim()}%`;
      const cond = or(ilike(emailsTable.subject, like), ilike(emailsTable.fromAddress, like), ilike(emailsTable.toAddress, like));
      if (cond) conditions.push(cond);
    }
  }

  if (conditions.length === 0) {
    res.status(400).json({ error: "At least one filter required" });
    return;
  }
  const where = and(...conditions);
  const result = await db.delete(emailsTable).where(where).returning({ id: emailsTable.id });
  res.json({ deleted: result.length });
});

router.get("/emails/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(emailsTable)
    .where(eq(emailsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Email not found" });
    return;
  }
  res.json({
    id: row.id,
    toAddress: row.toAddress,
    fromAddress: row.fromAddress,
    subject: row.subject,
    textBody: row.textBody,
    htmlBody: row.htmlBody,
    hasAttachments: row.hasAttachments,
    receivedAt: row.receivedAt.toISOString(),
  });
});

router.delete("/emails/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(emailsTable).where(eq(emailsTable.id, id));
  res.status(204).end();
});

export default router;
