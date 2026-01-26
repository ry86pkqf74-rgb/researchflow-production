/**
 * Structured Logger for ResearchFlow
 *
 * Features:
 * - Log levels: debug, info, warn, error
 * - Respects LOG_LEVEL environment variable
 * - Optional JSON output format (LOG_FORMAT=json)
 * - PHI-safe logging (never logs raw PHI)
 * - Includes context: timestamp, level, module, requestId
 *
 * Priority: P0 - CRITICAL (Deployment Robustness)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  module?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  module: string;
  requestId?: string;
  context?: Record<string, unknown>;
}

// Log level hierarchy (lower = more verbose)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get minimum log level from environment
 */
function getMinLogLevel(): number {
  const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;
}

/**
 * Check if JSON output is enabled
 */
function isJsonFormat(): boolean {
  return process.env.LOG_FORMAT === 'json';
}

/**
 * PHI patterns to redact from logs
 * These patterns are intentionally broad to catch potential PHI
 */
const PHI_PATTERNS = [
  // SSN patterns
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // Phone numbers
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  // Email addresses (redact the local part)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Date of birth patterns
  /\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g,
  // MRN patterns (common formats)
  /\bMRN[\s:]*\d+\b/gi,
  // Patient ID patterns
  /\bpatient[\s_-]?id[\s:]*[A-Za-z0-9]+\b/gi,
];

/**
 * Keywords that indicate potential PHI in object keys
 */
const PHI_KEYWORDS = [
  'ssn', 'social_security', 'socialSecurity',
  'dob', 'date_of_birth', 'dateOfBirth', 'birthdate',
  'mrn', 'medical_record', 'medicalRecord',
  'patient_id', 'patientId', 'patient_name', 'patientName',
  'address', 'street', 'city', 'zip', 'postal',
  'phone', 'mobile', 'cell', 'telephone',
  'email', 'email_address', 'emailAddress',
  'name', 'firstName', 'lastName', 'first_name', 'last_name',
  'diagnosis', 'treatment', 'medication', 'prescription',
  'insurance', 'policy_number', 'policyNumber',
];

/**
 * Redact PHI from a string
 */
function redactPhi(value: string): string {
  let redacted = value;
  for (const pattern of PHI_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

/**
 * Recursively sanitize an object to remove potential PHI
 */
function sanitizeForLogging(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactPhi(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if key indicates PHI
      const keyLower = key.toLowerCase();
      if (PHI_KEYWORDS.some(kw => keyLower.includes(kw.toLowerCase()))) {
        sanitized[key] = '[PHI_REDACTED]';
      } else {
        sanitized[key] = sanitizeForLogging(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(obj);
}

/**
 * Format timestamp for human-readable output
 */
function formatTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (isJsonFormat()) {
    return JSON.stringify(entry);
  }

  const time = formatTimestamp();
  const levelUpper = entry.level.toUpperCase().padEnd(5);
  const modulePrefix = entry.module ? `[${entry.module}]` : '';
  const requestPrefix = entry.requestId ? `[req:${entry.requestId.slice(0, 8)}]` : '';

  let line = `${time} ${levelUpper} ${modulePrefix}${requestPrefix} ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    const contextStr = JSON.stringify(entry.context);
    if (contextStr.length < 200) {
      line += ` ${contextStr}`;
    }
  }

  return line;
}

/**
 * Write log entry to appropriate output stream
 */
function writeLog(level: LogLevel, entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Logger class with module context
 */
export class Logger {
  private module: string;
  private defaultContext: LogContext;

  constructor(module: string, defaultContext: LogContext = {}) {
    this.module = module;
    this.defaultContext = defaultContext;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(context.module || this.module, {
      ...this.defaultContext,
      ...context,
    });
  }

  /**
   * Log at a specific level
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Check if this level should be logged
    if (LOG_LEVELS[level] < getMinLogLevel()) {
      return;
    }

    const mergedContext = { ...this.defaultContext, ...context };
    const { module, requestId, ...rest } = mergedContext;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: redactPhi(message),
      module: module || this.module,
      requestId,
      context: Object.keys(rest).length > 0
        ? sanitizeForLogging(rest) as Record<string, unknown>
        : undefined,
    };

    writeLog(level, entry);
  }

  /**
   * Debug level logging - for detailed debugging information
   * Only output when LOG_LEVEL=debug
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info level logging - for general operational information
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning level logging - for potentially problematic situations
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error level logging - for errors that need attention
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Log an error object with stack trace (sanitized)
   */
  logError(message: string, error: Error, context?: LogContext): void {
    this.error(message, {
      ...context,
      errorMessage: error.message,
      errorName: error.name,
      // Only include stack in non-production
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      }),
    });
  }
}

/**
 * Create a logger instance for a module
 */
export function createLogger(module: string): Logger {
  return new Logger(module);
}

/**
 * Default logger instance for the orchestrator
 */
export const logger = createLogger('orchestrator');

/**
 * Request logger middleware context type
 */
export interface RequestLogContext extends LogContext {
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, module = 'request'): Logger {
  return new Logger(module, { requestId });
}

// Export default instance
export default logger;
