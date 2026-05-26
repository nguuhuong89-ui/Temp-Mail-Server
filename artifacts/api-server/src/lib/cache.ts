type Entry<V> = { value: V; expiresAt: number };

export class TtlCache<K, V> {
  private map = new Map<K, Entry<V>>();
  private pruneTimer: ReturnType<typeof setInterval>;

  constructor(private ttlMs: number) {
    // Periodically prune expired entries to avoid unbounded memory growth.
    this.pruneTimer = setInterval(() => this.prune(), Math.max(ttlMs * 2, 60_000));
    if (this.pruneTimer.unref) this.pruneTimer.unref();
  }

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

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt < now) this.map.delete(key);
    }
  }
}

export class SingletonCache<V> {
  private cached: { value: V; expiresAt: number; generation: number } | null = null;
  private inflight: { promise: Promise<V>; generation: number } | null = null;
  private generation = 0;

  constructor(
    private ttlMs: number,
    private loader: () => Promise<V>,
  ) {}

  async get(): Promise<V> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.value;
    if (this.inflight) return this.inflight.promise;
    const gen = this.generation;
    const promise = (async () => {
      try {
        const value = await this.loader();
        // Drop stale results if invalidate() bumped generation while loading.
        if (gen === this.generation) {
          this.cached = { value, expiresAt: Date.now() + this.ttlMs, generation: gen };
        }
        return value;
      } finally {
        if (this.inflight && this.inflight.generation === gen) {
          this.inflight = null;
        }
      }
    })();
    this.inflight = { promise, generation: gen };
    return promise;
  }

  invalidate(): void {
    this.cached = null;
    this.generation++;
  }
}
