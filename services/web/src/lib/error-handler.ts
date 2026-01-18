/**
 * Error Handler for ResearchFlow Canvas
 *
 * Provides severity-based error routing for research operations system (ROS).
 * Critical PHI-related errors trigger modals and incident logging, while
 * background operations use toast notifications.
 */

import { toast } from '@/hooks/use-toast';
import type { APIError, ErrorSeverity } from '@/types/api';

/**
 * Error handler configuration
 */
interface ErrorHandlerConfig {
  /**
   * Whether to log errors to console (useful for development)
   */
  logToConsole?: boolean;

  /**
   * Whether to trigger incident logging for CRITICAL errors
   */
  enableIncidentLogging?: boolean;

  /**
   * Custom error modal component (optional)
   */
  showErrorModal?: (error: APIError) => void;
}

const config: ErrorHandlerConfig = {
  logToConsole: process.env.NODE_ENV === 'development',
  enableIncidentLogging: true,
};

/**
 * Configure the error handler
 */
export function configureErrorHandler(newConfig: Partial<ErrorHandlerConfig>) {
  Object.assign(config, newConfig);
}

/**
 * Convert API error response to structured error
 */
export function parseAPIError(response: Response, body?: any): APIError {
  // Try to extract error from response body
  if (body && typeof body === 'object') {
    if (body.error) {
      return {
        message: body.error.message || body.error,
        code: body.error.code,
        severity: determineSeverity(body.error.code, response.status),
        details: body.error.details,
        timestamp: new Date(),
      };
    }

    if (body.message) {
      return {
        message: body.message,
        code: body.code,
        severity: determineSeverity(body.code, response.status),
        details: body.details,
        timestamp: new Date(),
      };
    }
  }

  // Fallback to status-based error
  return {
    message: getStatusMessage(response.status),
    code: `HTTP_${response.status}`,
    severity: determineSeverity(`HTTP_${response.status}`, response.status),
    timestamp: new Date(),
  };
}

/**
 * Determine error severity based on error code and HTTP status
 */
function determineSeverity(code: string | undefined, status: number): ErrorSeverity {
  // Critical errors - PHI exposure, security breaches
  if (
    code?.includes('PHI_EXPOSURE') ||
    code?.includes('SECURITY_BREACH') ||
    code?.includes('UNAUTHORIZED_ACCESS') ||
    code?.includes('TAMPER_DETECTED')
  ) {
    return 'CRITICAL';
  }

  // Errors - validation failures, permission denied
  if (
    status === 403 ||
    status === 422 ||
    code?.includes('VALIDATION_ERROR') ||
    code?.includes('PERMISSION_DENIED') ||
    code?.includes('PHI_SCAN_FAILED')
  ) {
    return 'ERROR';
  }

  // Warnings - deprecated features, rate limits
  if (
    status === 429 ||
    code?.includes('RATE_LIMIT') ||
    code?.includes('DEPRECATED') ||
    code?.includes('QUOTA_WARNING')
  ) {
    return 'WARNING';
  }

  // Success messages
  if (status >= 200 && status < 300) {
    return 'SUCCESS';
  }

  // Default to ERROR for other failures
  return status >= 400 ? 'ERROR' : 'INFO';
}

/**
 * Get user-friendly message for HTTP status codes
 */
function getStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Authentication required. Please log in.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'Conflict detected. The resource may have been modified.';
    case 422:
      return 'Validation error. Please check your data.';
    case 429:
      return 'Rate limit exceeded. Please try again later.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return `Request failed with status ${status}`;
  }
}

/**
 * Handle API errors based on severity
 */
export function handleAPIError(error: APIError): void {
  if (config.logToConsole) {
    console.error('[API Error]', {
      severity: error.severity,
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp,
    });
  }

  switch (error.severity) {
    case 'CRITICAL':
      handleCriticalError(error);
      break;

    case 'ERROR':
      handleError(error);
      break;

    case 'WARNING':
      handleWarning(error);
      break;

    case 'SUCCESS':
      handleSuccess(error);
      break;

    case 'INFO':
    default:
      handleInfo(error);
      break;
  }
}

/**
 * Handle CRITICAL errors (PHI exposure, security breaches)
 * Shows modal dialog and logs incident
 */
function handleCriticalError(error: APIError): void {
  // Log incident if enabled
  if (config.enableIncidentLogging) {
    logIncident(error);
  }

  // Show error modal if configured, otherwise use toast
  if (config.showErrorModal) {
    config.showErrorModal(error);
  } else {
    toast({
      variant: 'destructive',
      title: '⚠️ Critical Security Alert',
      description: error.message,
      duration: Infinity, // Requires manual dismissal
    });
  }
}

/**
 * Handle ERROR level errors (validation, permissions)
 * Shows modal dialog that user must acknowledge
 */
function handleError(error: APIError): void {
  // Show error modal if configured, otherwise use toast
  if (config.showErrorModal) {
    config.showErrorModal(error);
  } else {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: error.message,
      duration: 8000, // 8 seconds, longer than default
    });
  }
}

/**
 * Handle WARNING level errors (rate limits, deprecations)
 * Shows toast notification with manual dismiss
 */
function handleWarning(error: APIError): void {
  toast({
    variant: 'default',
    title: 'Warning',
    description: error.message,
    duration: 6000, // 6 seconds
  });
}

/**
 * Handle SUCCESS messages
 * Shows auto-dismissing toast
 */
function handleSuccess(error: APIError): void {
  toast({
    variant: 'default',
    title: 'Success',
    description: error.message,
    duration: 3000, // 3 seconds
  });
}

/**
 * Handle INFO messages
 * Shows brief auto-dismissing toast
 */
function handleInfo(error: APIError): void {
  toast({
    variant: 'default',
    title: 'Info',
    description: error.message,
    duration: 4000, // 4 seconds
  });
}

/**
 * Log security incident (CRITICAL errors only)
 * In production, this would send to incident management system
 */
function logIncident(error: APIError): void {
  // In development, just log to console
  if (config.logToConsole) {
    console.error('[SECURITY INCIDENT]', {
      severity: 'CRITICAL',
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp,
      stackTrace: new Error().stack,
    });
  }

  // In production, send to incident management API
  // TODO: Integrate with incident logging system when available
  try {
    // Placeholder for incident API call
    // fetch('/api/incidents', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     severity: 'CRITICAL',
    //     error,
    //     userAgent: navigator.userAgent,
    //     url: window.location.href,
    //   }),
    //});
  } catch (incidentError) {
    console.error('Failed to log incident:', incidentError);
  }
}

/**
 * Create an APIError from a generic error
 */
export function createAPIError(
  error: unknown,
  defaultMessage: string = 'An unexpected error occurred'
): APIError {
  if (error instanceof Error) {
    return {
      message: error.message || defaultMessage,
      code: 'CLIENT_ERROR',
      severity: 'ERROR',
      details: { name: error.name, stack: error.stack },
      timestamp: new Date(),
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      code: 'CLIENT_ERROR',
      severity: 'ERROR',
      timestamp: new Date(),
    };
  }

  return {
    message: defaultMessage,
    code: 'UNKNOWN_ERROR',
    severity: 'ERROR',
    timestamp: new Date(),
  };
}
