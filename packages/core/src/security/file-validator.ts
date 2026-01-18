/**
 * Secure File Validation Utility
 *
 * Validates uploaded files for size, type, extension, and security threats.
 */

import * as path from 'path';
import { SecurityError } from './errors';
import { sanitizeFilename } from './path-sanitizer';

/**
 * Result of file validation
 */
export interface FileValidationResult {
  /** Whether the file passed all validation checks */
  valid: boolean;
  /** List of validation errors encountered */
  errors: string[];
  /** Sanitized filename safe for filesystem storage */
  sanitizedName: string;
}

/**
 * Options for file validation
 */
export interface FileValidationOptions {
  /** Maximum file size in bytes */
  maxSizeBytes: number;
  /** Allowed file extensions (with dot, e.g., '.pdf') */
  allowedExtensions: string[];
  /** Allowed MIME types */
  allowedMimeTypes: string[];
  /** Whether to block executable files regardless of allowlist */
  blockExecutables: boolean;
}

/**
 * File input that can be validated
 */
export interface FileInput {
  /** Original filename */
  filename: string;
  /** File content as Buffer */
  buffer: Buffer;
  /** Declared MIME type (from upload) */
  declaredMimeType?: string;
}

/**
 * Executable file extensions to block
 */
const EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.msp',
  '.scr',
  '.pif',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.psm1',
  '.psd1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.ws',
  '.wsf',
  '.wsc',
  '.wsh',
  '.dll',
  '.so',
  '.dylib',
  '.app',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.jar',
  '.war',
  '.ear',
  '.py',
  '.pyc',
  '.pyo',
  '.rb',
  '.pl',
  '.php',
  '.asp',
  '.aspx',
  '.cgi',
]);

/**
 * Magic bytes signatures for common file types
 */
const MAGIC_SIGNATURES: Array<{
  bytes: number[];
  offset?: number;
  mimeTypes: string[];
  description: string;
}> = [
  // PDF
  {
    bytes: [0x25, 0x50, 0x44, 0x46], // %PDF
    mimeTypes: ['application/pdf'],
    description: 'PDF',
  },
  // PNG
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    mimeTypes: ['image/png'],
    description: 'PNG',
  },
  // JPEG
  {
    bytes: [0xff, 0xd8, 0xff],
    mimeTypes: ['image/jpeg', 'image/jpg'],
    description: 'JPEG',
  },
  // GIF
  {
    bytes: [0x47, 0x49, 0x46, 0x38], // GIF8
    mimeTypes: ['image/gif'],
    description: 'GIF',
  },
  // ZIP (also XLSX, DOCX, etc.)
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    mimeTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    description: 'ZIP/Office Open XML',
  },
  // GZIP
  {
    bytes: [0x1f, 0x8b],
    mimeTypes: ['application/gzip', 'application/x-gzip'],
    description: 'GZIP',
  },
  // CSV/Text (no specific magic bytes, but check for text content)
  // JSON (no specific magic bytes, starts with { or [)
  // XLS (old Excel)
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    mimeTypes: ['application/vnd.ms-excel', 'application/msword'],
    description: 'MS Office (OLE)',
  },
  // Parquet
  {
    bytes: [0x50, 0x41, 0x52, 0x31], // PAR1
    mimeTypes: ['application/vnd.apache.parquet', 'application/octet-stream'],
    description: 'Apache Parquet',
  },
];

/**
 * Executable magic bytes to detect
 */
const EXECUTABLE_SIGNATURES: Array<{
  bytes: number[];
  offset?: number;
  description: string;
}> = [
  // ELF (Linux/Unix executables)
  { bytes: [0x7f, 0x45, 0x4c, 0x46], description: 'ELF executable' },
  // PE/COFF (Windows executables)
  { bytes: [0x4d, 0x5a], description: 'Windows executable (MZ)' },
  // Mach-O (macOS executables)
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], description: 'Mach-O 64-bit' },
  { bytes: [0xfe, 0xed, 0xfa, 0xcf], description: 'Mach-O 64-bit (reverse)' },
  { bytes: [0xce, 0xfa, 0xed, 0xfe], description: 'Mach-O 32-bit' },
  { bytes: [0xfe, 0xed, 0xfa, 0xce], description: 'Mach-O 32-bit (reverse)' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], description: 'Mach-O Universal/Java class' },
  // Shell scripts
  { bytes: [0x23, 0x21], description: 'Shell script (shebang)' }, // #!
];

/**
 * Checks if buffer starts with given bytes at specified offset
 */
function bufferStartsWith(
  buffer: Buffer,
  bytes: number[],
  offset: number = 0
): boolean {
  if (buffer.length < offset + bytes.length) {
    return false;
  }
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detects MIME type from buffer using magic bytes
 */
export function detectMimeType(buffer: Buffer): string | undefined {
  if (!buffer || buffer.length === 0) {
    return undefined;
  }

  for (const sig of MAGIC_SIGNATURES) {
    if (bufferStartsWith(buffer, sig.bytes, sig.offset || 0)) {
      return sig.mimeTypes[0];
    }
  }

  // Check if content appears to be text (CSV, JSON, TSV, TXT)
  if (isLikelyTextContent(buffer)) {
    // Try to detect JSON
    const content = buffer.slice(0, 1000).toString('utf-8').trim();
    if (content.startsWith('{') || content.startsWith('[')) {
      return 'application/json';
    }
    // Default to text/plain for text content
    return 'text/plain';
  }

  return undefined;
}

/**
 * Checks if buffer content appears to be text
 */
function isLikelyTextContent(buffer: Buffer): boolean {
  // Check first 1000 bytes for text characteristics
  const sampleSize = Math.min(buffer.length, 1000);
  let textCharCount = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    // Count printable ASCII, tabs, newlines, and carriage returns
    if (
      (byte >= 0x20 && byte <= 0x7e) ||
      byte === 0x09 || // tab
      byte === 0x0a || // newline
      byte === 0x0d    // carriage return
    ) {
      textCharCount++;
    }
  }

  // If more than 90% is text-like, consider it text
  return textCharCount / sampleSize > 0.9;
}

/**
 * Checks if the file is an executable based on magic bytes
 */
export function isExecutable(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 2) {
    return false;
  }

  for (const sig of EXECUTABLE_SIGNATURES) {
    if (bufferStartsWith(buffer, sig.bytes, sig.offset || 0)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if extension is in the executable blocklist
 */
function isExecutableExtension(extension: string): boolean {
  return EXECUTABLE_EXTENSIONS.has(extension.toLowerCase());
}

/**
 * Validates a file against security policies.
 *
 * @param file - The file to validate (buffer with filename and optional MIME type)
 * @param options - Validation options
 * @returns Validation result with sanitized filename
 *
 * @example
 * const result = validateFile(
 *   { filename: 'data.csv', buffer: fileBuffer },
 *   { maxSizeBytes: 10 * 1024 * 1024, allowedExtensions: ['.csv'], allowedMimeTypes: ['text/csv'], blockExecutables: true }
 * );
 */
export function validateFile(
  file: FileInput,
  options: FileValidationOptions
): FileValidationResult {
  const errors: string[] = [];

  // Sanitize filename first
  const sanitizedName = sanitizeFilename(file.filename);

  // Check file size
  if (file.buffer.length > options.maxSizeBytes) {
    errors.push(
      `File size (${file.buffer.length} bytes) exceeds maximum allowed (${options.maxSizeBytes} bytes)`
    );
  }

  // Get file extension
  const extension = path.extname(sanitizedName).toLowerCase();

  // Check if extension is allowed
  if (options.allowedExtensions.length > 0) {
    const normalizedAllowed = options.allowedExtensions.map((ext) =>
      ext.toLowerCase()
    );
    if (!normalizedAllowed.includes(extension)) {
      errors.push(
        `File extension "${extension}" is not allowed. Allowed extensions: ${normalizedAllowed.join(', ')}`
      );
    }
  }

  // Block executables if enabled
  if (options.blockExecutables) {
    // Check extension
    if (isExecutableExtension(extension)) {
      errors.push(
        `Executable file extension "${extension}" is blocked for security reasons`
      );
    }

    // Check magic bytes for executables
    if (isExecutable(file.buffer)) {
      errors.push(
        'File appears to be an executable based on its content (magic bytes)'
      );
    }
  }

  // Detect MIME type from magic bytes
  const detectedMimeType = detectMimeType(file.buffer);

  // Validate MIME type if we have allowed types
  if (options.allowedMimeTypes.length > 0 && detectedMimeType) {
    const normalizedAllowed = options.allowedMimeTypes.map((mt) =>
      mt.toLowerCase()
    );

    // Check if detected type is allowed
    if (!normalizedAllowed.includes(detectedMimeType.toLowerCase())) {
      // Special handling for text-based formats
      const isTextAllowed = normalizedAllowed.some(
        (mt) =>
          mt.startsWith('text/') ||
          mt === 'application/json' ||
          mt === 'application/csv'
      );

      if (
        !(
          isTextAllowed &&
          (detectedMimeType === 'text/plain' ||
            detectedMimeType === 'application/json')
        )
      ) {
        errors.push(
          `Detected MIME type "${detectedMimeType}" is not in allowed list: ${normalizedAllowed.join(', ')}`
        );
      }
    }
  }

  // If declared MIME type differs significantly from detected, warn
  if (
    file.declaredMimeType &&
    detectedMimeType &&
    file.declaredMimeType.toLowerCase() !== detectedMimeType.toLowerCase()
  ) {
    // Allow some flexibility for text types
    const declaredBase = file.declaredMimeType.split('/')[0];
    const detectedBase = detectedMimeType.split('/')[0];

    if (declaredBase !== detectedBase && declaredBase !== 'application') {
      errors.push(
        `Declared MIME type "${file.declaredMimeType}" does not match detected type "${detectedMimeType}"`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedName,
  };
}

/**
 * Validates file content matches expected type (additional security check)
 */
export function validateFileContent(
  buffer: Buffer,
  expectedMimeType: string
): boolean {
  const detectedType = detectMimeType(buffer);

  if (!detectedType) {
    // Can't determine type, allow if it looks like text for text types
    if (expectedMimeType.startsWith('text/')) {
      return isLikelyTextContent(buffer);
    }
    return false;
  }

  // Exact match
  if (detectedType.toLowerCase() === expectedMimeType.toLowerCase()) {
    return true;
  }

  // Allow text/plain for various text-based formats
  if (
    detectedType === 'text/plain' &&
    (expectedMimeType === 'text/csv' ||
      expectedMimeType === 'text/tab-separated-values' ||
      expectedMimeType === 'application/json')
  ) {
    return true;
  }

  // Allow ZIP-based formats
  if (
    detectedType === 'application/zip' &&
    expectedMimeType.includes('openxmlformats')
  ) {
    return true;
  }

  return false;
}
