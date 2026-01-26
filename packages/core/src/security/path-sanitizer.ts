/**
 * Path Traversal Prevention Utilities
 *
 * Provides functions to sanitize paths and prevent directory traversal attacks.
 */

import * as path from 'path';
import { SecurityError } from './errors';

/**
 * Sanitizes a user-provided path by removing dangerous sequences.
 *
 * @param userPath - The untrusted path string to sanitize
 * @returns A sanitized path string safe for use in file operations
 *
 * @example
 * sanitizePath('../../../etc/passwd') // Returns 'etc/passwd'
 * sanitizePath('foo\\..\\bar') // Returns 'foo/bar'
 */
export function sanitizePath(userPath: string): string {
  if (!userPath) {
    return '';
  }

  let sanitized = userPath;

  // Remove null bytes (can be used to truncate paths)
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters (ASCII 0-31 except common whitespace)
  sanitized = sanitized.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  // Normalize path separators to forward slashes first
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove path traversal sequences (../ and variations)
  // Handle encoded variants as well
  sanitized = sanitized
    .replace(/\.\.+[/\\]/g, '') // ../ or ..\
    .replace(/[/\\]\.\.+/g, '') // /.. or \..
    .replace(/%2e%2e[%2f%5c]/gi, '') // URL encoded ../
    .replace(/[%2f%5c]%2e%2e/gi, '') // URL encoded /..
    .replace(/\.{2,}/g, '.'); // Multiple dots to single dot

  // Remove leading slashes (prevents absolute paths)
  sanitized = sanitized.replace(/^[/\\]+/, '');

  // Remove Windows drive letters (C:, D:, etc.)
  sanitized = sanitized.replace(/^[a-zA-Z]:[/\\]?/, '');

  // Collapse multiple consecutive slashes
  sanitized = sanitized.replace(/[/\\]+/g, '/');

  // Remove trailing slashes
  sanitized = sanitized.replace(/[/\\]+$/, '');

  return sanitized;
}

/**
 * Sanitizes a filename by removing path components and dangerous characters.
 *
 * @param filename - The filename to sanitize
 * @returns A sanitized filename safe for filesystem storage
 *
 * @example
 * sanitizeFilename('../../../etc/passwd') // Returns 'etc_passwd'
 * sanitizeFilename('file\x00name.txt') // Returns 'filename.txt'
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    return 'unnamed';
  }

  let sanitized = filename;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');

  // Replace path separators with underscores
  sanitized = sanitized.replace(/[/\\]/g, '_');

  // Remove Windows reserved characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '');

  // Replace path traversal sequences with underscores
  sanitized = sanitized.replace(/\.{2,}/g, '_');

  // Collapse multiple underscores
  sanitized = sanitized.replace(/_+/g, '_');

  // Remove leading/trailing dots and underscores
  sanitized = sanitized.replace(/^[._]+|[._]+$/g, '');

  // Ensure we have a valid filename
  if (!sanitized || sanitized.length === 0) {
    return 'unnamed';
  }

  // Limit filename length (255 is common filesystem limit)
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    sanitized = base.slice(0, 255 - ext.length) + ext;
  }

  return sanitized;
}

/**
 * Checks if a resolved path is within the allowed base directory.
 *
 * @param testPath - The path to test (will be resolved to absolute)
 * @param basePath - The base directory that testPath must be within
 * @returns true if testPath is within basePath, false otherwise
 *
 * @example
 * isPathWithinBase('/app/uploads/file.txt', '/app/uploads') // true
 * isPathWithinBase('/app/uploads/../secrets/file.txt', '/app/uploads') // false
 */
export function isPathWithinBase(testPath: string, basePath: string): boolean {
  if (!testPath || !basePath) {
    return false;
  }

  // Resolve both paths to absolute paths
  const resolvedBase = path.resolve(basePath);
  const resolvedTest = path.resolve(basePath, testPath);

  // Normalize paths to handle trailing slashes consistently
  const normalizedBase = resolvedBase.endsWith(path.sep)
    ? resolvedBase
    : resolvedBase + path.sep;
  const normalizedTest = resolvedTest.endsWith(path.sep)
    ? resolvedTest
    : resolvedTest + path.sep;

  // Check if the test path starts with the base path
  // Using >= to allow the exact base path as valid
  return (
    normalizedTest.startsWith(normalizedBase) ||
    resolvedTest === resolvedBase
  );
}

/**
 * Joins path segments securely, ensuring the result stays within the base path.
 *
 * @param basePath - The base directory that the result must stay within
 * @param segments - Path segments to join
 * @returns The safely joined path
 * @throws SecurityError if the resulting path would escape the base directory
 *
 * @example
 * joinPathSecurely('/app/uploads', 'user', 'file.txt') // '/app/uploads/user/file.txt'
 * joinPathSecurely('/app/uploads', '../secrets', 'file.txt') // throws SecurityError
 */
export function joinPathSecurely(
  basePath: string,
  ...segments: string[]
): string {
  if (!basePath) {
    throw new SecurityError(
      'Base path is required',
      'PATH_TRAVERSAL',
      { basePath, segments }
    );
  }

  // Sanitize each segment
  const sanitizedSegments = segments.map((seg) => sanitizePath(seg));

  // Join the paths
  const joinedPath = path.join(basePath, ...sanitizedSegments);

  // Resolve to absolute path
  const resolvedPath = path.resolve(joinedPath);
  const resolvedBase = path.resolve(basePath);

  // Verify the result is within the base path
  if (!isPathWithinBase(resolvedPath, resolvedBase)) {
    throw new SecurityError(
      `Path traversal detected: result "${resolvedPath}" escapes base "${resolvedBase}"`,
      'PATH_TRAVERSAL',
      {
        basePath,
        segments,
        sanitizedSegments,
        resolvedPath,
        resolvedBase,
      }
    );
  }

  return resolvedPath;
}

/**
 * Validates a ZIP entry path for zip-slip vulnerabilities.
 *
 * @param entryPath - The path from the ZIP entry
 * @param targetDir - The target extraction directory
 * @returns true if the entry path is safe, false otherwise
 */
export function validateZipEntryPath(
  entryPath: string,
  targetDir: string
): boolean {
  if (!entryPath || !targetDir) {
    return false;
  }

  // Check for obvious path traversal attempts before normalization
  if (
    entryPath.includes('..') ||
    entryPath.startsWith('/') ||
    entryPath.startsWith('\\') ||
    /^[a-zA-Z]:/.test(entryPath)
  ) {
    return false;
  }

  // Resolve the full path
  const resolvedTarget = path.resolve(targetDir);
  const resolvedEntry = path.resolve(targetDir, entryPath);

  // Verify the entry resolves within the target directory
  return isPathWithinBase(resolvedEntry, resolvedTarget);
}
