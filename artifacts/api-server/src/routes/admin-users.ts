import { Router, type IRouter } from "express";
import { db, usersTable, apiKeysTable, inboxesTable, domainsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { invalidateUserCache } from "../middlewares/clerk-auth";
import { invalidateDomainCache } from "../lib/domain-cache";

const router: IRouter = Router();

router.get("/users", async (_req, res) => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      plan: usersTable.plan,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
      apiKeyCount: sql<number>`(select count(*) from ${apiKeysTable} where ${apiKeysTable.userId} = ${usersTable.id})::int`,
      inboxCount: sql<number>`(select count(*) from ${inboxesTable} where ${inboxesTable.ownerUserId} = ${usersTable.id})::int`,
      domainCount: sql<number>`(select count(*) from ${domainsTable} where ${domainsTable.userId} = ${usersTable.id})::int`,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));
  res.json(
    rows.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      apiKeyCount: Number(u.apiKeyCount ?? 0),
      inboxCount: Number(u.inboxCount ?? 0),
      domainCount: Number(u.domainCount ?? 0),
    })),
  );
});

router.patch("/users/:id", async (req, res) => {
  const id = String(req.params["id"]);
  const { plan, role } = req.body ?? {};
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (plan === "free" || plan === "pro") patch["plan"] = plan;
  if (role === "user" || role === "admin") patch["role"] = role;
  if (Object.keys(patch).length === 1) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  // Invariant: admin role always implies pro plan, so the system stays
  // consistent (admins need API/custom domains to operate).
  if (patch["role"] === "admin") patch["plan"] = "pro";
  // If demoting an admin to user without specifying plan, leave plan as-is.
  const [row] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "User not found" }); return; }
  invalidateUserCache(id);
  if (patch["plan"] === "free") invalidateDomainCache();
  res.json({
    id: row.id,
    email: row.email,
    plan: row.plan,
    role: row.role,
    updatedAt: row.updatedAt.toISOString(),
  });
});

export default router;
