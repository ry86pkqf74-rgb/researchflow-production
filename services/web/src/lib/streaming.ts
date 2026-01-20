/**
 * SSE Streaming Utilities
 *
 * Client-side helpers for consuming Server-Sent Events from the AI streaming endpoint.
 *
 * Phase 07: Latency Streaming + UX
 * See docs/architecture/perf-optimization-roadmap.md
 *
 * Usage:
 * ```typescript
 * import { createAIStream, SSEEventType } from '@/lib/streaming';
 *
 * const stream = createAIStream('/api/ai/stream', {
 *   operation: 'irb_draft',
 *   input: { researchId: '123' }
 * });
 *
 * stream.onStatus((data) => setStatus(data.status));
 * stream.onToken((data) => appendToken(data.token));
 * stream.onProgress((data) => setProgress(data.percent));
 * stream.onDone((data) => setResult(data.result));
 * stream.onError((data) => setError(data.message));
 *
 * stream.start();
 * ```
 */

/**
 * SSE Event Types (must match server)
 */
export enum SSEEventType {
  STATUS = 'status',
  TOKEN = 'token',
  PROGRESS = 'progress',
  DONE = 'done',
  ERROR = 'error',
}

/**
 * Event data interfaces
 */
export interface StatusEventData {
  status: string;
  stage?: string;
  [key: string]: unknown;
}

export interface TokenEventData {
  token: string;
}

export interface ProgressEventData {
  percent: number;
  message?: string;
}

export interface DoneEventData {
  result: unknown;
  metadata?: Record<string, unknown>;
}

export interface ErrorEventData {
  message: string;
  code?: string;
}

/**
 * Stream request options
 */
export interface StreamRequestBody {
  operation: string;
  input: Record<string, unknown>;
  options?: {
    model_tier?: 'MINI' | 'STANDARD' | 'ADVANCED';
    stream_tokens?: boolean;
  };
}

/**
 * Event handlers type
 */
type EventHandler<T> = (data: T) => void;

/**
 * AIStream class for managing SSE connections
 */
export class AIStream {
  private url: string;
  private body: StreamRequestBody;
  private abortController: AbortController | null = null;
  private eventSource: EventSource | null = null;

  private statusHandlers: EventHandler<StatusEventData>[] = [];
  private tokenHandlers: EventHandler<TokenEventData>[] = [];
  private progressHandlers: EventHandler<ProgressEventData>[] = [];
  private doneHandlers: EventHandler<DoneEventData>[] = [];
  private errorHandlers: EventHandler<ErrorEventData>[] = [];
  private closeHandlers: (() => void)[] = [];

  constructor(url: string, body: StreamRequestBody) {
    this.url = url;
    this.body = body;
  }

  /**
   * Register status event handler
   */
  onStatus(handler: EventHandler<StatusEventData>): this {
    this.statusHandlers.push(handler);
    return this;
  }

  /**
   * Register token event handler
   */
  onToken(handler: EventHandler<TokenEventData>): this {
    this.tokenHandlers.push(handler);
    return this;
  }

  /**
   * Register progress event handler
   */
  onProgress(handler: EventHandler<ProgressEventData>): this {
    this.progressHandlers.push(handler);
    return this;
  }

  /**
   * Register done event handler
   */
  onDone(handler: EventHandler<DoneEventData>): this {
    this.doneHandlers.push(handler);
    return this;
  }

  /**
   * Register error event handler
   */
  onError(handler: EventHandler<ErrorEventData>): this {
    this.errorHandlers.push(handler);
    return this;
  }

  /**
   * Register close event handler
   */
  onClose(handler: () => void): this {
    this.closeHandlers.push(handler);
    return this;
  }

  /**
   * Start the SSE stream using fetch (supports POST)
   */
  async start(): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(this.body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        this.handleError({
          message: error.message || 'Stream request failed',
          code: error.code || 'HTTP_ERROR',
        });
        return;
      }

      if (!response.body) {
        this.handleError({
          message: 'Response body is null',
          code: 'NO_BODY',
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.handleClose();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = this.parseSSEBuffer(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          this.dispatchEvent(event);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was intentionally stopped
        this.handleClose();
      } else {
        this.handleError({
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'STREAM_ERROR',
        });
      }
    }
  }

  /**
   * Stop the SSE stream
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Parse SSE events from buffer
   */
  private parseSSEBuffer(buffer: string): {
    parsed: Array<{ type: string; data: unknown }>;
    remaining: string;
  } {
    const parsed: Array<{ type: string; data: unknown }> = [];
    const lines = buffer.split('\n');
    let remaining = '';
    let currentEvent: { type?: string; data?: string; id?: string } = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Empty line marks end of event
      if (line === '') {
        if (currentEvent.type && currentEvent.data) {
          try {
            parsed.push({
              type: currentEvent.type,
              data: JSON.parse(currentEvent.data),
            });
          } catch {
            // Invalid JSON, skip event
          }
        }
        currentEvent = {};
        continue;
      }

      // Parse line
      if (line.startsWith('event:')) {
        currentEvent.type = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentEvent.data = line.slice(5).trim();
      } else if (line.startsWith('id:')) {
        currentEvent.id = line.slice(3).trim();
      }

      // Check if this might be an incomplete event at the end
      if (i === lines.length - 1 && line !== '') {
        remaining = lines.slice(i).join('\n');
        break;
      }
    }

    return { parsed, remaining };
  }

  /**
   * Dispatch parsed event to handlers
   */
  private dispatchEvent(event: { type: string; data: unknown }): void {
    switch (event.type) {
      case SSEEventType.STATUS:
        this.statusHandlers.forEach(h => h(event.data as StatusEventData));
        break;
      case SSEEventType.TOKEN:
        this.tokenHandlers.forEach(h => h(event.data as TokenEventData));
        break;
      case SSEEventType.PROGRESS:
        this.progressHandlers.forEach(h => h(event.data as ProgressEventData));
        break;
      case SSEEventType.DONE:
        this.doneHandlers.forEach(h => h(event.data as DoneEventData));
        break;
      case SSEEventType.ERROR:
        this.handleError(event.data as ErrorEventData);
        break;
    }
  }

  /**
   * Handle error event
   */
  private handleError(data: ErrorEventData): void {
    this.errorHandlers.forEach(h => h(data));
  }

  /**
   * Handle stream close
   */
  private handleClose(): void {
    this.closeHandlers.forEach(h => h());
  }
}

/**
 * Create an AI stream instance
 */
export function createAIStream(url: string, body: StreamRequestBody): AIStream {
  return new AIStream(url, body);
}

/**
 * Check if streaming is supported in this browser
 */
export function isStreamingSupported(): boolean {
  return (
    typeof fetch !== 'undefined' &&
    typeof ReadableStream !== 'undefined' &&
    typeof TextDecoder !== 'undefined'
  );
}

/**
 * React hook for AI streaming (optional - for React projects)
 */
export function useAIStreamState() {
  // This would be implemented with React hooks
  // Example structure for reference:
  // const [status, setStatus] = useState<string>('');
  // const [tokens, setTokens] = useState<string>('');
  // const [progress, setProgress] = useState<number>(0);
  // const [result, setResult] = useState<unknown>(null);
  // const [error, setError] = useState<string | null>(null);
  // const [isStreaming, setIsStreaming] = useState(false);
  // ...
  throw new Error('useAIStreamState requires React - import from streaming-react.ts instead');
}
