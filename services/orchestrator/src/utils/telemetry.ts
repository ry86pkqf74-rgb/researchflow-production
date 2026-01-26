/**
 * Telemetry Collector
 *
 * In-memory telemetry collection for external API calls.
 * Tracks counters for monitoring and observability.
 *
 * Metrics tracked:
 * - external_calls_total{provider,status} - Total external API calls by provider and status
 * - external_calls_blocked_total - Calls blocked by governance mode
 * - external_calls_failed_total - Calls that failed due to errors
 */

export type AIProvider = 'openai' | 'anthropic' | 'together' | 'unknown';
export type CallStatus = 'success' | 'failure' | 'blocked';
export type BlockReason = 'standby_mode' | 'no_network' | 'governance_mode' | 'phi_detected';

/**
 * Counter key for external_calls_total metric
 */
interface ExternalCallKey {
  provider: AIProvider;
  status: CallStatus;
}

/**
 * Counter key for blocked calls
 */
interface BlockedCallKey {
  reason: BlockReason;
  provider?: AIProvider;
}

/**
 * Telemetry snapshot for metrics endpoint
 */
export interface TelemetrySnapshot {
  external_calls_total: Record<string, number>;
  external_calls_blocked_total: Record<string, number>;
  external_calls_failed_total: number;
  uptime_seconds: number;
  collected_at: string;
}

/**
 * Runtime mode information (no secrets)
 */
export interface RuntimeMode {
  ros_mode: string;
  governance_mode: string;
  no_network: boolean;
  mock_only: boolean;
}

/**
 * Full metrics response
 */
export interface MetricsResponse {
  telemetry: TelemetrySnapshot;
  mode: RuntimeMode;
  version: string;
}

class TelemetryCollector {
  private startTime: number;

  // external_calls_total{provider,status}
  private externalCallsTotal: Map<string, number> = new Map();

  // external_calls_blocked_total{reason}
  private externalCallsBlockedTotal: Map<string, number> = new Map();

  // external_calls_failed_total (simple counter)
  private externalCallsFailedTotal: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Generate a key for the external calls counter
   */
  private makeExternalCallKey(provider: AIProvider, status: CallStatus): string {
    return `provider=${provider},status=${status}`;
  }

  /**
   * Generate a key for the blocked calls counter
   */
  private makeBlockedCallKey(reason: BlockReason, provider?: AIProvider): string {
    if (provider) {
      return `reason=${reason},provider=${provider}`;
    }
    return `reason=${reason}`;
  }

  /**
   * Record an external API call
   */
  recordExternalCall(provider: AIProvider, status: CallStatus): void {
    const key = this.makeExternalCallKey(provider, status);
    const current = this.externalCallsTotal.get(key) || 0;
    this.externalCallsTotal.set(key, current + 1);

    if (status === 'failure') {
      this.externalCallsFailedTotal++;
    }
  }

  /**
   * Record a blocked external call
   */
  recordBlockedCall(reason: BlockReason, provider?: AIProvider): void {
    const key = this.makeBlockedCallKey(reason, provider);
    const current = this.externalCallsBlockedTotal.get(key) || 0;
    this.externalCallsBlockedTotal.set(key, current + 1);

    // Also record in total calls as blocked
    if (provider) {
      this.recordExternalCall(provider, 'blocked');
    }
  }

  /**
   * Get current runtime mode (no secrets)
   */
  getRuntimeMode(): RuntimeMode {
    return {
      ros_mode: process.env.ROS_MODE || 'DEMO',
      governance_mode: process.env.GOVERNANCE_MODE || 'DEMO',
      no_network: process.env.NO_NETWORK === 'true',
      mock_only: process.env.MOCK_ONLY === 'true',
    };
  }

  /**
   * Get telemetry snapshot
   */
  getSnapshot(): TelemetrySnapshot {
    const externalCallsTotal: Record<string, number> = {};
    this.externalCallsTotal.forEach((value, key) => {
      externalCallsTotal[key] = value;
    });

    const externalCallsBlockedTotal: Record<string, number> = {};
    this.externalCallsBlockedTotal.forEach((value, key) => {
      externalCallsBlockedTotal[key] = value;
    });

    return {
      external_calls_total: externalCallsTotal,
      external_calls_blocked_total: externalCallsBlockedTotal,
      external_calls_failed_total: this.externalCallsFailedTotal,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      collected_at: new Date().toISOString(),
    };
  }

  /**
   * Get full metrics response
   */
  getMetrics(): MetricsResponse {
    return {
      telemetry: this.getSnapshot(),
      mode: this.getRuntimeMode(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /**
   * Reset all counters (for testing)
   */
  reset(): void {
    this.externalCallsTotal.clear();
    this.externalCallsBlockedTotal.clear();
    this.externalCallsFailedTotal = 0;
    this.startTime = Date.now();
  }
}

// Singleton instance
let telemetryInstance: TelemetryCollector | null = null;

/**
 * Get the telemetry collector singleton
 */
export function getTelemetry(): TelemetryCollector {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryCollector();
  }
  return telemetryInstance;
}

/**
 * Check if external AI calls are allowed based on current mode
 *
 * Returns { allowed: true } if calls can proceed
 * Returns { allowed: false, reason: BlockReason } if calls should be blocked
 */
export function checkAICallAllowed(): { allowed: true } | { allowed: false; reason: BlockReason } {
  const rosMode = process.env.ROS_MODE?.toUpperCase();
  const governanceMode = process.env.GOVERNANCE_MODE?.toUpperCase();
  const noNetwork = process.env.NO_NETWORK === 'true';

  // STANDBY mode blocks all AI calls
  if (rosMode === 'STANDBY' || governanceMode === 'STANDBY') {
    return { allowed: false, reason: 'standby_mode' };
  }

  // NO_NETWORK blocks all external calls
  if (noNetwork) {
    return { allowed: false, reason: 'no_network' };
  }

  return { allowed: true };
}

/**
 * Wrapper to gate AI calls and record telemetry
 *
 * Use this before making any AI SDK call to ensure proper gating and tracking.
 *
 * @param provider - The AI provider being called
 * @param fn - The async function to execute if allowed
 * @returns The result of fn, or throws if blocked
 */
export async function gatedAICall<T>(
  provider: AIProvider,
  fn: () => Promise<T>
): Promise<T> {
  const telemetry = getTelemetry();
  const check = checkAICallAllowed();

  if (check.allowed === false) {
    telemetry.recordBlockedCall(check.reason, provider);
    throw new AICallBlockedError(check.reason, provider);
  }

  try {
    const result = await fn();
    telemetry.recordExternalCall(provider, 'success');
    return result;
  } catch (error) {
    telemetry.recordExternalCall(provider, 'failure');
    throw error;
  }
}

/**
 * Error thrown when an AI call is blocked by governance
 */
export class AICallBlockedError extends Error {
  public readonly reason: BlockReason;
  public readonly provider: AIProvider;

  constructor(reason: BlockReason, provider: AIProvider) {
    const messages: Record<BlockReason, string> = {
      standby_mode: 'AI calls are blocked: System is in STANDBY mode',
      no_network: 'AI calls are blocked: NO_NETWORK mode is enabled',
      governance_mode: 'AI calls are blocked by governance policy',
      phi_detected: 'AI calls are blocked: PHI detected in request',
    };

    super(messages[reason]);
    this.name = 'AICallBlockedError';
    this.reason = reason;
    this.provider = provider;
  }
}

// Export the class for direct use
export { TelemetryCollector };
