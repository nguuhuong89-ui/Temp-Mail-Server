import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    plan: text("plan").notNull().default("free"),
    role: text("role").notNull().default("user"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_plan_idx").on(t.plan)],
);

export type User = typeof usersTable.$inferSelect;
