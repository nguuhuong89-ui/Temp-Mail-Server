import { Router, type IRouter } from "express";
import { db, blocklistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { invalidateBlocklist } from "../lib/blocklist-cache";

const router: IRouter = Router();

router.get("/blocklist", async (_req, res) => {
  const rows = await db.select().from(blocklistTable);
  res.json(
    rows.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      type: r.type,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/blocklist", async (req, res) => {
  const pattern = String(req.body?.pattern ?? "").trim().toLowerCase();
  const type = String(req.body?.type ?? "sender");
  const note = String(req.body?.note ?? "");
  if (!pattern) {
    res.status(400).json({ error: "pattern required" });
    return;
  }
  if (type !== "sender" && type !== "domain") {
    res.status(400).json({ error: "type must be sender|domain" });
    return;
  }
  try {
    const [row] = await db
      .insert(blocklistTable)
      .values({ pattern, type, note })
      .returning();
    if (!row) {
      res.status(500).json({ error: "insert failed" });
      return;
    }
    invalidateBlocklist();
    res.status(201).json({
      id: row.id,
      pattern: row.pattern,
      type: row.type,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    });
  } catch {
    res.status(409).json({ error: "Already exists" });
  }
});

router.delete("/blocklist/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(blocklistTable).where(eq(blocklistTable.id, id));
  invalidateBlocklist();
  res.status(204).end();
});

export default router;
