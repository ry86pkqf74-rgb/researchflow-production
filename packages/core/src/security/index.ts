/**
 * Security Utilities for File Ingestion Pipeline
 *
 * This module provides comprehensive security utilities to protect against:
 * - Zip-slip attacks (path traversal in ZIP files)
 * - Path traversal attacks (../ sequences)
 * - Malicious file uploads (executables, invalid types)
 * - Zip bombs (excessive compression/file counts)
 *
 * @example
 * import {
 *   validateFile,
 *   extractZipSecurely,
 *   sanitizePath,
 *   RESEARCH_FILE_OPTIONS,
 *   ZIP_EXTRACTION_DEFAULTS,
 * } from '@researchflow/core/security';
 *
 * // Validate an uploaded file
 * const result = validateFile(file, RESEARCH_FILE_OPTIONS);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 *
 * // Extract a ZIP file securely
 * const extractResult = await extractZipSecurely(zipBuffer, {
 *   ...ZIP_EXTRACTION_DEFAULTS,
 *   targetDir: '/app/uploads/extracted',
 * });
 */

// Export error types
export { SecurityError, type SecurityErrorCode } from './errors';

// Export path sanitization utilities
export {
  sanitizePath,
  sanitizeFilename,
  isPathWithinBase,
  joinPathSecurely,
  validateZipEntryPath,
} from './path-sanitizer';

// Export file validation utilities
export {
  validateFile,
  validateFileContent,
  detectMimeType,
  isExecutable,
  type FileValidationResult,
  type FileValidationOptions,
  type FileInput,
} from './file-validator';

// Export ZIP handling utilities
export {
  extractZipSecurely,
  validateZipEntry,
  parseZipEntries,
  isValidZipFile,
  getCompressionRatio,
  isPotentialZipBomb,
  type ZipExtractionOptions,
  type ZipExtractionResult,
  type ZipEntryInfo,
} from './zip-handler';

// Import types for preset definitions
import type { FileValidationOptions } from './file-validator';
import type { ZipExtractionOptions } from './zip-handler';

/**
 * Default file validation options for research data files.
 * Allows common data formats while blocking executables.
 */
export const RESEARCH_FILE_OPTIONS: FileValidationOptions = {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  allowedExtensions: [
    '.csv',
    '.xlsx',
    '.xls',
    '.json',
    '.parquet',
    '.txt',
    '.tsv',
  ],
  allowedMimeTypes: [
    'text/csv',
    'application/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/tab-separated-values',
    'application/vnd.apache.parquet',
    'application/octet-stream', // Parquet files may be detected as this
  ],
  blockExecutables: true,
};

/**
 * Default ZIP extraction options with reasonable limits.
 * Note: targetDir must be set by the caller.
 */
export const ZIP_EXTRACTION_DEFAULTS: Omit<ZipExtractionOptions, 'targetDir'> & {
  targetDir: string;
} = {
  targetDir: '', // MUST be set by caller
  maxFiles: 1000,
  maxTotalSize: 500 * 1024 * 1024, // 500MB
  maxFileSize: 100 * 1024 * 1024, // 100MB per file
};

/**
 * Stricter file validation options for sensitive environments.
 * Smaller size limits and fewer allowed types.
 */
export const STRICT_FILE_OPTIONS: FileValidationOptions = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.csv', '.json', '.txt'],
  allowedMimeTypes: [
    'text/csv',
    'application/csv',
    'application/json',
    'text/plain',
  ],
  blockExecutables: true,
};

/**
 * Stricter ZIP extraction options for sensitive environments.
 */
export const STRICT_ZIP_OPTIONS: Omit<ZipExtractionOptions, 'targetDir'> & {
  targetDir: string;
} = {
  targetDir: '', // MUST be set by caller
  maxFiles: 100,
  maxTotalSize: 50 * 1024 * 1024, // 50MB
  maxFileSize: 10 * 1024 * 1024, // 10MB per file
};
