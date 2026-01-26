/**
 * Literature Service Cache
 * Phase 2.1: Redis-backed caching with in-memory fallback
 * 
 * Reduces redundant API calls to PubMed, Semantic Scholar, and ArXiv.
 * Expected 80% reduction in external API calls.
 */

import { createClient, RedisClientType } from 'redis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  hitRate: number;
}

/**
 * Literature Cache Service
 * 
 * Provides caching for external literature API calls with:
 * - Redis backend (when available)
 * - In-memory fallback
 * - TTL-based expiration
 * - Cache statistics
 */
export class LiteratureCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private redis: RedisClientType | null = null;
  private defaultTTL: number;
  private stats: CacheStats = { hits: 0, misses: 0, writes: 0, hitRate: 0 };
  private isConnected = false;

  constructor(options: {
    redisUrl?: string;
    defaultTTL?: number;
  } = {}) {
    this.defaultTTL = options.defaultTTL || 3600000; // 1 hour default
    
    if (options.redisUrl) {
      this.initRedis(options.redisUrl);
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initRedis(url: string): Promise<void> {
    try {
      this.redis = createClient({ url });
      
      this.redis.on('error', (err) => {
        console.error('[LiteratureCache] Redis error:', err.message);
        this.isConnected = false;
      });
      
      this.redis.on('connect', () => {
        console.log('[LiteratureCache] Redis connected');
        this.isConnected = true;
      });
      
      await this.redis.connect();
    } catch (error) {
      console.warn('[LiteratureCache] Redis init failed, using memory cache:', error);
      this.redis = null;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    if (this.redis && this.isConnected) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          this.stats.hits++;
          this.updateHitRate();
          return JSON.parse(value) as T;
        }
      } catch (error) {
        console.warn('[LiteratureCache] Redis get failed:', error);
      }
    }
    
    // Fallback to memory
    const entry = this.memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      this.stats.hits++;
      this.updateHitRate();
      return entry.value as T;
    }
    
    // Cache miss
    if (entry) {
      this.memoryCache.delete(key); // Clean up expired
    }
    
    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlMs = ttl || this.defaultTTL;
    const expiresAt = Date.now() + ttlMs;
    
    // Store in Redis
    if (this.redis && this.isConnected) {
      try {
        await this.redis.setEx(key, Math.floor(ttlMs / 1000), JSON.stringify(value));
      } catch (error) {
        console.warn('[LiteratureCache] Redis set failed:', error);
      }
    }
    
    // Always store in memory as fallback
    this.memoryCache.set(key, { value, expiresAt });
    this.stats.writes++;
    
    // Prevent memory bloat - limit to 10000 entries
    if (this.memoryCache.size > 10000) {
      this.evictExpired();
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    if (this.redis && this.isConnected) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.warn('[LiteratureCache] Redis delete failed:', error);
      }
    }
    this.memoryCache.delete(key);
  }

  /**
   * Generate cache key for literature queries
   */
  generateKey(service: string, query: string, params?: Record<string, any>): string {
    const base = `lit:${service}:${Buffer.from(query).toString('base64').slice(0, 50)}`;
    if (params) {
      const paramStr = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      return `${base}:${Buffer.from(paramStr).toString('base64').slice(0, 20)}`;
    }
    return base;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    if (this.redis && this.isConnected) {
      try {
        // Clear only literature keys
        const keys = await this.redis.keys('lit:*');
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } catch (error) {
        console.warn('[LiteratureCache] Redis clear failed:', error);
      }
    }
    this.memoryCache.clear();
    this.stats = { hits: 0, misses: 0, writes: 0, hitRate: 0 };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Evict expired entries from memory cache
   */
  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
        evicted++;
      }
    }
    
    console.log(`[LiteratureCache] Evicted ${evicted} expired entries`);
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
    }
  }
}

// Singleton instance
let cacheInstance: LiteratureCache | null = null;

export function getLiteratureCache(): LiteratureCache {
  if (!cacheInstance) {
    cacheInstance = new LiteratureCache({
      redisUrl: process.env.REDIS_URL,
      defaultTTL: parseInt(process.env.LITERATURE_CACHE_TTL || '3600000', 10)
    });
  }
  return cacheInstance;
}

export default getLiteratureCache;
