import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("api_keys_prefix_idx").on(t.prefix)],
);

export type ApiKey = typeof apiKeysTable.$inferSelect;
