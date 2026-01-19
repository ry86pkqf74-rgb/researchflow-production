/**
 * Citation Cache Service
 * Redis-backed cache for citation lookups and formatting
 */

import { getRedisConnection } from '../redis';

export interface CachedCitation {
  doi?: string;
  pmid?: string;
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  volume?: string;
  issue?: string;
  pages?: string;
  formattedApa?: string;
  formattedVancouver?: string;
  formattedBibtex?: string;
  cachedAt: Date;
  expiresAt: Date;
}

const CACHE_PREFIX = 'citation:';
const CACHE_TTL = 86400 * 7; // 7 days in seconds

/**
 * Citation cache service using Redis
 * Caches citation metadata to avoid repeated PubMed/CrossRef lookups
 */
export class CitationCacheService {
  /**
   * Get citation from cache by DOI
   */
  async getByDoi(doi: string): Promise<CachedCitation | null> {
    const redis = getRedisConnection();
    const key = `${CACHE_PREFIX}doi:${doi.toLowerCase()}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('[CitationCache] Error getting by DOI:', error);
    }

    return null;
  }

  /**
   * Get citation from cache by PMID
   */
  async getByPmid(pmid: string): Promise<CachedCitation | null> {
    const redis = getRedisConnection();
    const key = `${CACHE_PREFIX}pmid:${pmid}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('[CitationCache] Error getting by PMID:', error);
    }

    return null;
  }

  /**
   * Store citation in cache
   */
  async set(citation: Omit<CachedCitation, 'cachedAt' | 'expiresAt'>): Promise<void> {
    const redis = getRedisConnection();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL * 1000);

    const fullCitation: CachedCitation = {
      ...citation,
      cachedAt: now,
      expiresAt,
    };

    const jsonValue = JSON.stringify(fullCitation);

    try {
      // Store by DOI if available
      if (citation.doi) {
        const doiKey = `${CACHE_PREFIX}doi:${citation.doi.toLowerCase()}`;
        await redis.setex(doiKey, CACHE_TTL, jsonValue);
      }

      // Store by PMID if available
      if (citation.pmid) {
        const pmidKey = `${CACHE_PREFIX}pmid:${citation.pmid}`;
        await redis.setex(pmidKey, CACHE_TTL, jsonValue);
      }
    } catch (error) {
      console.error('[CitationCache] Error setting citation:', error);
    }
  }

  /**
   * Batch get citations by DOIs
   */
  async getByDois(dois: string[]): Promise<Map<string, CachedCitation | null>> {
    const redis = getRedisConnection();
    const results = new Map<string, CachedCitation | null>();

    if (dois.length === 0) return results;

    try {
      const pipeline = redis.pipeline();
      dois.forEach(doi => {
        pipeline.get(`${CACHE_PREFIX}doi:${doi.toLowerCase()}`);
      });

      const responses = await pipeline.exec();
      if (responses) {
        dois.forEach((doi, index) => {
          const [err, value] = responses[index];
          if (!err && value) {
            results.set(doi, JSON.parse(value as string));
          } else {
            results.set(doi, null);
          }
        });
      }
    } catch (error) {
      console.error('[CitationCache] Error batch getting:', error);
      // Return empty results for all
      dois.forEach(doi => results.set(doi, null));
    }

    return results;
  }

  /**
   * Invalidate citation cache entry
   */
  async invalidate(doi?: string, pmid?: string): Promise<void> {
    const redis = getRedisConnection();

    try {
      if (doi) {
        await redis.del(`${CACHE_PREFIX}doi:${doi.toLowerCase()}`);
      }
      if (pmid) {
        await redis.del(`${CACHE_PREFIX}pmid:${pmid}`);
      }
    } catch (error) {
      console.error('[CitationCache] Error invalidating:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalCached: number; memoryUsage: string }> {
    const redis = getRedisConnection();

    try {
      const keys = await redis.keys(`${CACHE_PREFIX}*`);
      const info = await redis.info('memory');

      // Parse memory usage from info response
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

      return {
        totalCached: keys.length,
        memoryUsage,
      };
    } catch (error) {
      console.error('[CitationCache] Error getting stats:', error);
      return {
        totalCached: 0,
        memoryUsage: 'unknown',
      };
    }
  }
}

export const citationCacheService = new CitationCacheService();
