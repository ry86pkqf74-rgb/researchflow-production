/**
 * Sentry Error Tracking Configuration
 *
 * This module initializes Sentry for frontend error tracking with PHI/PII scrubbing.
 *
 * IMPORTANT: Before enabling Sentry in production:
 * 1. Create a Sentry project at https://sentry.io
 * 2. Set VITE_SENTRY_DSN environment variable
 * 3. Optionally set VITE_SENTRY_ENVIRONMENT (defaults to import.meta.env.MODE)
 *
 * PHI Safety: All potentially sensitive user data is scrubbed before sending to Sentry.
 */

// Note: Install @sentry/react when enabling Sentry:
// npm install @sentry/react

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
    // Lower sample rate in production to reduce costs
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    enabled: Boolean(dsn),
  };
}

/**
 * PHI/PII scrubbing patterns for error payloads
 */
const PHI_PATTERNS = [
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Phone numbers
  /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  // SSN
  /\d{3}[-.\s]?\d{2}[-.\s]?\d{4}/g,
  // Medical Record Numbers (common formats)
  /MRN[:\s]?\d{6,}/gi,
  // Patient IDs
  /patient[_-]?id[:\s]?\w+/gi,
  // Date of birth patterns
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
 * Sentry beforeSend hook for PHI/PII scrubbing
 * This function is called before every event is sent to Sentry
 */
export function beforeSendScrubber(event: any): any {
  // Scrub user data
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
    // Keep only anonymized user ID if present
    if (event.user.id) {
      event.user.id = `user_${String(event.user.id).slice(0, 8)}`;
    }
  }

  // Scrub exception messages
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex: any) => ({
      ...ex,
      value: ex.value ? scrubPHI(String(ex.value)) : ex.value,
    }));
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => ({
      ...breadcrumb,
      message: breadcrumb.message ? scrubPHI(String(breadcrumb.message)) : breadcrumb.message,
      data: breadcrumb.data ? scrubBreadcrumbData(breadcrumb.data) : breadcrumb.data,
    }));
  }

  // Scrub request data
  if (event.request) {
    if (event.request.data) {
      event.request.data = '[SCRUBBED]';
    }
    if (event.request.cookies) {
      event.request.cookies = '[SCRUBBED]';
    }
  }

  return event;
}

/**
 * Scrub breadcrumb data object
 */
function scrubBreadcrumbData(data: Record<string, any>): Record<string, any> {
  const scrubbed: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      scrubbed[key] = scrubPHI(value);
    } else if (typeof value === 'object' && value !== null) {
      scrubbed[key] = '[OBJECT]';
    } else {
      scrubbed[key] = value;
    }
  }
  return scrubbed;
}

/**
 * Initialize Sentry (call this in main.tsx)
 *
 * Usage:
 * ```tsx
 * import { initSentry } from './lib/sentry';
 *
 * // Initialize before rendering
 * initSentry();
 *
 * createRoot(document.getElementById("root")!).render(<App />);
 * ```
 */
export async function initSentry(): Promise<void> {
  const config = getSentryConfig();

  if (!config.enabled) {
    console.log('[Sentry] Disabled - VITE_SENTRY_DSN not configured');
    return;
  }

  try {
    // Dynamic import to avoid bundling Sentry when not configured
    const Sentry = await import('@sentry/react');

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      tracesSampleRate: config.tracesSampleRate,

      // PHI/PII scrubbing hook
      beforeSend: beforeSendScrubber,

      // Disable session tracking for privacy
      autoSessionTracking: false,

      // Disable default integrations that may capture sensitive data
      defaultIntegrations: false,

      // Only include essential integrations
      integrations: [
        Sentry.breadcrumbsIntegration({
          console: true,
          dom: false, // Disable DOM event tracking (may capture PHI)
          fetch: true,
          history: true,
          xhr: true,
        }),
        Sentry.globalHandlersIntegration(),
        Sentry.linkedErrorsIntegration(),
        Sentry.dedupeIntegration(),
      ],

      // Don't send default PII
      sendDefaultPii: false,

      // Ignore common non-actionable errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        /^Loading chunk \d+ failed/,
        /^Network Error$/,
        /^Request aborted$/,
      ],
    });

    console.log(`[Sentry] Initialized (${config.environment})`);
  } catch (error) {
    // Sentry not installed - this is expected in development
    console.log('[Sentry] Not available - install @sentry/react to enable');
  }
}

/**
 * Capture an error manually with PHI scrubbing
 */
export async function captureError(error: Error, context?: Record<string, any>): Promise<void> {
  const config = getSentryConfig();
  if (!config.enabled) return;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.captureException(error, {
      extra: context ? Object.fromEntries(
        Object.entries(context).map(([k, v]) => [k, typeof v === 'string' ? scrubPHI(v) : '[OBJECT]'])
      ) : undefined,
    });
  } catch {
    // Sentry not available
    console.error('[Error]', error);
  }
}

/**
 * Set user context (anonymized)
 */
export async function setUserContext(userId: string | number): Promise<void> {
  const config = getSentryConfig();
  if (!config.enabled) return;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.setUser({
      id: `user_${String(userId).slice(0, 8)}`,
    });
  } catch {
    // Sentry not available
  }
}

/**
 * Clear user context on logout
 */
export async function clearUserContext(): Promise<void> {
  const config = getSentryConfig();
  if (!config.enabled) return;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.setUser(null);
  } catch {
    // Sentry not available
  }
}
