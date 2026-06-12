import { Router, type IRouter } from "express";
import { db, bannedIpsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { invalidateBanCache } from "../middlewares/ip-ban";

const router: IRouter = Router();

// List all banned IPs
router.get("/admin/ip-bans", async (_req, res) => {
  const rows = await db
    .select()
    .from(bannedIpsTable)
    .orderBy(desc(bannedIpsTable.createdAt))
    .limit(500);
  res.json(
    rows.map((r) => ({
      id: r.id,
      ip: r.ip,
      reason: r.reason,
      bannedBy: r.bannedBy,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
    })),
  );
});

// Ban an IP
router.post("/admin/ip-bans", async (req, res) => {
  const { ip, reason, expiresAt } = req.body ?? {};
  if (typeof ip !== "string" || !ip.trim()) {
    res.status(400).json({ error: "ip required" });
    return;
  }
  const adminId = (req as { adminId?: string }).adminId ?? "admin";
  let expiry: Date | null = null;
  if (expiresAt) {
    const dt = new Date(expiresAt);
    if (!isNaN(dt.getTime())) expiry = dt;
  }
  try {
    const [row] = await db
      .insert(bannedIpsTable)
      .values({
        ip: ip.trim(),
        reason: typeof reason === "string" ? reason.trim() || null : null,
        bannedBy: adminId,
        expiresAt: expiry,
      })
      .returning();
    if (!row) {
      res.status(500).json({ error: "Insert failed" });
      return;
    }
    invalidateBanCache(ip.trim());
    res.status(201).json({
      id: row.id,
      ip: row.ip,
      reason: row.reason,
      bannedBy: row.bannedBy,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
    });
  } catch {
    res.status(409).json({ error: "IP already banned" });
  }
});

// Unban an IP
router.delete("/admin/ip-bans/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select({ ip: bannedIpsTable.ip })
    .from(bannedIpsTable)
    .where(eq(bannedIpsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(bannedIpsTable).where(eq(bannedIpsTable.id, id));
  invalidateBanCache(row.ip);
  res.status(204).end();
});

export default router;
