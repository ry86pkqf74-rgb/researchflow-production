/**
 * External API Rate Limiter
 * Phase 2.1: Provider-specific rate limiting using Bottleneck
 * 
 * Ensures compliance with external API rate limits:
 * - PubMed: 3 req/sec (with API key), 1 req/sec (without)
 * - Semantic Scholar: 10 req/sec
 * - ArXiv: 1 req/3sec
 */

import Bottleneck from 'bottleneck';

/**
 * Provider rate limit configurations
 */
export interface ProviderLimitConfig {
  maxConcurrent: number;
  minTime: number;        // Minimum time between requests (ms)
  reservoir?: number;     // Max requests per interval
  reservoirRefreshInterval?: number;
  reservoirRefreshAmount?: number;
}

export const PROVIDER_LIMITS: Record<string, ProviderLimitConfig> = {
  pubmed: { 
    maxConcurrent: 3, 
    minTime: 334,  // ~3 req/sec
    reservoir: 10,
    reservoirRefreshInterval: 1000,
    reservoirRefreshAmount: 3
  },
  pubmed_nokey: { 
    maxConcurrent: 1, 
    minTime: 1000  // 1 req/sec without API key
  },
  semanticscholar: { 
    maxConcurrent: 5, 
    minTime: 100,  // ~10 req/sec
    reservoir: 100,
    reservoirRefreshInterval: 60000,
    reservoirRefreshAmount: 100
  },
  arxiv: { 
    maxConcurrent: 1, 
    minTime: 3000  // 1 req/3sec
  },
  crossref: {
    maxConcurrent: 5,
    minTime: 50,   // Generous limit
    reservoir: 50,
    reservoirRefreshInterval: 1000,
    reservoirRefreshAmount: 50
  }
};

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  provider: string;
  queued: number;
  running: number;
  done: number;
  failed: number;
  reservoir: number | null;
}

/**
 * Provider rate limiters (singleton pattern)
 */
const limiters: Map<string, Bottleneck> = new Map();
const stats: Map<string, { done: number; failed: number }> = new Map();

/**
 * Get or create a rate limiter for a provider
 */
export function getLimiter(provider: string): Bottleneck {
  const key = provider.toLowerCase();
  
  if (!limiters.has(key)) {
    const config = PROVIDER_LIMITS[key] || { maxConcurrent: 1, minTime: 1000 };
    
    const limiter = new Bottleneck({
      maxConcurrent: config.maxConcurrent,
      minTime: config.minTime,
      reservoir: config.reservoir,
      reservoirRefreshInterval: config.reservoirRefreshInterval,
      reservoirRefreshAmount: config.reservoirRefreshAmount
    });
    
    // Track statistics
    stats.set(key, { done: 0, failed: 0 });
    
    limiter.on('done', () => {
      const s = stats.get(key)!;
      s.done++;
    });
    
    limiter.on('failed', () => {
      const s = stats.get(key)!;
      s.failed++;
    });
    
    limiters.set(key, limiter);
    console.log(`[RateLimiter] Created limiter for ${key}:`, config);
  }
  
  return limiters.get(key)!;
}

/**
 * Execute a rate-limited fetch
 */
export async function rateLimitedFetch<T>(
  provider: string,
  fetchFn: () => Promise<T>,
  options: {
    priority?: number;
    weight?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const limiter = getLimiter(provider);
  
  return limiter.schedule(
    {
      priority: options.priority || 5,  // 0-9, lower = higher priority
      weight: options.weight || 1
    },
    async () => {
      if (options.timeout) {
        return Promise.race([
          fetchFn(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), options.timeout)
          )
        ]);
      }
      return fetchFn();
    }
  );
}

/**
 * Execute with fallback chain
 * Tries providers in order until one succeeds
 */
export async function fetchWithFallback<T>(
  queries: Array<{ provider: string; fetchFn: () => Promise<T> }>,
  options: { timeout?: number } = {}
): Promise<{ result: T; provider: string } | null> {
  for (const { provider, fetchFn } of queries) {
    try {
      const result = await rateLimitedFetch(provider, fetchFn, {
        timeout: options.timeout || 30000
      });
      return { result, provider };
    } catch (error) {
      console.warn(`[RateLimiter] ${provider} failed:`, (error as Error).message);
      // Continue to next provider
    }
  }
  
  return null;
}

/**
 * Get rate limiter statistics
 */
export function getStats(provider: string): RateLimiterStats | null {
  const key = provider.toLowerCase();
  const limiter = limiters.get(key);
  
  if (!limiter) return null;
  
  const counts = limiter.counts();
  const s = stats.get(key) || { done: 0, failed: 0 };
  
  return {
    provider: key,
    queued: counts.QUEUED,
    running: counts.RUNNING,
    done: s.done,
    failed: s.failed,
    reservoir: counts.RESERVOIR
  };
}

/**
 * Get all provider statistics
 */
export function getAllStats(): Record<string, RateLimiterStats> {
  const result: Record<string, RateLimiterStats> = {};
  
  for (const provider of limiters.keys()) {
    const s = getStats(provider);
    if (s) result[provider] = s;
  }
  
  return result;
}

/**
 * Reset a provider's limiter (useful for testing or error recovery)
 */
export function resetLimiter(provider: string): void {
  const key = provider.toLowerCase();
  const limiter = limiters.get(key);
  
  if (limiter) {
    limiter.stop({ dropWaitingJobs: true });
    limiters.delete(key);
    stats.delete(key);
    console.log(`[RateLimiter] Reset limiter for ${key}`);
  }
}

/**
 * Graceful shutdown - wait for pending requests
 */
export async function shutdown(): Promise<void> {
  const shutdownPromises: Promise<void>[] = [];
  
  for (const [provider, limiter] of limiters.entries()) {
    shutdownPromises.push(
      new Promise<void>((resolve) => {
        limiter.on('idle', () => {
          console.log(`[RateLimiter] ${provider} drained`);
          resolve();
        });
        limiter.stop({ dropWaitingJobs: false });
      })
    );
  }
  
  await Promise.all(shutdownPromises);
  limiters.clear();
  stats.clear();
}

export default { getLimiter, rateLimitedFetch, fetchWithFallback, getStats, getAllStats };
