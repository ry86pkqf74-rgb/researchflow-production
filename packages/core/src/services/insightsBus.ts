/**
 * Insights Bus - Redis Streams client for transparency events
 * 
 * Provides publish/consume interface for the ros:insights stream.
 * Supports consumer groups for parallel processing of AI invocation events.
 * 
 * @module @researchflow/core/services/insightsBus
 */

import { Redis } from 'ioredis';
import { AIInvocationEvent, AI_INVOCATION_EVENT_TYPE } from '../events';

// ============================================
// Configuration
// ============================================

export interface InsightsBusConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Stream name (default: ros:insights) */
  streamName?: string;
  /** Consumer group name (default: insights-workers) */
  consumerGroup?: string;
  /** Consumer name (unique per instance) */
  consumerName?: string;
  /** Max stream length before trimming (default: 100000) */
  maxStreamLength?: number;
  /** Batch size for consuming (default: 10) */
  batchSize?: number;
  /** Block timeout in ms for XREADGROUP (default: 5000) */
  blockTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<Omit<InsightsBusConfig, 'redisUrl'>> = {
  streamName: process.env.INSIGHTS_STREAM_NAME || 'ros:insights',
  consumerGroup: process.env.INSIGHTS_CONSUMER_GROUP || 'insights-workers',
  consumerName: `worker-${process.pid}-${Date.now()}`,
  maxStreamLength: parseInt(process.env.INSIGHTS_MAX_LEN || '100000', 10),
  batchSize: parseInt(process.env.INSIGHTS_BATCH_SIZE || '10', 10),
  blockTimeoutMs: parseInt(process.env.INSIGHTS_BLOCK_TIMEOUT_MS || '5000', 10),
};

// ============================================
// Types
// ============================================

export interface StreamEntry {
  /** Redis stream entry ID (e.g., "1704067200000-0") */
  id: string;
  /** Event type */
  type: string;
  /** Parsed event data */
  data: AIInvocationEvent;
  /** Raw fields from Redis */
  fields: Record<string, string>;
}

export interface ConsumeResult {
  /** Entries consumed */
  entries: StreamEntry[];
  /** Whether there are more entries available */
  hasMore: boolean;
  /** Last entry ID processed */
  lastId: string | null;
}

export type EventHandler = (entry: StreamEntry) => Promise<void>;

// ============================================
// Insights Bus Class
// ============================================

export class InsightsBus {
  private redis: Redis;
  private config: Required<InsightsBusConfig>;
  private isConsuming = false;
  private consumerInitialized = false;

  constructor(config: InsightsBusConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<InsightsBusConfig>;
    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      console.error('[InsightsBus] Redis error:', err.message);
    });

    this.redis.on('connect', () => {
      console.log('[InsightsBus] Connected to Redis');
    });
  }

  // ============================================
  // Publishing
  // ============================================

  /**
   * Publish an AI invocation event to the insights stream.
   * 
   * @param event - The event to publish
   * @returns The stream entry ID, or null on failure
   */
  async publish(event: AIInvocationEvent): Promise<string | null> {
    try {
      const fields: Record<string, string> = {
        type: AI_INVOCATION_EVENT_TYPE,
        data: JSON.stringify(event),
        timestamp: event.timestamp,
        governance_mode: event.governance_mode,
        project_id: event.project_id,
        tier: event.tier,
        status: event.status,
      };

      // Add optional context fields for filtering
      if (event.run_id) fields.run_id = event.run_id;
      if (event.stage) fields.stage = String(event.stage);
      if (event.agent_id) fields.agent_id = event.agent_id;
      if (event.user_id) fields.user_id = event.user_id;
      if (event.tenant_id) fields.tenant_id = event.tenant_id;

      const entryId = await this.redis.xadd(
        this.config.streamName,
        'MAXLEN', '~', String(this.config.maxStreamLength),
        '*',
        ...Object.entries(fields).flat()
      );

      return entryId;
    } catch (err) {
      console.error('[InsightsBus] Publish failed:', err);
      return null;
    }
  }

  /**
   * Publish multiple events in a pipeline for efficiency.
   * 
   * @param events - Array of events to publish
   * @returns Array of stream entry IDs (null for failures)
   */
  async publishBatch(events: AIInvocationEvent[]): Promise<(string | null)[]> {
    const pipeline = this.redis.pipeline();

    for (const event of events) {
      const fields: string[] = [
        'type', AI_INVOCATION_EVENT_TYPE,
        'data', JSON.stringify(event),
        'timestamp', event.timestamp,
        'governance_mode', event.governance_mode,
        'project_id', event.project_id,
        'tier', event.tier,
        'status', event.status,
      ];

      if (event.run_id) fields.push('run_id', event.run_id);
      if (event.stage) fields.push('stage', String(event.stage));

      pipeline.xadd(
        this.config.streamName,
        'MAXLEN', '~', String(this.config.maxStreamLength),
        '*',
        ...fields
      );
    }

    const results = await pipeline.exec();
    return results?.map(([err, id]) => (err ? null : id as string)) ?? [];
  }

  // ============================================
  // Consuming
  // ============================================

  /**
   * Initialize the consumer group (idempotent).
   */
  private async ensureConsumerGroup(): Promise<void> {
    if (this.consumerInitialized) return;

    try {
      await this.redis.xgroup(
        'CREATE',
        this.config.streamName,
        this.config.consumerGroup,
        '0',
        'MKSTREAM'
      );
      console.log(`[InsightsBus] Created consumer group: ${this.config.consumerGroup}`);
    } catch (err: any) {
      if (err.message?.includes('BUSYGROUP')) {
        // Group already exists - this is fine
        console.log(`[InsightsBus] Consumer group already exists: ${this.config.consumerGroup}`);
      } else {
        throw err;
      }
    }

    this.consumerInitialized = true;
  }

  /**
   * Consume events from the stream using consumer groups.
   * 
   * @param handler - Async function to process each event
   * @param options - Consume options
   */
  async consume(
    handler: EventHandler,
    options: { signal?: AbortSignal } = {}
  ): Promise<void> {
    await this.ensureConsumerGroup();
    this.isConsuming = true;

    console.log(`[InsightsBus] Starting consumer: ${this.config.consumerName}`);

    while (this.isConsuming && !options.signal?.aborted) {
      try {
        // First, claim any pending messages that might have been abandoned
        await this.processPendingMessages(handler);

        // Then read new messages
        const result = await this.redis.xreadgroup(
          'GROUP', this.config.consumerGroup, this.config.consumerName,
          'COUNT', String(this.config.batchSize),
          'BLOCK', String(this.config.blockTimeoutMs),
          'STREAMS', this.config.streamName,
          '>'
        ) as [string, [string, string[]][]][] | null;

        if (!result || result.length === 0) continue;

        const [, entries] = result[0];
        for (const [entryId, fields] of entries) {
          const entry = this.parseEntry(entryId, fields);
          if (entry) {
            try {
              await handler(entry);
              // Acknowledge successful processing
              await this.redis.xack(
                this.config.streamName,
                this.config.consumerGroup,
                entryId
              );
            } catch (err) {
              console.error(`[InsightsBus] Handler error for ${entryId}:`, err);
              // Don't ack - will be retried via pending
            }
          }
        }
      } catch (err) {
        if (!options.signal?.aborted) {
          console.error('[InsightsBus] Consume error:', err);
          await this.sleep(1000); // Back off on error
        }
      }
    }

    console.log('[InsightsBus] Consumer stopped');
  }

  /**
   * Process pending messages that weren't acknowledged.
   */
  private async processPendingMessages(handler: EventHandler): Promise<void> {
    try {
      const pending = await this.redis.xpending(
        this.config.streamName,
        this.config.consumerGroup,
        '-', '+',
        '10'
      ) as [string, string, number, [string, number][]][];

      if (!pending || pending.length === 0) return;

      for (const [entryId, consumer, idleTime] of pending) {
        // Only claim messages idle for more than 30 seconds
        if (idleTime > 30000) {
          const claimed = await this.redis.xclaim(
            this.config.streamName,
            this.config.consumerGroup,
            this.config.consumerName,
            30000, // min-idle-time
            entryId
          ) as [string, string[]][];

          for (const [claimedId, fields] of claimed) {
            const entry = this.parseEntry(claimedId, fields);
            if (entry) {
              try {
                await handler(entry);
                await this.redis.xack(
                  this.config.streamName,
                  this.config.consumerGroup,
                  claimedId
                );
              } catch (err) {
                console.error(`[InsightsBus] Pending handler error for ${claimedId}:`, err);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[InsightsBus] Pending processing error:', err);
    }
  }

  /**
   * Stop the consumer loop gracefully.
   */
  stopConsuming(): void {
    this.isConsuming = false;
  }

  // ============================================
  // Replay & Query
  // ============================================

  /**
   * Replay events from a specific stream ID.
   * Useful for rebuilding state or debugging.
   * 
   * @param fromId - Stream ID to start from (use '0' for beginning)
   * @param handler - Handler for each event
   * @param options - Replay options
   */
  async replay(
    fromId: string,
    handler: EventHandler,
    options: { 
      toId?: string; 
      limit?: number;
      filter?: { 
        runId?: string;
        governanceMode?: 'DEMO' | 'LIVE';
        tier?: string;
      };
    } = {}
  ): Promise<number> {
    const { toId = '+', limit = 10000, filter } = options;
    let processed = 0;
    let currentId = fromId;

    while (processed < limit) {
      const result = await this.redis.xrange(
        this.config.streamName,
        currentId === fromId ? fromId : `(${currentId}`, // Exclusive after first
        toId,
        'COUNT', String(Math.min(100, limit - processed))
      ) as [string, string[]][];

      if (!result || result.length === 0) break;

      for (const [entryId, fields] of result) {
        const entry = this.parseEntry(entryId, fields);
        if (entry && this.matchesFilter(entry, filter)) {
          await handler(entry);
          processed++;
        }
        currentId = entryId;
      }

      if (result.length < 100) break; // No more data
    }

    return processed;
  }

  /**
   * Get events for a specific run ID.
   */
  async getEventsForRun(runId: string, limit = 1000): Promise<StreamEntry[]> {
    const entries: StreamEntry[] = [];
    
    await this.replay('0', async (entry) => {
      entries.push(entry);
    }, {
      limit,
      filter: { runId }
    });

    return entries;
  }

  /**
   * Get stream info and statistics.
   */
  async getStreamInfo(): Promise<{
    length: number;
    firstEntry: string | null;
    lastEntry: string | null;
    groups: number;
  }> {
    try {
      const info = await this.redis.xinfo('STREAM', this.config.streamName) as any[];
      const infoObj: Record<string, any> = {};
      
      for (let i = 0; i < info.length; i += 2) {
        infoObj[info[i]] = info[i + 1];
      }

      return {
        length: infoObj.length || 0,
        firstEntry: infoObj['first-entry']?.[0] || null,
        lastEntry: infoObj['last-entry']?.[0] || null,
        groups: infoObj.groups || 0,
      };
    } catch (err: any) {
      if (err.message?.includes('no such key')) {
        return { length: 0, firstEntry: null, lastEntry: null, groups: 0 };
      }
      throw err;
    }
  }

  // ============================================
  // Utilities
  // ============================================

  private parseEntry(entryId: string, fields: string[]): StreamEntry | null {
    try {
      const fieldMap: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        fieldMap[fields[i]] = fields[i + 1];
      }

      const data = JSON.parse(fieldMap.data);
      return {
        id: entryId,
        type: fieldMap.type,
        data,
        fields: fieldMap,
      };
    } catch (err) {
      console.error(`[InsightsBus] Failed to parse entry ${entryId}:`, err);
      return null;
    }
  }

  private matchesFilter(
    entry: StreamEntry,
    filter?: { runId?: string; governanceMode?: string; tier?: string }
  ): boolean {
    if (!filter) return true;
    if (filter.runId && entry.data.run_id !== filter.runId) return false;
    if (filter.governanceMode && entry.data.governance_mode !== filter.governanceMode) return false;
    if (filter.tier && entry.data.tier !== filter.tier) return false;
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close the Redis connection.
   */
  async close(): Promise<void> {
    this.stopConsuming();
    await this.redis.quit();
  }

  /**
   * Health check - verify Redis connection and stream exists.
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; streamLength: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      const info = await this.getStreamInfo();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        streamLength: info.length,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        streamLength: 0,
      };
    }
  }
}

// ============================================
// Singleton Factory
// ============================================

let insightsBusInstance: InsightsBus | null = null;

/**
 * Get or create the shared InsightsBus instance.
 */
export function getInsightsBus(config?: Partial<InsightsBusConfig>): InsightsBus {
  if (!insightsBusInstance) {
    const redisUrl = config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    insightsBusInstance = new InsightsBus({ redisUrl, ...config });
  }
  return insightsBusInstance;
}

/**
 * Shutdown the shared InsightsBus instance.
 */
export async function shutdownInsightsBus(): Promise<void> {
  if (insightsBusInstance) {
    await insightsBusInstance.close();
    insightsBusInstance = null;
  }
}
