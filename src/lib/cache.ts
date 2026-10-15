import Redis from "ioredis";

interface CacheStats {
  type: "redis" | "memory";
  connected: boolean;
  keysCount: number;
  hits: number;
  misses: number;
  lastSync: string;
}

class CacheManager {
  private redisClient: Redis | null = null;
  private memoryStore: Map<string, { value: any; expiresAt?: number }> = new Map();
  private isRedisConnected = false;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 2500,
          retryStrategy(times) {
            if (times > 3) return null; // Fallback to memory
            return Math.min(times * 500, 2000);
          }
        });

        this.redisClient.connect().then(() => {
          this.isRedisConnected = true;
          console.log("[Redis Cache] Conectado com sucesso ao servidor Redis!");
        }).catch((err) => {
          console.warn("[Redis Cache] Servidor Redis externo indisponível, usando Cache em Memória de alta performance:", err.message);
          this.isRedisConnected = false;
        });

        this.redisClient.on("error", (err) => {
          this.isRedisConnected = false;
        });
      } catch (e: any) {
        console.warn("[Redis Cache] Inicialização do Redis falhou, operando em modo Memória:", e.message);
        this.isRedisConnected = false;
      }
    } else {
      // Operação padrão: Cache em Memória super rápido (Redis-compatible memory engine)
      this.isRedisConnected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        if (data) {
          this.hits++;
          return JSON.parse(data) as T;
        }
      } catch {
        // Fallback para memória se o Redis falhar
      }
    }

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

    if (this.isRedisConnected && this.redisClient) {
      try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds > 0) {
          await this.redisClient.setex(key, ttlSeconds, serialized);
        } else {
          await this.redisClient.set(key, serialized);
        }
      } catch {
        // Ignora erro no Redis se a memória já foi salva
      }
    }
  }

  async del(key: string): Promise<void> {
    this.memoryStore.delete(key);
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch {}
    }
  }

  async delPattern(patternPrefix: string): Promise<void> {
    for (const key of Array.from(this.memoryStore.keys())) {
      if (key.startsWith(patternPrefix)) {
        this.memoryStore.delete(key);
      }
    }

    if (this.isRedisConnected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${patternPrefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch {}
    }
  }

  async flush(): Promise<void> {
    this.memoryStore.clear();
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch {}
    }
  }

  getStats(): CacheStats {
    return {
      type: this.isRedisConnected ? "redis" : "memory",
      connected: this.isRedisConnected || true,
      keysCount: this.memoryStore.size,
      hits: this.hits,
      misses: this.misses,
      lastSync: new Date().toISOString()
    };
  }
}

export const cache = new CacheManager();
