import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const blocklistTable = pgTable(
  "blocklist",
  {
    id: serial("id").primaryKey(),
    pattern: text("pattern").notNull().unique(),
    type: text("type").notNull().default("sender"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blocklist_type_idx").on(t.type)],
);

export type BlocklistEntry = typeof blocklistTable.$inferSelect;
