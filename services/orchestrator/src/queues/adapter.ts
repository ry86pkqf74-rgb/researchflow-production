/**
 * Queue Adapter Interface - Tasks 158, 175, 193
 *
 * Unified interface for queue backends (BullMQ, RabbitMQ).
 * Supports migration from BullMQ to RabbitMQ with dual-run mode.
 */

/**
 * Backoff configuration
 */
export interface BackoffConfig {
  type: 'fixed' | 'exponential' | 'custom';
  delayMs: number;
  maxDelayMs?: number;
  multiplier?: number;
  /** Custom backoff function (attempt -> delay) */
  customFn?: (attempt: number) => number;
}

/**
 * Job options for enqueue
 */
export interface EnqueueOpts {
  /** Queue name */
  queueName: string;
  /** Unique job ID */
  jobId: string;
  /** Job payload */
  payload: unknown;
  /** Number of retry attempts */
  attempts?: number;
  /** Backoff configuration */
  backoff?: BackoffConfig;
  /** Priority (lower = higher priority) */
  priority?: number;
  /** Delay before processing (ms) */
  delay?: number;
  /** Job timeout (ms) */
  timeout?: number;
  /** Remove job after completion */
  removeOnComplete?: boolean | number;
  /** Remove job after failure */
  removeOnFail?: boolean | number;
  /** Job metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Job result
 */
export interface JobResult<T = unknown> {
  jobId: string;
  queueName: string;
  status: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed';
  result?: T;
  error?: string;
  attempts: number;
  progress?: number;
  processedAt?: string;
  finishedAt?: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Queue Adapter Interface
 */
export interface QueueAdapter {
  /** Backend name */
  readonly name: string;

  /**
   * Enqueue a single job
   */
  enqueue(opts: EnqueueOpts): Promise<string>;

  /**
   * Enqueue multiple jobs in bulk (Task 175)
   */
  enqueueBulk(items: EnqueueOpts[]): Promise<string[]>;

  /**
   * Get job status/result
   */
  getJob<T = unknown>(queueName: string, jobId: string): Promise<JobResult<T> | null>;

  /**
   * Cancel/remove a job
   */
  removeJob(queueName: string, jobId: string): Promise<boolean>;

  /**
   * Get queue statistics
   */
  getQueueStats(queueName: string): Promise<QueueStats>;

  /**
   * Pause a queue
   */
  pauseQueue(queueName: string): Promise<void>;

  /**
   * Resume a queue
   */
  resumeQueue(queueName: string): Promise<void>;

  /**
   * Drain queue (remove all waiting jobs)
   */
  drainQueue(queueName: string): Promise<number>;

  /**
   * Clean old jobs
   */
  cleanQueue(
    queueName: string,
    grace: number,
    status: 'completed' | 'failed'
  ): Promise<number>;

  /**
   * Close connections
   */
  close(): Promise<void>;
}

/**
 * Queue backend type
 */
export type QueueBackend = 'bullmq' | 'rabbitmq' | 'dual';

/**
 * Calculate backoff delay
 */
export function calculateBackoff(
  attempt: number,
  config: BackoffConfig
): number {
  switch (config.type) {
    case 'fixed':
      return config.delayMs;

    case 'exponential': {
      const multiplier = config.multiplier ?? 2;
      const delay = config.delayMs * Math.pow(multiplier, attempt - 1);
      return config.maxDelayMs ? Math.min(delay, config.maxDelayMs) : delay;
    }

    case 'custom':
      if (config.customFn) {
        return config.customFn(attempt);
      }
      return config.delayMs;

    default:
      return config.delayMs;
  }
}

/**
 * Default backoff configuration (Task 193)
 */
export const DEFAULT_BACKOFF: BackoffConfig = {
  type: 'exponential',
  delayMs: 1000,
  maxDelayMs: 300000, // 5 minutes max
  multiplier: 2,
};

/**
 * Default job options
 */
export const DEFAULT_JOB_OPTIONS: Partial<EnqueueOpts> = {
  attempts: 3,
  backoff: DEFAULT_BACKOFF,
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 1000, // Keep last 1000 failed jobs
  timeout: 300000, // 5 minutes
};

export default QueueAdapter;
