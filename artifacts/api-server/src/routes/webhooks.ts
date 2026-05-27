import { Router, type IRouter } from "express";
import { db, webhooksTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { attachUser, requireUser, requirePro, type AuthedRequest } from "../middlewares/session-auth";

const router: IRouter = Router();

router.use("/account/webhooks", attachUser);

const VALID_EVENTS = ["new_email", "inbox_expired", "domain_removed"] as const;
const MAX_WEBHOOKS_PER_USER = 5;

router.get("/account/webhooks", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const rows = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, r.userId!))
    .orderBy(desc(webhooksTable.createdAt));
  res.json(rows.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events.split(","),
    isActive: w.isActive,
    failCount: Number(w.failCount),
    lastTriggeredAt: w.lastTriggeredAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
  })));
});

router.post("/account/webhooks", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const { url, events } = req.body ?? {};
  if (!url || typeof url !== "string" || !url.startsWith("https://")) {
    res.status(400).json({ error: "URL must start with https://" });
    return;
  }
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "At least one event is required" });
    return;
  }
  const validEvents = events.filter((e: string) => (VALID_EVENTS as readonly string[]).includes(e));
  if (validEvents.length === 0) {
    res.status(400).json({ error: `Invalid events. Valid: ${VALID_EVENTS.join(", ")}` });
    return;
  }

  const existing = await db
    .select({ id: webhooksTable.id })
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, r.userId!));
  if (existing.length >= MAX_WEBHOOKS_PER_USER) {
    res.status(400).json({ error: `Maximum ${MAX_WEBHOOKS_PER_USER} webhooks allowed` });
    return;
  }

  const secret = crypto.randomBytes(32).toString("hex");
  const [row] = await db
    .insert(webhooksTable)
    .values({
      userId: r.userId!,
      url: url.trim(),
      events: validEvents.join(","),
      secret,
    })
    .returning();

  res.status(201).json({
    id: row.id,
    url: row.url,
    events: row.events.split(","),
    secret,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/account/webhooks/:id", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  const { url, events, isActive } = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof url === "string" && url.startsWith("https://")) patch["url"] = url.trim();
  if (Array.isArray(events)) {
    const valid = events.filter((e: string) => (VALID_EVENTS as readonly string[]).includes(e));
    if (valid.length > 0) patch["events"] = valid.join(",");
  }
  if (typeof isActive === "boolean") patch["isActive"] = isActive;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [row] = await db
    .update(webhooksTable)
    .set(patch)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, r.userId!)))
    .returning();
  if (!row) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.json({
    id: row.id,
    url: row.url,
    events: row.events.split(","),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/account/webhooks/:id", requireUser, requirePro, async (req, res) => {
  const r = req as AuthedRequest;
  const id = Number(req.params["id"]);
  const [deleted] = await db
    .delete(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, r.userId!)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.json({ ok: true });
});

export default router;

export async function triggerWebhooks(event: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const hooks = await db
      .select()
      .from(webhooksTable)
      .where(eq(webhooksTable.isActive, true));

    const matching = hooks.filter((h) => h.events.split(",").includes(event));

    await Promise.allSettled(
      matching.map(async (hook) => {
        const signature = crypto
          .createHmac("sha256", hook.secret)
          .update(JSON.stringify(payload))
          .digest("hex");

        try {
          const resp = await fetch(hook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature": signature,
              "X-Webhook-Event": event,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10_000),
          });

          if (resp.ok) {
            await db
              .update(webhooksTable)
              .set({ lastTriggeredAt: new Date(), failCount: "0" })
              .where(eq(webhooksTable.id, hook.id));
          } else {
            const newFail = Number(hook.failCount) + 1;
            await db
              .update(webhooksTable)
              .set({
                failCount: String(newFail),
                isActive: newFail < 10,
              })
              .where(eq(webhooksTable.id, hook.id));
          }
        } catch {
          const newFail = Number(hook.failCount) + 1;
          await db
            .update(webhooksTable)
            .set({
              failCount: String(newFail),
              isActive: newFail < 10,
            })
            .where(eq(webhooksTable.id, hook.id));
        }
      }),
    );
  } catch {
    // Webhook delivery should never break the main flow
  }
}
