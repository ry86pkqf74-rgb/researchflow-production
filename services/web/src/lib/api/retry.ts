// ============================================
// ResearchFlow API Retry Logic
// ============================================
// Implements exponential backoff retry strategy for API requests
// Handles transient failures, network errors, and rate limiting

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export interface RetryableError extends Error {
  statusCode?: number;
  isRetryable?: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * HTTP status codes that should trigger a retry
 */
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Determine if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    // Check if error has custom isRetryable property
    const errorObj = error as unknown as Record<string, unknown>;
    if ('isRetryable' in errorObj && typeof errorObj.isRetryable === 'boolean') {
      return errorObj.isRetryable;
    }

    // Network errors are retryable
    if (error instanceof TypeError) {
      return error.message.includes('Failed to fetch') ||
             error.message.includes('Network') ||
             error.message.includes('timeout');
    }

    // Check status code
    if ('statusCode' in errorObj && typeof errorObj.statusCode === 'number') {
      const statusCode = errorObj.statusCode;
      if (RETRYABLE_STATUS_CODES.includes(statusCode)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * config.jitterFactor * Math.random();
  return cappedDelay + jitter;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === config.maxRetries || !isRetryable(error)) {
        throw error;
      }

      const delay = calculateBackoffDelay(attempt, config);
      onRetry?.(attempt + 1, error);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Create a retryable async function
 */
export function createRetryableFunction<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
) {
  return async () => retryWithBackoff(fn, config);
}

/**
 * Create a retryable fetch wrapper
 */
export async function retryableFetch(
  url: string,
  init?: RequestInit,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, init);

      if (!response.ok && RETRYABLE_STATUS_CODES.includes(response.status)) {
        const error = new Error(`HTTP ${response.status}`) as RetryableError;
        error.statusCode = response.status;
        error.isRetryable = true;
        throw error;
      }

      return response;
    },
    config,
    onRetry
  );
}

/**
 * Decorators for retrying class methods
 */
export function Retryable(
  config: Partial<RetryConfig> = {}
) {
  return function (
    target: unknown,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

    descriptor.value = async function (...args: unknown[]) {
      return retryWithBackoff(
        () => originalMethod.apply(this, args),
        retryConfig
      );
    };

    return descriptor;
  };
}

/**
 * Hook for retry state management
 */
export interface RetryState {
  attempt: number;
  isRetrying: boolean;
  lastError: unknown;
  nextRetryIn: number;
}

export class RetryManager {
  private state: RetryState = {
    attempt: 0,
    isRetrying: false,
    lastError: null,
    nextRetryIn: 0,
  };

  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  getState(): RetryState {
    return { ...this.state };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      this.state.attempt = attempt;
      this.state.isRetrying = attempt > 0;

      try {
        const result = await fn();
        this.reset();
        return result;
      } catch (error) {
        lastError = error;
        this.state.lastError = error;

        if (attempt === this.config.maxRetries || !isRetryable(error)) {
          this.state.isRetrying = false;
          throw error;
        }

        const delay = calculateBackoffDelay(attempt, this.config);
        this.state.nextRetryIn = delay;

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  reset(): void {
    this.state = {
      attempt: 0,
      isRetrying: false,
      lastError: null,
      nextRetryIn: 0,
    };
  }
}

/**
 * React hook for retry logic
 * @example
 * const { attempt, isRetrying, execute } = useRetry();
 * const data = await execute(() => api.get('/data'));
 */
export function useRetry(config: Partial<RetryConfig> = {}) {
  // Create manager instance - note: this needs React context in actual use
  // For now, we create a simple wrapper that can be used with React
  const managerRef = { current: new RetryManager(config) };

  return {
    getState: () => managerRef.current.getState(),
    execute: <T,>(fn: () => Promise<T>) => managerRef.current.execute(fn),
    reset: () => managerRef.current.reset(),
  };
}
