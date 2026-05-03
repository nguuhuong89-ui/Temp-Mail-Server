import { resolveTxt } from "node:dns/promises";
import crypto from "node:crypto";

export function generateDomainToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

const VERIFY_PREFIX = "tempmail-verify=";

export async function verifyDomainTxt(
  domain: string,
  token: string,
): Promise<{ ok: boolean; records: string[]; error?: string }> {
  try {
    const records = await resolveTxt(domain);
    const flat = records.map((parts) => parts.join(""));
    const expected = `${VERIFY_PREFIX}${token}`;
    return { ok: flat.includes(expected), records: flat };
  } catch (err) {
    return { ok: false, records: [], error: (err as Error)?.message ?? "DNS lookup failed" };
  }
}

export function verifyRecordValue(token: string): string {
  return `${VERIFY_PREFIX}${token}`;
}
