/**
 * Analysis Execution Route
 * 
 * Handles Stage 6 (Analysis) execution including:
 * - Clinical data extraction via worker service
 * - Statistical analysis
 * - Data validation
 * 
 * This route bridges the orchestrator and worker for analysis tasks.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/env';
import { logAction } from '../services/audit-service';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// Worker service URL
const WORKER_URL = config.workerUrl;

// Request schemas
const ExtractionRequestSchema = z.object({
  cells: z.array(z.object({
    text: z.string(),
    metadata: z.record(z.unknown()).optional(),
  })).min(1).max(100),
  parameters: z.object({
    extract_diagnoses: z.boolean().default(true),
    extract_procedures: z.boolean().default(true),
    extract_medications: z.boolean().default(true),
    extract_labs: z.boolean().default(true),
    enrich_with_mesh: z.boolean().default(true),
    batch_concurrency: z.number().int().min(1).max(20).default(5),
    force_tier: z.enum(['NANO', 'MINI', 'FRONTIER']).nullable().optional(),
  }).optional(),
  research_id: z.string().optional(),
  job_id: z.string().optional(),
});

const AnalysisRequestSchema = z.object({
  analysis_type: z.enum([
    'exploratory',
    'statistical', 
    'correlation',
    'distribution',
    'regression',
    'clustering',
    'clinical_extraction',
  ]),
  data: z.unknown().optional(),
  parameters: z.record(z.unknown()).optional(),
  research_id: z.string().optional(),
});

/**
 * POST /api/analysis/extract
 * 
 * Run clinical data extraction on provided cells.
 * Calls worker's /api/extraction/batch endpoint.
 */
router.post(
  '/extract',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate request
    const parseResult = ExtractionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid extraction request',
        details: parseResult.error.issues,
        request_id: requestId,
      });
    }

    const { cells, parameters, research_id, job_id } = parseResult.data;

    // Build request for worker - must be List[ExtractionRequest]
    const workerPayload = cells.map(cell => ({
      text: cell.text,
      metadata: {
        ...cell.metadata,
        research_id: research_id || 'unknown',
        job_id: job_id || requestId,
      },
      force_tier: parameters?.force_tier || null,
    }));

    try {
      // Call worker extraction endpoint with concurrency param
      const workerResponse = await fetch(
        `${WORKER_URL}/api/extraction/extract/batch?concurrency=${parameters?.batch_concurrency || 5}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          body: JSON.stringify(workerPayload),
        }
      );

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        console.error('[Analysis] Worker extraction failed:', errorText);
        
        return res.status(workerResponse.status).json({
          error: 'EXTRACTION_FAILED',
          message: `Worker returned ${workerResponse.status}`,
          details: errorText,
          request_id: requestId,
        });
      }

      const extractionResults = await workerResponse.json();

      // Log successful extraction
      await logAction({
        userId: req.user?.id || 'anonymous',
        action: 'CLINICAL_EXTRACTION',
        resourceType: 'analysis',
        resourceId: requestId,
        metadata: {
          cell_count: cells.length,
          research_id,
          duration_ms: Date.now() - startTime,
          successful: extractionResults.successful || 0,
          failed: extractionResults.failed || 0,
        },
      });

      return res.json({
        request_id: requestId,
        status: 'completed',
        results: extractionResults,
        duration_ms: Date.now() - startTime,
      });

    } catch (error) {
      console.error('[Analysis] Extraction error:', error);
      
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Worker service unavailable',
        request_id: requestId,
      });
    }
  })
);

/**
 * POST /api/analysis/run
 * 
 * Run analysis of specified type.
 * Routes to appropriate backend based on analysis type.
 */
router.post(
  '/run',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate request
    const parseResult = AnalysisRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid analysis request',
        details: parseResult.error.issues,
        request_id: requestId,
      });
    }

    const { analysis_type, data, parameters, research_id } = parseResult.data;

    // Route to appropriate handler
    if (analysis_type === 'clinical_extraction') {
      // Redirect to extraction endpoint
      return res.status(400).json({
        error: 'USE_EXTRACT_ENDPOINT',
        message: 'For clinical extraction, use POST /api/analysis/extract with cells array',
        request_id: requestId,
      });
    }

    // For other analysis types, call worker's analysis endpoint
    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/analysis/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify({
          analysis_type,
          data,
          parameters,
          research_id,
        }),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'ANALYSIS_FAILED',
          message: `Worker returned ${workerResponse.status}`,
          details: errorText,
          request_id: requestId,
        });
      }

      const analysisResults = await workerResponse.json();

      // Log analysis
      await logAction({
        userId: req.user?.id || 'anonymous',
        action: 'RUN_ANALYSIS',
        resourceType: 'analysis',
        resourceId: requestId,
        metadata: {
          analysis_type,
          research_id,
          duration_ms: Date.now() - startTime,
        },
      });

      return res.json({
        request_id: requestId,
        analysis_type,
        status: 'completed',
        results: analysisResults,
        duration_ms: Date.now() - startTime,
      });

    } catch (error) {
      console.error('[Analysis] Run error:', error);
      
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Worker service unavailable',
        request_id: requestId,
      });
    }
  })
);

/**
 * GET /api/analysis/health
 * 
 * Health check for analysis service.
 * Also checks worker connectivity.
 */
router.get('/health', async (_req: Request, res: Response) => {
  let workerStatus = 'unknown';
  
  try {
    const workerResponse = await fetch(`${WORKER_URL}/api/extraction/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    workerStatus = workerResponse.ok ? 'healthy' : 'unhealthy';
  } catch {
    workerStatus = 'unreachable';
  }

  res.json({
    status: 'healthy',
    service: 'analysis',
    worker_url: WORKER_URL,
    worker_status: workerStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;
