/**
 * Semantic Scholar API Client
 *
 * Provides search capabilities for Semantic Scholar database.
 * Returns metadata only (no full text).
 */

import CacheService from '../cache.service.js';
import { logger } from '../../logger/file-logger.js';

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  citationCount?: number;
  source: 'semantic_scholar';
}

export interface SemanticScholarSearchOptions {
  limit?: number;
  fields?: string[];
  yearFrom?: number;
  yearTo?: number;
}

export class SemanticScholarClient {
  private baseUrl = 'https://api.semanticscholar.org/graph/v1';
  private cache: CacheService;
  private apiKey?: string;

  constructor(cache: CacheService, apiKey?: string) {
    this.cache = cache;
    this.apiKey = apiKey ?? process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  /**
   * Search for papers matching query
   */
  async search(query: string, options: SemanticScholarSearchOptions = {}): Promise<SemanticScholarPaper[]> {
    const limit = options.limit ?? 20;
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    // Normalize cache key
    const cacheKey = `s2:q:${query.trim().toLowerCase()}|n:${limit}`;

    return this.cache.getOrSet(cacheKey, async () => {
      const fields = options.fields ?? [
        'title',
        'year',
        'authors',
        'doi',
        'url',
        'abstract',
        'citationCount',
      ];

      let url = `${this.baseUrl}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields.join(',')}`;

      // Add year filter if provided
      if (options.yearFrom || options.yearTo) {
        const from = options.yearFrom ?? 1900;
        const to = options.yearTo ?? new Date().getFullYear();
        url += `&year=${from}-${to}`;
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        if (res.status === 429) {
          logger.warn('Semantic Scholar rate limit hit');
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`Semantic Scholar search failed: ${res.status}`);
      }

      const json = await res.json();
      const items = json?.data ?? [];

      logger.info(`Semantic Scholar search: ${items.length} results for "${query}"`);

      return items.map((p: any) => ({
        paperId: p.paperId,
        title: p.title || '',
        authors: (p.authors ?? []).map((a: any) => a.name).filter(Boolean),
        year: p.year ?? null,
        doi: p.doi ?? null,
        url: p.url ?? null,
        abstract: p.abstract ?? null,
        citationCount: p.citationCount ?? null,
        source: 'semantic_scholar' as const,
      }));
    }, ttl);
  }

  /**
   * Fetch paper by ID (Semantic Scholar ID, DOI, or arXiv ID)
   */
  async fetchPaper(id: string): Promise<SemanticScholarPaper | null> {
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);
    const cacheKey = `s2:paper:${id}`;

    return this.cache.getOrSet(cacheKey, async () => {
      const fields = 'title,year,authors,doi,url,abstract,citationCount';
      const url = `${this.baseUrl}/paper/${encodeURIComponent(id)}?fields=${fields}`;

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error(`Semantic Scholar fetch failed: ${res.status}`);
      }

      const p = await res.json();

      return {
        paperId: p.paperId,
        title: p.title || '',
        authors: (p.authors ?? []).map((a: any) => a.name).filter(Boolean),
        year: p.year ?? null,
        doi: p.doi ?? null,
        url: p.url ?? null,
        abstract: p.abstract ?? null,
        citationCount: p.citationCount ?? null,
        source: 'semantic_scholar' as const,
      };
    }, ttl);
  }

  /**
   * Get citations for a paper
   */
  async getCitations(paperId: string, limit: number = 50): Promise<SemanticScholarPaper[]> {
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);
    const cacheKey = `s2:citations:${paperId}:${limit}`;

    return this.cache.getOrSet(cacheKey, async () => {
      const fields = 'title,year,authors,doi,url,abstract';
      const url = `${this.baseUrl}/paper/${paperId}/citations?fields=${fields}&limit=${limit}`;

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        throw new Error(`Semantic Scholar citations failed: ${res.status}`);
      }

      const json = await res.json();
      const items = json?.data ?? [];

      return items
        .map((item: any) => item.citingPaper)
        .filter(Boolean)
        .map((p: any) => ({
          paperId: p.paperId,
          title: p.title || '',
          authors: (p.authors ?? []).map((a: any) => a.name).filter(Boolean),
          year: p.year ?? null,
          doi: p.doi ?? null,
          url: p.url ?? null,
          abstract: p.abstract ?? null,
          citationCount: null,
          source: 'semantic_scholar' as const,
        }));
    }, ttl);
  }
}

export default SemanticScholarClient;
