import { resolveMx } from "node:dns/promises";

/**
 * Verify that a domain's MX record points to our mail server.
 * This is the only verification needed — if user can set MX, they own the domain.
 */
export async function verifyDomainMx(
  domain: string,
  expectedHost: string,
): Promise<{ ok: boolean; records: string[]; error?: string }> {
  try {
    const records = await resolveMx(domain);
    const exchanges = records.map((r) => r.exchange.replace(/\.$/, "").toLowerCase());
    const expected = expectedHost.replace(/\.$/, "").toLowerCase();
    const ok = exchanges.some((ex) => ex === expected || ex.endsWith(`.${expected}`));
    return { ok, records: records.map((r) => `${r.priority} ${r.exchange}`) };
  } catch (err) {
    return { ok: false, records: [], error: (err as Error)?.message ?? "DNS lookup failed" };
  }
}
