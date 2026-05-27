import { pgTable, serial, text, timestamp, integer, index, unique } from "drizzle-orm/pg-core";

export const savedInboxesTable = pgTable(
  "saved_inboxes",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    address: text("address").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("saved_inboxes_user_address_uniq").on(t.userId, t.address),
    index("saved_inboxes_user_idx").on(t.userId),
  ],
);

export type SavedInbox = typeof savedInboxesTable.$inferSelect;
