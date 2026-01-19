/**
 * Manuscript Job Queue
 * BullMQ queue for Phase B manuscript tasks
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, bullMqConnection } from '../redis';
import { ManuscriptJobType, type ManuscriptJob, type JobStatus } from '../types/job.types';
import { handleManuscriptJob } from './handlers';

const QUEUE_NAME = 'researchflow:manuscript:jobs';

// Create queue instance
export const manuscriptQueue = new Queue<ManuscriptJob>(QUEUE_NAME, {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

// Job status store (in-memory for simplicity, use Redis in production)
const jobStatuses = new Map<string, JobStatus>();

/**
 * Create a worker to process manuscript jobs
 */
export function createManuscriptWorker(
  onProgress?: (jobId: string, progress: number) => void,
  onCompleted?: (jobId: string, result: any) => void,
  onFailed?: (jobId: string, error: string) => void
): Worker<ManuscriptJob> {
  const worker = new Worker<ManuscriptJob>(
    QUEUE_NAME,
    async (job: Job<ManuscriptJob>) => {
      console.log(`[Worker] Processing job ${job.id}: ${job.data.type}`);

      // Update status
      updateJobStatus(job.id!, {
        jobId: job.id!,
        manuscriptId: job.data.manuscriptId,
        type: job.data.type,
        status: 'processing',
        progress: 0,
        startedAt: new Date(),
      });

      try {
        // Process the job
        const result = await handleManuscriptJob(job.data, (progress) => {
          updateJobStatus(job.id!, { progress });
          job.updateProgress(progress);
          onProgress?.(job.id!, progress);
        });

        // Update status
        updateJobStatus(job.id!, {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          result,
        });

        onCompleted?.(job.id!, result);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        updateJobStatus(job.id!, {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        });

        onFailed?.(job.id!, errorMessage);
        throw error;
      }
    },
    {
      connection: bullMqConnection,
      concurrency: 5, // Process up to 5 jobs concurrently
    }
  );

  worker.on('error', (error) => {
    console.error('[Worker] Error:', error);
  });

  return worker;
}

/**
 * Add a job to the queue
 */
export async function addManuscriptJob(
  job: ManuscriptJob,
  options?: {
    priority?: number;
    delay?: number;
  }
): Promise<string> {
  const added = await manuscriptQueue.add(job.type, job, {
    priority: options?.priority,
    delay: options?.delay,
  });

  // Initialize status
  updateJobStatus(added.id!, {
    jobId: added.id!,
    manuscriptId: job.manuscriptId,
    type: job.type,
    status: 'pending',
    progress: 0,
  });

  return added.id!;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): JobStatus | undefined {
  return jobStatuses.get(jobId);
}

/**
 * Update job status
 */
function updateJobStatus(jobId: string, update: Partial<JobStatus>): void {
  const current = jobStatuses.get(jobId) || {
    jobId,
    manuscriptId: '',
    type: '',
    status: 'pending' as const,
    progress: 0,
  };

  jobStatuses.set(jobId, { ...current, ...update });
}

/**
 * Get job from queue
 */
export async function getJob(jobId: string): Promise<Job<ManuscriptJob> | undefined> {
  return manuscriptQueue.getJob(jobId);
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const job = await manuscriptQueue.getJob(jobId);
  if (job) {
    await job.remove();
    updateJobStatus(jobId, { status: 'cancelled' as any });
    return true;
  }
  return false;
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    manuscriptQueue.getWaitingCount(),
    manuscriptQueue.getActiveCount(),
    manuscriptQueue.getCompletedCount(),
    manuscriptQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
