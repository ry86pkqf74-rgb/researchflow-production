/**
 * Phase A - Task 13: Circuit breaker for external API calls
 *
 * Uses opossum library to implement circuit breaker pattern:
 * - Prevents cascading failures when external services are down
 * - Automatically opens circuit after error threshold is reached
 * - Half-opens periodically to test if service has recovered
 */

import CircuitBreaker from 'opossum';

// Circuit breaker configuration
const DEFAULT_OPTIONS: CircuitBreaker.Options = {
  timeout: 30000, // 30 second timeout
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 15000, // Try again after 15 seconds
  rollingCountTimeout: 10000, // Time window for tracking statistics
  rollingCountBuckets: 10, // Number of buckets in rolling window
  volumeThreshold: 5, // Minimum requests before circuit can trip
};

// Track all breakers for metrics/monitoring
const breakers = new Map<string, CircuitBreaker>();

/**
 * Create a circuit breaker for an async function
 */
export function makeBreaker<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options?: Partial<CircuitBreaker.Options>
): CircuitBreaker<TArgs, TResult> {
  const breakerOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    name,
  };

  const breaker = new CircuitBreaker(fn, breakerOptions);

  // Register event handlers for logging/monitoring
  breaker.on('success', (result) => {
    logBreakerEvent(name, 'success');
  });

  breaker.on('timeout', () => {
    logBreakerEvent(name, 'timeout');
  });

  breaker.on('reject', () => {
    logBreakerEvent(name, 'reject');
  });

  breaker.on('open', () => {
    logBreakerEvent(name, 'open');
    console.warn(`[circuit-breaker] OPEN: ${name} - requests will be rejected`);
  });

  breaker.on('halfOpen', () => {
    logBreakerEvent(name, 'halfOpen');
    console.warn(`[circuit-breaker] HALF-OPEN: ${name} - testing recovery`);
  });

  breaker.on('close', () => {
    logBreakerEvent(name, 'close');
    console.info(`[circuit-breaker] CLOSED: ${name} - service recovered`);
  });

  breaker.on('fallback', (result) => {
    logBreakerEvent(name, 'fallback');
  });

  // Store breaker for metrics access
  breakers.set(name, breaker);

  return breaker;
}

/**
 * Log breaker events for observability
 */
function logBreakerEvent(name: string, event: string): void {
  // In production, this should emit metrics to Prometheus
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[circuit-breaker] ${name}: ${event}`);
  }
}

/**
 * Get circuit breaker by name
 */
export function getBreaker(name: string): CircuitBreaker | undefined {
  return breakers.get(name);
}

/**
 * Get all circuit breaker stats for monitoring
 */
export function getAllBreakerStats(): Record<string, CircuitBreaker.Stats> {
  const stats: Record<string, CircuitBreaker.Stats> = {};

  for (const [name, breaker] of breakers) {
    stats[name] = breaker.stats;
  }

  return stats;
}

/**
 * Get health status of all circuit breakers
 */
export function getBreakerHealth(): {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  stats: {
    failures: number;
    successes: number;
    rejects: number;
    timeouts: number;
  };
}[] {
  const health = [];

  for (const [name, breaker] of breakers) {
    const state = breaker.opened
      ? 'open'
      : breaker.halfOpen
        ? 'half-open'
        : 'closed';

    health.push({
      name,
      state,
      stats: {
        failures: breaker.stats.failures,
        successes: breaker.stats.successes,
        rejects: breaker.stats.rejects,
        timeouts: breaker.stats.timeouts,
      },
    });
  }

  return health;
}

/**
 * Reset all circuit breakers (for testing)
 */
export function resetAllBreakers(): void {
  for (const breaker of breakers.values()) {
    breaker.close();
  }
}

/**
 * Create a breaker with fallback function
 */
export function makeBreakerWithFallback<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  fallbackFn: (...args: TArgs) => Promise<TResult>,
  options?: Partial<CircuitBreaker.Options>
): CircuitBreaker<TArgs, TResult> {
  const breaker = makeBreaker(name, fn, options);
  breaker.fallback(fallbackFn);
  return breaker;
}

// Export default options for customization
export { DEFAULT_OPTIONS };
