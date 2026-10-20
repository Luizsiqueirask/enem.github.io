export interface CacheStats {
  type: "memory";
  connected: boolean;
  keysCount: number;
  hits: number;
  misses: number;
  lastSync: string;
}

class CacheManager {
  private memoryStore: Map<string, { value: any; expiresAt?: number }> = new Map();
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    const item = this.memoryStore.get(key);
    if (!item) {
      this.misses++;
      return null;
    }

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryStore.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.memoryStore.delete(key);
  }

  async delPattern(patternPrefix: string): Promise<void> {
    for (const key of Array.from(this.memoryStore.keys())) {
      if (key.startsWith(patternPrefix)) {
        this.memoryStore.delete(key);
      }
    }
  }

  async flush(): Promise<void> {
    this.memoryStore.clear();
  }

  getStats(): CacheStats {
    return {
      type: "memory",
      connected: true,
      keysCount: this.memoryStore.size,
      hits: this.hits,
      misses: this.misses,
      lastSync: new Date().toISOString()
    };
  }
}

export const cache = new CacheManager();
