/**
 * Standardized Error Response System (Backend)
 *
 * Provides consistent error response format across all API endpoints.
 * Matches frontend error type system for seamless error handling.
 */

/**
 * Standard error codes (matches frontend)
 */
export enum APIErrorCode {
  // Authentication & Authorization
  APPROVAL_DENIED = 'APPROVAL_DENIED',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',

  // Network & Infrastructure
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Rate Limiting & Resources
  RATE_LIMIT = 'RATE_LIMIT',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // PHI & Compliance
  PHI_DETECTED = 'PHI_DETECTED',
  PHI_GATE_BLOCKED = 'PHI_GATE_BLOCKED',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',

  // Mode & Configuration
  MODE_MISMATCH = 'MODE_MISMATCH',
  DEMO_MODE_BLOCKED = 'DEMO_MODE_BLOCKED',
  LIVE_MODE_REQUIRED = 'LIVE_MODE_REQUIRED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // AI Operations
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  GENERATION_FAILED = 'GENERATION_FAILED',
  STREAM_ERROR = 'STREAM_ERROR',
  STREAM_CANCELLED = 'STREAM_CANCELLED',

  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
}

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  error: {
    code: APIErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
    timestamp: string;
  };
}

/**
 * API Error class
 */
export class APIError extends Error {
  public readonly code: APIErrorCode;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    code: APIErrorCode,
    message: string,
    statusCode: number = 500,
    retryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /**
   * Convert to standard error response
   */
  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        details: this.details,
        timestamp: this.timestamp,
      },
    };
  }
}

/**
 * HTTP status code to error code mapping
 */
function statusCodeToErrorCode(statusCode: number): APIErrorCode {
  const statusMap: Record<number, APIErrorCode> = {
    400: APIErrorCode.INVALID_INPUT,
    401: APIErrorCode.AUTHENTICATION_REQUIRED,
    403: APIErrorCode.INSUFFICIENT_PERMISSIONS,
    404: APIErrorCode.NOT_FOUND,
    409: APIErrorCode.CONFLICT,
    429: APIErrorCode.RATE_LIMIT,
    500: APIErrorCode.INTERNAL_ERROR,
    503: APIErrorCode.SERVICE_UNAVAILABLE,
    504: APIErrorCode.TIMEOUT,
  };

  return statusMap[statusCode] || APIErrorCode.UNKNOWN_ERROR;
}

/**
 * Create standard error responses
 */
export const ErrorFactory = {
  // Authentication errors
  authenticationRequired(message: string = 'Authentication required'): APIError {
    return new APIError(
      APIErrorCode.AUTHENTICATION_REQUIRED,
      message,
      401,
      false
    );
  },

  authenticationFailed(message: string = 'Authentication failed'): APIError {
    return new APIError(
      APIErrorCode.AUTHENTICATION_FAILED,
      message,
      401,
      false
    );
  },

  tokenExpired(message: string = 'Token has expired'): APIError {
    return new APIError(
      APIErrorCode.TOKEN_EXPIRED,
      message,
      401,
      false
    );
  },

  tokenInvalid(message: string = 'Invalid token'): APIError {
    return new APIError(
      APIErrorCode.TOKEN_INVALID,
      message,
      401,
      false
    );
  },

  insufficientPermissions(message: string = 'Insufficient permissions'): APIError {
    return new APIError(
      APIErrorCode.INSUFFICIENT_PERMISSIONS,
      message,
      403,
      false
    );
  },

  approvalDenied(message: string = 'AI operation denied by user'): APIError {
    return new APIError(
      APIErrorCode.APPROVAL_DENIED,
      message,
      403,
      false
    );
  },

  // Validation errors
  validationFailed(message: string, details?: Record<string, unknown>): APIError {
    return new APIError(
      APIErrorCode.VALIDATION_FAILED,
      message,
      400,
      false,
      details
    );
  },

  invalidInput(message: string, details?: Record<string, unknown>): APIError {
    return new APIError(
      APIErrorCode.INVALID_INPUT,
      message,
      400,
      false,
      details
    );
  },

  // Network errors (retryable)
  networkError(message: string = 'Network error occurred'): APIError {
    return new APIError(
      APIErrorCode.NETWORK_ERROR,
      message,
      503,
      true
    );
  },

  timeout(message: string = 'Request timed out'): APIError {
    return new APIError(
      APIErrorCode.TIMEOUT,
      message,
      504,
      true
    );
  },

  serviceUnavailable(message: string = 'Service temporarily unavailable'): APIError {
    return new APIError(
      APIErrorCode.SERVICE_UNAVAILABLE,
      message,
      503,
      true
    );
  },

  // Rate limiting
  rateLimit(message: string = 'Rate limit exceeded', retryAfter?: number): APIError {
    return new APIError(
      APIErrorCode.RATE_LIMIT,
      message,
      429,
      true,
      retryAfter ? { retryAfter } : undefined
    );
  },

  budgetExceeded(message: string = 'Budget limit exceeded'): APIError {
    return new APIError(
      APIErrorCode.BUDGET_EXCEEDED,
      message,
      403,
      false
    );
  },

  // PHI & Compliance
  phiDetected(message: string, details?: Record<string, unknown>): APIError {
    return new APIError(
      APIErrorCode.PHI_DETECTED,
      message,
      400,
      false,
      details
    );
  },

  phiGateBlocked(message: string = 'Operation blocked by PHI gate'): APIError {
    return new APIError(
      APIErrorCode.PHI_GATE_BLOCKED,
      message,
      403,
      false
    );
  },

  // Mode errors
  modeMismatch(message: string): APIError {
    return new APIError(
      APIErrorCode.MODE_MISMATCH,
      message,
      400,
      false
    );
  },

  demoModeBlocked(message: string = 'Operation not available in demo mode'): APIError {
    return new APIError(
      APIErrorCode.DEMO_MODE_BLOCKED,
      message,
      403,
      false
    );
  },

  liveModeRequired(message: string = 'This operation requires LIVE mode'): APIError {
    return new APIError(
      APIErrorCode.LIVE_MODE_REQUIRED,
      message,
      403,
      false
    );
  },

  // AI errors
  aiServiceError(message: string, details?: Record<string, unknown>): APIError {
    return new APIError(
      APIErrorCode.AI_SERVICE_ERROR,
      message,
      503,
      true,
      details
    );
  },

  modelUnavailable(message: string = 'AI model temporarily unavailable'): APIError {
    return new APIError(
      APIErrorCode.MODEL_UNAVAILABLE,
      message,
      503,
      true
    );
  },

  generationFailed(message: string): APIError {
    return new APIError(
      APIErrorCode.GENERATION_FAILED,
      message,
      500,
      false
    );
  },

  // Generic
  notFound(message: string = 'Resource not found'): APIError {
    return new APIError(
      APIErrorCode.NOT_FOUND,
      message,
      404,
      false
    );
  },

  conflict(message: string = 'Resource conflict'): APIError {
    return new APIError(
      APIErrorCode.CONFLICT,
      message,
      409,
      false
    );
  },

  internalError(message: string = 'Internal server error'): APIError {
    return new APIError(
      APIErrorCode.INTERNAL_ERROR,
      message,
      500,
      false
    );
  },
};

/**
 * Standardized error response helper
 */
export function sendErrorResponse(
  res: any,
  error: APIError | Error,
  fallbackStatusCode: number = 500
): void {
  if (error instanceof APIError) {
    res.status(error.statusCode).json(error.toResponse());
  } else {
    // Convert generic Error to APIError
    const apiError = new APIError(
      APIErrorCode.INTERNAL_ERROR,
      error.message || 'Unknown error',
      fallbackStatusCode,
      false
    );
    res.status(apiError.statusCode).json(apiError.toResponse());
  }
}
