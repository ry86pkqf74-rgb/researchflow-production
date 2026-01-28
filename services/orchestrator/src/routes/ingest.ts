/**
 * Ingest API Routes
 *
 * Provides endpoints for multi-file data ingestion operations:
 * - POST /api/ingest/detect - Start detection phase
 * - POST /api/ingest/confirm - Confirm ID column and complete merge
 * - GET /api/ingest/status/:runId - Get job status
 * - GET /api/ingest/jobs - List all jobs
 * - DELETE /api/ingest/jobs/:runId - Cancel a job
 *
 * Part of the multi-file ingestion feature.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getMultiFileIngestJob,
  MultiFileIngestInput,
  IngestConfirmation,
} from '../jobs/multiFileIngest';
import { requireAuth } from '../services/authService';

const router = Router();

// =============================================================================
// SCHEMAS
// =============================================================================

const DetectSchema = z.object({
  source: z.string().min(1),
  filePattern: z.string().optional().default('*.csv,*.xlsx'),
  runId: z.string().optional(),
  governanceMode: z.enum(['DEMO', 'LIVE']).optional().default('DEMO'),
});

const ConfirmSchema = z.object({
  runId: z.string().min(1),
  idColumn: z.string().min(1),
  userResponse: z.string().min(1),
  mergeStrategy: z.enum(['outer', 'inner', 'left', 'right']).optional().default('outer'),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/ingest/detect
 * Start Phase 1: Detect ID candidates from source files
 */
router.post('/detect', requireAuth, async (req: Request, res: Response) => {
  try {
    const input = DetectSchema.parse(req.body);

    const job = getMultiFileIngestJob();
    const result = await job.startDetection({
      source: input.source,
      filePattern: input.filePattern,
      runId: input.runId,
      governanceMode: input.governanceMode,
    });

    res.json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Ingest detection error:', error);
    res.status(500).json({
      error: 'Detection failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/ingest/confirm
 * Complete Phase 2: Confirm ID column and merge files
 */
router.post('/confirm', requireAuth, async (req: Request, res: Response) => {
  try {
    const input = ConfirmSchema.parse(req.body);

    const job = getMultiFileIngestJob();
    const result = await job.confirmAndMerge({
      runId: input.runId,
      idColumn: input.idColumn,
      userResponse: input.userResponse,
      mergeStrategy: input.mergeStrategy,
    });

    res.json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Ingest confirmation error:', error);
    res.status(500).json({
      error: 'Merge failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/ingest/status/:runId
 * Get status of a specific ingest job
 */
router.get('/status/:runId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const job = getMultiFileIngestJob();
    const result = job.getJobStatus(runId);

    if (!result) {
      return res.status(404).json({
        error: 'Job not found',
        runId,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Ingest status error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message,
    });
  }
});

/**
 * GET /api/ingest/jobs
 * List all ingest jobs
 */
router.get('/jobs', requireAuth, async (req: Request, res: Response) => {
  try {
    const job = getMultiFileIngestJob();
    const jobs = job.listJobs();

    // Convert Map to array of objects
    const jobList = Array.from(jobs.entries()).map(([runId, result]) => ({
      runId,
      state: result.state,
      success: result.success,
      needsConfirmation: result.needsConfirmation,
      sourceFiles: result.manifest.source_files,
      createdAt: result.manifest.started_at,
      completedAt: result.manifest.completed_at,
    }));

    res.json({
      total: jobList.length,
      jobs: jobList,
    });
  } catch (error: any) {
    console.error('List jobs error:', error);
    res.status(500).json({
      error: 'Failed to list jobs',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/ingest/jobs/:runId
 * Cancel a pending ingest job
 */
router.delete('/jobs/:runId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const job = getMultiFileIngestJob();
    const cancelled = job.cancelJob(runId);

    if (!cancelled) {
      return res.status(400).json({
        error: 'Cannot cancel job',
        message: 'Job is not in a cancellable state',
        runId,
      });
    }

    res.json({
      success: true,
      message: 'Job cancelled',
      runId,
    });
  } catch (error: any) {
    console.error('Cancel job error:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message,
    });
  }
});

/**
 * GET /api/ingest/health
 * Health check for ingest service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ingest',
    timestamp: new Date().toISOString(),
  });
});

export default router;
