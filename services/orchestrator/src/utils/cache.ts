/**
 * Redis Caching Layer
 *
 * Generic cache helpers with TTL management for ResearchFlow.
 * Provides namespace-based key prefixes and configurable TTL defaults.
 *
 * Namespaces:
 * - rf:gov:   Governance state (5 minute TTL)
 * - rf:stage: Stage metadata (15 minute TTL)
 * - rf:user:  User preferences (1 hour TTL)
 */

import { createClient, RedisClientType } from 'redis';

// Cache namespaces with their key prefixes
export const CacheNamespace = {
  GOVERNANCE: 'rf:gov:',
  STAGE: 'rf:stage:',
  USER: 'rf:user:',
} as const;

export type CacheNamespaceType = (typeof CacheNamespace)[keyof typeof CacheNamespace];

// Default TTL values in seconds
export const DefaultTTL = {
  GOVERNANCE_STATE: 5 * 60,    // 5 minutes
  STAGE_METADATA: 15 * 60,     // 15 minutes
  USER_PREFS: 60 * 60,         // 1 hour
} as const;

// Cache configuration
export interface CacheConfig {
  redisUrl: string;
  keyPrefix?: string;
  defaultTtlSeconds?: number;
  enableCompression?: boolean;
}

// Cache entry metadata
export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  expiresAt: string;
  namespace: string;
}

// Redis client singleton
let redisClient: RedisClientType | null = null;
let isConnected = false;

/**
 * Initialize Redis connection
 */
export async function initializeCache(config?: Partial<CacheConfig>): Promise<void> {
  if (redisClient && isConnected) {
    return;
  }

  const redisUrl = config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[Cache] Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      console.error('[Cache] Redis client error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('[Cache] Redis connected');
      isConnected = true;
    });

    redisClient.on('disconnect', () => {
      console.log('[Cache] Redis disconnected');
      isConnected = false;
    });

    await redisClient.connect();
    isConnected = true;
  } catch (error) {
    console.error('[Cache] Failed to initialize Redis:', error);
    redisClient = null;
    isConnected = false;
  }
}

/**
 * Get the Redis client (for direct access if needed)
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Check if cache is available
 */
export function isCacheAvailable(): boolean {
  return redisClient !== null && isConnected;
}

/**
 * Build a namespaced cache key
 */
export function buildKey(namespace: CacheNamespaceType, key: string): string {
  return `${namespace}${key}`;
}

/**
 * Get a value from cache
 *
 * @param namespace - Cache namespace prefix
 * @param key - Cache key (without namespace)
 * @returns Cached value or null if not found/expired
 */
export async function cacheGet<T>(
  namespace: CacheNamespaceType,
  key: string
): Promise<T | null> {
  if (!isCacheAvailable()) {
    return null;
  }

  try {
    const fullKey = buildKey(namespace, key);
    const cached = await redisClient!.get(fullKey);

    if (!cached) {
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(cached);
    return entry.data;
  } catch (error) {
    console.warn(`[Cache] Error getting key ${namespace}${key}:`, error);
    return null;
  }
}

/**
 * Set a value in cache with TTL
 *
 * @param namespace - Cache namespace prefix
 * @param key - Cache key (without namespace)
 * @param value - Value to cache
 * @param ttlSeconds - Time-to-live in seconds (uses namespace default if not provided)
 */
export async function cacheSet<T>(
  namespace: CacheNamespaceType,
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<boolean> {
  if (!isCacheAvailable()) {
    return false;
  }

  // Use default TTL based on namespace if not provided
  const ttl = ttlSeconds ?? getDefaultTTL(namespace);

  try {
    const fullKey = buildKey(namespace, key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const entry: CacheEntry<T> = {
      data: value,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      namespace,
    };

    await redisClient!.setEx(fullKey, ttl, JSON.stringify(entry));
    return true;
  } catch (error) {
    console.warn(`[Cache] Error setting key ${namespace}${key}:`, error);
    return false;
  }
}

/**
 * Invalidate (delete) a cache entry
 *
 * @param namespace - Cache namespace prefix
 * @param key - Cache key (without namespace)
 */
export async function cacheInvalidate(
  namespace: CacheNamespaceType,
  key: string
): Promise<boolean> {
  if (!isCacheAvailable()) {
    return false;
  }

  try {
    const fullKey = buildKey(namespace, key);
    await redisClient!.del(fullKey);
    return true;
  } catch (error) {
    console.warn(`[Cache] Error invalidating key ${namespace}${key}:`, error);
    return false;
  }
}

/**
 * Invalidate all keys in a namespace
 *
 * @param namespace - Cache namespace prefix to clear
 */
export async function cacheInvalidateNamespace(
  namespace: CacheNamespaceType
): Promise<number> {
  if (!isCacheAvailable()) {
    return 0;
  }

  try {
    const pattern = `${namespace}*`;
    const keys = await redisClient!.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await redisClient!.del(keys);
    return keys.length;
  } catch (error) {
    console.warn(`[Cache] Error invalidating namespace ${namespace}:`, error);
    return 0;
  }
}

/**
 * Get or fetch pattern - returns cached value or fetches and caches
 *
 * @param namespace - Cache namespace prefix
 * @param key - Cache key (without namespace)
 * @param fetcher - Function to fetch value if not cached
 * @param ttlSeconds - TTL in seconds (optional)
 */
export async function cacheGetOrFetch<T>(
  namespace: CacheNamespaceType,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds?: number
): Promise<{ data: T; fromCache: boolean }> {
  // Try cache first
  const cached = await cacheGet<T>(namespace, key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // Fetch and cache
  const data = await fetcher();
  await cacheSet(namespace, key, data, ttlSeconds);
  return { data, fromCache: false };
}

/**
 * Get default TTL for a namespace
 */
function getDefaultTTL(namespace: CacheNamespaceType): number {
  switch (namespace) {
    case CacheNamespace.GOVERNANCE:
      return DefaultTTL.GOVERNANCE_STATE;
    case CacheNamespace.STAGE:
      return DefaultTTL.STAGE_METADATA;
    case CacheNamespace.USER:
      return DefaultTTL.USER_PREFS;
    default:
      return 300; // 5 minutes default
  }
}

/**
 * Check if a key exists in cache
 */
export async function cacheExists(
  namespace: CacheNamespaceType,
  key: string
): Promise<boolean> {
  if (!isCacheAvailable()) {
    return false;
  }

  try {
    const fullKey = buildKey(namespace, key);
    const exists = await redisClient!.exists(fullKey);
    return exists > 0;
  } catch (error) {
    console.warn(`[Cache] Error checking existence of ${namespace}${key}:`, error);
    return false;
  }
}

/**
 * Get TTL remaining for a cached key
 */
export async function cacheGetTTL(
  namespace: CacheNamespaceType,
  key: string
): Promise<number> {
  if (!isCacheAvailable()) {
    return -1;
  }

  try {
    const fullKey = buildKey(namespace, key);
    return await redisClient!.ttl(fullKey);
  } catch (error) {
    console.warn(`[Cache] Error getting TTL for ${namespace}${key}:`, error);
    return -1;
  }
}

/**
 * Close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (redisClient && isConnected) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    console.log('[Cache] Redis connection closed');
  }
}

/**
 * Cache health check
 */
export async function cacheHealthCheck(): Promise<{
  healthy: boolean;
  connected: boolean;
  latencyMs: number | null;
}> {
  if (!isCacheAvailable()) {
    return { healthy: false, connected: false, latencyMs: null };
  }

  try {
    const start = Date.now();
    await redisClient!.ping();
    const latencyMs = Date.now() - start;

    return { healthy: true, connected: true, latencyMs };
  } catch (error) {
    return { healthy: false, connected: isConnected, latencyMs: null };
  }
}
