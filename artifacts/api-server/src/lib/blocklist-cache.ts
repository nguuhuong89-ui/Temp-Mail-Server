import { db, blocklistTable } from "@workspace/db";
import { SingletonCache } from "./cache";

export type BlockEntry = { pattern: string; type: string };

type BlockIndex = {
  entries: BlockEntry[];
  senders: Set<string>;
  domainPatterns: string[];
};

const cache = new SingletonCache<BlockIndex>(60_000, async () => {
  const rows = await db.select().from(blocklistTable);
  const entries: BlockEntry[] = [];
  const senders = new Set<string>();
  const domainPatterns: string[] = [];
  for (const r of rows) {
    const p = r.pattern.toLowerCase();
    entries.push({ pattern: p, type: r.type });
    if (r.type === "sender") senders.add(p);
    else if (r.type === "domain") domainPatterns.push(p);
  }
  return { entries, senders, domainPatterns };
});

export function invalidateBlocklist(): void {
  cache.invalidate();
}

export async function isSenderBlocked(fromAddress: string): Promise<boolean> {
  const sender = fromAddress.toLowerCase();
  const { senders, domainPatterns } = await cache.get();
  if (senders.has(sender)) return true;
  const senderDomain = sender.split("@")[1] ?? "";
  if (!senderDomain) return false;
  for (const d of domainPatterns) {
    if (senderDomain === d || senderDomain.endsWith("." + d)) return true;
  }
  return false;
}

export async function listBlocklist(): Promise<BlockEntry[]> {
  const { entries } = await cache.get();
  return entries;
}
