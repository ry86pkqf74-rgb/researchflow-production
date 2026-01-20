/**
 * Semantic Search Router (Task 107)
 *
 * API endpoints for semantic vector search:
 * - POST /api/search/semantic - Semantic vector search
 * - POST /api/search/hybrid - Hybrid keyword + semantic search
 * - GET /api/search/similar/:artifactId - Find similar artifacts
 * - POST /api/embeddings/generate - Batch generate embeddings
 *
 * All endpoints require PRO tier and semantic_search feature flag.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { isAuthenticated } from '../../replit_integrations/auth/replitAuth';
import { resolveOrgContext, requireOrgMember } from '../middleware/org-context';
import { semanticSearchService } from '../services/semanticSearchService';
import { hybridSearchService } from '../services/hybridSearchService';
import { embeddingService } from '../services/embeddingService';
import { featureFlagsService } from '../services/featureFlagsService';

const router = Router();

/**
 * Middleware to check tier requirement and feature flag for semantic search
 */
const requireSemanticSearch = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { org } = req.org!;

  // Check tier requirement (PRO, TEAM, or ENTERPRISE)
  const tierAllowed = ['PRO', 'TEAM', 'ENTERPRISE'].includes(org.subscriptionTier);
  if (!tierAllowed) {
    return res.status(403).json({
      error: 'Semantic search requires PRO tier or higher',
      currentTier: org.subscriptionTier,
      upgradeUrl: '/billing/upgrade',
      code: 'TIER_REQUIRED',
    });
  }

  // Check feature flag
  const enabled = await featureFlagsService.isFlagEnabled('semantic_search', org.id);
  if (!enabled) {
    return res.status(403).json({
      error: 'Semantic search is currently disabled',
      code: 'FEATURE_DISABLED',
    });
  }

  next();
});

/**
 * POST /api/search/semantic - Semantic vector search
 */
const semanticSearchSchema = z.object({
  q: z.string().min(1, 'Query cannot be empty').max(500, 'Query too long'),
  limit: z.number().int().min(1).max(100).optional(),
  threshold: z.number().min(0).max(1).optional(),
  types: z.array(z.string()).optional(),
});

router.post(
  '/semantic',
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  requireSemanticSearch,
  asyncHandler(async (req: Request, res: Response) => {
    const { org } = req.org!;

    // Validate request body
    const validation = semanticSearchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.flatten(),
        code: 'VALIDATION_ERROR',
      });
    }

    const { q, limit, threshold, types } = validation.data;

    try {
      const results = await semanticSearchService.search(q, {
        orgId: org.id,
        limit,
        threshold,
        artifactTypes: types,
      });

      res.json({
        query: q,
        mode: 'semantic',
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('[SemanticSearch] Search failed:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SEARCH_ERROR',
      });
    }
  })
);

/**
 * POST /api/search/hybrid - Hybrid keyword + semantic search
 */
const hybridSearchSchema = z.object({
  q: z.string().min(1, 'Query cannot be empty').max(500, 'Query too long'),
  limit: z.number().int().min(1).max(100).optional(),
  keywordWeight: z.number().min(0).max(1).optional(),
  semanticWeight: z.number().min(0).max(1).optional(),
});

router.post(
  '/hybrid',
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  requireSemanticSearch,
  asyncHandler(async (req: Request, res: Response) => {
    const { org } = req.org!;

    // Validate request body
    const validation = hybridSearchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.flatten(),
        code: 'VALIDATION_ERROR',
      });
    }

    const { q, limit, keywordWeight, semanticWeight } = validation.data;

    try {
      const results = await hybridSearchService.search(q, {
        orgId: org.id,
        limit,
        keywordWeight,
        semanticWeight,
      });

      res.json({
        query: q,
        mode: 'hybrid',
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('[HybridSearch] Search failed:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SEARCH_ERROR',
      });
    }
  })
);

/**
 * GET /api/search/similar/:artifactId - Find similar artifacts
 */
router.get(
  '/similar/:artifactId',
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  requireSemanticSearch,
  asyncHandler(async (req: Request, res: Response) => {
    const { org } = req.org!;
    const { artifactId } = req.params;
    const { limit } = req.query;

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 10, 50);

    try {
      const results = await semanticSearchService.findSimilar(artifactId, org.id, parsedLimit);

      res.json({
        artifactId,
        similar: results,
        count: results.length,
      });
    } catch (error) {
      console.error('[SimilarArtifacts] Search failed:', error);

      if (error instanceof Error && error.message.includes('No embedding found')) {
        return res.status(404).json({
          error: 'Artifact embedding not found',
          message: 'This artifact has not been indexed for semantic search yet',
          code: 'EMBEDDING_NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SEARCH_ERROR',
      });
    }
  })
);

/**
 * POST /api/embeddings/generate - Batch generate embeddings
 */
router.post(
  '/generate',
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  requireSemanticSearch,
  asyncHandler(async (req: Request, res: Response) => {
    const { org } = req.org!;
    const { limit } = req.body;

    const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);

    try {
      const count = await embeddingService.batchGenerateEmbeddings(org.id, parsedLimit);

      res.json({
        message: `Successfully generated ${count} embeddings`,
        orgId: org.id,
        count,
      });
    } catch (error) {
      console.error('[EmbeddingGeneration] Failed:', error);
      res.status(500).json({
        error: 'Embedding generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'GENERATION_ERROR',
      });
    }
  })
);

export default router;
