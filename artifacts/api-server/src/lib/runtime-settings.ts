export interface RuntimeSettings {
  anonRetentionHours: number;
  emailRetentionDays: number;
}

export const runtimeSettings: RuntimeSettings = {
  anonRetentionHours: Math.max(1, Number(process.env["ANON_RETENTION_HOURS"] ?? 24) || 24),
  emailRetentionDays: Math.max(1, Number(process.env["EMAIL_RETENTION_DAYS"] ?? 14) || 14),
};
