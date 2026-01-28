/**
 * Multi-File Ingest Job Handler
 *
 * Handles multi-file/multi-sheet data ingestion jobs with:
 * - Two-phase workflow (detect + confirm + merge)
 * - User confirmation for ID column selection
 * - Integration with Python worker service
 * - Audit logging and manifest tracking
 *
 * Part of the multi-file ingestion feature.
 */

import { EventEmitter } from 'events';

// Job states
export type IngestJobState =
  | 'pending'
  | 'detecting'
  | 'awaiting_confirmation'
  | 'merging'
  | 'completed'
  | 'failed';

// ID candidate from Python worker
export interface IDCandidate {
  column_name: string;
  uniqueness_ratio: number;
  overlap_ratio: number;
  pattern_score: number;
  combined_score: number;
  source_files: string[];
  sample_values: string[];
}

// Merge manifest from Python worker
export interface MergeManifest {
  run_id: string;
  started_at: string;
  completed_at?: string;
  governance_mode: string;
  source_directory?: string;
  source_files: string[];
  rows_before_merge: Record<string, number>;
  rows_after_merge?: number;
  columns_by_source: Record<string, string[]>;
  columns_merged: string[];
  id_column?: string;
  id_column_aliases: Record<string, string>;
  merge_strategy?: string;
  user_confirmation?: string;
  id_candidates: Record<string, any>[];
  warnings: string[];
  errors: string[];
}

// Job input parameters
export interface MultiFileIngestInput {
  source: string;  // Directory path or Excel file path
  filePattern?: string;  // Glob pattern, default "*.csv,*.xlsx"
  runId?: string;  // Optional run ID
  governanceMode?: 'DEMO' | 'LIVE';
}

// Job result
export interface MultiFileIngestResult {
  success: boolean;
  state: IngestJobState;
  needsConfirmation: boolean;
  confirmationPrompt?: string;
  candidates?: IDCandidate[];
  manifest: MergeManifest;
  rowCount?: number;
  columnCount?: number;
  outputPath?: string;
  error?: string;
}

// Confirmation input
export interface IngestConfirmation {
  runId: string;
  idColumn: string;
  userResponse: string;  // 'yes', 'no', or specific column name
  mergeStrategy?: 'outer' | 'inner' | 'left' | 'right';
}

/**
 * Multi-File Ingest Job Handler
 *
 * Manages the lifecycle of multi-file ingest jobs including:
 * - Starting detection phase
 * - Handling user confirmations
 * - Completing merge operations
 */
export class MultiFileIngestJob extends EventEmitter {
  private workerUrl: string;
  private jobs: Map<string, MultiFileIngestResult>;

  constructor(workerUrl?: string) {
    super();
    this.workerUrl = workerUrl || process.env.WORKER_URL || 'http://worker:8000';
    this.jobs = new Map();
  }

  /**
   * Start Phase 1: Ingest files and detect ID candidates
   */
  async startDetection(input: MultiFileIngestInput): Promise<MultiFileIngestResult> {
    const runId = input.runId || `ingest_${Date.now()}`;

    try {
      // Call Python worker to start detection
      const response = await fetch(`${this.workerUrl}/api/ingest/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: input.source,
          file_pattern: input.filePattern || '*.csv,*.xlsx',
          run_id: runId,
          governance_mode: input.governanceMode || 'DEMO',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Worker detection failed: ${error}`);
      }

      const result = await response.json() as MultiFileIngestResult;
      result.state = result.needsConfirmation ? 'awaiting_confirmation' : 'completed';

      // Store job state
      this.jobs.set(runId, result);

      // Emit event
      this.emit('detection_complete', runId, result);

      return result;
    } catch (error: any) {
      const result: MultiFileIngestResult = {
        success: false,
        state: 'failed',
        needsConfirmation: false,
        manifest: {
          run_id: runId,
          started_at: new Date().toISOString(),
          governance_mode: input.governanceMode || 'DEMO',
          source_files: [],
          rows_before_merge: {},
          columns_by_source: {},
          columns_merged: [],
          id_column_aliases: {},
          id_candidates: [],
          warnings: [],
          errors: [error.message],
        },
        error: error.message,
      };

      this.jobs.set(runId, result);
      this.emit('detection_failed', runId, result);

      return result;
    }
  }

  /**
   * Complete Phase 2: Merge files after user confirmation
   */
  async confirmAndMerge(confirmation: IngestConfirmation): Promise<MultiFileIngestResult> {
    const existingJob = this.jobs.get(confirmation.runId);

    if (!existingJob) {
      throw new Error(`Job not found: ${confirmation.runId}`);
    }

    if (existingJob.state !== 'awaiting_confirmation') {
      throw new Error(`Job ${confirmation.runId} is not awaiting confirmation (state: ${existingJob.state})`);
    }

    try {
      // Update state
      existingJob.state = 'merging';
      this.jobs.set(confirmation.runId, existingJob);

      // Call Python worker to complete merge
      const response = await fetch(`${this.workerUrl}/api/ingest/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: confirmation.runId,
          id_column: confirmation.idColumn,
          user_response: confirmation.userResponse,
          merge_strategy: confirmation.mergeStrategy || 'outer',
          manifest: existingJob.manifest,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Worker merge failed: ${error}`);
      }

      const result = await response.json() as MultiFileIngestResult;
      result.state = result.success ? 'completed' : 'failed';

      // Update stored job
      this.jobs.set(confirmation.runId, result);

      // Emit event
      this.emit('merge_complete', confirmation.runId, result);

      return result;
    } catch (error: any) {
      existingJob.state = 'failed';
      existingJob.error = error.message;
      existingJob.manifest.errors.push(error.message);

      this.jobs.set(confirmation.runId, existingJob);
      this.emit('merge_failed', confirmation.runId, existingJob);

      return existingJob;
    }
  }

  /**
   * Get job status
   */
  getJobStatus(runId: string): MultiFileIngestResult | undefined {
    return this.jobs.get(runId);
  }

  /**
   * List all jobs
   */
  listJobs(): Map<string, MultiFileIngestResult> {
    return this.jobs;
  }

  /**
   * Cancel a pending job
   */
  cancelJob(runId: string): boolean {
    const job = this.jobs.get(runId);
    if (job && (job.state === 'pending' || job.state === 'awaiting_confirmation')) {
      job.state = 'failed';
      job.error = 'Cancelled by user';
      this.jobs.set(runId, job);
      this.emit('job_cancelled', runId);
      return true;
    }
    return false;
  }
}

// Singleton instance
let instance: MultiFileIngestJob | null = null;

export function getMultiFileIngestJob(): MultiFileIngestJob {
  if (!instance) {
    instance = new MultiFileIngestJob();
  }
  return instance;
}

export default MultiFileIngestJob;
