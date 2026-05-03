type Entry<V> = { value: V; expiresAt: number };

export class TtlCache<K, V> {
  private map = new Map<K, Entry<V>>();
  constructor(private ttlMs: number) {}

  get(key: K): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: K, value: V): void {
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key?: K): void {
    if (key === undefined) this.map.clear();
    else this.map.delete(key);
  }
}

export class SingletonCache<V> {
  private cached: { value: V; expiresAt: number } | null = null;
  constructor(
    private ttlMs: number,
    private loader: () => Promise<V>,
  ) {}

  async get(): Promise<V> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.value;
    const value = await this.loader();
    this.cached = { value, expiresAt: now + this.ttlMs };
    return value;
  }

  invalidate(): void {
    this.cached = null;
  }
}
