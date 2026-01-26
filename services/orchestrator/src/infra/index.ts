/**
 * Infrastructure Module
 * Phase 2.1: Caching and rate limiting for external services
 */

export { 
  LiteratureCache, 
  getLiteratureCache,
  type CacheStats 
} from './cache';

export { 
  getLimiter, 
  rateLimitedFetch, 
  fetchWithFallback,
  getStats,
  getAllStats,
  resetLimiter,
  shutdown,
  PROVIDER_LIMITS,
  type ProviderLimitConfig,
  type RateLimiterStats 
} from './rateLimiter';
