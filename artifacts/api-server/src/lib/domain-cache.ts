import { db, domainsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SingletonCache } from "./cache";

export type CachedDomain = {
  id: number;
  name: string;
  status: string;
  isPublic: boolean;
  webhookUrl: string | null;
};

const allDomainsCache = new SingletonCache<Map<string, CachedDomain>>(30_000, async () => {
  const rows = await db.select().from(domainsTable);
  const m = new Map<string, CachedDomain>();
  for (const r of rows) {
    m.set(r.name.toLowerCase(), {
      id: r.id,
      name: r.name,
      status: r.status,
      isPublic: r.isPublic,
      webhookUrl: r.webhookUrl ?? null,
    });
  }
  return m;
});

export async function lookupDomain(name: string): Promise<CachedDomain | undefined> {
  const map = await allDomainsCache.get();
  return map.get(name.toLowerCase());
}

export async function pickRandomPublicActiveDomain(): Promise<string | null> {
  const map = await allDomainsCache.get();
  const candidates: string[] = [];
  for (const d of map.values()) {
    if (d.status === "active" && d.isPublic) candidates.push(d.name);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export async function listAllDomains(): Promise<CachedDomain[]> {
  const map = await allDomainsCache.get();
  return [...map.values()];
}

export function invalidateDomainCache(): void {
  allDomainsCache.invalidate();
}

export async function ensureDefaultDomain(fallback: string): Promise<string> {
  const existing = await pickRandomPublicActiveDomain();
  if (existing) return existing;
  await db
    .insert(domainsTable)
    .values({ name: fallback, status: "active", isPublic: true })
    .onConflictDoNothing();
  invalidateDomainCache();
  return fallback;
}
