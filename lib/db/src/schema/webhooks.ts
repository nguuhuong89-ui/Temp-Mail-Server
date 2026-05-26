import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const webhooksTable = pgTable(
  "webhooks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    url: text("url").notNull(),
    events: text("events").notNull().default("new_email"),
    secret: text("secret").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    failCount: text("fail_count").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhooks_user_idx").on(t.userId),
  ],
);

export type Webhook = typeof webhooksTable.$inferSelect;
