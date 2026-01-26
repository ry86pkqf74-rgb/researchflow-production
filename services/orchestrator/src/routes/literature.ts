/**
 * Literature Routes
 *
 * API endpoints for literature search, caching, and retrieval.
 * Implements Tasks 41-42: PubMed, Semantic Scholar, arXiv search with Redis cache.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/rbac.js';
import { createAuditEntry } from '../services/auditService.js';
import { RedisCacheService, getCacheService } from '../services/redis-cache.js';
import { getPubMedClient } from '../clients/pubmed.js';
import { getSemanticScholarClient } from '../clients/semantic-scholar.js';
import { getArxivClient } from '../clients/arxiv.js';
import type {
  LiteratureItem,
  LiteratureSearchRequest,
  LiteratureSearchResponse,
  LiteratureProvider,
} from '@researchflow/core';

const router = Router();

/**
 * Merge results from multiple providers
 */
function mergeSearchResults(
  results: LiteratureSearchResponse[],
  query: string
): LiteratureSearchResponse {
  const allItems: LiteratureItem[] = [];
  const providerResults: Record<string, { count: number; total: number; durationMs?: number; error?: string }> = {};
  let totalDurationMs = 0;

  for (const result of results) {
    allItems.push(...result.items);

    for (const provider of result.providers) {
      if (result.providerResults?.[provider]) {
        providerResults[provider] = result.providerResults[provider];
        if (result.providerResults[provider].durationMs) {
          totalDurationMs = Math.max(totalDurationMs, result.providerResults[provider].durationMs || 0);
        }
      }
    }
  }

  // Sort by relevance score if available, otherwise keep provider order
  allItems.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  return {
    items: allItems,
    total: allItems.length,
    query,
    providers: Object.keys(providerResults) as LiteratureProvider[],
    cached: results.every(r => r.cached),
    searchDurationMs: totalDurationMs,
    providerResults: providerResults as any,
  };
}

/**
 * GET /api/literature/search/pubmed
 *
 * Search PubMed with Redis caching
 */
router.get(
  '/search/pubmed',
  requirePermission('VIEW'),
  asyncHandler(async (req, res) => {
    const { q, limit, offset, yearStart, yearEnd, publicationTypes } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        error: 'Query parameter "q" is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const searchOptions = {
      limit: limit ? Math.min(parseInt(String(limit), 10), 100) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
      yearStart: yearStart ? parseInt(String(yearStart), 10) : undefined,
      yearEnd: yearEnd ? parseInt(String(yearEnd), 10) : undefined,
      publicationTypes: publicationTypes ? String(publicationTypes).split(',') : undefined,
    };

    const cache = getCacheService();
    const cacheKey = RedisCacheService.generateKey(
      'lit:pubmed',
      q,
      searchOptions.limit,
      searchOptions.offset,
      searchOptions.yearStart,
      searchOptions.yearEnd,
      searchOptions.publicationTypes?.join(',')
    );

    const ttlSeconds = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    const { data, cached, cachedAt } = await cache.getOrFetch(
      cacheKey,
      async () => {
        const client = getPubMedClient();
        return client.search(q, searchOptions);
      },
      { ttlSeconds, singleflight: true }
    );

    // Add cache metadata to response
    const response: LiteratureSearchResponse = {
      ...data,
      cached,
      cachedAt,
    };

    // Audit log
    await createAuditEntry({
      eventType: 'LITERATURE_SEARCH',
      action: 'PUBMED_SEARCH',
      userId: (req as any).user?.id,
      resourceType: 'literature',
      details: {
        query: q,
        resultCount: response.items.length,
        cached,
        provider: 'pubmed',
      },
    });

    res.json(response);
  })
);

/**
 * GET /api/literature/search/semantic-scholar
 *
 * Search Semantic Scholar with Redis caching
 */
router.get(
  '/search/semantic-scholar',
  requirePermission('VIEW'),
  asyncHandler(async (req, res) => {
    const { q, limit, offset, yearStart, yearEnd, fieldsOfStudy, openAccess } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        error: 'Query parameter "q" is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const searchOptions = {
      limit: limit ? Math.min(parseInt(String(limit), 10), 100) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
      yearStart: yearStart ? parseInt(String(yearStart), 10) : undefined,
      yearEnd: yearEnd ? parseInt(String(yearEnd), 10) : undefined,
      fieldsOfStudy: fieldsOfStudy ? String(fieldsOfStudy).split(',') : undefined,
      openAccessOnly: openAccess === 'true',
    };

    const cache = getCacheService();
    const cacheKey = RedisCacheService.generateKey(
      'lit:s2',
      q,
      searchOptions.limit,
      searchOptions.offset,
      searchOptions.yearStart,
      searchOptions.yearEnd,
      searchOptions.fieldsOfStudy?.join(','),
      searchOptions.openAccessOnly
    );

    const ttlSeconds = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    const { data, cached, cachedAt } = await cache.getOrFetch(
      cacheKey,
      async () => {
        const client = getSemanticScholarClient();
        return client.search(q, searchOptions);
      },
      { ttlSeconds, singleflight: true }
    );

    const response: LiteratureSearchResponse = {
      ...data,
      cached,
      cachedAt,
    };

    // Audit log
    await createAuditEntry({
      eventType: 'LITERATURE_SEARCH',
      action: 'SEMANTIC_SCHOLAR_SEARCH',
      userId: (req as any).user?.id,
      resourceType: 'literature',
      details: {
        query: q,
        resultCount: response.items.length,
        cached,
        provider: 'semantic_scholar',
      },
    });

    res.json(response);
  })
);

/**
 * GET /api/literature/search/arxiv
 *
 * Search arXiv with Redis caching
 */
router.get(
  '/search/arxiv',
  requirePermission('VIEW'),
  asyncHandler(async (req, res) => {
    const { q, limit, offset, sortBy, categories } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        error: 'Query parameter "q" is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const searchOptions = {
      limit: limit ? Math.min(parseInt(String(limit), 10), 100) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
      sortBy: sortBy as 'relevance' | 'lastUpdatedDate' | 'submittedDate' | undefined,
      categories: categories ? String(categories).split(',') : undefined,
    };

    const cache = getCacheService();
    const cacheKey = RedisCacheService.generateKey(
      'lit:arxiv',
      q,
      searchOptions.limit,
      searchOptions.offset,
      searchOptions.sortBy,
      searchOptions.categories?.join(',')
    );

    const ttlSeconds = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    const { data, cached, cachedAt } = await cache.getOrFetch(
      cacheKey,
      async () => {
        const client = getArxivClient();
        return client.search(q, searchOptions);
      },
      { ttlSeconds, singleflight: true }
    );

    const response: LiteratureSearchResponse = {
      ...data,
      cached,
      cachedAt,
    };

    // Audit log
    await createAuditEntry({
      eventType: 'LITERATURE_SEARCH',
      action: 'ARXIV_SEARCH',
      userId: (req as any).user?.id,
      resourceType: 'literature',
      details: {
        query: q,
        resultCount: response.items.length,
        cached,
        provider: 'arxiv',
      },
    });

    res.json(response);
  })
);

/**
 * GET /api/literature/search
 *
 * Unified search across multiple providers
 */
router.get(
  '/search',
  requirePermission('VIEW'),
  asyncHandler(async (req, res) => {
    const {
      q,
      provider,
      limit,
      offset,
      yearStart,
      yearEnd,
    } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        error: 'Query parameter "q" is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Determine which providers to search
    let providers: LiteratureProvider[] = ['pubmed', 'semantic_scholar', 'arxiv'];
    if (provider && provider !== 'all') {
      const requestedProviders = String(provider).split(',') as LiteratureProvider[];
      providers = requestedProviders.filter(p =>
        ['pubmed', 'semantic_scholar', 'arxiv'].includes(p)
      );
    }

    const searchOptions = {
      limit: limit ? Math.min(parseInt(String(limit), 10), 100) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
      yearStart: yearStart ? parseInt(String(yearStart), 10) : undefined,
      yearEnd: yearEnd ? parseInt(String(yearEnd), 10) : undefined,
    };

    const cache = getCacheService();
    const ttlSeconds = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    // Search all requested providers in parallel
    const searchPromises: Promise<LiteratureSearchResponse>[] = [];

    if (providers.includes('pubmed')) {
      const cacheKey = RedisCacheService.generateKey(
        'lit:pubmed',
        q,
        searchOptions.limit,
        searchOptions.offset,
        searchOptions.yearStart,
        searchOptions.yearEnd
      );

      searchPromises.push(
        cache.getOrFetch(
          cacheKey,
          async () => {
            const client = getPubMedClient();
            return client.search(q, searchOptions);
          },
          { ttlSeconds, singleflight: true }
        ).then(r => ({ ...r.data, cached: r.cached, cachedAt: r.cachedAt }))
      );
    }

    if (providers.includes('semantic_scholar')) {
      const cacheKey = RedisCacheService.generateKey(
        'lit:s2',
        q,
        searchOptions.limit,
        searchOptions.offset,
        searchOptions.yearStart,
        searchOptions.yearEnd
      );

      searchPromises.push(
        cache.getOrFetch(
          cacheKey,
          async () => {
            const client = getSemanticScholarClient();
            return client.search(q, searchOptions);
          },
          { ttlSeconds, singleflight: true }
        ).then(r => ({ ...r.data, cached: r.cached, cachedAt: r.cachedAt }))
      );
    }

    if (providers.includes('arxiv')) {
      const cacheKey = RedisCacheService.generateKey(
        'lit:arxiv',
        q,
        searchOptions.limit,
        searchOptions.offset
      );

      searchPromises.push(
        cache.getOrFetch(
          cacheKey,
          async () => {
            const client = getArxivClient();
            return client.search(q, searchOptions);
          },
          { ttlSeconds, singleflight: true }
        ).then(r => ({ ...r.data, cached: r.cached, cachedAt: r.cachedAt }))
      );
    }

    // Wait for all searches to complete (with timeout)
    const results = await Promise.all(
      searchPromises.map(p =>
        Promise.race([
          p,
          new Promise<LiteratureSearchResponse>((resolve) =>
            setTimeout(() => resolve({
              items: [],
              total: 0,
              query: q,
              providers: [],
              cached: false,
              providerResults: {},
            }), 30000)
          ),
        ])
      )
    );

    // Merge results
    const response = mergeSearchResults(results, q);

    // Audit log
    await createAuditEntry({
      eventType: 'LITERATURE_SEARCH',
      action: 'UNIFIED_SEARCH',
      userId: (req as any).user?.id,
      resourceType: 'literature',
      details: {
        query: q,
        providers: providers,
        resultCount: response.items.length,
        cached: response.cached,
      },
    });

    res.json(response);
  })
);

/**
 * GET /api/literature/paper/:provider/:id
 *
 * Get a single paper by provider and ID
 */
router.get(
  '/paper/:provider/:id',
  requirePermission('VIEW'),
  asyncHandler(async (req, res) => {
    const { provider, id } = req.params;

    let paper: LiteratureItem | null = null;

    switch (provider) {
      case 'pubmed':
        paper = await getPubMedClient().getByPmid(id);
        break;
      case 'semantic_scholar':
      case 's2':
        paper = await getSemanticScholarClient().getById(id);
        break;
      case 'arxiv':
        paper = await getArxivClient().getById(id);
        break;
      default:
        res.status(400).json({
          error: `Unknown provider: ${provider}`,
          code: 'VALIDATION_ERROR',
          validProviders: ['pubmed', 'semantic_scholar', 'arxiv'],
        });
        return;
    }

    if (!paper) {
      res.status(404).json({
        error: 'Paper not found',
        code: 'NOT_FOUND',
        provider,
        id,
      });
      return;
    }

    res.json({ paper });
  })
);

/**
 * GET /api/literature/health
 *
 * Health check for literature services
 */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const cache = getCacheService();

    res.json({
      status: 'ok',
      service: 'literature',
      providers: {
        pubmed: {
          available: true,
          hasApiKey: !!process.env.NCBI_API_KEY,
        },
        semantic_scholar: {
          available: true,
          hasApiKey: !!process.env.SEMANTIC_SCHOLAR_API_KEY,
        },
        arxiv: {
          available: true,
        },
      },
      cache: {
        type: process.env.REDIS_URL ? 'redis' : 'in-memory',
        ttlSeconds: parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10),
      },
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
