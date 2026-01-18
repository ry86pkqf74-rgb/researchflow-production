/**
 * Security Error Types
 *
 * Custom error class for file ingestion security violations.
 */

export type SecurityErrorCode =
  | 'PATH_TRAVERSAL'
  | 'ZIP_SLIP'
  | 'INVALID_FILE'
  | 'SIZE_EXCEEDED';

/**
 * Security error for file ingestion pipeline violations.
 * Thrown when security checks detect malicious or invalid file operations.
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: SecurityErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}
