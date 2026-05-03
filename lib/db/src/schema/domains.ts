import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const domainsTable = pgTable(
  "domains",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    status: text("status").notNull().default("active"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("domains_status_idx").on(t.status)],
);

export type Domain = typeof domainsTable.$inferSelect;
