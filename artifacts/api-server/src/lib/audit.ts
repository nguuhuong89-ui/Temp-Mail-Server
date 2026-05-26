import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";

export interface AuditEntry {
  action: string;
  actorId: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: entry.action,
      actorId: entry.actorId,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: entry.req?.ip ?? null,
    });
  } catch {
    // Audit logging should never break the main flow
  }
}
