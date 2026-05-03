import { Router, type IRouter } from "express";
import { db, emailsTable } from "@workspace/db";
import { and, eq, desc, ilike, or, type SQL } from "drizzle-orm";

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
