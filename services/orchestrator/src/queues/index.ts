/**
 * Queue System - Tasks 158, 175, 193
 *
 * Unified queue interface with support for migration from BullMQ to RabbitMQ.
 * QUEUE_BACKEND env controls which backend is used.
 */

import type { QueueAdapter, QueueBackend, EnqueueOpts } from './adapter';
import { BullMQAdapter, createBullMQAdapter } from './bullmq-adapter';
import { RabbitMQAdapter, createRabbitMQAdapter } from './rabbitmq-adapter';
import { logger } from '../logger/file-logger.js';

// Re-export types
export type { QueueAdapter, EnqueueOpts, JobResult, QueueStats, BackoffConfig } from './adapter';
export { DEFAULT_BACKOFF, DEFAULT_JOB_OPTIONS, calculateBackoff } from './adapter';
export { BullMQAdapter, createBullMQAdapter } from './bullmq-adapter';
export { RabbitMQAdapter, createRabbitMQAdapter } from './rabbitmq-adapter';

/**
 * Dual adapter that publishes to both BullMQ and RabbitMQ
 * Used during migration (Phase 2)
 */
class DualQueueAdapter implements QueueAdapter {
  readonly name = 'dual';

  private bullmq: BullMQAdapter;
  private rabbitmq: RabbitMQAdapter;
  private primary: 'bullmq' | 'rabbitmq';

  constructor(
    bullmq: BullMQAdapter,
    rabbitmq: RabbitMQAdapter,
    primary: 'bullmq' | 'rabbitmq' = 'bullmq'
  ) {
    this.bullmq = bullmq;
    this.rabbitmq = rabbitmq;
    this.primary = primary;
  }

  async enqueue(opts: EnqueueOpts): Promise<string> {
    // Publish to both
    const [bullmqResult, rabbitmqResult] = await Promise.allSettled([
      this.bullmq.enqueue(opts),
      this.rabbitmq.enqueue(opts),
    ]);

    // Log any failures
    if (bullmqResult.status === 'rejected') {
      logger.error('[DualQueue] BullMQ enqueue failed:', bullmqResult.reason);
    }
    if (rabbitmqResult.status === 'rejected') {
      logger.error('[DualQueue] RabbitMQ enqueue failed:', rabbitmqResult.reason);
    }

    // Return result from primary
    if (this.primary === 'bullmq' && bullmqResult.status === 'fulfilled') {
      return bullmqResult.value;
    }
    if (this.primary === 'rabbitmq' && rabbitmqResult.status === 'fulfilled') {
      return rabbitmqResult.value;
    }

    // Fall back to whichever succeeded
    if (bullmqResult.status === 'fulfilled') return bullmqResult.value;
    if (rabbitmqResult.status === 'fulfilled') return rabbitmqResult.value;

    throw new Error('Both BullMQ and RabbitMQ enqueue failed');
  }

  async enqueueBulk(items: EnqueueOpts[]): Promise<string[]> {
    const [bullmqResult, rabbitmqResult] = await Promise.allSettled([
      this.bullmq.enqueueBulk(items),
      this.rabbitmq.enqueueBulk(items),
    ]);

    if (bullmqResult.status === 'rejected') {
      logger.error('[DualQueue] BullMQ bulk enqueue failed:', bullmqResult.reason);
    }
    if (rabbitmqResult.status === 'rejected') {
      logger.error('[DualQueue] RabbitMQ bulk enqueue failed:', rabbitmqResult.reason);
    }

    if (this.primary === 'bullmq' && bullmqResult.status === 'fulfilled') {
      return bullmqResult.value;
    }
    if (this.primary === 'rabbitmq' && rabbitmqResult.status === 'fulfilled') {
      return rabbitmqResult.value;
    }

    if (bullmqResult.status === 'fulfilled') return bullmqResult.value;
    if (rabbitmqResult.status === 'fulfilled') return rabbitmqResult.value;

    throw new Error('Both BullMQ and RabbitMQ bulk enqueue failed');
  }

  async getJob<T = unknown>(queueName: string, jobId: string) {
    // Get from primary
    return this.primary === 'bullmq'
      ? this.bullmq.getJob<T>(queueName, jobId)
      : this.rabbitmq.getJob<T>(queueName, jobId);
  }

  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const [bullmqResult, rabbitmqResult] = await Promise.allSettled([
      this.bullmq.removeJob(queueName, jobId),
      this.rabbitmq.removeJob(queueName, jobId),
    ]);

    return (
      (bullmqResult.status === 'fulfilled' && bullmqResult.value) ||
      (rabbitmqResult.status === 'fulfilled' && rabbitmqResult.value)
    );
  }

  async getQueueStats(queueName: string) {
    return this.primary === 'bullmq'
      ? this.bullmq.getQueueStats(queueName)
      : this.rabbitmq.getQueueStats(queueName);
  }

  async pauseQueue(queueName: string): Promise<void> {
    await Promise.all([
      this.bullmq.pauseQueue(queueName),
      this.rabbitmq.pauseQueue(queueName),
    ]);
  }

  async resumeQueue(queueName: string): Promise<void> {
    await Promise.all([
      this.bullmq.resumeQueue(queueName),
      this.rabbitmq.resumeQueue(queueName),
    ]);
  }

  async drainQueue(queueName: string): Promise<number> {
    const [bullmqCount, rabbitmqCount] = await Promise.all([
      this.bullmq.drainQueue(queueName),
      this.rabbitmq.drainQueue(queueName),
    ]);
    return Math.max(bullmqCount, rabbitmqCount);
  }

  async cleanQueue(
    queueName: string,
    grace: number,
    status: 'completed' | 'failed'
  ): Promise<number> {
    const [bullmqCount, rabbitmqCount] = await Promise.all([
      this.bullmq.cleanQueue(queueName, grace, status),
      this.rabbitmq.cleanQueue(queueName, grace, status),
    ]);
    return bullmqCount + rabbitmqCount;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.bullmq.close(),
      this.rabbitmq.close(),
    ]);
  }
}

/**
 * Singleton queue adapter instance
 */
let queueAdapter: QueueAdapter | null = null;

/**
 * Get the configured queue adapter
 */
export function getQueueAdapter(): QueueAdapter {
  if (queueAdapter) return queueAdapter;

  const backend = (process.env.QUEUE_BACKEND ?? 'bullmq') as QueueBackend;

  switch (backend) {
    case 'bullmq':
      queueAdapter = createBullMQAdapter();
      logger.info('[Queue] Using BullMQ backend');
      break;

    case 'rabbitmq':
      queueAdapter = createRabbitMQAdapter();
      logger.info('[Queue] Using RabbitMQ backend');
      break;

    case 'dual': {
      const bullmq = createBullMQAdapter();
      const rabbitmq = createRabbitMQAdapter();
      const primary = (process.env.QUEUE_PRIMARY ?? 'bullmq') as 'bullmq' | 'rabbitmq';
      queueAdapter = new DualQueueAdapter(bullmq, rabbitmq, primary);
      logger.info(`[Queue] Using dual backend (primary: ${primary})`);
      break;
    }

    default:
      throw new Error(`Unknown queue backend: ${backend}`);
  }

  return queueAdapter;
}

/**
 * Reset queue adapter (for testing)
 */
export async function resetQueueAdapter(): Promise<void> {
  if (queueAdapter) {
    await queueAdapter.close();
    queueAdapter = null;
  }
}

/**
 * Convenience function to enqueue a job
 */
export async function enqueueJob(opts: EnqueueOpts): Promise<string> {
  return getQueueAdapter().enqueue(opts);
}

/**
 * Convenience function to bulk enqueue jobs (Task 175)
 */
export async function enqueueJobsBulk(items: EnqueueOpts[]): Promise<string[]> {
  return getQueueAdapter().enqueueBulk(items);
}

export default {
  getQueueAdapter,
  resetQueueAdapter,
  enqueueJob,
  enqueueJobsBulk,
};
