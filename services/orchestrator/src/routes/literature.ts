/**
 * Literature Search Routes
 *
 * API endpoints for searching academic literature across multiple sources.
 * All requests are PHI-scanned and governance-gated.
 */

import { Router, Request, Response, NextFunction } from 'express';
import CacheService from '../services/cache.service.js';
import { PubMedClient } from '../services/literature/pubmed.client.js';
import { SemanticScholarClient } from '../services/literature/semantic_scholar.client.js';
import { ArxivClient } from '../services/literature/arxiv.client.js';
import { ClinicalTrialsClient } from '../services/literature/clinicaltrials.client.js';
import { scan as scanPhi } from '@researchflow/phi-engine';
import { logger } from '../logger/file-logger.js';
import type { LiteratureSource, LiteratureResult } from '../services/literature/index.js';

const router = Router();

// Shared cache instance
let cacheInstance: CacheService | null = null;

async function getCache(): Promise<CacheService> {
  if (!cacheInstance) {
    cacheInstance = new CacheService();
    await cacheInstance.connect();
  }
  return cacheInstance;
}

// Mode guard middleware
function blockInStandby(req: Request, res: Response, next: NextFunction) {
  const mode = process.env.GOVERNANCE_MODE || 'DEMO';
  if (mode === 'STANDBY') {
    return res.status(403).json({
      error: 'Literature search blocked in STANDBY mode',
      code: 'STANDBY_BLOCKED',
    });
  }
  next();
}

// PHI scan middleware for query parameters
function scanQueryForPhi(req: Request, res: Response, next: NextFunction) {
  const query = req.body?.query || req.body?.topic || req.query?.q || '';

  if (query) {
    const phi = scanPhi(String(query));
    if (phi?.findings?.length) {
      logger.warn('PHI detected in literature query', {
        findingsCount: phi.findings.length,
      });
      return res.status(400).json({
        error: 'PHI-like patterns detected in query',
        code: 'PHI_QUERY_BLOCKED',
        // Return only locations/types (no values)
        findings: phi.findings.map((f: any) => ({
          type: f.type,
          start: f.start,
          end: f.end,
          confidence: f.confidence,
        })),
      });
    }
  }

  next();
}

// PHI scan output results
function scanResultsForPhi(results: any[]): any[] {
  const mode = process.env.GOVERNANCE_MODE || 'DEMO';

  // In LIVE mode, apply strict PHI scanning on abstracts
  if (mode === 'LIVE') {
    return results.map((r) => {
      if (r.abstract) {
        const phi = scanPhi(r.abstract);
        if (phi?.findings?.length) {
          // Redact abstract if PHI detected
          return {
            ...r,
            abstract: '[REDACTED - PHI detected in abstract]',
            phiRedacted: true,
          };
        }
      }
      return r;
    });
  }

  return results;
}

/**
 * POST /api/literature/search
 *
 * Unified literature search across multiple sources
 */
router.post(
  '/search',
  blockInStandby,
  scanQueryForPhi,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, topic, source, maxResults } = req.body;
      const q = String(query || topic || '').trim();

      if (!q) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const sources: LiteratureSource[] = source
        ? [source as LiteratureSource]
        : ['pubmed']; // Default to PubMed

      const limit = Math.min(Number(maxResults) || 20, 100);
      const cache = await getCache();

      const results: LiteratureResult[] = [];
      const errors: { source: string; error: string }[] = [];

      // Search each requested source
      for (const src of sources) {
        try {
          let sourceResults: LiteratureResult[] = [];

          switch (src) {
            case 'pubmed': {
              const client = new PubMedClient(cache);
              sourceResults = await client.search(q, { maxResults: limit });
              break;
            }
            case 'semantic_scholar': {
              const client = new SemanticScholarClient(cache);
              sourceResults = await client.search(q, { limit });
              break;
            }
            case 'arxiv': {
              const client = new ArxivClient(cache);
              sourceResults = await client.search(q, { maxResults: limit });
              break;
            }
            case 'clinicaltrials': {
              const client = new ClinicalTrialsClient(cache);
              sourceResults = await client.search(q, { maxResults: limit });
              break;
            }
            default:
              errors.push({ source: src, error: 'Unknown source' });
              continue;
          }

          results.push(...sourceResults);
        } catch (error: any) {
          logger.error(`Literature search error for ${src}:`, error);
          errors.push({ source: src, error: error.message });
        }
      }

      // Apply PHI scanning to results
      const safeResults = scanResultsForPhi(results);

      return res.json({
        success: true,
        query: q,
        sources,
        results: safeResults,
        totalResults: safeResults.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/literature/pubmed/search
 *
 * Search PubMed specifically
 */
router.get(
  '/pubmed/search',
  blockInStandby,
  scanQueryForPhi,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = String(req.query.q || '').trim();
      const maxResults = Math.min(Number(req.query.maxResults) || 20, 100);

      if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }

      const cache = await getCache();
      const client = new PubMedClient(cache);
      const results = await client.search(q, { maxResults });

      const safeResults = scanResultsForPhi(results);

      return res.json({
        success: true,
        source: 'pubmed',
        query: q,
        results: safeResults,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/literature/semantic-scholar/search
 *
 * Search Semantic Scholar
 */
router.get(
  '/semantic-scholar/search',
  blockInStandby,
  scanQueryForPhi,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = String(req.query.q || '').trim();
      const limit = Math.min(Number(req.query.limit) || 20, 100);

      if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }

      const cache = await getCache();
      const client = new SemanticScholarClient(cache);
      const results = await client.search(q, { limit });

      const safeResults = scanResultsForPhi(results);

      return res.json({
        success: true,
        source: 'semantic_scholar',
        query: q,
        results: safeResults,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/literature/arxiv/search
 *
 * Search arXiv
 */
router.get(
  '/arxiv/search',
  blockInStandby,
  scanQueryForPhi,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = String(req.query.q || '').trim();
      const maxResults = Math.min(Number(req.query.maxResults) || 20, 100);

      if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }

      const cache = await getCache();
      const client = new ArxivClient(cache);
      const results = await client.search(q, { maxResults });

      const safeResults = scanResultsForPhi(results);

      return res.json({
        success: true,
        source: 'arxiv',
        query: q,
        results: safeResults,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/literature/clinicaltrials/search
 *
 * Search ClinicalTrials.gov
 */
router.get(
  '/clinicaltrials/search',
  blockInStandby,
  scanQueryForPhi,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = String(req.query.q || '').trim();
      const maxResults = Math.min(Number(req.query.maxResults) || 20, 100);

      if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }

      const cache = await getCache();
      const client = new ClinicalTrialsClient(cache);
      const results = await client.search(q, { maxResults });

      return res.json({
        success: true,
        source: 'clinicaltrials',
        query: q,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/literature/article/:source/:id
 *
 * Fetch a specific article by ID
 */
router.get(
  '/article/:source/:id',
  blockInStandby,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { source, id } = req.params;
      const cache = await getCache();

      let result: LiteratureResult | null = null;

      switch (source) {
        case 'pubmed': {
          const client = new PubMedClient(cache);
          result = await client.fetchArticle(id);
          break;
        }
        case 'semantic_scholar': {
          const client = new SemanticScholarClient(cache);
          result = await client.fetchPaper(id);
          break;
        }
        case 'arxiv': {
          const client = new ArxivClient(cache);
          result = await client.fetchPaper(id);
          break;
        }
        case 'clinicaltrials': {
          const client = new ClinicalTrialsClient(cache);
          result = await client.fetchTrial(id);
          break;
        }
        default:
          return res.status(400).json({ error: 'Unknown source' });
      }

      if (!result) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Apply PHI scanning
      const safeResults = scanResultsForPhi([result]);

      return res.json({
        success: true,
        source,
        result: safeResults[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
