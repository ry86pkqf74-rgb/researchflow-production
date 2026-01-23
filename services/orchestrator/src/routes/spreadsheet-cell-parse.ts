/**
 * Spreadsheet Cell Parse Routes
 * 
 * Handles cell-level clinical extraction from spreadsheet files (CSV/XLSX).
 * Integrates with the Python worker for actual processing via the LargeSheetPipeline.
 * 
 * @module routes/spreadsheet-cell-parse
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { z } from 'zod';

const router = Router();

// Environment configuration
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
const ARTIFACT_BASE = process.env.ARTIFACT_BASE || '/data/artifacts';
const MANIFEST_BASE = process.env.MANIFEST_BASE || '/data/manifests';

// ============================================================================
// Request/Response Schemas
// ============================================================================

const BlockTextConfigSchema = z.object({
  minChars: z.number().int().min(1).default(120),
  minNewlines: z.number().int().min(0).default(2),
  minClinicalMarkers: z.number().int().min(0).default(1),
  denyColumns: z.array(z.string()).default(['mrn', 'patient_id', 'dob', 'ssn', 'id']),
  allowColumns: z.array(z.string()).default(['ros', 'clinical_notes', 'op_note', 'discharge_summary']),
}).partial();

const LargeSheetConfigSchema = z.object({
  chunkRows: z.number().int().min(1000).max(100000).default(50000),
  llmConcurrency: z.number().int().min(1).max(100).default(24),
  llmBatchSize: z.number().int().min(1).max(100).default(20),
  joinBackToSheet: z.boolean().default(false),
  enableDask: z.boolean().default(false),
}).partial();

const PromptPackSchema = z.object({
  cellExtract: z.string().default('cell_extract_v1'),
  rosExtract: z.string().default('ros_extract_v1'),
  outcomeExtract: z.string().default('outcome_extract_v1'),
}).partial();

const SpreadsheetParseRequestSchema = z.object({
  artifactPath: z.string().min(1),
  fileType: z.enum(['csv', 'xlsx', 'xls', 'tsv']).default('csv'),
  sheetName: z.string().nullable().default(null),
  blockTextConfig: BlockTextConfigSchema.optional(),
  largeSheetConfig: LargeSheetConfigSchema.optional(),
  promptPack: PromptPackSchema.optional(),
  callbackUrl: z.string().url().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
});

type SpreadsheetParseRequest = z.infer<typeof SpreadsheetParseRequestSchema>;

// ============================================================================
// In-memory job tracking (in production, use Redis or database)
// ============================================================================

interface JobRecord {
  jobId: string;
  status: 'pending' | 'scanning' | 'extracting' | 'merging' | 'complete' | 'failed';
  progress: {
    phase: string;
    totalRows: number;
    processedRows: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
  };
  config: SpreadsheetParseRequest;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    artifactPaths: Record<string, string>;
    manifestPath: string;
    processingTimeMs: number;
  };
}

const jobs: Map<string, JobRecord> = new Map();

// ============================================================================
// Middleware
// ============================================================================

/**
 * Validate request body against schema
 */
function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Ensure PHI scan has been completed for the artifact
 */
async function ensurePhiScanComplete(artifactPath: string): Promise<boolean> {
  // In production, check PHI scan status from database or artifact metadata
  // For now, assume PHI scan is complete if file exists
  try {
    const fs = await import('fs/promises');
    await fs.access(artifactPath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/spreadsheet/parse
 * 
 * Submit a spreadsheet for cell-level clinical extraction.
 */
router.post(
  '/parse',
  validateRequest(SpreadsheetParseRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = req.body as SpreadsheetParseRequest;
      
      // Verify PHI scan complete
      const phiScanOk = await ensurePhiScanComplete(config.artifactPath);
      if (!phiScanOk) {
        return res.status(400).json({
          error: 'PHI scan not complete',
          message: 'The artifact must complete PHI scanning before cell parsing',
        });
      }
      
      // Generate job ID
      const jobId = `job_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
      
      // Create job record
      const job: JobRecord = {
        jobId,
        status: 'pending',
        progress: {
          phase: 'init',
          totalRows: 0,
          processedRows: 0,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
        },
        config,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jobs.set(jobId, job);
      
      // Forward to worker (async, don't await)
      forwardToWorker(jobId, config).catch((err) => {
        console.error(`Job ${jobId} worker forwarding failed:`, err);
        const existingJob = jobs.get(jobId);
        if (existingJob) {
          existingJob.status = 'failed';
          existingJob.error = err.message;
          existingJob.updatedAt = new Date();
        }
      });
      
      res.status(202).json({
        jobId,
        status: 'pending',
        message: 'Job submitted successfully',
        statusUrl: `/api/spreadsheet/parse/${jobId}/status`,
        resultsUrl: `/api/spreadsheet/parse/${jobId}/results`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/spreadsheet/parse/:jobId/status
 * 
 * Get the status of a spreadsheet parsing job.
 */
router.get('/parse/:jobId/status', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      jobId,
    });
  }
  
  // If job is still in progress, poll worker for updates
  if (job.status !== 'complete' && job.status !== 'failed') {
    try {
      const workerStatus = await axios.get(
        `${WORKER_URL}/api/extraction/spreadsheet/status/${jobId}`,
        { timeout: 5000 }
      );
      
      // Update local record
      job.status = workerStatus.data.status;
      job.progress = workerStatus.data.progress || job.progress;
      job.updatedAt = new Date();
      
      if (workerStatus.data.error) {
        job.error = workerStatus.data.error;
      }
    } catch (err) {
      // Worker might not be reachable, return cached status
      console.warn(`Could not fetch worker status for ${jobId}:`, err);
    }
  }
  
  res.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    error: job.error,
  });
});

/**
 * GET /api/spreadsheet/parse/:jobId/results
 * 
 * Get the results of a completed spreadsheet parsing job.
 */
router.get('/parse/:jobId/results', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      jobId,
    });
  }
  
  if (job.status !== 'complete') {
    return res.status(400).json({
      error: 'Job not complete',
      status: job.status,
      message: job.status === 'failed' 
        ? `Job failed: ${job.error}` 
        : 'Job is still in progress',
    });
  }
  
  // Fetch results from worker
  try {
    const workerResults = await axios.get(
      `${WORKER_URL}/api/extraction/spreadsheet/results/${jobId}`,
      { timeout: 30000 }
    );
    
    res.json({
      jobId,
      success: true,
      ...workerResults.data,
    });
  } catch (err) {
    // Return cached result if available
    if (job.result) {
      res.json({
        jobId,
        success: true,
        ...job.result,
      });
    } else {
      res.status(500).json({
        error: 'Could not fetch results',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
});

/**
 * POST /api/spreadsheet/parse/:jobId/cancel
 * 
 * Cancel a running spreadsheet parsing job.
 */
router.post('/parse/:jobId/cancel', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      jobId,
    });
  }
  
  if (job.status === 'complete' || job.status === 'failed') {
    return res.status(400).json({
      error: 'Cannot cancel',
      status: job.status,
      message: 'Job has already completed or failed',
    });
  }
  
  // Forward cancel to worker
  try {
    await axios.post(
      `${WORKER_URL}/api/extraction/spreadsheet/cancel/${jobId}`,
      {},
      { timeout: 10000 }
    );
    
    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.updatedAt = new Date();
    
    res.json({
      jobId,
      status: 'cancelled',
      message: 'Job cancellation requested',
    });
  } catch (err) {
    res.status(500).json({
      error: 'Cancel failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/spreadsheet/parse/jobs
 * 
 * List all spreadsheet parsing jobs (with optional filters).
 */
router.get('/parse/jobs', async (req: Request, res: Response) => {
  const { status, limit = '50', offset = '0' } = req.query;
  
  let jobList = Array.from(jobs.values());
  
  // Filter by status
  if (status && typeof status === 'string') {
    jobList = jobList.filter((j) => j.status === status);
  }
  
  // Sort by createdAt desc
  jobList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  // Paginate
  const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
  const offsetNum = parseInt(offset as string, 10) || 0;
  const paged = jobList.slice(offsetNum, offsetNum + limitNum);
  
  res.json({
    total: jobList.length,
    limit: limitNum,
    offset: offsetNum,
    jobs: paged.map((j) => ({
      jobId: j.jobId,
      status: j.status,
      progress: j.progress,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })),
  });
});

// ============================================================================
// Worker Communication
// ============================================================================

/**
 * Forward parsing job to the Python worker.
 */
async function forwardToWorker(jobId: string, config: SpreadsheetParseRequest): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;
  
  job.status = 'scanning';
  job.updatedAt = new Date();
  
  try {
    const response = await axios.post(
      `${WORKER_URL}/api/extraction/spreadsheet/parse`,
      {
        job_id: jobId,
        artifact_path: config.artifactPath,
        file_type: config.fileType,
        sheet_name: config.sheetName,
        block_text_config: config.blockTextConfig,
        large_sheet_config: config.largeSheetConfig,
        prompt_pack: config.promptPack,
      },
      {
        timeout: 60000, // 60s for initial submission
        headers: {
          'Content-Type': 'application/json',
          'X-Job-ID': jobId,
        },
      }
    );
    
    // Update job with initial response
    if (response.data.status) {
      job.status = response.data.status;
    }
    if (response.data.progress) {
      job.progress = response.data.progress;
    }
    job.updatedAt = new Date();
    
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Worker communication failed';
    job.updatedAt = new Date();
    throw error;
  }
}

/**
 * Webhook handler for worker status updates (optional, for push-based updates).
 */
router.post('/webhook/status', async (req: Request, res: Response) => {
  const { jobId, status, progress, error, result } = req.body;
  
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  job.status = status;
  job.progress = progress || job.progress;
  job.updatedAt = new Date();
  
  if (error) {
    job.error = error;
  }
  
  if (result) {
    job.result = result;
    job.completedAt = new Date();
  }
  
  res.json({ acknowledged: true });
});

export default router;
