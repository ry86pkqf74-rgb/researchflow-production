/**
 * Cache Configuration (PERF-003)
 *
 * Centralized cache TTL settings by route type and use case.
 * Balances performance improvements with data freshness requirements.
 */

import { getEnvString, getEnvInt, getEnvBool, getEnvEnum } from './env';

/**
 * Cache backend types
 */
export const CACHE_BACKENDS = ['redis', 'memory'] as const;
export type CacheBackend = typeof CACHE_BACKENDS[number];

/**
 * TTL (Time-To-Live) in seconds for different cache categories
 */
export const CACHE_TTL = {
  // Ultra-short: Real-time data, streaming responses
  ULTRA_SHORT: 5, // 5 seconds

  // Very short: User-specific, frequently changing data
  VERY_SHORT: 30, // 30 seconds

  // Short: User session data, profile information
  SHORT: 60, // 1 minute

  // Medium: Research/manuscript data
  MEDIUM: 300, // 5 minutes

  // Long: Reference data, static content
  LONG: 3600, // 1 hour

  // Extra long: Configuration, settings (invalidate on change)
  EXTRA_LONG: 86400, // 24 hours
} as const;

/**
 * Route-specific cache configuration
 */
export const ROUTE_CACHE_CONFIG = {
  // AI endpoints - very short cache due to real-time nature
  '/api/ai': {
    ttl: CACHE_TTL.ULTRA_SHORT,
    enabled: true,
    bypassForAuth: true,
    description: 'AI completion endpoints - minimal caching',
  },

  '/api/ai/stream': {
    ttl: CACHE_TTL.ULTRA_SHORT,
    enabled: false, // Never cache streaming responses
    bypassForAuth: true,
    description: 'AI streaming endpoints - no caching',
  },

  // User/Auth endpoints - no caching
  '/api/auth': {
    ttl: 0,
    enabled: false,
    bypassForAuth: true,
    description: 'Authentication endpoints - never cache',
  },

  '/api/user': {
    ttl: CACHE_TTL.SHORT,
    enabled: true,
    bypassForAuth: true,
    description: 'User profile and account data',
  },

  '/api/user/me': {
    ttl: CACHE_TTL.SHORT,
    enabled: true,
    bypassForAuth: true,
    description: 'Current user information',
  },

  // Manuscript endpoints
  '/api/manuscript': {
    ttl: CACHE_TTL.MEDIUM,
    enabled: true,
    bypassForAuth: false,
    description: 'Manuscript list and metadata',
  },

  '/api/manuscript/:id': {
    ttl: CACHE_TTL.MEDIUM,
    enabled: true,
    bypassForAuth: false,
    description: 'Individual manuscript content',
  },

  '/api/manuscript/:id/review': {
    ttl: CACHE_TTL.MEDIUM,
    enabled: true,
    bypassForAuth: false,
    description: 'Manuscript review data',
  },

  // Research/Literature endpoints
  '/api/research': {
    ttl: CACHE_TTL.MEDIUM,
    enabled: true,
    bypassForAuth: false,
    description: 'Research data and metadata',
  },

  '/api/literature': {
    ttl: CACHE_TTL.MEDIUM,
    enabled: true,
    bypassForAuth: false,
    description: 'Literature search and references',
  },

  // Reference/Static data
  '/api/topics': {
    ttl: CACHE_TTL.LONG,
    enabled: true,
    bypassForAuth: false,
    description: 'Research topics and categories',
  },

  '/api/categories': {
    ttl: CACHE_TTL.LONG,
    enabled: true,
    bypassForAuth: false,
    description: 'Content categories',
  },

  '/api/tags': {
    ttl: CACHE_TTL.LONG,
    enabled: true,
    bypassForAuth: false,
    description: 'Content tags',
  },

  // Governance/Compliance endpoints
  '/api/governance': {
    ttl: CACHE_TTL.MEDIUM,
    enabled: true,
    bypassForAuth: true,
    description: 'Governance and compliance data',
  },

  // Collaboration endpoints
  '/api/collab': {
    ttl: CACHE_TTL.VERY_SHORT,
    enabled: true,
    bypassForAuth: false,
    description: 'Collaboration session data',
  },

  // Health checks - never cache
  '/health': {
    ttl: 0,
    enabled: false,
    bypassForAuth: false,
    description: 'Health check endpoint',
  },

  '/health/ready': {
    ttl: 0,
    enabled: false,
    bypassForAuth: false,
    description: 'Readiness check endpoint',
  },
} as const;

/**
 * HTTP method cache rules
 * Define which methods are cacheable by default
 */
export const METHOD_CACHE_RULES = {
  GET: {
    cacheable: true,
    default: true,
  },
  HEAD: {
    cacheable: true,
    default: false,
  },
  POST: {
    cacheable: false,
    default: false,
  },
  PUT: {
    cacheable: false,
    default: false,
  },
  PATCH: {
    cacheable: false,
    default: false,
  },
  DELETE: {
    cacheable: false,
    default: false,
  },
  OPTIONS: {
    cacheable: false,
    default: false,
  },
} as const;

/**
 * Cache strategy for different content types
 */
export const CONTENT_TYPE_CACHE = {
  'application/json': {
    cacheable: true,
    ttlMultiplier: 1.0,
  },
  'text/plain': {
    cacheable: true,
    ttlMultiplier: 1.0,
  },
  'text/html': {
    cacheable: true,
    ttlMultiplier: 1.0,
  },
  'text/css': {
    cacheable: true,
    ttlMultiplier: 2.0, // Slightly longer for CSS
  },
  'application/javascript': {
    cacheable: true,
    ttlMultiplier: 2.0, // Slightly longer for JS
  },
  'image/jpeg': {
    cacheable: true,
    ttlMultiplier: 5.0, // Much longer for images
  },
  'image/png': {
    cacheable: true,
    ttlMultiplier: 5.0,
  },
  'image/svg+xml': {
    cacheable: true,
    ttlMultiplier: 5.0,
  },
  'image/webp': {
    cacheable: true,
    ttlMultiplier: 5.0,
  },
} as const;

/**
 * Cache invalidation rules
 * Define which endpoints invalidate which cache patterns
 */
export const CACHE_INVALIDATION_RULES = {
  '/api/manuscript/:id': {
    invalidates: [
      '/api/manuscript', // Invalidate list when item changes
      '/api/research', // May affect research data
    ],
  },

  '/api/user/:id': {
    invalidates: [
      '/api/user/me', // Invalidate current user info
      '/api/user', // Invalidate user list
    ],
  },

  '/api/governance/:id': {
    invalidates: [
      '/api/governance', // Invalidate governance list
    ],
  },

  '/api/collab/:sessionId': {
    invalidates: [
      '/api/collab', // Invalidate collaboration list
    ],
  },
} as const;

/**
 * Get cache TTL for a specific route and method
 */
export function getCacheTTL(path: string, method: string = 'GET'): number {
  // Check method cachability first
  const methodRule = METHOD_CACHE_RULES[method as keyof typeof METHOD_CACHE_RULES];
  if (!methodRule?.cacheable) {
    return 0;
  }

  // Try exact match first
  for (const [route, config] of Object.entries(ROUTE_CACHE_CONFIG)) {
    if (route === path && config.enabled) {
      return config.ttl;
    }
  }

  // Try prefix match (e.g., /api/manuscript matches /api/manuscript/:id)
  for (const [route, config] of Object.entries(ROUTE_CACHE_CONFIG)) {
    const pattern = route.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}(?:/|$)`);

    if (regex.test(path) && config.enabled) {
      return config.ttl;
    }
  }

  // Default: don't cache if no matching rule
  return 0;
}

/**
 * Check if a route should bypass cache for authenticated mutations
 */
export function shouldBypassCacheForAuth(path: string): boolean {
  for (const [route, config] of Object.entries(ROUTE_CACHE_CONFIG)) {
    if (route === path) {
      return config.bypassForAuth;
    }
  }
  return false;
}

/**
 * Get cache invalidation targets for a route
 */
export function getCacheInvalidationTargets(path: string): string[] {
  for (const [route, targets] of Object.entries(CACHE_INVALIDATION_RULES)) {
    if (route === path) {
      return targets.invalidates;
    }
  }
  return [];
}

/**
 * Main cache configuration object
 */
export const cacheConfig = {
  // Backend selection
  backend: getEnvEnum('CACHE_BACKEND', CACHE_BACKENDS, 'redis'),
  redisUrl: getEnvString('REDIS_URL', 'redis://localhost:6379'),

  // Enable/disable caching globally
  enabled: getEnvBool('CACHE_ENABLED', true),

  // Cache key prefix
  keyPrefix: getEnvString('CACHE_KEY_PREFIX', 'rf:cache:'),

  // Maximum cache size (for memory backend, in number of entries)
  maxEntries: getEnvInt('CACHE_MAX_ENTRIES', 10000),

  // Cleanup interval for expired entries (seconds)
  cleanupIntervalSeconds: getEnvInt('CACHE_CLEANUP_INTERVAL', 300),

  // Enable cache statistics
  statsEnabled: getEnvBool('CACHE_STATS_ENABLED', true),

  // Enable cache warming (pre-populate frequently accessed data)
  warmingEnabled: getEnvBool('CACHE_WARMING_ENABLED', false),

  // Cache compression (for Redis)
  compressionEnabled: getEnvBool('CACHE_COMPRESSION_ENABLED', false),
  compressionThreshold: getEnvInt('CACHE_COMPRESSION_THRESHOLD', 1024), // bytes

  // Stale-while-revalidate: serve stale cache while refreshing
  staleWhileRevalidate: getEnvBool('CACHE_STALE_WHILE_REVALIDATE', true),
  staleWhileRevalidateTtl: getEnvInt('CACHE_STALE_WHILE_REVALIDATE_TTL', 86400), // 24 hours

  // Cache hit/miss tracking
  trackingEnabled: getEnvBool('CACHE_TRACKING_ENABLED', true),

  // Distributed cache synchronization (for multiple instances)
  distributedSync: getEnvBool('CACHE_DISTRIBUTED_SYNC', false),
  syncInterval: getEnvInt('CACHE_SYNC_INTERVAL', 60), // seconds
} as const;

export default cacheConfig;
