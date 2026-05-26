import { pgTable, serial, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    actorId: text("actor_id").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
