/**
 * Standardized Error Type System
 *
 * Provides consistent error codes and types across frontend/backend.
 * Enables better error handling, user feedback, and debugging.
 */

/**
 * Standard error codes for AI operations
 */
export enum AIErrorCode {
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
 * Standard error interface
 */
export interface AIError {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Custom error class for AI operations
 */
export class AIOperationError extends Error {
  public readonly code: AIErrorCode;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    code: AIErrorCode,
    message: string,
    retryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIOperationError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown (V8 engines only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIOperationError);
    }
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): AIError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  /**
   * Convert to user-friendly display message
   */
  toDisplayMessage(): string {
    const codeMessages: Record<AIErrorCode, string> = {
      [AIErrorCode.APPROVAL_DENIED]: 'AI operation was denied. Authorization is required to proceed.',
      [AIErrorCode.AUTHENTICATION_REQUIRED]: 'Please log in to access this feature.',
      [AIErrorCode.AUTHENTICATION_FAILED]: 'Authentication failed. Please check your credentials.',
      [AIErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
      [AIErrorCode.TOKEN_INVALID]: 'Invalid authentication token. Please log in again.',
      [AIErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action.',

      [AIErrorCode.VALIDATION_FAILED]: 'The provided data is invalid. Please check and try again.',
      [AIErrorCode.INVALID_INPUT]: 'Invalid input provided. Please review your data.',
      [AIErrorCode.INVALID_RESPONSE]: 'Received invalid response from AI service.',
      [AIErrorCode.SCHEMA_MISMATCH]: 'Response format mismatch. Please contact support.',

      [AIErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
      [AIErrorCode.TIMEOUT]: 'Request timed out. Please try again.',
      [AIErrorCode.CONNECTION_REFUSED]: 'Unable to connect to service. Please try again later.',
      [AIErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',

      [AIErrorCode.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
      [AIErrorCode.BUDGET_EXCEEDED]: 'Budget limit exceeded. Please review your usage.',
      [AIErrorCode.QUOTA_EXCEEDED]: 'Quota exceeded. Please upgrade your plan or wait until reset.',

      [AIErrorCode.PHI_DETECTED]: 'PHI detected in data. Review and redact sensitive information.',
      [AIErrorCode.PHI_GATE_BLOCKED]: 'Operation blocked by PHI gate. Approval required.',
      [AIErrorCode.COMPLIANCE_VIOLATION]: 'Operation violates compliance requirements.',

      [AIErrorCode.MODE_MISMATCH]: 'Operation not available in current mode.',
      [AIErrorCode.DEMO_MODE_BLOCKED]: 'This operation is not available in demo mode.',
      [AIErrorCode.LIVE_MODE_REQUIRED]: 'This operation requires LIVE mode. Please log in.',
      [AIErrorCode.CONFIGURATION_ERROR]: 'Configuration error. Please contact support.',

      [AIErrorCode.AI_SERVICE_ERROR]: 'AI service error. Please try again.',
      [AIErrorCode.MODEL_UNAVAILABLE]: 'AI model temporarily unavailable. Please try again later.',
      [AIErrorCode.GENERATION_FAILED]: 'AI generation failed. Please try again.',
      [AIErrorCode.STREAM_ERROR]: 'Streaming error occurred. Please try again.',
      [AIErrorCode.STREAM_CANCELLED]: 'Stream cancelled by user.',

      [AIErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
      [AIErrorCode.INTERNAL_ERROR]: 'Internal error. Please contact support.',
      [AIErrorCode.NOT_FOUND]: 'Resource not found.',
      [AIErrorCode.CONFLICT]: 'Conflict detected. Resource may have been modified.',
    };

    return codeMessages[this.code] || this.message;
  }
}

/**
 * Create error from API response
 */
export function createErrorFromResponse(response: any): AIOperationError {
  // Handle standardized error response
  if (response.error && typeof response.error === 'object') {
    const { code, message, retryable, details } = response.error;
    return new AIOperationError(
      code || AIErrorCode.UNKNOWN_ERROR,
      message || 'Unknown error',
      retryable || false,
      details
    );
  }

  // Handle legacy error formats
  if (typeof response.error === 'string') {
    return inferErrorFromMessage(response.error);
  }

  if (response.message) {
    return inferErrorFromMessage(response.message);
  }

  return new AIOperationError(
    AIErrorCode.UNKNOWN_ERROR,
    'Unknown error occurred',
    false
  );
}

/**
 * Infer error code from error message (for legacy support)
 */
function inferErrorFromMessage(message: string): AIOperationError {
  const lowerMessage = message.toLowerCase();

  // Authentication errors
  if (lowerMessage.includes('denied') || lowerMessage.includes('authorization')) {
    return new AIOperationError(AIErrorCode.APPROVAL_DENIED, message, false);
  }
  if (lowerMessage.includes('authentication') || lowerMessage.includes('login')) {
    return new AIOperationError(AIErrorCode.AUTHENTICATION_REQUIRED, message, false);
  }
  if (lowerMessage.includes('token') && lowerMessage.includes('expired')) {
    return new AIOperationError(AIErrorCode.TOKEN_EXPIRED, message, false);
  }
  if (lowerMessage.includes('token') && lowerMessage.includes('invalid')) {
    return new AIOperationError(AIErrorCode.TOKEN_INVALID, message, false);
  }

  // Network errors (retryable)
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return new AIOperationError(AIErrorCode.NETWORK_ERROR, message, true);
  }
  if (lowerMessage.includes('timeout')) {
    return new AIOperationError(AIErrorCode.TIMEOUT, message, true);
  }
  if (lowerMessage.includes('connection refused')) {
    return new AIOperationError(AIErrorCode.CONNECTION_REFUSED, message, true);
  }
  if (lowerMessage.includes('503') || lowerMessage.includes('unavailable')) {
    return new AIOperationError(AIErrorCode.SERVICE_UNAVAILABLE, message, true);
  }

  // Rate limiting
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    return new AIOperationError(AIErrorCode.RATE_LIMIT, message, true);
  }
  if (lowerMessage.includes('budget') || lowerMessage.includes('cost')) {
    return new AIOperationError(AIErrorCode.BUDGET_EXCEEDED, message, false);
  }

  // PHI
  if (lowerMessage.includes('phi')) {
    return new AIOperationError(AIErrorCode.PHI_DETECTED, message, false);
  }

  // Validation
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return new AIOperationError(AIErrorCode.VALIDATION_FAILED, message, false);
  }

  // Generic
  if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
    return new AIOperationError(AIErrorCode.NOT_FOUND, message, false);
  }

  return new AIOperationError(AIErrorCode.UNKNOWN_ERROR, message, false);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: AIOperationError | AIError | string): boolean {
  if (typeof error === 'string') {
    const inferredError = inferErrorFromMessage(error);
    return inferredError.retryable;
  }

  if (error instanceof AIOperationError) {
    return error.retryable;
  }

  return error.retryable || false;
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: AIOperationError | AIError | string): string {
  if (typeof error === 'string') {
    const inferredError = inferErrorFromMessage(error);
    return inferredError.toDisplayMessage();
  }

  if (error instanceof AIOperationError) {
    return error.toDisplayMessage();
  }

  // Plain AIError object
  const operationError = new AIOperationError(
    error.code,
    error.message,
    error.retryable,
    error.details
  );
  return operationError.toDisplayMessage();
}
