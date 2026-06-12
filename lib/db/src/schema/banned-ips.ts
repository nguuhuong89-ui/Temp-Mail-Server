import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const bannedIpsTable = pgTable(
  "banned_ips",
  {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull().unique(),
    reason: text("reason"),
    bannedBy: text("banned_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [index("banned_ips_ip_idx").on(t.ip)],
);

export type BannedIp = typeof bannedIpsTable.$inferSelect;
