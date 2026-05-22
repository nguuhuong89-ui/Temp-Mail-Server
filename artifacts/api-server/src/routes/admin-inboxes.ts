import { Router, type IRouter } from "express";
import { db, inboxesTable, emailsTable } from "@workspace/db";
import { eq, lt, isNull, isNotNull, ilike, and, desc, inArray, sql, type SQL } from "drizzle-orm";

const router: IRouter = Router();

router.get("/inboxes/list", async (req, res) => {
  const page = Math.max(1, Number(req.query["page"] ?? 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query["limit"] ?? 50) || 50));
  const offset = (page - 1) * limit;
  const type = typeof req.query["type"] === "string" ? req.query["type"] : "all";
  const status = typeof req.query["status"] === "string" ? req.query["status"] : "all";
  const search = typeof req.query["search"] === "string" ? req.query["search"].trim() : "";

  const now = new Date();
  const conditions: SQL[] = [];

  if (type === "anon") conditions.push(isNull(inboxesTable.ownerUserId));
  else if (type === "owned") conditions.push(isNotNull(inboxesTable.ownerUserId));

  if (status === "active") conditions.push(sql`${inboxesTable.expiresAt} > ${now}`);
  else if (status === "expired") conditions.push(lt(inboxesTable.expiresAt, now));

  if (search) conditions.push(ilike(inboxesTable.address, `%${search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: inboxesTable.id,
        address: inboxesTable.address,
        ownerUserId: inboxesTable.ownerUserId,
        createdAt: inboxesTable.createdAt,
        expiresAt: inboxesTable.expiresAt,
        emailCount: sql<number>`(SELECT count(*)::int FROM emails WHERE to_address = ${inboxesTable.address})`,
      })
      .from(inboxesTable)
      .where(where)
      .orderBy(desc(inboxesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(inboxesTable).where(where),
  ]);

  res.json({
    total: Number(countRow?.total ?? 0),
    page,
    limit,
    inboxes: rows.map((r) => ({
      ...r,
      isAnon: r.ownerUserId === null,
      isExpired: r.expiresAt < now,
      emailCount: Number(r.emailCount ?? 0),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    })),
  });
});

router.delete("/inboxes/bulk", async (req, res) => {
  const { addresses, olderThan, type } = req.body ?? {};
  const conditions: SQL[] = [];

  if (Array.isArray(addresses) && addresses.length > 0) {
    conditions.push(inArray(inboxesTable.address, addresses as string[]));
  } else {
    if (type === "anon") conditions.push(isNull(inboxesTable.ownerUserId));
    else if (type === "expired") conditions.push(lt(inboxesTable.expiresAt, new Date()));
    if (typeof olderThan === "string" && olderThan) {
      const dt = new Date(olderThan);
      if (!isNaN(dt.getTime())) conditions.push(lt(inboxesTable.createdAt, dt));
    }
  }

  if (conditions.length === 0) {
    res.status(400).json({ error: "At least one filter required" });
    return;
  }

  const where = and(...conditions);
  const toDelete = await db.select({ address: inboxesTable.address }).from(inboxesTable).where(where);
  const addrs = toDelete.map((r) => r.address);

  if (addrs.length > 0) {
    await db.delete(emailsTable).where(inArray(emailsTable.toAddress, addrs));
    await db.delete(inboxesTable).where(where);
  }
  res.json({ deleted: addrs.length });
});

router.post("/inboxes/purge-expired", async (_req, res) => {
  const now = new Date();
  const expired = await db
    .select({ address: inboxesTable.address })
    .from(inboxesTable)
    .where(lt(inboxesTable.expiresAt, now));

  const addrs = expired.map((r) => r.address);
  if (addrs.length > 0) {
    await db.delete(emailsTable).where(inArray(emailsTable.toAddress, addrs));
    await db.delete(inboxesTable).where(lt(inboxesTable.expiresAt, now));
  }
  res.json({ purged: addrs.length });
});

export default router;
