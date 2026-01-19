/**
 * Manuscript Jobs Service
 *
 * Manages job creation, status updates, and retrieval for manuscript operations.
 */

import { v4 as uuid } from 'uuid';
import type { ManuscriptJob, JobStatus } from '../../../../shared/contracts/manuscripts';

// In-memory store for development; replace with DB in production
const jobStore = new Map<string, ManuscriptJob>();

export interface CreateJobParams {
  manuscriptId: string;
  jobType: string;
  requestJson: Record<string, unknown>;
}

export interface UpdateJobParams {
  status?: JobStatus;
  resultJson?: Record<string, unknown>;
  errorText?: string;
}

/**
 * Create a new job for a manuscript operation
 */
export async function createJob(params: CreateJobParams): Promise<ManuscriptJob> {
  const now = new Date().toISOString();
  const job: ManuscriptJob = {
    id: uuid(),
    manuscriptId: params.manuscriptId,
    jobType: params.jobType,
    status: 'QUEUED',
    requestJson: params.requestJson,
    createdAt: now,
    updatedAt: now,
  };

  jobStore.set(job.id, job);

  // TODO: Persist to database
  // await db.insert(manuscript_jobs).values({...})

  return job;
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<ManuscriptJob | null> {
  // TODO: Fetch from database
  return jobStore.get(jobId) || null;
}

/**
 * Update job status and/or result
 */
export async function updateJob(
  jobId: string,
  updates: UpdateJobParams
): Promise<ManuscriptJob | null> {
  const job = jobStore.get(jobId);
  if (!job) return null;

  const updatedJob: ManuscriptJob = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  jobStore.set(jobId, updatedJob);

  // TODO: Persist to database
  // await db.update(manuscript_jobs).set({...}).where(eq(id, jobId))

  return updatedJob;
}

/**
 * Mark job as succeeded with result
 */
export async function updateJobSuccess(
  jobId: string,
  resultJson: Record<string, unknown>
): Promise<ManuscriptJob | null> {
  return updateJob(jobId, {
    status: 'SUCCEEDED',
    resultJson,
  });
}

/**
 * Mark job as failed with error
 */
export async function updateJobFailed(
  jobId: string,
  errorText: string
): Promise<ManuscriptJob | null> {
  return updateJob(jobId, {
    status: 'FAILED',
    errorText,
  });
}

/**
 * Mark job as blocked (e.g., PHI detected)
 */
export async function updateJobBlocked(
  jobId: string,
  errorText: string
): Promise<ManuscriptJob | null> {
  return updateJob(jobId, {
    status: 'BLOCKED',
    errorText,
  });
}

/**
 * Mark job as running
 */
export async function updateJobRunning(jobId: string): Promise<ManuscriptJob | null> {
  return updateJob(jobId, { status: 'RUNNING' });
}

/**
 * List jobs for a manuscript
 */
export async function listJobsForManuscript(
  manuscriptId: string,
  options?: { status?: JobStatus; limit?: number; offset?: number }
): Promise<{ jobs: ManuscriptJob[]; total: number }> {
  const allJobs = Array.from(jobStore.values())
    .filter((j) => j.manuscriptId === manuscriptId)
    .filter((j) => !options?.status || j.status === options.status)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const offset = options?.offset || 0;
  const limit = options?.limit || 20;
  const jobs = allJobs.slice(offset, offset + limit);

  return { jobs, total: allJobs.length };
}

export default {
  createJob,
  getJob,
  updateJob,
  updateJobSuccess,
  updateJobFailed,
  updateJobBlocked,
  updateJobRunning,
  listJobsForManuscript,
};
