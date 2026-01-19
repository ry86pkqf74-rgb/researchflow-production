/**
 * Schema Caching in Redis - Task 167
 *
 * Caches compiled validators and resolved schema graphs to reduce
 * orchestrator CPU spikes when job volume increases.
 */

import Redis from 'ioredis';
// @ts-ignore - ajv version compatibility
import Ajv from 'ajv';
// @ts-ignore - ajv-formats is an optional peer dependency
import addFormats from 'ajv-formats';
import { createHash } from 'crypto';

// Type alias for compiled validator (compatible with both Ajv v6 and v8)
type ValidateFunction = ((data: unknown) => boolean) & { errors?: Array<{ dataPath?: string; instancePath?: string; message?: string; keyword: string }> };

/**
 * Cache key format: schema:{schemaId}:{schemaHash}
 */
const CACHE_PREFIX = 'schema:';
const DEFAULT_TTL = 3600; // 1 hour

/**
 * Cached schema entry
 */
interface CachedSchema {
  schemaId: string;
  schemaHash: string;
  schema: object;
  resolvedRefs?: Record<string, object>;
  compiledAt: string;
  accessCount: number;
  lastAccessedAt: string;
}

/**
 * Schema cache statistics
 */
interface SchemaCacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
  avgAccessCount: number;
}

/**
 * Redis-backed schema cache
 */
export class SchemaCache {
  private redis: Redis;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ajv: any;
  private localCache = new Map<string, ValidateFunction>();
  private stats = { hits: 0, misses: 0 };
  private ttl: number;
  private maxLocalCacheSize: number;

  constructor(options: {
    redisUrl?: string;
    ttl?: number;
    maxLocalCacheSize?: number;
  } = {}) {
    this.redis = new Redis(options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
    this.ttl = options.ttl ?? DEFAULT_TTL;
    this.maxLocalCacheSize = options.maxLocalCacheSize ?? 100;

    // Configure AJV with formats (compatible with Ajv v6 and v8)
    this.ajv = new Ajv({
      allErrors: true,
    });
    try {
      addFormats(this.ajv);
    } catch {
      // ajv-formats not available
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(schemaId: string, schemaHash: string): string {
    return `${CACHE_PREFIX}${schemaId}:${schemaHash}`;
  }

  /**
   * Calculate schema hash
   */
  static calculateSchemaHash(schema: object): string {
    const canonical = JSON.stringify(schema, Object.keys(schema as Record<string, unknown>).sort());
    return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  }

  /**
   * Get or compile a validator
   */
  async getValidator(
    schemaId: string,
    schema: object
  ): Promise<ValidateFunction> {
    const schemaHash = SchemaCache.calculateSchemaHash(schema);
    const cacheKey = this.getCacheKey(schemaId, schemaHash);

    // Check local cache first (fastest)
    const localValidator = this.localCache.get(cacheKey);
    if (localValidator) {
      this.stats.hits++;
      await this.updateAccessStats(cacheKey);
      return localValidator;
    }

    // Check Redis cache
    const cachedStr = await this.redis.get(cacheKey);
    if (cachedStr) {
      try {
        const cached: CachedSchema = JSON.parse(cachedStr);

        // Compile from cached schema
        const validator = this.ajv.compile(cached.schema);

        // Store in local cache
        this.setLocalCache(cacheKey, validator);

        this.stats.hits++;
        await this.updateAccessStats(cacheKey);

        return validator;
      } catch (err) {
        console.error(`[SchemaCache] Failed to parse cached schema ${schemaId}:`, err);
        // Fall through to compile
      }
    }

    // Cache miss - compile and store
    this.stats.misses++;
    const validator = this.ajv.compile(schema);

    // Store in Redis
    const cacheEntry: CachedSchema = {
      schemaId,
      schemaHash,
      schema,
      compiledAt: new Date().toISOString(),
      accessCount: 1,
      lastAccessedAt: new Date().toISOString(),
    };

    await this.redis.setex(cacheKey, this.ttl, JSON.stringify(cacheEntry));

    // Store in local cache
    this.setLocalCache(cacheKey, validator);

    return validator;
  }

  /**
   * Set local cache with LRU eviction
   */
  private setLocalCache(key: string, validator: ValidateFunction): void {
    // Simple LRU: remove oldest if at max size
    if (this.localCache.size >= this.maxLocalCacheSize) {
      const oldestKey = this.localCache.keys().next().value;
      if (oldestKey) {
        this.localCache.delete(oldestKey);
      }
    }

    this.localCache.set(key, validator);
  }

  /**
   * Update access statistics in Redis
   */
  private async updateAccessStats(cacheKey: string): Promise<void> {
    try {
      const cachedStr = await this.redis.get(cacheKey);
      if (cachedStr) {
        const cached: CachedSchema = JSON.parse(cachedStr);
        cached.accessCount++;
        cached.lastAccessedAt = new Date().toISOString();
        await this.redis.setex(cacheKey, this.ttl, JSON.stringify(cached));
      }
    } catch {
      // Ignore update failures
    }
  }

  /**
   * Validate data against a schema
   */
  async validate(
    schemaId: string,
    schema: object,
    data: unknown
  ): Promise<{
    valid: boolean;
    errors?: Array<{
      path: string;
      message: string;
      keyword: string;
    }>;
  }> {
    const validator = await this.getValidator(schemaId, schema);
    const valid = validator(data);

    if (!valid && validator.errors) {
      return {
        valid: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errors: validator.errors.map((err: any) => ({
          // Support both Ajv v6 (dataPath) and v8 (instancePath)
          path: err.instancePath || err.dataPath || '/',
          message: err.message ?? 'Validation error',
          keyword: err.keyword,
        })),
      };
    }

    return { valid: true };
  }

  /**
   * Pre-compile and cache a schema
   */
  async warmup(schemaId: string, schema: object): Promise<void> {
    await this.getValidator(schemaId, schema);
    console.log(`[SchemaCache] Warmed up schema: ${schemaId}`);
  }

  /**
   * Pre-compile multiple schemas
   */
  async warmupBatch(
    schemas: Array<{ id: string; schema: object }>
  ): Promise<void> {
    await Promise.all(schemas.map(s => this.warmup(s.id, s.schema)));
    console.log(`[SchemaCache] Warmed up ${schemas.length} schemas`);
  }

  /**
   * Invalidate a cached schema
   */
  async invalidate(schemaId: string, schemaHash?: string): Promise<number> {
    if (schemaHash) {
      const cacheKey = this.getCacheKey(schemaId, schemaHash);
      this.localCache.delete(cacheKey);
      return this.redis.del(cacheKey);
    }

    // Invalidate all versions of this schema
    const pattern = `${CACHE_PREFIX}${schemaId}:*`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      this.localCache.delete(key);
    }

    if (keys.length > 0) {
      return this.redis.del(...keys);
    }

    return 0;
  }

  /**
   * Clear all cached schemas
   */
  async clearAll(): Promise<number> {
    this.localCache.clear();

    const keys = await this.redis.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      return this.redis.del(...keys);
    }

    return 0;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<SchemaCacheStats> {
    const keys = await this.redis.keys(`${CACHE_PREFIX}*`);
    let totalAccessCount = 0;

    for (const key of keys) {
      const cachedStr = await this.redis.get(key);
      if (cachedStr) {
        try {
          const cached: CachedSchema = JSON.parse(cachedStr);
          totalAccessCount += cached.accessCount;
        } catch {}
      }
    }

    const total = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: keys.length,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgAccessCount: keys.length > 0 ? totalAccessCount / keys.length : 0,
    };
  }

  /**
   * List cached schemas
   */
  async listCachedSchemas(): Promise<Array<{
    schemaId: string;
    schemaHash: string;
    compiledAt: string;
    accessCount: number;
  }>> {
    const keys = await this.redis.keys(`${CACHE_PREFIX}*`);
    const results: Array<{
      schemaId: string;
      schemaHash: string;
      compiledAt: string;
      accessCount: number;
    }> = [];

    for (const key of keys) {
      const cachedStr = await this.redis.get(key);
      if (cachedStr) {
        try {
          const cached: CachedSchema = JSON.parse(cachedStr);
          results.push({
            schemaId: cached.schemaId,
            schemaHash: cached.schemaHash,
            compiledAt: cached.compiledAt,
            accessCount: cached.accessCount,
          });
        } catch {}
      }
    }

    return results;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    this.localCache.clear();
    await this.redis.quit();
  }
}

/**
 * Singleton schema cache instance
 */
let schemaCacheInstance: SchemaCache | null = null;

/**
 * Get the schema cache instance
 */
export function getSchemaCache(): SchemaCache {
  if (!schemaCacheInstance) {
    schemaCacheInstance = new SchemaCache();
  }
  return schemaCacheInstance;
}

/**
 * Reset schema cache (for testing)
 */
export async function resetSchemaCache(): Promise<void> {
  if (schemaCacheInstance) {
    await schemaCacheInstance.close();
    schemaCacheInstance = null;
  }
}

export default SchemaCache;
