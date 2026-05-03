import { db, blocklistTable } from "@workspace/db";
import { SingletonCache } from "./cache";

export type BlockEntry = { pattern: string; type: string };

const cache = new SingletonCache<BlockEntry[]>(30_000, async () => {
  const rows = await db.select().from(blocklistTable);
  return rows.map((r) => ({ pattern: r.pattern.toLowerCase(), type: r.type }));
});

export function invalidateBlocklist(): void {
  cache.invalidate();
}

export async function isSenderBlocked(fromAddress: string): Promise<boolean> {
  const sender = fromAddress.toLowerCase();
  const senderDomain = sender.split("@")[1] ?? "";
  const entries = await cache.get();
  for (const e of entries) {
    if (e.type === "sender" && sender === e.pattern) return true;
    if (e.type === "domain" && senderDomain && senderDomain === e.pattern) return true;
    if (e.type === "domain" && senderDomain.endsWith("." + e.pattern)) return true;
  }
  return false;
}

export async function listBlocklist(): Promise<BlockEntry[]> {
  return cache.get();
}
