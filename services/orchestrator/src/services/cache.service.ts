/**
 * Redis Cache Service
 *
 * Provides caching layer for:
 * - GraphQL query results
 * - PubMed/literature search results
 * - Schema definitions
 * - Session data
 */

import { logger } from '../logger/file-logger.js';

interface CacheConfig {
  url: string;
  prefix: string;
  defaultTTL: number; // seconds
  maxMemory: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
}

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<string | null>;
  del(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  mget(keys: string[]): Promise<(string | null)[]>;
  mset(pairs: Record<string, string>): Promise<string>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, field: string | string[]): Promise<number>;
  quit(): Promise<void>;
};

const defaultConfig: CacheConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  prefix: 'rf:cache:',
  defaultTTL: 300, // 5 minutes
  maxMemory: '256mb'
};

export class CacheService {
  private config: CacheConfig;
  private client?: RedisClient;
  private stats = { hits: 0, misses: 0 };
  private localCache: Map<string, { value: any; expires: number }> = new Map();

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      const { createClient } = await import('redis');
      this.client = createClient({ url: this.config.url }) as unknown as RedisClient;
      await (this.client as any).connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.warn('Redis not available, using in-memory cache');
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.config.prefix + key;

    // Try Redis first
    if (this.client) {
      try {
        const value = await this.client.get(fullKey);
        if (value) {
          this.stats.hits++;
          return JSON.parse(value) as T;
        }
        this.stats.misses++;
        return null;
      } catch (error) {
        logger.error('Redis get error:', error);
      }
    }

    // Fallback to local cache
    const local = this.localCache.get(fullKey);
    if (local && local.expires > Date.now()) {
      this.stats.hits++;
      return local.value as T;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const fullKey = this.config.prefix + key;
    const expiration = ttl || this.config.defaultTTL;
    const serialized = JSON.stringify(value);

    // Set in Redis
    if (this.client) {
      try {
        await this.client.set(fullKey, serialized, { EX: expiration });
        return;
      } catch (error) {
        logger.error('Redis set error:', error);
      }
    }

    // Fallback to local cache
    this.localCache.set(fullKey, {
      value,
      expires: Date.now() + expiration * 1000
    });
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.config.prefix + key;

    if (this.client) {
      try {
        await this.client.del(fullKey);
      } catch (error) {
        logger.error('Redis del error:', error);
      }
    }

    this.localCache.delete(fullKey);
  }

  /**
   * Invalidate keys matching pattern
   */
  async invalidate(pattern: string): Promise<number> {
    const fullPattern = this.config.prefix + pattern;
    let count = 0;

    if (this.client) {
      try {
        // Use SCAN for production, KEYS for dev
        const keys = await this.client.keys(fullPattern.replace('*', ''));
        if (keys.length > 0) {
          count = await this.client.del(keys);
        }
      } catch (error) {
        logger.error('Redis invalidate error:', error);
      }
    }

    // Clear matching local cache entries
    for (const key of this.localCache.keys()) {
      if (key.startsWith(fullPattern.replace('*', ''))) {
        this.localCache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get or set pattern - fetch from cache or compute
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Multi-get
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const fullKeys = keys.map(k => this.config.prefix + k);

    if (this.client) {
      try {
        const values = await this.client.mget(fullKeys);
        return values.map(v => (v ? JSON.parse(v) : null));
      } catch (error) {
        logger.error('Redis mget error:', error);
      }
    }

    // Fallback
    return keys.map(k => {
      const local = this.localCache.get(this.config.prefix + k);
      return local && local.expires > Date.now() ? local.value : null;
    });
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.config.prefix + key;

    if (this.client) {
      try {
        return (await this.client.exists(fullKey)) === 1;
      } catch (error) {
        logger.error('Redis exists error:', error);
      }
    }

    const local = this.localCache.get(fullKey);
    return !!(local && local.expires > Date.now());
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      keys: this.localCache.size
    };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await this.invalidate('*');
    this.localCache.clear();
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  // ============================================
  // Specialized caching methods for PubMed/Literature
  // ============================================

  /**
   * Cache PubMed search results
   */
  async cachePubMedSearch(
    query: string,
    results: any[],
    ttl: number = 3600 // 1 hour default
  ): Promise<void> {
    const key = `pubmed:search:${this.hashQuery(query)}`;
    await this.set(key, {
      query,
      results,
      cachedAt: new Date().toISOString()
    }, ttl);
  }

  /**
   * Get cached PubMed search results
   */
  async getCachedPubMedSearch(query: string): Promise<any[] | null> {
    const key = `pubmed:search:${this.hashQuery(query)}`;
    const cached = await this.get<{ results: any[] }>(key);
    return cached?.results || null;
  }

  /**
   * Cache individual PubMed article
   */
  async cachePubMedArticle(pmid: string, article: any): Promise<void> {
    const key = `pubmed:article:${pmid}`;
    await this.set(key, article, 86400); // 24 hours
  }

  /**
   * Get cached PubMed article
   */
  async getCachedPubMedArticle(pmid: string): Promise<any | null> {
    const key = `pubmed:article:${pmid}`;
    return this.get(key);
  }

  /**
   * Cache schema definition
   */
  async cacheSchema(name: string, version: string, schema: any): Promise<void> {
    const key = `schema:${name}:${version}`;
    await this.set(key, schema, 3600); // 1 hour
  }

  /**
   * Get cached schema
   */
  async getCachedSchema(name: string, version: string): Promise<any | null> {
    const key = `schema:${name}:${version}`;
    return this.get(key);
  }

  // Utility

  private hashQuery(query: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }
}

export default CacheService;
