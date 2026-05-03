import { Router, type IRouter } from "express";
import {
  db,
  emailsTable,
  inboxesTable,
  domainsTable,
  adsTable,
} from "@workspace/db";
import { sql, gte, eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/dashboard", async (_req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();

  const [
    [emailsTotal],
    [emailsTodayRow],
    [activeInboxesRow],
    [domainsTotalRow],
    [domainsActiveRow],
    [adsTotalRow],
    [adsActiveRow],
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(emailsTable),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(emailsTable)
      .where(gte(emailsTable.receivedAt, startOfDay)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(inboxesTable)
      .where(gte(inboxesTable.expiresAt, now)),
    db.select({ c: sql<number>`count(*)::int` }).from(domainsTable),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(domainsTable)
      .where(eq(domainsTable.status, "active")),
    db.select({ c: sql<number>`count(*)::int` }).from(adsTable),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(adsTable)
      .where(eq(adsTable.isActive, true)),
  ]);

  res.json({
    totalEmails: Number(emailsTotal?.c ?? 0),
    emailsToday: Number(emailsTodayRow?.c ?? 0),
    activeInboxes: Number(activeInboxesRow?.c ?? 0),
    totalDomains: Number(domainsTotalRow?.c ?? 0),
    activeDomains: Number(domainsActiveRow?.c ?? 0),
    totalAds: Number(adsTotalRow?.c ?? 0),
    activeAds: Number(adsActiveRow?.c ?? 0),
  });
});

router.get("/stats/activity", async (_req, res) => {
  const [recentEmails, recentInboxes, recentDomains, recentAds] = await Promise.all([
    db
      .select({
        id: emailsTable.id,
        from: emailsTable.fromAddress,
        to: emailsTable.toAddress,
        subject: emailsTable.subject,
        ts: emailsTable.receivedAt,
      })
      .from(emailsTable)
      .orderBy(desc(emailsTable.receivedAt))
      .limit(20),
    db
      .select({
        id: inboxesTable.id,
        address: inboxesTable.address,
        ts: inboxesTable.createdAt,
      })
      .from(inboxesTable)
      .orderBy(desc(inboxesTable.createdAt))
      .limit(20),
    db
      .select({
        id: domainsTable.id,
        name: domainsTable.name,
        ts: domainsTable.createdAt,
      })
      .from(domainsTable)
      .orderBy(desc(domainsTable.createdAt))
      .limit(10),
    db
      .select({
        id: adsTable.id,
        name: adsTable.name,
        ts: adsTable.createdAt,
      })
      .from(adsTable)
      .orderBy(desc(adsTable.createdAt))
      .limit(10),
  ]);

  type Item = { id: string; type: string; message: string; timestamp: string; ts: Date };
  const items: Item[] = [
    ...recentEmails.map((e) => ({
      id: `email-${e.id}`,
      type: "email_received",
      message: `${e.from} → ${e.to}: ${e.subject || "(no subject)"}`,
      timestamp: e.ts.toISOString(),
      ts: e.ts,
    })),
    ...recentInboxes.map((i) => ({
      id: `inbox-${i.id}`,
      type: "inbox_created",
      message: `New inbox ${i.address}`,
      timestamp: i.ts.toISOString(),
      ts: i.ts,
    })),
    ...recentDomains.map((d) => ({
      id: `domain-${d.id}`,
      type: "domain_added",
      message: `Domain added: ${d.name}`,
      timestamp: d.ts.toISOString(),
      ts: d.ts,
    })),
    ...recentAds.map((a) => ({
      id: `ad-${a.id}`,
      type: "ad_created",
      message: `Ad campaign: ${a.name}`,
      timestamp: a.ts.toISOString(),
      ts: a.ts,
    })),
  ];
  items.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  res.json(
    items.slice(0, 30).map(({ ts: _ts, ...rest }) => rest),
  );
});

router.get("/stats/timeseries", async (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT date_trunc('hour', received_at) AS hour, COUNT(*)::int AS count
    FROM emails
    WHERE received_at >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  const map = new Map<string, number>();
  for (const r of rows.rows as Array<{ hour: Date | string; count: number }>) {
    const d = r.hour instanceof Date ? r.hour : new Date(r.hour);
    map.set(d.toISOString(), Number(r.count));
  }
  const buckets: Array<{ hour: string; count: number }> = [];
  const start = new Date(since);
  start.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const t = new Date(start.getTime() + i * 60 * 60 * 1000);
    const key = t.toISOString();
    buckets.push({ hour: key, count: map.get(key) ?? 0 });
  }
  res.json(buckets);
});

export default router;
