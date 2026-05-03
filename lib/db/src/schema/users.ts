import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    plan: text("plan").notNull().default("free"),
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_plan_idx").on(t.plan)],
);

export type User = typeof usersTable.$inferSelect;
