import { pgTable, serial, text, timestamp, index, unique } from "drizzle-orm/pg-core";

export const domainSharesTable = pgTable(
  "domain_shares",
  {
    id: serial("id").primaryKey(),
    domainId: serial("domain_id").notNull(),
    sharedWithUserId: text("shared_with_user_id").notNull(),
    sharedByUserId: text("shared_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("domain_shares_domain_idx").on(t.domainId),
    index("domain_shares_user_idx").on(t.sharedWithUserId),
    unique("domain_shares_unique").on(t.domainId, t.sharedWithUserId),
  ],
);

export type DomainShare = typeof domainSharesTable.$inferSelect;
