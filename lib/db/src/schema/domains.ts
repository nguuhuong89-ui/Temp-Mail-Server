import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const domainsTable = pgTable(
  "domains",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    name: text("name").notNull().unique(),
    status: text("status").notNull().default("active"),
    isPublic: boolean("is_public").notNull().default(true),
    webhookUrl: text("webhook_url"),
    verificationToken: text("verification_token"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("domains_status_idx").on(t.status),
    index("domains_user_idx").on(t.userId),
  ],
);

export type Domain = typeof domainsTable.$inferSelect;
