/**
 * AI Streaming Router
 *
 * Server-Sent Events (SSE) endpoint for streaming AI responses.
 * Reduces perceived latency by showing progress during long operations.
 *
 * Phase 07: Latency Streaming + UX
 * See docs/architecture/perf-optimization-roadmap.md
 */

import { Router, Request, Response } from 'express';
import { config } from '../config/env';

const router = Router();

/**
 * SSE Event Types
 */
export enum SSEEventType {
  STATUS = 'status',      // Phase updates (Drafting, Validating, etc.)
  TOKEN = 'token',        // Partial text chunks
  PROGRESS = 'progress',  // Percentage progress
  DONE = 'done',          // Final payload
  ERROR = 'error',        // Error details
}

/**
 * SSE Event Interface
 */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  id?: string;
}

/**
 * Format an SSE event for transmission
 */
function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }

  lines.push(`event: ${event.type}`);
  lines.push(`data: ${JSON.stringify(event.data)}`);
  lines.push(''); // Empty line to end the event

  return lines.join('\n') + '\n';
}

/**
 * SSE Writer class for managing streaming responses
 */
class SSEWriter {
  private res: Response;
  private closed: boolean = false;
  private eventId: number = 0;
  private idleTimeout: NodeJS.Timeout | null = null;
  private idleTimeoutMs: number;

  constructor(res: Response, idleTimeoutMs: number = 30000) {
    this.res = res;
    this.idleTimeoutMs = idleTimeoutMs;
    this.resetIdleTimeout();
  }

  private resetIdleTimeout(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.idleTimeout = setTimeout(() => {
      this.sendError('Idle timeout - no activity');
      this.close();
    }, this.idleTimeoutMs);
  }

  /**
   * Send an SSE event
   */
  send(type: SSEEventType, data: unknown): void {
    if (this.closed) return;

    this.resetIdleTimeout();
    this.eventId++;

    const event: SSEEvent = {
      type,
      data,
      id: String(this.eventId),
    };

    this.res.write(formatSSEEvent(event));
  }

  /**
   * Send status update
   */
  sendStatus(status: string, details?: Record<string, unknown>): void {
    this.send(SSEEventType.STATUS, { status, ...details });
  }

  /**
   * Send token chunk
   */
  sendToken(token: string): void {
    this.send(SSEEventType.TOKEN, { token });
  }

  /**
   * Send progress update
   */
  sendProgress(percent: number, message?: string): void {
    this.send(SSEEventType.PROGRESS, { percent, message });
  }

  /**
   * Send completion event
   */
  sendDone(payload: unknown): void {
    this.send(SSEEventType.DONE, payload);
    this.close();
  }

  /**
   * Send error event
   */
  sendError(message: string, code?: string): void {
    this.send(SSEEventType.ERROR, { message, code });
  }

  /**
   * Close the SSE stream
   */
  close(): void {
    if (this.closed) return;

    this.closed = true;

    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }

    this.res.end();
  }

  /**
   * Check if stream is still open
   */
  isOpen(): boolean {
    return !this.closed;
  }
}

/**
 * Initialize SSE response headers
 */
function initSSEResponse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
}

/**
 * POST /api/ai/stream
 *
 * Stream AI generation responses via SSE
 *
 * Request body:
 * {
 *   "operation": "irb_draft" | "manuscript_draft" | "literature_synthesis",
 *   "input": { ... operation-specific input ... },
 *   "options": {
 *     "model_tier": "MINI" | "STANDARD" | "ADVANCED",
 *     "stream_tokens": true
 *   }
 * }
 *
 * SSE Events:
 * - status: { status: "Drafting", stage: "introduction" }
 * - token: { token: "partial text" }
 * - progress: { percent: 50, message: "Generating methods section" }
 * - done: { result: { ... }, metadata: { ... } }
 * - error: { message: "Error description", code: "ERROR_CODE" }
 */
router.post('/stream', async (req: Request, res: Response) => {
  // Check if streaming is enabled
  if (!config.aiStreamingEnabled) {
    res.status(503).json({
      error: 'Streaming disabled',
      message: 'AI_STREAMING_ENABLED is set to false',
      code: 'STREAMING_DISABLED',
    });
    return;
  }

  const { operation, input, options = {} } = req.body;

  // Validate request
  if (!operation) {
    res.status(400).json({
      error: 'Missing operation',
      message: 'Request body must include "operation" field',
      code: 'INVALID_REQUEST',
    });
    return;
  }

  // Initialize SSE
  initSSEResponse(res);
  const writer = new SSEWriter(res, config.aiStreamingIdleTimeoutMs);

  // Handle client disconnect
  req.on('close', () => {
    writer.close();
  });

  try {
    // Log start (PHI-safe - no body content)
    console.log(JSON.stringify({
      type: 'ai_stream_start',
      operation,
      timestamp: new Date().toISOString(),
    }));

    writer.sendStatus('Initializing', { operation });

    // TODO: Integrate with ai-router streaming when available
    // For now, simulate streaming behavior

    // This is a placeholder - actual implementation would:
    // 1. Call ai-router.routeStream() if available
    // 2. Pipe tokens from the provider
    // 3. Handle errors gracefully

    // Simulated streaming response
    writer.sendStatus('Processing', { stage: 'preparing' });
    writer.sendProgress(10, 'Analyzing input');

    // In real implementation, this would be replaced with actual AI streaming
    await new Promise(resolve => setTimeout(resolve, 100));

    writer.sendProgress(50, 'Generating content');
    await new Promise(resolve => setTimeout(resolve, 100));

    writer.sendProgress(90, 'Finalizing');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send completion
    writer.sendDone({
      result: {
        message: 'Streaming endpoint ready for integration',
        operation,
      },
      metadata: {
        streaming: true,
        processingTime: 300,
      },
    });

    // Log completion
    console.log(JSON.stringify({
      type: 'ai_stream_complete',
      operation,
      timestamp: new Date().toISOString(),
    }));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(JSON.stringify({
      type: 'ai_stream_error',
      operation,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }));

    writer.sendError(errorMessage, 'STREAM_ERROR');
    writer.close();
  }
});

/**
 * GET /api/ai/stream/health
 *
 * Health check for streaming endpoint
 */
router.get('/stream/health', (req: Request, res: Response) => {
  res.json({
    enabled: config.aiStreamingEnabled,
    idleTimeoutMs: config.aiStreamingIdleTimeoutMs,
    status: config.aiStreamingEnabled ? 'ready' : 'disabled',
  });
});

export default router;
export { SSEWriter, SSEEventType, formatSSEEvent };
