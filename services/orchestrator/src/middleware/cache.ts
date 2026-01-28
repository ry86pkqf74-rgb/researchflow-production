/**
 * Redis Caching Middleware (PERF-003)
 *
 * High-performance HTTP response caching with:
 * - Configurable TTL by route type
 * - Cache key generation from request metadata
 * - Cache invalidation helpers
 * - Bypass for authenticated mutations
 * - Redis and in-memory backends
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import Redis from 'ioredis';

/**
 * Cache backend interface
 */
export interface ICacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * Redis cache backend implementation
 */
class RedisCache implements ICacheBackend {
  private redis: Redis;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.redis.on('error', (err) => {
      console.error('Redis cache connection error:', err);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

/**
 * In-memory cache backend (fallback)
 */
class MemoryCache implements ICacheBackend {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Cache middleware configuration
 */
export interface CacheMiddlewareOptions {
  backend?: 'redis' | 'memory';
  redisUrl?: string;
  keyPrefix?: string;
  enabled?: boolean;
}

/**
 * Cache middleware factory
 */
export class CacheMiddleware {
  private backend: ICacheBackend;
  private keyPrefix: string;
  private enabled: boolean;

  constructor(options: CacheMiddlewareOptions = {}) {
    const { backend = 'redis', redisUrl, keyPrefix = 'cache:', enabled = true } = options;

    this.keyPrefix = keyPrefix;
    this.enabled = enabled && process.env.CACHE_ENABLED !== 'false';

    // Initialize appropriate backend
    if (backend === 'redis') {
      this.backend = new RedisCache(redisUrl);
    } else {
      this.backend = new MemoryCache();
    }
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(req: Request): string {
    const method = req.method.toUpperCase();
    const path = req.path;
    const query = Object.entries(req.query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const key = query ? `${method}:${path}?${query}` : `${method}:${path}`;
    return this.keyPrefix + key;
  }

  /**
   * Determine if request should be cached
   */
  private shouldCache(req: Request): boolean {
    // Only cache GET and HEAD requests
    if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      return false;
    }

    // Don't cache authenticated mutations (e.g., /api/auth)
    if (req.path.includes('/auth') || req.path.includes('/login') || req.path.includes('/logout')) {
      return false;
    }

    // Don't cache if user explicitly requests fresh data
    if (req.headers['cache-control']?.includes('no-cache')) {
      return false;
    }

    // Don't cache health checks and internal endpoints
    if (req.path.startsWith('/health') || req.path.startsWith('/_internal')) {
      return false;
    }

    return true;
  }

  /**
   * Get TTL for a route
   */
  private getTTL(req: Request): number {
    const path = req.path;

    // Very short cache for rapidly changing data
    if (path.includes('/api/ai') || path.includes('/ai/stream')) {
      return 10; // 10 seconds
    }

    // Short cache for user-specific data
    if (path.includes('/user') || path.includes('/profile') || path.includes('/me')) {
      return 60; // 1 minute
    }

    // Medium cache for research/manuscript data
    if (path.includes('/manuscript') || path.includes('/research') || path.includes('/review')) {
      return 300; // 5 minutes
    }

    // Longer cache for reference data (static research topics, etc)
    if (path.includes('/topics') || path.includes('/categories') || path.includes('/references')) {
      return 3600; // 1 hour
    }

    // Default: 5 minutes
    return 300;
  }

  /**
   * Middleware function
   */
  middleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip if caching is disabled
      if (!this.enabled) {
        return next();
      }

      // Check if request should be cached
      if (!this.shouldCache(req)) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req);

      try {
        // Try to get from cache
        const cachedResponse = await this.backend.get(cacheKey);

        if (cachedResponse) {
          const { statusCode, headers, body } = JSON.parse(cachedResponse);

          // Set cache headers
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('Cache-Control', `public, max-age=${this.getTTL(req)}`);

          // Restore original headers
          Object.entries(headers).forEach(([key, value]) => {
            res.setHeader(key, value as string);
          });

          return res.status(statusCode).send(body);
        }
      } catch (error) {
        console.error(`Cache retrieval error for ${cacheKey}:`, error);
        // Fall through to normal processing
      }

      // Wrap res.send to cache the response
      const originalSend = res.send.bind(res);

      res.send = function (data: any) {
        // Cache successful responses (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const ttl = this.getTTL(req);
            const cacheData = {
              statusCode: res.statusCode,
              headers: Object.fromEntries(
                Object.entries(res.getHeaders()).filter(
                  ([key]) => !['content-length', 'transfer-encoding'].includes(key.toLowerCase())
                )
              ),
              body: data,
            };

            this.backend.set(cacheKey, JSON.stringify(cacheData), ttl);
            res.setHeader('X-Cache', 'MISS');
          } catch (error) {
            console.error(`Cache write error for ${cacheKey}:`, error);
          }
        }

        return originalSend(data);
      } as any;

      next();
    };
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ healthy: boolean }> {
    return {
      healthy: await this.backend.healthCheck(),
    };
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    if (pattern === '*') {
      await this.backend.clear();
    } else {
      // For memory backend, we can't do pattern-based deletion
      // In production with Redis, use KEYS pattern
      await this.backend.del(this.keyPrefix + pattern);
    }
  }

  /**
   * Create cache-busting endpoint helper
   */
  createInvalidationMiddleware(requireAuth: boolean = true): RequestHandler {
    return async (req: Request, res: Response) => {
      if (requireAuth && !req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { pattern = '*' } = req.body;

      try {
        await this.invalidate(pattern);
        res.json({ success: true, message: `Cache invalidated for pattern: ${pattern}` });
      } catch (error) {
        res.status(500).json({ error: 'Cache invalidation failed', details: (error as Error).message });
      }
    };
  }
}

/**
 * Helper to create tag-based cache invalidation
 * Useful for invalidating related cached entries
 */
export class TaggedCache {
  private cache: CacheMiddleware;
  private tagIndex = new Map<string, Set<string>>();

  constructor(cache: CacheMiddleware) {
    this.cache = cache;
  }

  /**
   * Store cache with tags for invalidation
   */
  async setWithTags(key: string, value: string, ttl: number, tags: string[]): Promise<void> {
    // First, store the cache entry
    await this.cache['backend'].set(key, value, ttl);

    // Then, index the tags
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Invalidate all entries with a specific tag
   */
  async invalidateByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag) || new Set();

    for (const key of keys) {
      await this.cache['backend'].del(key);
    }

    this.tagIndex.delete(tag);
  }
}

/**
 * Export factory function for easy setup
 */
export function createCacheMiddleware(options?: CacheMiddlewareOptions): CacheMiddleware {
  return new CacheMiddleware(options);
}

export default createCacheMiddleware;
