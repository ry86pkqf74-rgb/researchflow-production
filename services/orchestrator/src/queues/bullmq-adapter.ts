/**
 * BullMQ Queue Adapter - Tasks 158, 175, 193
 *
 * BullMQ implementation of the queue adapter interface.
 * Includes improved backoff strategies (Task 193).
 */

import { Queue } from 'bullmq';
import type {
  QueueAdapter,
  EnqueueOpts,
  JobResult,
  QueueStats,
  BackoffConfig,
} from './adapter';
import { calculateBackoff, DEFAULT_JOB_OPTIONS } from './adapter';

/**
 * BullMQ adapter configuration
 */
export interface BullMQAdapterConfig {
  /** Redis connection URL */
  redisUrl?: string;
  /** Redis connection options (host, port, etc.) */
  redisOptions?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  /** Default job options */
  defaultJobOptions?: Partial<EnqueueOpts>;
  /** Prefix for queue names */
  prefix?: string;
}

/**
 * BullMQ Queue Adapter
 */
export class BullMQAdapter implements QueueAdapter {
  readonly name = 'bullmq';

  private queues = new Map<string, Queue>();
  private redisUrl: string;
  private prefix: string;
  private defaultOpts: Partial<EnqueueOpts>;

  constructor(config: BullMQAdapterConfig = {}) {
    this.redisUrl = config.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.prefix = config.prefix ?? 'researchflow';
    this.defaultOpts = { ...DEFAULT_JOB_OPTIONS, ...config.defaultJobOptions };
  }

  /**
   * Get or create a queue
   */
  private getQueue(queueName: string): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, {
        connection: {
          host: new URL(this.redisUrl).hostname || 'localhost',
          port: parseInt(new URL(this.redisUrl).port || '6379', 10),
        },
        prefix: this.prefix,
        defaultJobOptions: {
          attempts: this.defaultOpts.attempts ?? 3,
          removeOnComplete: this.defaultOpts.removeOnComplete,
          removeOnFail: this.defaultOpts.removeOnFail,
        },
      });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  /**
   * Convert backoff config to BullMQ format
   */
  private toBullMQBackoff(backoff?: BackoffConfig): {
    type: 'fixed' | 'exponential';
    delay: number;
  } | undefined {
    if (!backoff) return undefined;

    // BullMQ only supports fixed and exponential
    if (backoff.type === 'custom') {
      // Fall back to exponential for custom
      return {
        type: 'exponential',
        delay: backoff.delayMs,
      };
    }

    return {
      type: backoff.type as 'fixed' | 'exponential',
      delay: backoff.delayMs,
    };
  }

  /**
   * Enqueue a single job
   */
  async enqueue(opts: EnqueueOpts): Promise<string> {
    const queue = this.getQueue(opts.queueName);

    const jobOpts = {
      jobId: opts.jobId,
      attempts: opts.attempts ?? this.defaultOpts.attempts,
      backoff: this.toBullMQBackoff(opts.backoff ?? this.defaultOpts.backoff),
      priority: opts.priority,
      delay: opts.delay,
      timeout: opts.timeout,
      removeOnComplete: opts.removeOnComplete ?? this.defaultOpts.removeOnComplete,
      removeOnFail: opts.removeOnFail ?? this.defaultOpts.removeOnFail,
    };

    const job = await queue.add(opts.queueName, opts.payload, jobOpts);

    return job.id ?? opts.jobId;
  }

  /**
   * Enqueue multiple jobs in bulk (Task 175)
   */
  async enqueueBulk(items: EnqueueOpts[]): Promise<string[]> {
    // Group by queue
    const byQueue = new Map<string, EnqueueOpts[]>();
    for (const item of items) {
      const list = byQueue.get(item.queueName) ?? [];
      list.push(item);
      byQueue.set(item.queueName, list);
    }

    const results: string[] = [];

    // Add to each queue in bulk
    for (const [queueName, queueItems] of byQueue) {
      const queue = this.getQueue(queueName);

      const jobs = queueItems.map(item => ({
        name: queueName,
        data: item.payload,
        opts: {
          jobId: item.jobId,
          attempts: item.attempts ?? this.defaultOpts.attempts,
          backoff: this.toBullMQBackoff(item.backoff ?? this.defaultOpts.backoff),
          priority: item.priority,
          delay: item.delay,
          timeout: item.timeout,
          removeOnComplete: item.removeOnComplete ?? this.defaultOpts.removeOnComplete,
          removeOnFail: item.removeOnFail ?? this.defaultOpts.removeOnFail,
        },
      }));

      const addedJobs = await queue.addBulk(jobs);
      results.push(...addedJobs.map(j => j.id ?? ''));
    }

    return results;
  }

  /**
   * Get job status/result
   */
  async getJob<T = unknown>(
    queueName: string,
    jobId: string
  ): Promise<JobResult<T> | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) return null;

    const state = await job.getState();

    return {
      jobId: job.id ?? jobId,
      queueName,
      status: state as JobResult['status'],
      result: job.returnvalue as T,
      error: job.failedReason,
      attempts: job.attemptsMade,
      progress: typeof job.progress === 'number' ? job.progress : undefined,
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
    };
  }

  /**
   * Remove a job
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) return false;

    await job.remove();
    return true;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    };
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  /**
   * Drain queue
   */
  async drainQueue(queueName: string): Promise<number> {
    const queue = this.getQueue(queueName);
    const waitingCount = await queue.getWaitingCount();
    await queue.drain();
    return waitingCount;
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(
    queueName: string,
    grace: number,
    status: 'completed' | 'failed'
  ): Promise<number> {
    const queue = this.getQueue(queueName);
    const cleaned = await queue.clean(grace, 1000, status);
    return cleaned.length;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const queue of this.queues.values()) {
      closePromises.push(queue.close());
    }

    await Promise.all(closePromises);
    this.queues.clear();
  }
}

/**
 * Create BullMQ adapter instance
 */
export function createBullMQAdapter(
  config?: BullMQAdapterConfig
): BullMQAdapter {
  return new BullMQAdapter(config);
}

export default BullMQAdapter;
