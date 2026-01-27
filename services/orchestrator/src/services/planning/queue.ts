/**
 * Planning Queue Service
 *
 * BullMQ-based job queue for agentic planning pipeline.
 * Handles async plan generation and execution jobs.
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { EventEmitter } from 'events';
import { planningService } from './planning.service';

// Redis connection config from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = {
  url: REDIS_URL,
};

// Parse Redis URL for BullMQ
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

// Queue names
export const QUEUE_NAMES = {
  PLAN_BUILD: 'agentic:plan-build',
  PLAN_RUN: 'agentic:plan-run',
} as const;

// Job data types
export interface PlanBuildJobData {
  planId: string;
  jobId: string;
  datasetId: string;
  researchGoal: string;
  constraints: Record<string, unknown>;
  governanceMode: 'DEMO' | 'LIVE';
}

export interface PlanRunJobData {
  planId: string;
  jobId: string;
  planSpec: unknown;
  constraints: Record<string, unknown>;
  configOverrides: Record<string, unknown>;
}

// Event emitter for job status updates
export const jobEvents = new EventEmitter();

// Queues
let planBuildQueue: Queue<PlanBuildJobData> | null = null;
let planRunQueue: Queue<PlanRunJobData> | null = null;

// Workers
let planBuildWorker: Worker<PlanBuildJobData> | null = null;
let planRunWorker: Worker<PlanRunJobData> | null = null;

// Queue events
let planBuildQueueEvents: QueueEvents | null = null;
let planRunQueueEvents: QueueEvents | null = null;

/**
 * Initialize the planning queues and workers
 */
export async function initPlanningQueues(): Promise<void> {
  console.log('[Planning Queue] Initializing BullMQ queues...');

  // Create queues
  planBuildQueue = new Queue<PlanBuildJobData>(QUEUE_NAMES.PLAN_BUILD, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  planRunQueue = new Queue<PlanRunJobData>(QUEUE_NAMES.PLAN_RUN, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  // Create workers
  planBuildWorker = new Worker<PlanBuildJobData>(
    QUEUE_NAMES.PLAN_BUILD,
    async (job: Job<PlanBuildJobData>) => {
      console.log(`[Planning Queue] Processing plan build job ${job.id}`);

      try {
        await planningService.generatePlanInBackground(
          job.data.planId,
          job.data.jobId,
          job.data.datasetId,
          job.data.researchGoal,
          job.data.constraints,
          job.data.governanceMode
        );

        jobEvents.emit(`job:${job.data.jobId}:completed`, {
          jobId: job.data.jobId,
          planId: job.data.planId,
          status: 'completed',
        });

        return { success: true };
      } catch (error) {
        console.error(`[Planning Queue] Plan build job ${job.id} failed:`, error);

        jobEvents.emit(`job:${job.data.jobId}:failed`, {
          jobId: job.data.jobId,
          planId: job.data.planId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    },
    { connection, concurrency: 2 }
  );

  planRunWorker = new Worker<PlanRunJobData>(
    QUEUE_NAMES.PLAN_RUN,
    async (job: Job<PlanRunJobData>) => {
      console.log(`[Planning Queue] Processing plan run job ${job.id}`);

      try {
        await planningService.executePlanInBackground(
          job.data.planId,
          job.data.jobId,
          job.data.planSpec,
          job.data.constraints,
          job.data.configOverrides
        );

        jobEvents.emit(`job:${job.data.jobId}:completed`, {
          jobId: job.data.jobId,
          planId: job.data.planId,
          status: 'completed',
        });

        return { success: true };
      } catch (error) {
        console.error(`[Planning Queue] Plan run job ${job.id} failed:`, error);

        jobEvents.emit(`job:${job.data.jobId}:failed`, {
          jobId: job.data.jobId,
          planId: job.data.planId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      }
    },
    { connection, concurrency: 1 }
  );

  // Setup queue events for SSE streaming
  planBuildQueueEvents = new QueueEvents(QUEUE_NAMES.PLAN_BUILD, { connection });
  planRunQueueEvents = new QueueEvents(QUEUE_NAMES.PLAN_RUN, { connection });

  // Forward queue events
  planBuildQueueEvents.on('progress', ({ jobId, data }) => {
    jobEvents.emit(`job:${data?.jobId}:progress`, data);
  });

  planRunQueueEvents.on('progress', ({ jobId, data }) => {
    jobEvents.emit(`job:${data?.jobId}:progress`, data);
  });

  // Error handlers
  planBuildWorker.on('error', (error) => {
    console.error('[Planning Queue] Plan build worker error:', error);
  });

  planRunWorker.on('error', (error) => {
    console.error('[Planning Queue] Plan run worker error:', error);
  });

  console.log('[Planning Queue] Queues and workers initialized');
}

/**
 * Add a plan build job to the queue
 */
export async function addPlanBuildJob(data: PlanBuildJobData): Promise<string> {
  if (!planBuildQueue) {
    throw new Error('Planning queues not initialized');
  }

  const job = await planBuildQueue.add('build-plan', data, {
    jobId: data.jobId,
  });

  console.log(`[Planning Queue] Added plan build job ${job.id}`);
  return job.id || data.jobId;
}

/**
 * Add a plan run job to the queue
 */
export async function addPlanRunJob(data: PlanRunJobData): Promise<string> {
  if (!planRunQueue) {
    throw new Error('Planning queues not initialized');
  }

  const job = await planRunQueue.add('run-plan', data, {
    jobId: data.jobId,
  });

  console.log(`[Planning Queue] Added plan run job ${job.id}`);
  return job.id || data.jobId;
}

/**
 * Get job status by ID
 */
export async function getJobStatus(
  jobId: string,
  queueName: keyof typeof QUEUE_NAMES
): Promise<{
  status: string;
  progress: number;
  data?: unknown;
  error?: string;
} | null> {
  const queue = queueName === 'PLAN_BUILD' ? planBuildQueue : planRunQueue;
  if (!queue) {
    return null;
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress as number || 0;

  return {
    status: state,
    progress,
    data: job.data,
    error: job.failedReason,
  };
}

/**
 * Shutdown queues gracefully
 */
export async function shutdownPlanningQueues(): Promise<void> {
  console.log('[Planning Queue] Shutting down...');

  if (planBuildWorker) await planBuildWorker.close();
  if (planRunWorker) await planRunWorker.close();
  if (planBuildQueueEvents) await planBuildQueueEvents.close();
  if (planRunQueueEvents) await planRunQueueEvents.close();
  if (planBuildQueue) await planBuildQueue.close();
  if (planRunQueue) await planRunQueue.close();

  console.log('[Planning Queue] Shutdown complete');
}

export default {
  init: initPlanningQueues,
  shutdown: shutdownPlanningQueues,
  addPlanBuildJob,
  addPlanRunJob,
  getJobStatus,
  jobEvents,
  QUEUE_NAMES,
};
