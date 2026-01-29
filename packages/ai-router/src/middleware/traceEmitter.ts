/**
 * Trace Emitter Middleware
 * 
 * Emits AI invocation events to Redis Stream for transparency tracking.
 * Uses fire-and-forget pattern to avoid blocking AI calls.
 * 
 * @module @researchflow/ai-router/middleware/traceEmitter
 */

import { Redis } from 'ioredis';
import {
  AIInvocationEvent,
  AIInvocationEventSchema,
  AI_INVOCATION_EVENT_TYPE,
  createAIInvocationEvent,
} from '@researchflow/core/events';

// ============================================
// Configuration
// ============================================

const INSIGHTS_STREAM_NAME = process.env.INSIGHTS_STREAM_NAME || 'ros:insights';
const INSIGHTS_MAX_LEN = parseInt(process.env.INSIGHTS_MAX_LEN || '100000', 10);
const EMIT_TIMEOUT_MS = parseInt(process.env.INSIGHTS_EMIT_TIMEOUT_MS || '500', 10);

// ============================================
// Redis Client Singleton
// ============================================

let redisClient: Redis | null = null;
let redisAvailable = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds

function getRedisClient(): Redis | null {
  if (!redisAvailable) {
    // Check if we should retry
    const now = Date.now();
    if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
      return null;
    }
    lastHealthCheck = now;
    redisAvailable = true; // Retry
  }

  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: EMIT_TIMEOUT_MS,
      });

      redisClient.on('error', (err) => {
        console.warn('[TraceEmitter] Redis connection error:', err.message);
        redisAvailable = false;
      });

      redisClient.on('connect', () => {
        console.log('[TraceEmitter] Redis connected');
        redisAvailable = true;
      });
    } catch (err) {
      console.warn('[TraceEmitter] Failed to create Redis client:', err);
      redisAvailable = false;
      return null;
    }
  }

  return redisClient;
}

// ============================================
// Trace Emitter
// ============================================

export interface TraceEmitterOptions {
  /** Whether to validate events before emitting (default: true in development) */
  validateEvents?: boolean;
  /** Custom stream name override */
  streamName?: string;
  /** Callback for emit errors (for monitoring) */
  onError?: (error: Error, event: AIInvocationEvent) => void;
  /** Callback for successful emits (for monitoring) */
  onSuccess?: (streamId: string, event: AIInvocationEvent) => void;
}

const defaultOptions: TraceEmitterOptions = {
  validateEvents: process.env.NODE_ENV === 'development',
  streamName: INSIGHTS_STREAM_NAME,
};

/**
 * Emits an AI invocation event to the Redis insights stream.
 * 
 * This is a fire-and-forget operation that will not block or throw.
 * Errors are logged but do not propagate to the caller.
 * 
 * @param event - The AI invocation event to emit
 * @param options - Optional configuration
 * @returns Promise that resolves to the stream entry ID, or null on failure
 */
export async function emitTraceEvent(
  event: AIInvocationEvent,
  options: TraceEmitterOptions = {}
): Promise<string | null> {
  const opts = { ...defaultOptions, ...options };
  const redis = getRedisClient();

  if (!redis) {
    // Graceful degradation - Redis unavailable
    if (opts.onError) {
      opts.onError(new Error('Redis unavailable'), event);
    }
    return null;
  }

  try {
    // Validate if enabled
    if (opts.validateEvents) {
      const validation = AIInvocationEventSchema.safeParse(event);
      if (!validation.success) {
        console.warn('[TraceEmitter] Invalid event:', validation.error.errors);
        if (opts.onError) {
          opts.onError(new Error(`Validation failed: ${validation.error.message}`), event);
        }
        return null;
      }
    }

    // Serialize event for Redis stream
    const fields: Record<string, string> = {
      type: AI_INVOCATION_EVENT_TYPE,
      data: JSON.stringify(event),
      timestamp: event.timestamp,
      governance_mode: event.governance_mode,
      project_id: event.project_id,
      tier: event.tier,
      status: event.status,
    };

    // Add run context if available (for filtering)
    if (event.run_id) fields.run_id = event.run_id;
    if (event.stage) fields.stage = String(event.stage);
    if (event.agent_id) fields.agent_id = event.agent_id;

    // Emit with timeout
    const streamId = await Promise.race([
      redis.xadd(
        opts.streamName!,
        'MAXLEN', '~', String(INSIGHTS_MAX_LEN),
        '*',
        ...Object.entries(fields).flat()
      ),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Emit timeout')), EMIT_TIMEOUT_MS)
      ),
    ]);

    if (streamId && opts.onSuccess) {
      opts.onSuccess(streamId, event);
    }

    return streamId;
  } catch (err) {
    // Fire-and-forget - log but don't throw
    console.warn('[TraceEmitter] Failed to emit event:', err);
    if (opts.onError) {
      opts.onError(err as Error, event);
    }
    return null;
  }
}

/**
 * Creates a middleware wrapper for AI router that automatically emits trace events.
 * 
 * @example
 * ```typescript
 * const tracedRouter = withTraceEmitter(aiRouter, {
 *   projectId: 'project-123',
 *   governanceMode: 'DEMO',
 * });
 * ```
 */
export interface TraceContext {
  projectId: string;
  governanceMode: 'DEMO' | 'LIVE';
  runId?: string;
  stage?: number;
  stageName?: string;
  userId?: string;
  tenantId?: string;
  agentId?: string;
  caller?: 'orchestrator' | 'worker' | 'web';
  tags?: string[];
}

export interface AIRouterResponse {
  content: string;
  model: string;
  provider: string;
  tier: 'NANO' | 'MINI' | 'FRONTIER';
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd?: number;
  };
  latency_ms: number;
  escalated?: boolean;
  escalation_reason?: string;
  quality_gate_passed?: boolean;
}

/**
 * Wraps an AI router call with automatic trace emission.
 * 
 * @param routerFn - The AI router function to wrap
 * @param context - Trace context (project, governance mode, etc.)
 * @param options - Emitter options
 */
export function withTraceEmitter<T extends AIRouterResponse>(
  routerFn: () => Promise<T>,
  context: TraceContext,
  options: TraceEmitterOptions = {}
): () => Promise<T> {
  return async () => {
    const startTime = Date.now();
    const invocationId = crypto.randomUUID();
    
    let response: T | null = null;
    let error: Error | null = null;
    let status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'RATE_LIMITED' = 'SUCCESS';

    try {
      response = await routerFn();
    } catch (err) {
      error = err as Error;
      status = error.message.includes('timeout') ? 'TIMEOUT' 
             : error.message.includes('rate') ? 'RATE_LIMITED' 
             : 'FAILED';
      throw err; // Re-throw after capturing
    } finally {
      const latencyMs = Date.now() - startTime;

      // Build trace event
      const event = createAIInvocationEvent({
        invocation_id: invocationId,
        governance_mode: context.governanceMode,
        project_id: context.projectId,
        run_id: context.runId ?? null,
        stage: context.stage ?? null,
        stage_name: context.stageName ?? null,
        caller: context.caller ?? 'orchestrator',
        tier: response?.tier ?? 'MINI',
        provider: response?.provider ?? 'unknown',
        model: response?.model ?? 'unknown',
        user_id: context.userId ?? null,
        tenant_id: context.tenantId ?? null,
        agent_id: context.agentId ?? null,
        tags: context.tags,
        status,
        usage: response ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
          cost_usd: response.usage.cost_usd ?? 0,
          latency_ms: latencyMs,
        } : {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
          latency_ms: latencyMs,
        },
        routing: response ? {
          escalated: response.escalated,
          escalation_reason: response.escalation_reason,
          quality_gate_passed: response.quality_gate_passed,
        } : undefined,
        error: error ? {
          code: error.name,
          message: error.message,
          retryable: status === 'RATE_LIMITED' || status === 'TIMEOUT',
        } : null,
      });

      // Fire-and-forget emit
      emitTraceEvent(event, options).catch(() => {
        // Intentionally swallow - already logged in emitTraceEvent
      });
    }

    return response!;
  };
}

// ============================================
// Health Check
// ============================================

/**
 * Checks if the trace emitter is healthy (Redis is available).
 */
export async function checkTraceEmitterHealth(): Promise<{
  healthy: boolean;
  latency_ms?: number;
  error?: string;
}> {
  const redis = getRedisClient();
  if (!redis) {
    return { healthy: false, error: 'Redis client unavailable' };
  }

  const start = Date.now();
  try {
    await redis.ping();
    return { healthy: true, latency_ms: Date.now() - start };
  } catch (err) {
    return { healthy: false, error: (err as Error).message };
  }
}

/**
 * Gracefully shuts down the trace emitter.
 */
export async function shutdownTraceEmitter(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
