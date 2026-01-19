/**
 * Batch Processor Service
 *
 * Manages batch processing jobs for non-interactive AI work.
 * Integrates with governance mode to block in STANDBY.
 */

import crypto from 'crypto';
import type { AIRouterRequest, ModelTier } from '@researchflow/ai-router';
import { getModelRouter } from '@researchflow/ai-router';
import { getGovernanceMode } from '../middleware/governanceMode';
import { logger } from '../logger/file-logger.js';

/**
 * Batch job status
 */
export type BatchJobStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Batch job request
 */
export interface BatchRequest {
  taskType: AIRouterRequest['taskType'];
  prompt: string;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
  metadata?: Record<string, unknown>;
}

/**
 * Batch job configuration
 */
export interface BatchJobConfig {
  provider?: 'anthropic' | 'openai';
  tier?: ModelTier;
  webhookUrl?: string;
  researchId?: string;
  createdBy?: string;
}

/**
 * Batch job result
 */
export interface BatchJobResult {
  requestIndex: number;
  status: 'COMPLETED' | 'FAILED';
  content?: string;
  parsed?: Record<string, unknown>;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Batch job record
 */
export interface BatchJob {
  jobId: string;
  provider: 'anthropic' | 'openai';
  providerJobId?: string;
  status: BatchJobStatus;
  requestCount: number;
  completedCount: number;
  failedCount: number;
  governanceMode: string;
  researchId?: string;
  createdBy?: string;
  submittedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  results: BatchJobResult[];
  webhookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for development (use database in production)
const batchJobs = new Map<string, BatchJob>();
const batchRequests = new Map<string, BatchRequest[]>();

/**
 * Batch Processor Service
 */
export class BatchProcessorService {
  private router = getModelRouter();

  /**
   * Create a new batch job
   *
   * @throws Error if governance mode is STANDBY
   */
  async createJob(
    requests: BatchRequest[],
    config: BatchJobConfig = {}
  ): Promise<BatchJob> {
    // Check governance mode
    const mode = getGovernanceMode();
    if (mode === 'STANDBY') {
      throw new Error('Batch processing blocked: System is in STANDBY mode');
    }

    const jobId = `batch_${crypto.randomBytes(12).toString('hex')}`;

    const job: BatchJob = {
      jobId,
      provider: config.provider || 'anthropic',
      status: 'PENDING',
      requestCount: requests.length,
      completedCount: 0,
      failedCount: 0,
      governanceMode: mode,
      researchId: config.researchId,
      createdBy: config.createdBy,
      webhookUrl: config.webhookUrl,
      results: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    batchJobs.set(jobId, job);
    batchRequests.set(jobId, requests);

    return job;
  }

  /**
   * Submit a batch job for processing
   */
  async submitJob(jobId: string): Promise<BatchJob> {
    const job = batchJobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job not found: ${jobId}`);
    }

    if (job.status !== 'PENDING') {
      throw new Error(`Cannot submit job with status: ${job.status}`);
    }

    // Check governance mode again
    const mode = getGovernanceMode();
    if (mode === 'STANDBY') {
      job.status = 'CANCELLED';
      job.errorMessage = 'Batch processing blocked: System is in STANDBY mode';
      job.updatedAt = new Date();
      batchJobs.set(jobId, job);
      throw new Error(job.errorMessage);
    }

    job.status = 'SUBMITTED';
    job.submittedAt = new Date();
    job.updatedAt = new Date();
    batchJobs.set(jobId, job);

    // Start processing asynchronously
    this.processJobAsync(jobId).catch((error) => {
      logger.error(`Batch job ${jobId} failed:`, error);
    });

    return job;
  }

  /**
   * Process batch job asynchronously
   */
  private async processJobAsync(jobId: string): Promise<void> {
    const job = batchJobs.get(jobId);
    const requests = batchRequests.get(jobId);

    if (!job || !requests) {
      return;
    }

    job.status = 'PROCESSING';
    job.updatedAt = new Date();
    batchJobs.set(jobId, job);

    const results: BatchJobResult[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];

      try {
        const response = await this.router.route({
          taskType: request.taskType,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          responseFormat: request.responseFormat,
          metadata: {
            researchId: job.researchId,
            userId: job.createdBy,
          },
        });

        results.push({
          requestIndex: i,
          status: 'COMPLETED',
          content: response.content,
          parsed: response.parsed,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
        });

        job.completedCount++;
      } catch (error) {
        results.push({
          requestIndex: i,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        job.failedCount++;
      }

      // Update job progress
      job.results = results;
      job.updatedAt = new Date();
      batchJobs.set(jobId, job);
    }

    // Mark job as completed
    job.status = job.failedCount === job.requestCount ? 'FAILED' : 'COMPLETED';
    job.completedAt = new Date();
    job.updatedAt = new Date();
    batchJobs.set(jobId, job);

    // Call webhook if configured
    if (job.webhookUrl) {
      await this.callWebhook(job);
    }
  }

  /**
   * Call webhook on job completion
   */
  private async callWebhook(job: BatchJob): Promise<void> {
    if (!job.webhookUrl) return;

    try {
      await fetch(job.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.jobId,
          status: job.status,
          completedCount: job.completedCount,
          failedCount: job.failedCount,
          completedAt: job.completedAt,
        }),
      });
    } catch (error) {
      logger.error(`Failed to call webhook for job ${job.jobId}:`, error);
    }
  }

  /**
   * Get batch job status
   */
  getJob(jobId: string): BatchJob | undefined {
    return batchJobs.get(jobId);
  }

  /**
   * Cancel a batch job
   */
  cancelJob(jobId: string): BatchJob {
    const job = batchJobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job not found: ${jobId}`);
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }

    job.status = 'CANCELLED';
    job.updatedAt = new Date();
    batchJobs.set(jobId, job);

    return job;
  }

  /**
   * List batch jobs
   */
  listJobs(options: {
    status?: BatchJobStatus;
    researchId?: string;
    limit?: number;
    offset?: number;
  } = {}): BatchJob[] {
    let jobs = Array.from(batchJobs.values());

    if (options.status) {
      jobs = jobs.filter((j) => j.status === options.status);
    }

    if (options.researchId) {
      jobs = jobs.filter((j) => j.researchId === options.researchId);
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset || 0;
    const limit = options.limit || 50;

    return jobs.slice(offset, offset + limit);
  }

  /**
   * Get batch job results
   */
  getJobResults(jobId: string): BatchJobResult[] {
    const job = batchJobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job not found: ${jobId}`);
    }

    return job.results;
  }

  /**
   * Clean up old completed jobs (for maintenance)
   */
  cleanupOldJobs(maxAgeHours: number = 24): number {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [jobId, job] of batchJobs.entries()) {
      if (
        (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') &&
        job.updatedAt < cutoff
      ) {
        batchJobs.delete(jobId);
        batchRequests.delete(jobId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Singleton instance
 */
let instance: BatchProcessorService | null = null;

export function getBatchProcessor(): BatchProcessorService {
  if (!instance) {
    instance = new BatchProcessorService();
  }
  return instance;
}
