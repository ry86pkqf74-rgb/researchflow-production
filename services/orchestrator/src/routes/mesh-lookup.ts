/**
 * MeSH Lookup Route
 * 
 * Provides NLM E-utilities integration for MeSH term enrichment.
 * Used by extraction module for standardizing clinical terminology.
 * 
 * Endpoint: POST /api/literature/mesh/lookup
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { logAction } from '../services/audit-service';

const router = Router();

// NLM E-utilities base URL
const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const NCBI_API_KEY = process.env.NCBI_API_KEY;

// Request schema
const MeshLookupRequestSchema = z.object({
  terms: z.array(z.string()).min(1).max(500),
  include_synonyms: z.boolean().default(true),
  max_results_per_term: z.number().int().min(1).max(20).default(5),
});

// MeSH term response
interface MeshTerm {
  term: string;
  mesh_id: string | null;
  mesh_name: string | null;
  tree_numbers: string[];
  synonyms: string[];
  scope_note: string | null;
  confidence: number;
}

interface MeshLookupResponse {
  results: Record<string, MeshTerm[]>;
  total_queries: number;
  successful_queries: number;
  cache_hits: number;
}

// Simple in-memory cache (replace with Redis in production)
const meshCache = new Map<string, MeshTerm[]>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * POST /api/literature/mesh/lookup
 * 
 * Look up MeSH terms for given clinical terms.
 */
router.post(
  '/lookup',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = MeshLookupRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid request format',
        details: parseResult.error.issues,
      });
    }

    const { terms, include_synonyms, max_results_per_term } = parseResult.data;
    const results: Record<string, MeshTerm[]> = {};
    let cacheHits = 0;
    let successfulQueries = 0;

    for (const term of terms) {
      const normalizedTerm = term.toLowerCase().trim();
      
      // Check cache first
      if (meshCache.has(normalizedTerm)) {
        results[term] = meshCache.get(normalizedTerm)!;
        cacheHits++;
        successfulQueries++;
        continue;
      }

      try {
        const meshTerms = await lookupMeshTerm(normalizedTerm, include_synonyms, max_results_per_term);
        results[term] = meshTerms;
        meshCache.set(normalizedTerm, meshTerms);
        if (meshTerms.length > 0) {
          successfulQueries++;
        }
      } catch (error) {
        console.error(`[MeSH] Lookup failed for "${term}":`, error);
        results[term] = [];
      }

      // Rate limiting: small delay between requests
      if (!NCBI_API_KEY) {
        await new Promise(resolve => setTimeout(resolve, 350)); // 3 req/sec without API key
      }
    }

    // Audit log
    await logAction({
      userId: req.user?.id || 'anonymous',
      action: 'MESH_LOOKUP',
      resourceType: 'literature',
      resourceId: `mesh_batch_${Date.now()}`,
      metadata: {
        total_terms: terms.length,
        successful: successfulQueries,
        cache_hits: cacheHits,
      },
    });

    const response: MeshLookupResponse = {
      results,
      total_queries: terms.length,
      successful_queries: successfulQueries,
      cache_hits: cacheHits,
    };

    res.json(response);
  })
);

/**
 * GET /api/literature/mesh/health
 * Health check for MeSH service
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'mesh-lookup',
    ncbi_api_key_configured: !!NCBI_API_KEY,
    cache_size: meshCache.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Look up a single term in MeSH database
 */
async function lookupMeshTerm(
  term: string,
  includeSynonyms: boolean,
  maxResults: number
): Promise<MeshTerm[]> {
  const apiKeyParam = NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : '';
  
  // Search for term in MeSH
  const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=mesh&term=${encodeURIComponent(term)}[MeSH Terms]&retmax=${maxResults}&retmode=json${apiKeyParam}`;
  
  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error(`MeSH search failed: ${searchResponse.status}`);
  }
  
  const searchData = await searchResponse.json() as {
    esearchresult?: {
      idlist?: string[];
      count?: string;
    };
  };
  
  const ids = searchData.esearchresult?.idlist || [];
  if (ids.length === 0) {
    // Try broader search without [MeSH Terms] qualifier
    const broadSearchUrl = `${EUTILS_BASE}/esearch.fcgi?db=mesh&term=${encodeURIComponent(term)}&retmax=${maxResults}&retmode=json${apiKeyParam}`;
    const broadResponse = await fetch(broadSearchUrl);
    if (broadResponse.ok) {
      const broadData = await broadResponse.json() as {
        esearchresult?: { idlist?: string[] };
      };
      ids.push(...(broadData.esearchresult?.idlist || []));
    }
  }
  
  if (ids.length === 0) {
    return [{
      term,
      mesh_id: null,
      mesh_name: null,
      tree_numbers: [],
      synonyms: [],
      scope_note: null,
      confidence: 0,
    }];
  }
  
  // Fetch details for found IDs
  const results: MeshTerm[] = [];
  
  for (const id of ids.slice(0, maxResults)) {
    try {
      const summaryUrl = `${EUTILS_BASE}/esummary.fcgi?db=mesh&id=${id}&retmode=json${apiKeyParam}`;
      const summaryResponse = await fetch(summaryUrl);
      
      if (!summaryResponse.ok) continue;
      
      const summaryData = await summaryResponse.json() as {
        result?: Record<string, {
          uid?: string;
          ds_meshterms?: string[];
          ds_idxlinks?: string[];
          ds_scopenote?: string;
        }>;
      };
      
      const record = summaryData.result?.[id];
      if (!record) continue;
      
      const meshName = record.ds_meshterms?.[0] || term;
      const treeNumbers = record.ds_idxlinks || [];
      
      results.push({
        term,
        mesh_id: `D${id.padStart(6, '0')}`,
        mesh_name: meshName,
        tree_numbers: treeNumbers,
        synonyms: includeSynonyms ? (record.ds_meshterms || []).slice(1) : [],
        scope_note: record.ds_scopenote || null,
        confidence: meshName.toLowerCase() === term.toLowerCase() ? 1.0 : 0.8,
      });
    } catch (error) {
      console.error(`[MeSH] Failed to fetch details for ID ${id}:`, error);
    }
  }
  
  return results.length > 0 ? results : [{
    term,
    mesh_id: null,
    mesh_name: null,
    tree_numbers: [],
    synonyms: [],
    scope_note: null,
    confidence: 0,
  }];
}

export default router;
