import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";

export const inboxesTable = pgTable(
  "inboxes",
  {
    id: serial("id").primaryKey(),
    address: text("address").notNull().unique(),
    token: text("token").notNull(),
    ownerApiKeyId: integer("owner_api_key_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("inboxes_address_idx").on(t.address),
    index("inboxes_expires_idx").on(t.expiresAt),
    index("inboxes_owner_idx").on(t.ownerApiKeyId),
  ],
);

export type Inbox = typeof inboxesTable.$inferSelect;
