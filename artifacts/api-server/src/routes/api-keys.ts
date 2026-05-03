import { Router, type IRouter } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { generateApiKey } from "../lib/api-key-auth";

const router: IRouter = Router();

router.get("/api-keys", async (_req, res) => {
  const rows = await db.select().from(apiKeysTable).orderBy(desc(apiKeysTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      revokedAt: r.revokedAt?.toISOString() ?? null,
    })),
  );
});

router.post("/api-keys", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const { plaintext, prefix, keyHash } = generateApiKey();
  const [row] = await db
    .insert(apiKeysTable)
    .values({ name, prefix, keyHash })
    .returning();
  if (!row) {
    res.status(500).json({ error: "Failed to create key" });
    return;
  }
  res.status(201).json({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    plaintext,
    createdAt: row.createdAt.toISOString(),
  });
});

router.post("/api-keys/:id/revoke", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const [row] = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeysTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ ok: true });
});

router.delete("/api-keys/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));
  res.status(204).end();
});

export default router;
