import { Router, type IRouter } from "express";
import { db, adsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function serialize(row: typeof adsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    placement: row.placement,
    content: row.content,
    imageUrl: row.imageUrl,
    linkUrl: row.linkUrl,
    isActive: row.isActive,
    impressions: row.impressions,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/ads", async (_req, res) => {
  const rows = await db.select().from(adsTable).orderBy(desc(adsTable.createdAt));
  res.json(rows.map(serialize));
});

// Public, separately exported and mounted before admin auth.
export const publicAdsRouter: IRouter = Router();
publicAdsRouter.get("/ads/active", async (_req, res) => {
  const rows = await db
    .select()
    .from(adsTable)
    .where(eq(adsTable.isActive, true));
  res.json(rows.map(serialize));
});

router.post("/ads", async (req, res) => {
  const { name, placement, content, imageUrl, linkUrl, isActive } = req.body ?? {};
  if (typeof name !== "string" || typeof placement !== "string" || typeof content !== "string") {
    res.status(400).json({ error: "Invalid ad payload" });
    return;
  }
  const [row] = await db
    .insert(adsTable)
    .values({
      name,
      placement,
      content,
      imageUrl: imageUrl ?? null,
      linkUrl: linkUrl ?? null,
      isActive: isActive ?? true,
    })
    .returning();
  if (!row) {
    res.status(500).json({ error: "Insert failed" });
    return;
  }
  res.status(201).json(serialize(row));
});

router.patch("/ads/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "placement", "content", "imageUrl", "linkUrl", "isActive"]) {
    if (req.body && key in req.body) patch[key] = req.body[key];
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [row] = await db
    .update(adsTable)
    .set(patch)
    .where(eq(adsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Ad not found" });
    return;
  }
  res.json(serialize(row));
});

router.delete("/ads/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(adsTable).where(eq(adsTable.id, id));
  res.status(204).end();
});

export default router;
