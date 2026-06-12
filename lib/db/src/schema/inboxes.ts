import { pgTable, serial, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

export const inboxesTable = pgTable(
  "inboxes",
  {
    id: serial("id").primaryKey(),
    address: text("address").notNull().unique(),
    token: text("token").notNull(),
    ownerApiKeyId: integer("owner_api_key_id"),
    ownerUserId: text("owner_user_id"),
    isShared: boolean("is_shared").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("inboxes_address_idx").on(t.address),
    index("inboxes_expires_idx").on(t.expiresAt),
    index("inboxes_owner_idx").on(t.ownerApiKeyId),
    index("inboxes_owner_user_idx").on(t.ownerUserId),
  ],
);

export type Inbox = typeof inboxesTable.$inferSelect;
