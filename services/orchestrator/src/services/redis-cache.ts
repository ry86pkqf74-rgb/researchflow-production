/**
 * Redis Cache Service
 *
 * Generic Redis caching utility with singleflight pattern to prevent
 * cache stampede. Used for literature search caching.
 */

import crypto from 'crypto';

/**
 * Cache options
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttlSeconds: number;
  /** Enable singleflight pattern to prevent cache stampede */
  singleflight?: boolean;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  ttlSeconds: number;
}

/**
 * Redis client interface (compatible with ioredis)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
}

/**
 * In-memory fallback cache for development/testing
 */
class InMemoryCache implements RedisClient {
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<unknown> {
    const expiresAt = duration ? Date.now() + duration * 1000 : Date.now() + 86400000;
    this.cache.set(key, { value, expiresAt });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<unknown> {
    const expiresAt = Date.now() + seconds * 1000;
    this.cache.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.cache.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return 0;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return 0;
    }
    return 1;
  }
}

/**
 * Redis Cache Service
 */
export class RedisCacheService {
  private client: RedisClient;
  private inflightRequests: Map<string, Promise<unknown>> = new Map();
  private defaultTtlSeconds: number;

  constructor(client?: RedisClient, defaultTtlSeconds: number = 86400) {
    this.client = client || new InMemoryCache();
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  /**
   * Generate a cache key from components
   */
  static generateKey(prefix: string, ...parts: (string | number | boolean | undefined)[]): string {
    const validParts = parts.filter(p => p !== undefined && p !== '');
    const hashInput = validParts.join(':');
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
    return `${prefix}:${hash}`;
  }

  /**
   * Get from cache
   */
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await this.client.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as CacheEntry<T>;
    } catch (error) {
      console.warn(`[RedisCacheService] Error reading cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set in cache
   */
  async set<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const entry: CacheEntry<T> = {
      data,
      cachedAt: new Date().toISOString(),
      ttlSeconds: ttl,
    };
    try {
      await this.client.setex(key, ttl, JSON.stringify(entry));
    } catch (error) {
      console.warn(`[RedisCacheService] Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.warn(`[RedisCacheService] Error deleting cache key ${key}:`, error);
    }
  }

  /**
   * Get or fetch with singleflight pattern
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<{ data: T; cached: boolean; cachedAt?: string }> {
    const ttl = options.ttlSeconds ?? this.defaultTtlSeconds;
    const fullKey = options.keyPrefix ? `${options.keyPrefix}:${key}` : key;

    // Try cache first
    const cached = await this.get<T>(fullKey);
    if (cached) {
      return { data: cached.data, cached: true, cachedAt: cached.cachedAt };
    }

    // Singleflight: return existing promise if one is in-flight
    if (options.singleflight && this.inflightRequests.has(fullKey)) {
      const result = await this.inflightRequests.get(fullKey) as T;
      const newCached = await this.get<T>(fullKey);
      return { data: result, cached: true, cachedAt: newCached?.cachedAt };
    }

    // Fetch and cache
    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        await this.set(fullKey, result, ttl);
        return result;
      } finally {
        this.inflightRequests.delete(fullKey);
      }
    })();

    if (options.singleflight) {
      this.inflightRequests.set(fullKey, fetchPromise);
    }

    const data = await fetchPromise;
    return { data, cached: false };
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) > 0;
    } catch (error) {
      console.warn(`[RedisCacheService] Error checking existence of key ${key}:`, error);
      return false;
    }
  }
}

// Singleton instance with in-memory fallback
let cacheInstance: RedisCacheService | null = null;

/**
 * Get or create cache service instance
 */
export function getCacheService(client?: RedisClient): RedisCacheService {
  if (!cacheInstance) {
    const ttlSeconds = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);
    cacheInstance = new RedisCacheService(client, ttlSeconds);
  }
  return cacheInstance;
}

/**
 * Create cache service with specific client
 */
export function createCacheService(client: RedisClient, ttlSeconds?: number): RedisCacheService {
  return new RedisCacheService(client, ttlSeconds);
}
