/**
 * Error Tracking Integration
 *
 * Provides Sentry-compatible error tracking with optional external service integration.
 * When Sentry is not configured, errors are logged locally with structured context.
 *
 * Features:
 * - Sentry-compatible interface (optional Sentry integration)
 * - Structured error context: runId, stageId, userId, governanceMode
 * - Error fingerprinting for deduplication
 * - PHI-safe error reporting (no PII in reports)
 * - Breadcrumb tracking for error context
 */

import { createLogger } from './logger';

const logger = createLogger('error-tracking');

/**
 * Error severity levels (Sentry-compatible)
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Error context for structured reporting
 */
export interface ErrorContext {
  runId?: string;
  stageId?: string;
  userId?: string;
  orgId?: string;
  governanceMode?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Breadcrumb for tracking events leading to an error
 */
export interface Breadcrumb {
  type: 'http' | 'navigation' | 'user' | 'debug' | 'error' | 'default';
  category: string;
  message: string;
  level: ErrorSeverity;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * Error event structure
 */
export interface ErrorEvent {
  id: string;
  timestamp: string;
  error: {
    type: string;
    message: string;
    stack?: string[];
  };
  fingerprint: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  breadcrumbs: Breadcrumb[];
  tags: Record<string, string>;
  environment: string;
}

/**
 * Configuration for error tracking
 */
export interface ErrorTrackingConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  maxBreadcrumbs?: number;
  enabled?: boolean;
}

/**
 * PHI-sensitive field patterns to redact
 */
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\bpatient[\s_-]?id[\s:]*[A-Za-z0-9]+\b/gi, // Patient ID
  /\bMRN[\s:]*\d+\b/gi, // MRN
];

/**
 * Redact PHI from strings
 */
function redactPhi(value: string): string {
  let result = value;
  for (const pattern of PHI_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Sanitize error context to remove PHI
 */
function sanitizeContext(context: ErrorContext): ErrorContext {
  const sanitized: ErrorContext = {};

  for (const [key, value] of Object.entries(context)) {
    // Skip PHI-sensitive fields
    const keyLower = key.toLowerCase();
    if (
      keyLower.includes('name') ||
      keyLower.includes('email') ||
      keyLower.includes('phone') ||
      keyLower.includes('address') ||
      keyLower.includes('ssn') ||
      keyLower.includes('patient')
    ) {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = redactPhi(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
    // Skip complex objects to prevent PHI leakage
  }

  return sanitized;
}

/**
 * Generate a fingerprint for error deduplication
 */
function generateFingerprint(error: Error, context: ErrorContext): string {
  const parts: string[] = [
    error.name,
    error.message.replace(/\d+/g, 'N').slice(0, 100), // Normalize numbers
    context.stageId || 'unknown-stage',
  ];

  // Add first meaningful stack frame if available
  if (error.stack) {
    const frames = error.stack.split('\n').slice(1, 3);
    const meaningfulFrame = frames.find(f =>
      f.includes('orchestrator') && !f.includes('node_modules')
    );
    if (meaningfulFrame) {
      // Extract file:line info
      const match = meaningfulFrame.match(/at\s+(?:.*?\s+)?\(?(.+?):\d+:\d+\)?/);
      if (match) {
        parts.push(match[1].split('/').pop() || 'unknown');
      }
    }
  }

  // Simple hash function
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Error Tracking Service
 */
class ErrorTracker {
  private config: ErrorTrackingConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private globalContext: ErrorContext = {};
  private recentErrors: Map<string, { count: number; lastSeen: number }> = new Map();
  private eventHandlers: ((event: ErrorEvent) => void)[] = [];

  constructor(config: ErrorTrackingConfig = {}) {
    this.config = {
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version || '1.0.0',
      sampleRate: 1.0,
      maxBreadcrumbs: 50,
      enabled: config.enabled ?? (process.env.ERROR_TRACKING_ENABLED !== 'false'),
      ...config,
    };

    // Set global context from environment
    this.globalContext = {
      governanceMode: process.env.GOVERNANCE_MODE || 'DEMO',
    };
  }

  /**
   * Set global context that will be included with all errors
   */
  setContext(context: ErrorContext): void {
    this.globalContext = { ...this.globalContext, ...sanitizeContext(context) };
  }

  /**
   * Add a breadcrumb for error context
   */
  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    if (!this.config.enabled) return;

    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now(),
    });

    // Keep only recent breadcrumbs
    const maxBreadcrumbs = this.config.maxBreadcrumbs || 50;
    if (this.breadcrumbs.length > maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-maxBreadcrumbs);
    }
  }

  /**
   * Register an event handler for captured errors
   */
  onError(handler: (event: ErrorEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Check if error should be sampled
   */
  private shouldSample(): boolean {
    const sampleRate = this.config.sampleRate || 1.0;
    return Math.random() < sampleRate;
  }

  /**
   * Check for duplicate errors (rate limiting)
   */
  private isDuplicate(fingerprint: string): boolean {
    const now = Date.now();
    const existing = this.recentErrors.get(fingerprint);

    if (existing) {
      // If same error within 60 seconds, increment count but don't report
      if (now - existing.lastSeen < 60000) {
        existing.count++;
        existing.lastSeen = now;
        return existing.count > 3; // Allow up to 3 occurrences per minute
      }
    }

    // New error or expired
    this.recentErrors.set(fingerprint, { count: 1, lastSeen: now });

    // Cleanup old entries periodically
    if (this.recentErrors.size > 1000) {
      const cutoff = now - 300000; // 5 minutes
      for (const [key, value] of this.recentErrors) {
        if (value.lastSeen < cutoff) {
          this.recentErrors.delete(key);
        }
      }
    }

    return false;
  }

  /**
   * Capture an error with context
   */
  captureException(
    error: Error,
    context: ErrorContext = {},
    severity: ErrorSeverity = 'error'
  ): string | null {
    if (!this.config.enabled) {
      return null;
    }

    // Merge contexts
    const mergedContext = {
      ...this.globalContext,
      ...sanitizeContext(context),
    };

    // Generate fingerprint
    const fingerprint = generateFingerprint(error, mergedContext);

    // Check for duplicates
    if (this.isDuplicate(fingerprint)) {
      logger.debug('Suppressed duplicate error', { fingerprint });
      return null;
    }

    // Check sampling
    if (!this.shouldSample()) {
      return null;
    }

    // Create error event
    const eventId = generateErrorId();
    const event: ErrorEvent = {
      id: eventId,
      timestamp: new Date().toISOString(),
      error: {
        type: error.name,
        message: redactPhi(error.message),
        stack: error.stack
          ? error.stack
              .split('\n')
              .slice(0, 10)
              .map(line => redactPhi(line))
          : undefined,
      },
      fingerprint,
      severity,
      context: mergedContext,
      breadcrumbs: [...this.breadcrumbs],
      tags: {
        environment: this.config.environment || 'development',
        release: this.config.release || '1.0.0',
        ...(mergedContext.stageId && { stage: mergedContext.stageId }),
        ...(mergedContext.governanceMode && { governance: mergedContext.governanceMode }),
      },
      environment: this.config.environment || 'development',
    };

    // Log locally
    logger.error(`[${eventId}] ${error.name}: ${redactPhi(error.message)}`, {
      fingerprint,
      stageId: mergedContext.stageId,
      runId: mergedContext.runId,
      severity,
    });

    // Call event handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (handlerError) {
        logger.warn('Error handler failed', { handlerError });
      }
    }

    // If Sentry DSN is configured, send to Sentry
    if (this.config.dsn) {
      this.sendToSentry(event).catch(sentryError => {
        logger.warn('Failed to send error to Sentry', { sentryError });
      });
    }

    // Clear breadcrumbs after capture
    this.breadcrumbs = [];

    return eventId;
  }

  /**
   * Capture a message (non-error event)
   */
  captureMessage(
    message: string,
    context: ErrorContext = {},
    severity: ErrorSeverity = 'info'
  ): string | null {
    const error = new Error(message);
    error.name = 'Message';
    return this.captureException(error, context, severity);
  }

  /**
   * Send error to Sentry (if configured)
   * This is a simplified implementation - in production, use @sentry/node
   */
  private async sendToSentry(event: ErrorEvent): Promise<void> {
    if (!this.config.dsn) return;

    try {
      // Parse DSN
      const dsnMatch = this.config.dsn.match(
        /^https?:\/\/([^@]+)@([^/]+)\/(\d+)$/
      );
      if (!dsnMatch) {
        logger.warn('Invalid Sentry DSN format');
        return;
      }

      const [, publicKey, host, projectId] = dsnMatch;

      // Build Sentry envelope
      const sentryEvent = {
        event_id: event.id.replace('err_', '').replace(/_/g, ''),
        timestamp: event.timestamp,
        platform: 'node',
        level: event.severity,
        message: event.error.message,
        exception: {
          values: [
            {
              type: event.error.type,
              value: event.error.message,
              stacktrace: event.error.stack
                ? { frames: event.error.stack.map(line => ({ filename: line })) }
                : undefined,
            },
          ],
        },
        tags: event.tags,
        extra: event.context,
        breadcrumbs: {
          values: event.breadcrumbs.map(b => ({
            timestamp: b.timestamp / 1000,
            type: b.type,
            category: b.category,
            message: b.message,
            level: b.level,
            data: b.data,
          })),
        },
        environment: event.environment,
        release: this.config.release,
      };

      const endpoint = `https://${host}/api/${projectId}/store/`;

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=researchflow/1.0, sentry_key=${publicKey}`,
        },
        body: JSON.stringify(sentryEvent),
      });
    } catch (error) {
      // Don't throw - just log locally
      logger.debug('Sentry send failed', { error });
    }
  }

  /**
   * Get recent error summary for debugging
   */
  getErrorSummary(): { fingerprint: string; count: number; lastSeen: string }[] {
    const summary: { fingerprint: string; count: number; lastSeen: string }[] = [];

    this.recentErrors.forEach((value, key) => {
      summary.push({
        fingerprint: key,
        count: value.count,
        lastSeen: new Date(value.lastSeen).toISOString(),
      });
    });

    return summary.sort((a, b) => b.count - a.count).slice(0, 20);
  }

  /**
   * Reset error tracking state (for testing)
   */
  reset(): void {
    this.breadcrumbs = [];
    this.recentErrors.clear();
    this.eventHandlers = [];
  }
}

// Singleton instance
let errorTrackerInstance: ErrorTracker | null = null;

/**
 * Get the error tracker singleton
 */
export function getErrorTracker(): ErrorTracker {
  if (!errorTrackerInstance) {
    errorTrackerInstance = new ErrorTracker({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.npm_package_version,
    });
  }
  return errorTrackerInstance;
}

/**
 * Initialize error tracking with custom config
 */
export function initErrorTracking(config: ErrorTrackingConfig): ErrorTracker {
  errorTrackerInstance = new ErrorTracker(config);
  return errorTrackerInstance;
}

/**
 * Capture an exception (convenience function)
 */
export function captureException(
  error: Error,
  context: ErrorContext = {},
  severity: ErrorSeverity = 'error'
): string | null {
  return getErrorTracker().captureException(error, context, severity);
}

/**
 * Capture a message (convenience function)
 */
export function captureMessage(
  message: string,
  context: ErrorContext = {},
  severity: ErrorSeverity = 'info'
): string | null {
  return getErrorTracker().captureMessage(message, context, severity);
}

/**
 * Add a breadcrumb (convenience function)
 */
export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
  getErrorTracker().addBreadcrumb(breadcrumb);
}

/**
 * Set global context (convenience function)
 */
export function setErrorContext(context: ErrorContext): void {
  getErrorTracker().setContext(context);
}

// Export for testing
export { ErrorTracker };
