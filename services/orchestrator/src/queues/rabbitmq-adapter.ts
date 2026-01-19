/**
 * RabbitMQ Queue Adapter - Task 158
 *
 * RabbitMQ implementation of the queue adapter interface.
 * Used for migration from BullMQ.
 */

// @ts-ignore - amqplib is an optional dependency for RabbitMQ migration
import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import type {
  QueueAdapter,
  EnqueueOpts,
  JobResult,
  QueueStats,
  BackoffConfig,
} from './adapter';
import { calculateBackoff, DEFAULT_JOB_OPTIONS } from './adapter';

/**
 * RabbitMQ adapter configuration
 */
export interface RabbitMQAdapterConfig {
  /** RabbitMQ connection URL */
  url?: string;
  /** Exchange name */
  exchange?: string;
  /** Exchange type */
  exchangeType?: 'direct' | 'topic' | 'fanout';
  /** Default job options */
  defaultJobOptions?: Partial<EnqueueOpts>;
  /** Prefetch count for consumers */
  prefetch?: number;
}

/**
 * Job message format
 */
interface JobMessage {
  jobId: string;
  queueName: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  backoff?: BackoffConfig;
  metadata?: Record<string, unknown>;
  enqueuedAt: string;
}

/**
 * RabbitMQ Queue Adapter
 */
export class RabbitMQAdapter implements QueueAdapter {
  readonly name = 'rabbitmq';

  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private url: string;
  private exchange: string;
  private exchangeType: 'direct' | 'topic' | 'fanout';
  private defaultOpts: Partial<EnqueueOpts>;
  private prefetch: number;
  private declaredQueues = new Set<string>();

  constructor(config: RabbitMQAdapterConfig = {}) {
    this.url = config.url ?? process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
    this.exchange = config.exchange ?? 'researchflow';
    this.exchangeType = config.exchangeType ?? 'direct';
    this.defaultOpts = { ...DEFAULT_JOB_OPTIONS, ...config.defaultJobOptions };
    this.prefetch = config.prefetch ?? 10;
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<Channel> {
    if (!this.connection) {
      this.connection = await amqp.connect(this.url);

      this.connection.on('error', (err) => {
        console.error('[RabbitMQ] Connection error:', err);
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        console.log('[RabbitMQ] Connection closed');
        this.connection = null;
        this.channel = null;
      });
    }

    if (!this.channel) {
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(this.prefetch);

      // Declare exchange
      await this.channel.assertExchange(this.exchange, this.exchangeType, {
        durable: true,
      });
    }

    return this.channel;
  }

  /**
   * Ensure queue is declared
   */
  private async ensureQueue(queueName: string): Promise<void> {
    if (this.declaredQueues.has(queueName)) return;

    const channel = await this.ensureConnection();

    // Declare main queue
    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': `${this.exchange}.dlx`,
        'x-dead-letter-routing-key': `${queueName}.dead`,
      },
    });

    // Bind to exchange
    await channel.bindQueue(queueName, this.exchange, queueName);

    // Declare dead letter exchange and queue
    await channel.assertExchange(`${this.exchange}.dlx`, 'direct', { durable: true });
    await channel.assertQueue(`${queueName}.dead`, { durable: true });
    await channel.bindQueue(`${queueName}.dead`, `${this.exchange}.dlx`, `${queueName}.dead`);

    // Declare delay exchange for delayed messages
    await channel.assertExchange(`${this.exchange}.delay`, 'x-delayed-message', {
      durable: true,
      arguments: { 'x-delayed-type': 'direct' },
    }).catch(() => {
      // Plugin may not be installed, ignore
    });

    this.declaredQueues.add(queueName);
  }

  /**
   * Enqueue a single job
   */
  async enqueue(opts: EnqueueOpts): Promise<string> {
    const channel = await this.ensureConnection();
    await this.ensureQueue(opts.queueName);

    const message: JobMessage = {
      jobId: opts.jobId,
      queueName: opts.queueName,
      payload: opts.payload,
      attempts: 0,
      maxAttempts: opts.attempts ?? this.defaultOpts.attempts ?? 3,
      backoff: opts.backoff ?? this.defaultOpts.backoff,
      metadata: opts.metadata,
      enqueuedAt: new Date().toISOString(),
    };

    const headers: Record<string, unknown> = {
      'x-job-id': opts.jobId,
      'x-priority': opts.priority ?? 0,
    };

    // Handle delay using delayed message exchange
    if (opts.delay && opts.delay > 0) {
      headers['x-delay'] = opts.delay;

      channel.publish(
        `${this.exchange}.delay`,
        opts.queueName,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          headers,
          expiration: opts.timeout?.toString(),
        }
      );
    } else {
      channel.publish(
        this.exchange,
        opts.queueName,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          headers,
          priority: opts.priority,
          expiration: opts.timeout?.toString(),
        }
      );
    }

    return opts.jobId;
  }

  /**
   * Enqueue multiple jobs in bulk (Task 175)
   */
  async enqueueBulk(items: EnqueueOpts[]): Promise<string[]> {
    const channel = await this.ensureConnection();

    // Ensure all queues exist
    const uniqueQueues = [...new Set(items.map(i => i.queueName))];
    await Promise.all(uniqueQueues.map(q => this.ensureQueue(q)));

    const results: string[] = [];

    for (const opts of items) {
      const message: JobMessage = {
        jobId: opts.jobId,
        queueName: opts.queueName,
        payload: opts.payload,
        attempts: 0,
        maxAttempts: opts.attempts ?? this.defaultOpts.attempts ?? 3,
        backoff: opts.backoff ?? this.defaultOpts.backoff,
        metadata: opts.metadata,
        enqueuedAt: new Date().toISOString(),
      };

      channel.publish(
        this.exchange,
        opts.queueName,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          headers: {
            'x-job-id': opts.jobId,
            'x-priority': opts.priority ?? 0,
          },
          priority: opts.priority,
        }
      );

      results.push(opts.jobId);
    }

    return results;
  }

  /**
   * Get job status/result
   * Note: RabbitMQ doesn't natively track job status like BullMQ
   */
  async getJob<T = unknown>(
    queueName: string,
    jobId: string
  ): Promise<JobResult<T> | null> {
    // RabbitMQ doesn't have native job tracking
    // This would need to be implemented with a separate store
    console.warn('[RabbitMQ] getJob requires external job store - not implemented');
    return null;
  }

  /**
   * Remove a job (not directly supported by RabbitMQ)
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    console.warn('[RabbitMQ] removeJob requires external job store - not implemented');
    return false;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const channel = await this.ensureConnection();
    await this.ensureQueue(queueName);

    const queueInfo = await channel.checkQueue(queueName);

    return {
      queueName,
      waiting: queueInfo.messageCount,
      active: queueInfo.consumerCount,
      completed: 0, // RabbitMQ doesn't track this
      failed: 0,
      delayed: 0,
      paused: false,
    };
  }

  /**
   * Pause a queue (stop consumers)
   */
  async pauseQueue(queueName: string): Promise<void> {
    // RabbitMQ doesn't have native pause - would need to cancel consumers
    console.warn('[RabbitMQ] pauseQueue requires consumer management - not implemented');
  }

  /**
   * Resume a queue (restart consumers)
   */
  async resumeQueue(queueName: string): Promise<void> {
    console.warn('[RabbitMQ] resumeQueue requires consumer management - not implemented');
  }

  /**
   * Drain queue (purge messages)
   */
  async drainQueue(queueName: string): Promise<number> {
    const channel = await this.ensureConnection();
    await this.ensureQueue(queueName);

    const result = await channel.purgeQueue(queueName);
    return result.messageCount;
  }

  /**
   * Clean old jobs (not supported - RabbitMQ uses TTL)
   */
  async cleanQueue(
    queueName: string,
    grace: number,
    status: 'completed' | 'failed'
  ): Promise<number> {
    // RabbitMQ uses message TTL for cleanup
    console.warn('[RabbitMQ] cleanQueue uses TTL - manual cleanup not supported');
    return 0;
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.declaredQueues.clear();
  }
}

/**
 * Create RabbitMQ adapter instance
 */
export function createRabbitMQAdapter(
  config?: RabbitMQAdapterConfig
): RabbitMQAdapter {
  return new RabbitMQAdapter(config);
}

export default RabbitMQAdapter;
