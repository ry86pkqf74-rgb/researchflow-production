/**
 * Worker Client with Circuit Breaker (Task 72)
 *
 * HTTP client for communicating with the Python worker service.
 * Implements circuit breaker pattern to prevent cascade failures.
 *
 * Circuit Breaker States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */

import { logAction } from '../services/audit-service';

// Configuration from environment
const WORKER_URL = process.env.WORKER_CALLBACK_URL || 'http://worker:8000';
const CIRCUIT_BREAKER_ENABLED = process.env.CIRCUIT_BREAKER_ENABLED !== 'false';
const FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10);
const SUCCESS_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '2', 10);
const TIMEOUT_MS = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '10000', 10);
const RESET_TIMEOUT_MS = parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS || '30000', 10);

/**
 * Circuit breaker states
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker status
 */
export interface CircuitStatus {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
  nextAttemptAt?: Date;
}

/**
 * Worker response type
 */
export interface WorkerResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  latencyMs: number;
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private openedAt?: Date;
  private nextAttemptAt?: Date;

  constructor(
    private name: string,
    private failureThreshold: number = FAILURE_THRESHOLD,
    private successThreshold: number = SUCCESS_THRESHOLD,
    private resetTimeout: number = RESET_TIMEOUT_MS
  ) {}

  /**
   * Get current circuit status
   */
  getStatus(): CircuitStatus {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      nextAttemptAt: this.nextAttemptAt,
    };
  }

  /**
   * Check if request is allowed
   */
  canRequest(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (this.nextAttemptAt && Date.now() >= this.nextAttemptAt.getTime()) {
        this.transitionTo('HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow single request
    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.lastSuccess = new Date();

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open goes back to open
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED' && this.failures >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'OPEN') {
      this.openedAt = new Date();
      this.nextAttemptAt = new Date(Date.now() + this.resetTimeout);
      this.successes = 0;
    } else if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      this.openedAt = undefined;
      this.nextAttemptAt = undefined;
    } else if (newState === 'HALF_OPEN') {
      this.successes = 0;
    }

    console.log(`[CircuitBreaker:${this.name}] State transition: ${oldState} -> ${newState}`);
  }

  /**
   * Force circuit open (for testing/admin)
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
  }

  /**
   * Force circuit closed (for testing/admin)
   */
  forceClose(): void {
    this.transitionTo('CLOSED');
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canRequest()) {
      throw new CircuitOpenError(this.name, this.nextAttemptAt);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(
    public serviceName: string,
    public retryAfter?: Date
  ) {
    super(`Circuit breaker open for ${serviceName}`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Worker Client
 */
class WorkerClient {
  private circuitBreaker: CircuitBreaker;
  private baseUrl: string;

  constructor(baseUrl: string = WORKER_URL) {
    this.baseUrl = baseUrl;
    this.circuitBreaker = new CircuitBreaker('worker', FAILURE_THRESHOLD, SUCCESS_THRESHOLD, RESET_TIMEOUT_MS);
  }

  /**
   * Make a request to the worker service
   */
  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<WorkerResponse<T>> {
    const { method = 'GET', body, headers = {}, timeout = TIMEOUT_MS } = options;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;
      const data = response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : await response.text();

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : (typeof data === 'string' ? data : data.error || data.detail),
        statusCode: response.status,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          statusCode: 408,
          latencyMs,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 0,
        latencyMs,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Call worker endpoint with circuit breaker protection
   */
  async call<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<WorkerResponse<T>> {
    if (!CIRCUIT_BREAKER_ENABLED) {
      return this.makeRequest<T>(endpoint, options);
    }

    try {
      return await this.circuitBreaker.execute(() => this.makeRequest<T>(endpoint, options));
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        await logAction({
          eventType: 'CIRCUIT_BREAKER',
          action: 'REQUEST_BLOCKED',
          resourceType: 'worker',
          resourceId: endpoint,
          details: {
            service: error.serviceName,
            retryAfter: error.retryAfter?.toISOString(),
          },
        });

        return {
          success: false,
          error: `Service temporarily unavailable (circuit open). Retry after ${error.retryAfter?.toISOString() || 'unknown'}`,
          statusCode: 503,
          latencyMs: 0,
        };
      }
      throw error;
    }
  }

  /**
   * POST request to worker
   */
  async post<T>(endpoint: string, body: unknown, options?: { headers?: Record<string, string>; timeout?: number }): Promise<WorkerResponse<T>> {
    return this.call<T>(endpoint, { method: 'POST', body, ...options });
  }

  /**
   * GET request to worker
   */
  async get<T>(endpoint: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<WorkerResponse<T>> {
    return this.call<T>(endpoint, { method: 'GET', ...options });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const result = await this.makeRequest<{ status: string }>('/health');
    return {
      healthy: result.success && result.data?.status === 'healthy',
      latencyMs: result.latencyMs,
      error: result.error,
    };
  }

  /**
   * Submit a job to the worker
   */
  async submitJob<T>(jobType: string, payload: unknown): Promise<WorkerResponse<T>> {
    return this.post<T>('/api/jobs/submit', {
      type: jobType,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get job status
   */
  async getJobStatus<T>(jobId: string): Promise<WorkerResponse<T>> {
    return this.get<T>(`/api/jobs/${jobId}/status`);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(): CircuitStatus {
    return this.circuitBreaker.getStatus();
  }

  /**
   * Force circuit open (admin/testing)
   */
  forceCircuitOpen(): void {
    this.circuitBreaker.forceOpen();
  }

  /**
   * Force circuit closed (admin/testing)
   */
  forceCircuitClose(): void {
    this.circuitBreaker.forceClose();
  }
}

// Singleton instance
let defaultWorkerClient: WorkerClient | null = null;

/**
 * Get the worker client instance
 */
export function getWorkerClient(baseUrl?: string): WorkerClient {
  if (!defaultWorkerClient || baseUrl) {
    defaultWorkerClient = new WorkerClient(baseUrl);
  }
  return defaultWorkerClient;
}

/**
 * Get circuit breaker status for all services
 */
export function getAllCircuitStatuses(): Record<string, CircuitStatus> {
  const client = getWorkerClient();
  return {
    worker: client.getCircuitStatus(),
  };
}

export { WorkerClient, CircuitBreaker };
export default getWorkerClient;
