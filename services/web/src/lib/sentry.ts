/**
 * Sentry Error Tracking Configuration (Stub)
 *
 * This is a stub implementation that provides the Sentry API interface
 * without requiring @sentry/react to be installed.
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Set VITE_SENTRY_DSN environment variable
 * 3. Replace this file with the full implementation from sentry.ts.full
 *
 * PHI Safety: When enabled, all potentially sensitive user data is scrubbed before sending to Sentry.
 */

interface SentryConfig {
  dsn: string | undefined;
  environment: string;
  tracesSampleRate: number;
  enabled: boolean;
}

/**
 * Get Sentry configuration from environment
 */
export function getSentryConfig(): SentryConfig {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
  const isProduction = import.meta.env.MODE === 'production';

  return {
    dsn,
    environment,
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    enabled: Boolean(dsn),
  };
}

/**
 * PHI/PII scrubbing patterns for error payloads
 */
const PHI_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  /\d{3}[-.\s]?\d{2}[-.\s]?\d{4}/g,
  /MRN[:\s]?\d{6,}/gi,
  /patient[_-]?id[:\s]?\w+/gi,
  /\b(?:DOB|birth[_\s]?date)[:\s]?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
];

/**
 * Scrub PHI/PII from a string
 */
export function scrubPHI(text: string): string {
  let scrubbed = text;
  PHI_PATTERNS.forEach((pattern, index) => {
    scrubbed = scrubbed.replace(pattern, `[REDACTED_${index}]`);
  });
  return scrubbed;
}

/**
 * Initialize Sentry (stub - logs message when DSN not configured)
 *
 * To enable Sentry, install @sentry/react and update this file.
 */
export async function initSentry(): Promise<void> {
  const config = getSentryConfig();

  if (!config.enabled) {
    console.log('[Sentry] Disabled - VITE_SENTRY_DSN not configured');
    return;
  }

  // Sentry DSN is configured but @sentry/react is not installed
  console.warn(
    '[Sentry] DSN configured but @sentry/react not installed. ' +
    'Run: npm install @sentry/react'
  );
}

/**
 * Capture an error manually (stub - logs to console)
 */
export async function captureError(error: Error, context?: Record<string, any>): Promise<void> {
  const config = getSentryConfig();
  if (!config.enabled) return;

  // Fallback to console logging when Sentry not available
  console.error('[Error]', scrubPHI(error.message), context ? '[context available]' : '');
}

/**
 * Set user context (stub - no-op)
 */
export async function setUserContext(_userId: string | number): Promise<void> {
  // No-op when Sentry not installed
}

/**
 * Clear user context on logout (stub - no-op)
 */
export async function clearUserContext(): Promise<void> {
  // No-op when Sentry not installed
}
