import { Router, type IRouter } from "express";
import { db, usersTable, apiKeysTable, inboxesTable, domainsTable, emailsTable } from "@workspace/db";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { createClerkClient } from "@clerk/express";
import { invalidateUserCache } from "../middlewares/clerk-auth";
import { invalidateDomainCache } from "../lib/domain-cache";

const clerkClient = createClerkClient({
  secretKey: process.env["CLERK_SECRET_KEY"] ?? "",
});

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

// POST /users/sync — pull all users from Clerk, upsert into usersTable
router.post("/users/sync", async (_req, res) => {
  const adminEmails = (process.env["ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let added = 0, updated = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const list = await clerkClient.users.getUserList({ limit, offset });
    if (list.data.length === 0) break;

    for (const u of list.data) {
      const email =
        u.primaryEmailAddress?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        null;
      const role = email && adminEmails.includes(email.toLowerCase()) ? "admin" : "user";
      const plan = role === "admin" ? "pro" : "free";

      const existing = await db
        .select({ id: usersTable.id, plan: usersTable.plan, role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, u.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(usersTable).values({ id: u.id, email, plan, role }).onConflictDoNothing();
        added++;
      } else {
        // Only update email if missing; preserve manually-set plan/role
        const cur = existing[0]!;
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (email && !cur) patch["email"] = email;
        // Promote to admin if in ADMIN_EMAILS and not already admin
        if (role === "admin" && cur.role !== "admin") {
          patch["role"] = "admin";
          patch["plan"] = "pro";
        }
        if (Object.keys(patch).length > 1) {
          await db.update(usersTable).set(patch).where(eq(usersTable.id, u.id));
          updated++;
        }
      }
    }
    offset += list.data.length;
    if (list.data.length < limit) break;
  }

  res.json({ added, updated });
});

// POST /users/promote — set role=admin (and plan=pro) by email
router.post("/users/promote", async (req, res) => {
  const { email, role } = req.body ?? {};
  if (typeof email !== "string" || !email) {
    res.status(400).json({ error: "email required" }); return;
  }
  const targetRole = role === "user" ? "user" : "admin";
  const targetPlan = targetRole === "admin" ? "pro" : "free";

  // Find user by email in DB
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, email.trim().toLowerCase()));

  if (rows.length === 0) {
    // Try to find in Clerk and create
    try {
      const list = await clerkClient.users.getUserList({ emailAddress: [email.trim()] });
      if (!list.data[0]) { res.status(404).json({ error: "User not found" }); return; }
      const cu = list.data[0];
      await db.insert(usersTable)
        .values({ id: cu.id, email: email.trim(), plan: targetPlan, role: targetRole })
        .onConflictDoNothing();
      invalidateUserCache(cu.id);
      res.json({ ok: true, id: cu.id, email: email.trim(), role: targetRole, plan: targetPlan });
      return;
    } catch {
      res.status(404).json({ error: "User not found in Clerk" }); return;
    }
  }

  const [row] = await db
    .update(usersTable)
    .set({ role: targetRole, plan: targetPlan, updatedAt: new Date() })
    .where(eq(sql`lower(${usersTable.email})`, email.trim().toLowerCase()))
    .returning();

  if (row) invalidateUserCache(row.id);
  if (targetPlan === "free") invalidateDomainCache();
  res.json({ ok: true, id: row?.id, email: row?.email, role: targetRole, plan: targetPlan });
});

// DELETE /users/:id — remove user + all their data
router.delete("/users/:id", async (req, res) => {
  const id = String(req.params["id"]);

  // Get all inboxes owned by this user
  const ownedInboxes = await db
    .select({ address: inboxesTable.address })
    .from(inboxesTable)
    .where(eq(inboxesTable.ownerUserId, id));
  const addresses = ownedInboxes.map((r) => r.address);

  // Cascade delete
  if (addresses.length > 0) {
    await db.delete(emailsTable).where(inArray(emailsTable.toAddress, addresses));
    await db.delete(inboxesTable).where(eq(inboxesTable.ownerUserId, id));
  }
  await db.delete(apiKeysTable).where(eq(apiKeysTable.userId, id));
  await db.delete(domainsTable).where(eq(domainsTable.userId, id));
  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();

  if (!deleted) { res.status(404).json({ error: "User not found" }); return; }
  invalidateUserCache(id);
  invalidateDomainCache();
  res.json({ ok: true, deleted: id });
});

export default router;
