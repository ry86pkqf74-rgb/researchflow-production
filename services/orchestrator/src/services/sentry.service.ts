/**
 * Sentry Error Tracking Service
 *
 * Provides optional Sentry integration for error tracking and performance monitoring.
 * CRITICAL: Never include PHI in breadcrumbs, tags, or extra data.
 *
 * Enable by setting SENTRY_DSN environment variable.
 */

// Sentry SDK types (actual SDK loaded conditionally)
interface SentryScope {
  setTag(key: string, value: string): void;
  setExtra(key: string, value: unknown): void;
  setUser(user: { id: string; email?: string }): void;
  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }): void;
}

interface SentryTransaction {
  finish(): void;
  setStatus(status: string): void;
  setData(key: string, value: unknown): void;
}

interface SentryOptions {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  beforeSend?: (event: unknown) => unknown | null;
  beforeBreadcrumb?: (breadcrumb: unknown) => unknown | null;
}

// PHI-safe patterns to filter from error data
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,        // SSN
  /\b\d{9}\b/g,                     // MRN-like
  /\b\d{10}\b/g,                    // Phone
  /\b[A-Z]{2}\d{6}\b/gi,            // License
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit card
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // Email
];

function scrubPHI(text: string): string {
  let scrubbed = text;
  for (const pattern of PHI_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  return scrubbed;
}

function scrubObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return scrubPHI(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(scrubObject);
  }
  if (obj && typeof obj === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip potentially PHI-containing fields entirely
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('ssn') ||
        lowerKey.includes('mrn') ||
        lowerKey.includes('patient') ||
        lowerKey.includes('dob') ||
        lowerKey.includes('birthdate') ||
        lowerKey.includes('address') ||
        lowerKey.includes('phone') ||
        lowerKey.includes('email') && lowerKey !== 'emailtype'
      ) {
        scrubbed[key] = '[PHI_FIELD_REDACTED]';
      } else {
        scrubbed[key] = scrubObject(value);
      }
    }
    return scrubbed;
  }
  return obj;
}

// Singleton state
let sentryEnabled = false;
let Sentry: typeof import('@sentry/node') | null = null;

/**
 * Initialize Sentry if SENTRY_DSN is configured
 */
export async function initSentry(): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] SENTRY_DSN not set, error tracking disabled');
    return false;
  }

  try {
    // Dynamic import to avoid loading Sentry if not needed
    Sentry = await import('@sentry/node');

    const options: SentryOptions = {
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.RELEASE_VERSION || 'unknown',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

      // PHI scrubbing before sending events
      beforeSend: (event) => {
        return scrubObject(event) as typeof event;
      },

      // PHI scrubbing for breadcrumbs
      beforeBreadcrumb: (breadcrumb) => {
        return scrubObject(breadcrumb) as typeof breadcrumb;
      },
    };

    Sentry.init(options);
    sentryEnabled = true;
    console.log('[Sentry] Initialized with environment:', options.environment);
    return true;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
    return false;
  }
}

/**
 * Capture an exception with PHI-safe context
 */
export function captureException(
  error: Error,
  context?: {
    userId?: string;
    researchId?: string;
    action?: string;
    component?: string;
    extra?: Record<string, unknown>;
  }
): string | undefined {
  if (!sentryEnabled || !Sentry) {
    console.error('[Error]', error.message, context?.action || '');
    return undefined;
  }

  return Sentry.withScope((scope) => {
    if (context?.userId) {
      // Only use anonymized user ID, never include PII
      scope.setUser({ id: context.userId });
    }
    if (context?.researchId) {
      scope.setTag('researchId', context.researchId);
    }
    if (context?.action) {
      scope.setTag('action', context.action);
    }
    if (context?.component) {
      scope.setTag('component', context.component);
    }
    if (context?.extra) {
      // Scrub any potentially PHI-containing data
      const safeExtra = scrubObject(context.extra) as Record<string, unknown>;
      for (const [key, value] of Object.entries(safeExtra)) {
        scope.setExtra(key, value);
      }
    }

    return Sentry!.captureException(error);
  });
}

/**
 * Capture a message with PHI-safe context
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): string | undefined {
  if (!sentryEnabled || !Sentry) {
    console.log(`[${level.toUpperCase()}]`, scrubPHI(message));
    return undefined;
  }

  return Sentry.withScope((scope) => {
    if (context) {
      const safeContext = scrubObject(context) as Record<string, unknown>;
      for (const [key, value] of Object.entries(safeContext)) {
        scope.setExtra(key, value);
      }
    }

    return Sentry!.captureMessage(scrubPHI(message), level);
  });
}

/**
 * Add a PHI-safe breadcrumb
 */
export function addBreadcrumb(
  category: string,
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, unknown>
): void {
  if (!sentryEnabled || !Sentry) {
    return;
  }

  Sentry.addBreadcrumb({
    category,
    message: scrubPHI(message),
    level,
    data: data ? (scrubObject(data) as Record<string, unknown>) : undefined,
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string
): SentryTransaction | null {
  if (!sentryEnabled || !Sentry) {
    return null;
  }

  return Sentry.startSpan({ name, op }, (span) => span) as unknown as SentryTransaction;
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

/**
 * Flush pending events (call before process exit)
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  if (!sentryEnabled || !Sentry) {
    return true;
  }

  return Sentry.flush(timeout);
}

/**
 * Express error handler middleware for Sentry
 */
export function sentryErrorHandler() {
  if (!sentryEnabled || !Sentry) {
    return (_err: Error, _req: unknown, _res: unknown, next: (err?: Error) => void) => {
      next(_err as Error);
    };
  }

  return Sentry.Handlers.errorHandler();
}

/**
 * Express request handler middleware for Sentry tracing
 */
export function sentryRequestHandler() {
  if (!sentryEnabled || !Sentry) {
    return (_req: unknown, _res: unknown, next: () => void) => {
      next();
    };
  }

  return Sentry.Handlers.requestHandler();
}
