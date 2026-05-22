import { Router, type IRouter } from "express";
import { db, domainsTable, emailsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { resolveMx, resolveTxt } from "node:dns/promises";
import { invalidateDomainCache } from "../lib/domain-cache";
import { isSafeWebhookUrl } from "../lib/webhooks";

const router: IRouter = Router();

router.get("/domains", async (_req, res) => {
  const rows = await db
    .select({
      id: domainsTable.id,
      name: domainsTable.name,
      status: domainsTable.status,
      isPublic: domainsTable.isPublic,
      webhookUrl: domainsTable.webhookUrl,
      createdAt: domainsTable.createdAt,
      emailCount: sql<number>`count(${emailsTable.id})::int`,
    })
    .from(domainsTable)
    .leftJoin(emailsTable, eq(emailsTable.domainId, domainsTable.id))
    .groupBy(domainsTable.id)
    .orderBy(domainsTable.name);
  res.json(
    rows.map((r) => ({
      ...r,
      emailCount: Number(r.emailCount ?? 0),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/domains", async (req, res) => {
  const { name, isPublic, webhookUrl } = req.body ?? {};
  if (typeof name !== "string" || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) {
    res.status(400).json({ error: "Invalid domain name" });
    return;
  }
  if (webhookUrl != null && webhookUrl !== "" && !isSafeWebhookUrl(String(webhookUrl))) {
    res.status(400).json({ error: "Invalid webhook URL" });
    return;
  }
  try {
    const [row] = await db
      .insert(domainsTable)
      .values({
        name: name.toLowerCase(),
        isPublic: isPublic ?? true,
        status: "active",
        webhookUrl: webhookUrl ? String(webhookUrl) : null,
      })
      .returning();
    if (!row) {
      res.status(500).json({ error: "Insert failed" });
      return;
    }
    invalidateDomainCache();
    res.status(201).json({
      id: row.id,
      name: row.name,
      status: row.status,
      isPublic: row.isPublic,
      webhookUrl: row.webhookUrl,
      emailCount: 0,
      createdAt: row.createdAt.toISOString(),
    });
  } catch {
    res.status(409).json({ error: "Domain already exists" });
  }
});

router.patch("/domains/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { status, isPublic, webhookUrl } = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof status === "string") patch["status"] = status;
  if (typeof isPublic === "boolean") patch["isPublic"] = isPublic;
  if (webhookUrl !== undefined) {
    if (webhookUrl === null || webhookUrl === "") {
      patch["webhookUrl"] = null;
    } else if (typeof webhookUrl === "string" && isSafeWebhookUrl(webhookUrl)) {
      patch["webhookUrl"] = webhookUrl;
    } else {
      res.status(400).json({ error: "Invalid webhook URL" });
      return;
    }
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [row] = await db
    .update(domainsTable)
    .set(patch)
    .where(eq(domainsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }
  invalidateDomainCache();
  res.json({
    id: row.id,
    name: row.name,
    status: row.status,
    isPublic: row.isPublic,
    webhookUrl: row.webhookUrl,
    emailCount: 0,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/domains/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(domainsTable).where(eq(domainsTable.id, id));
  invalidateDomainCache();
  res.status(204).end();
});

router.post("/domains/:id/check", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.id, id))
    .limit(1);
  if (!domain) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }
  let mxValid = false;
  let mxRecords: string[] = [];
  let spfValid = false;
  let spfRecords: string[] = [];
  try {
    const records = await resolveMx(domain.name);
    mxRecords = records
      .sort((a, b) => a.priority - b.priority)
      .map((r: { priority: number; exchange: string }) => `${r.priority} ${r.exchange}`);
    mxValid = mxRecords.length > 0;
  } catch (err) {
    req.log.warn({ err, domain: domain.name }, "MX lookup failed");
  }
  try {
    const txtRecords = await resolveTxt(domain.name);
    spfRecords = txtRecords.map((parts: string[]) => parts.join("")).filter((r: string) => r.startsWith("v=spf1"));
    spfValid = spfRecords.length > 0;
  } catch (err) {
    req.log.warn({ err, domain: domain.name }, "TXT/SPF lookup failed");
  }
  res.json({
    domain: domain.name,
    mxValid,
    mxRecords,
    spfValid,
    spfRecords,
    checkedAt: new Date().toISOString(),
  });
});

export default router;
