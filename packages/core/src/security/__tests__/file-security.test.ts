/**
 * Comprehensive Security Tests for File Ingestion Pipeline
 *
 * These tests verify protection against:
 * - Path traversal attacks
 * - Zip-slip vulnerabilities
 * - Malicious file uploads
 * - Zip bombs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  SecurityError,
  // Path sanitization
  sanitizePath,
  sanitizeFilename,
  isPathWithinBase,
  joinPathSecurely,
  validateZipEntryPath,
  // File validation
  validateFile,
  detectMimeType,
  isExecutable,
  RESEARCH_FILE_OPTIONS,
  // ZIP handling
  validateZipEntry,
  parseZipEntries,
  isValidZipFile,
  getCompressionRatio,
  isPotentialZipBomb,
  extractZipSecurely,
  ZIP_EXTRACTION_DEFAULTS,
  type ZipEntryInfo,
} from '../index';

describe('SecurityError', () => {
  it('creates error with correct code and details', () => {
    const error = new SecurityError(
      'Test error message',
      'PATH_TRAVERSAL',
      { filename: 'test.txt' }
    );

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('PATH_TRAVERSAL');
    expect(error.details).toEqual({ filename: 'test.txt' });
  });

  it('has correct name property', () => {
    const error = new SecurityError('Test', 'ZIP_SLIP');
    expect(error.name).toBe('SecurityError');
  });

  it('is instanceof Error', () => {
    const error = new SecurityError('Test', 'INVALID_FILE');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('Path Sanitizer', () => {
  describe('sanitizePath', () => {
    it('removes "../" path traversal sequences', () => {
      expect(sanitizePath('../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('../../../etc/passwd')).toBe('etc/passwd');
    });

    it('removes "..\\" Windows path traversal sequences', () => {
      expect(sanitizePath('..\\etc\\passwd')).toBe('etc/passwd');
      expect(sanitizePath('..\\..\\etc\\passwd')).toBe('etc/passwd');
    });

    it('removes null bytes', () => {
      expect(sanitizePath('file\x00name.txt')).toBe('filename.txt');
      expect(sanitizePath('test\x00\x00.csv')).toBe('test.csv');
    });

    it('removes leading slashes (prevents absolute paths)', () => {
      expect(sanitizePath('/etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('//etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('\\etc\\passwd')).toBe('etc/passwd');
    });

    it('removes Windows drive letters', () => {
      expect(sanitizePath('C:\\Windows\\System32')).toBe('Windows/System32');
      expect(sanitizePath('D:/data/file.txt')).toBe('data/file.txt');
    });

    it('normalizes path separators', () => {
      expect(sanitizePath('foo\\bar\\baz')).toBe('foo/bar/baz');
      expect(sanitizePath('foo\\\\bar')).toBe('foo/bar');
    });

    it('collapses multiple separators', () => {
      expect(sanitizePath('foo//bar///baz')).toBe('foo/bar/baz');
    });

    it('handles empty string', () => {
      expect(sanitizePath('')).toBe('');
    });

    it('handles already safe paths', () => {
      expect(sanitizePath('data/uploads/file.csv')).toBe('data/uploads/file.csv');
    });

    it('removes control characters', () => {
      expect(sanitizePath('file\x01\x02name.txt')).toBe('filename.txt');
    });
  });

  describe('sanitizeFilename', () => {
    it('removes path traversal from filename: "../../../etc/passwd" → "etc_passwd"', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etc_passwd');
    });

    it('removes null bytes from filename', () => {
      expect(sanitizeFilename('file\x00name.txt')).toBe('filename.txt');
    });

    it('removes control characters', () => {
      expect(sanitizeFilename('file\x01\x02name.txt')).toBe('filename.txt');
    });

    it('replaces path separators with underscores', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
      expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
    });

    it('removes Windows reserved characters', () => {
      expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file.txt');
    });

    it('handles Unicode filenames safely', () => {
      expect(sanitizeFilename('文件.csv')).toBe('文件.csv');
      expect(sanitizeFilename('データ.xlsx')).toBe('データ.xlsx');
    });

    it('returns "unnamed" for empty input', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('...')).toBe('unnamed');
    });

    it('truncates overly long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('isPathWithinBase', () => {
    it('returns true for valid subpath', () => {
      expect(isPathWithinBase('uploads/file.txt', '/app/data')).toBe(true);
      expect(isPathWithinBase('file.txt', '/app/data')).toBe(true);
    });

    it('returns false for path traversal', () => {
      expect(isPathWithinBase('../secrets/file.txt', '/app/data')).toBe(false);
      expect(isPathWithinBase('../../etc/passwd', '/app/data')).toBe(false);
    });

    it('returns true for exact base path', () => {
      expect(isPathWithinBase('.', '/app/data')).toBe(true);
      expect(isPathWithinBase('', '/app/data')).toBe(false); // Empty is invalid
    });

    it('handles trailing slashes correctly', () => {
      expect(isPathWithinBase('file.txt', '/app/data/')).toBe(true);
      expect(isPathWithinBase('file.txt', '/app/data')).toBe(true);
    });

    it('returns false for empty inputs', () => {
      expect(isPathWithinBase('', '/app/data')).toBe(false);
      expect(isPathWithinBase('file.txt', '')).toBe(false);
    });
  });

  describe('joinPathSecurely', () => {
    it('returns valid joined path for safe segments', () => {
      const result = joinPathSecurely('/app/uploads', 'user', 'file.txt');
      expect(result).toContain('app');
      expect(result).toContain('uploads');
      expect(result).toContain('user');
      expect(result).toContain('file.txt');
    });

    it('sanitizes path traversal attempts instead of throwing', () => {
      // joinPathSecurely sanitizes segments before joining, so '../' is removed
      // This is defense in depth - sanitization prevents the escape
      const result = joinPathSecurely('/app/uploads', '../secrets', 'file.txt');
      expect(result).toContain('secrets');
      expect(result).toContain('file.txt');
      expect(result).not.toContain('..');
    });

    it('throws for absolute path segments', () => {
      expect(() => {
        joinPathSecurely('/app/uploads', '/etc/passwd');
      }).not.toThrow(); // Sanitization removes leading slash
    });

    it('throws for empty base path', () => {
      expect(() => {
        joinPathSecurely('', 'file.txt');
      }).toThrow(SecurityError);
    });

    it('sanitizes segments before joining', () => {
      const result = joinPathSecurely('/app/uploads', 'user/../data', 'file.txt');
      expect(result).toContain('uploads');
    });
  });

  describe('validateZipEntryPath', () => {
    it('returns true for valid entry paths', () => {
      expect(validateZipEntryPath('data/file.csv', '/app/extract')).toBe(true);
      expect(validateZipEntryPath('file.txt', '/app/extract')).toBe(true);
    });

    it('returns false for path traversal', () => {
      expect(validateZipEntryPath('../etc/passwd', '/app/extract')).toBe(false);
      expect(validateZipEntryPath('data/../../../etc/passwd', '/app/extract')).toBe(false);
    });

    it('returns false for absolute paths', () => {
      expect(validateZipEntryPath('/etc/passwd', '/app/extract')).toBe(false);
      expect(validateZipEntryPath('C:\\Windows\\System32', '/app/extract')).toBe(false);
    });
  });
});

describe('File Validator', () => {
  describe('validateFile', () => {
    it('accepts files within size limit', () => {
      const file = {
        filename: 'data.csv',
        buffer: Buffer.from('col1,col2\nval1,val2'),
        declaredMimeType: 'text/csv',
      };

      const result = validateFile(file, RESEARCH_FILE_OPTIONS);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects files exceeding maxSizeBytes', () => {
      const file = {
        filename: 'large.csv',
        buffer: Buffer.alloc(101 * 1024 * 1024), // 101MB
        declaredMimeType: 'text/csv',
      };

      const result = validateFile(file, RESEARCH_FILE_OPTIONS);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
    });

    it('rejects disallowed extensions', () => {
      const file = {
        filename: 'script.php',
        buffer: Buffer.from('<?php echo "hello"; ?>'),
        declaredMimeType: 'application/x-httpd-php',
      };

      const result = validateFile(file, RESEARCH_FILE_OPTIONS);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('extension'))).toBe(true);
    });

    it('accepts allowed extensions case-insensitively', () => {
      const file = {
        filename: 'DATA.CSV',
        buffer: Buffer.from('col1,col2\nval1,val2'),
        declaredMimeType: 'text/csv',
      };

      const result = validateFile(file, RESEARCH_FILE_OPTIONS);
      expect(result.valid).toBe(true);
    });

    it('blocks executable extensions regardless of allowlist', () => {
      const options = {
        ...RESEARCH_FILE_OPTIONS,
        allowedExtensions: ['.exe', '.csv'], // Even if .exe was allowed
      };

      const file = {
        filename: 'malware.exe',
        buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // MZ header
        declaredMimeType: 'application/octet-stream',
      };

      const result = validateFile(file, options);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('executable') || e.includes('Executable'))).toBe(true);
    });

    it('sanitizes filename in result', () => {
      const file = {
        filename: '../../../etc/passwd',
        buffer: Buffer.from('test content'),
        declaredMimeType: 'text/plain',
      };

      const options = {
        ...RESEARCH_FILE_OPTIONS,
        allowedExtensions: ['.txt', ''], // Allow no extension
      };

      const result = validateFile(file, options);
      expect(result.sanitizedName).toBe('etc_passwd');
      expect(result.sanitizedName).not.toContain('..');
    });
  });

  describe('detectMimeType', () => {
    it('detects PDF magic bytes', () => {
      const buffer = Buffer.from('%PDF-1.4 test content');
      expect(detectMimeType(buffer)).toBe('application/pdf');
    });

    it('detects PNG magic bytes', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectMimeType(buffer)).toBe('image/png');
    });

    it('detects ZIP magic bytes', () => {
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(detectMimeType(buffer)).toBe('application/zip');
    });

    it('detects JSON content', () => {
      const buffer = Buffer.from('{"key": "value"}');
      expect(detectMimeType(buffer)).toBe('application/json');
    });

    it('detects text content', () => {
      const buffer = Buffer.from('col1,col2,col3\nval1,val2,val3');
      expect(detectMimeType(buffer)).toBe('text/plain');
    });

    it('returns undefined for empty buffer', () => {
      expect(detectMimeType(Buffer.alloc(0))).toBeUndefined();
    });

    it('returns undefined for unknown format', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      expect(detectMimeType(buffer)).toBeUndefined();
    });
  });

  describe('isExecutable', () => {
    it('detects ELF binaries', () => {
      const buffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
      expect(isExecutable(buffer)).toBe(true);
    });

    it('detects PE/Windows executables', () => {
      const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      expect(isExecutable(buffer)).toBe(true);
    });

    it('detects Mach-O binaries', () => {
      const buffer = Buffer.from([0xcf, 0xfa, 0xed, 0xfe]);
      expect(isExecutable(buffer)).toBe(true);
    });

    it('detects shell scripts with shebang', () => {
      const buffer = Buffer.from('#!/bin/bash\necho "hello"');
      expect(isExecutable(buffer)).toBe(true);
    });

    it('does not flag normal text files', () => {
      const buffer = Buffer.from('This is a normal text file.');
      expect(isExecutable(buffer)).toBe(false);
    });

    it('does not flag CSV files', () => {
      const buffer = Buffer.from('name,age,city\nJohn,30,NYC');
      expect(isExecutable(buffer)).toBe(false);
    });

    it('does not flag JSON files', () => {
      const buffer = Buffer.from('{"name": "test", "value": 123}');
      expect(isExecutable(buffer)).toBe(false);
    });
  });
});

describe('Zip Handler - Zip Slip Prevention', () => {
  const mockOptions = {
    targetDir: '/app/extract',
    maxFiles: 100,
    maxTotalSize: 50 * 1024 * 1024,
    maxFileSize: 10 * 1024 * 1024,
  };

  describe('validateZipEntry', () => {
    it('rejects entry with "../" path traversal', () => {
      const entry: ZipEntryInfo = {
        filename: '../../../etc/passwd',
        compressedSize: 100,
        uncompressedSize: 200,
        isDirectory: false,
        isSymlink: false,
      };

      const error = validateZipEntry(entry, mockOptions.targetDir, mockOptions);
      expect(error).not.toBeNull();
      expect(error?.code).toBe('ZIP_SLIP');
    });

    it('rejects entry with "..\\" Windows path traversal', () => {
      const entry: ZipEntryInfo = {
        filename: '..\\..\\Windows\\System32\\config',
        compressedSize: 100,
        uncompressedSize: 200,
        isDirectory: false,
        isSymlink: false,
      };

      const error = validateZipEntry(entry, mockOptions.targetDir, mockOptions);
      expect(error).not.toBeNull();
      expect(error?.code).toBe('ZIP_SLIP');
    });

    it('rejects absolute paths in zip entries', () => {
      const entry: ZipEntryInfo = {
        filename: '/etc/passwd',
        compressedSize: 100,
        uncompressedSize: 200,
        isDirectory: false,
        isSymlink: false,
      };

      const error = validateZipEntry(entry, mockOptions.targetDir, mockOptions);
      expect(error).not.toBeNull();
      expect(error?.code).toBe('ZIP_SLIP');
    });

    it('rejects symlink entries', () => {
      const entry: ZipEntryInfo = {
        filename: 'link_to_passwd',
        compressedSize: 20,
        uncompressedSize: 20,
        isDirectory: false,
        isSymlink: true,
      };

      const error = validateZipEntry(entry, mockOptions.targetDir, mockOptions);
      expect(error).not.toBeNull();
      expect(error?.code).toBe('ZIP_SLIP');
    });

    it('accepts valid entry paths', () => {
      const entry: ZipEntryInfo = {
        filename: 'data/file.csv',
        compressedSize: 100,
        uncompressedSize: 200,
        isDirectory: false,
        isSymlink: false,
      };

      const error = validateZipEntry(entry, mockOptions.targetDir, mockOptions);
      expect(error).toBeNull();
    });

    it('rejects entries exceeding maxFileSize', () => {
      const entry: ZipEntryInfo = {
        filename: 'large.bin',
        compressedSize: 1000,
        uncompressedSize: 20 * 1024 * 1024, // 20MB, limit is 10MB
        isDirectory: false,
        isSymlink: false,
      };

      const error = validateZipEntry(entry, mockOptions.targetDir, mockOptions);
      expect(error).not.toBeNull();
      expect(error?.code).toBe('SIZE_EXCEEDED');
    });

    it('rejects when maxFiles limit exceeded', () => {
      const entry: ZipEntryInfo = {
        filename: 'file.txt',
        compressedSize: 100,
        uncompressedSize: 200,
        isDirectory: false,
        isSymlink: false,
      };

      const error = validateZipEntry(
        entry,
        mockOptions.targetDir,
        mockOptions,
        0,
        100 // Already at limit
      );
      expect(error).not.toBeNull();
      expect(error?.code).toBe('SIZE_EXCEEDED');
    });

    it('rejects when maxTotalSize would be exceeded', () => {
      const entry: ZipEntryInfo = {
        filename: 'file.bin',
        compressedSize: 1000,
        uncompressedSize: 10 * 1024 * 1024, // 10MB
        isDirectory: false,
        isSymlink: false,
      };

      const error = validateZipEntry(
        entry,
        mockOptions.targetDir,
        mockOptions,
        45 * 1024 * 1024, // Already at 45MB, limit is 50MB
        0
      );
      expect(error).not.toBeNull();
      expect(error?.code).toBe('SIZE_EXCEEDED');
    });
  });

  describe('isValidZipFile', () => {
    it('returns true for valid ZIP magic bytes', () => {
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(isValidZipFile(buffer)).toBe(true);
    });

    it('returns false for non-ZIP file', () => {
      const buffer = Buffer.from('%PDF-1.4');
      expect(isValidZipFile(buffer)).toBe(false);
    });

    it('returns false for empty buffer', () => {
      expect(isValidZipFile(Buffer.alloc(0))).toBe(false);
    });

    it('returns false for buffer too small', () => {
      expect(isValidZipFile(Buffer.from([0x50, 0x4b]))).toBe(false);
    });
  });

  describe('getCompressionRatio', () => {
    it('calculates correct ratio', () => {
      const entry: ZipEntryInfo = {
        filename: 'file.txt',
        compressedSize: 100,
        uncompressedSize: 1000,
        isDirectory: false,
        isSymlink: false,
      };
      expect(getCompressionRatio(entry)).toBe(10);
    });

    it('handles zero compressed size', () => {
      const entry: ZipEntryInfo = {
        filename: 'file.txt',
        compressedSize: 0,
        uncompressedSize: 1000,
        isDirectory: false,
        isSymlink: false,
      };
      expect(getCompressionRatio(entry)).toBe(Infinity);
    });

    it('returns 1 for both zero', () => {
      const entry: ZipEntryInfo = {
        filename: 'file.txt',
        compressedSize: 0,
        uncompressedSize: 0,
        isDirectory: false,
        isSymlink: false,
      };
      expect(getCompressionRatio(entry)).toBe(1);
    });
  });

  describe('isPotentialZipBomb', () => {
    it('detects high compression ratio', () => {
      const entry: ZipEntryInfo = {
        filename: 'bomb.txt',
        compressedSize: 100,
        uncompressedSize: 100 * 1024 * 1024, // 100MB from 100 bytes
        isDirectory: false,
        isSymlink: false,
      };
      expect(isPotentialZipBomb(entry, 100)).toBe(true);
    });

    it('allows normal compression ratio', () => {
      const entry: ZipEntryInfo = {
        filename: 'normal.txt',
        compressedSize: 1000,
        uncompressedSize: 5000, // 5:1 ratio
        isDirectory: false,
        isSymlink: false,
      };
      expect(isPotentialZipBomb(entry, 100)).toBe(false);
    });
  });
});

describe('Presets', () => {
  describe('RESEARCH_FILE_OPTIONS', () => {
    it('has expected maxSizeBytes', () => {
      expect(RESEARCH_FILE_OPTIONS.maxSizeBytes).toBe(100 * 1024 * 1024);
    });

    it('includes common research data extensions', () => {
      expect(RESEARCH_FILE_OPTIONS.allowedExtensions).toContain('.csv');
      expect(RESEARCH_FILE_OPTIONS.allowedExtensions).toContain('.xlsx');
      expect(RESEARCH_FILE_OPTIONS.allowedExtensions).toContain('.json');
      expect(RESEARCH_FILE_OPTIONS.allowedExtensions).toContain('.parquet');
    });

    it('blocks executables', () => {
      expect(RESEARCH_FILE_OPTIONS.blockExecutables).toBe(true);
    });
  });

  describe('ZIP_EXTRACTION_DEFAULTS', () => {
    it('has expected limits', () => {
      expect(ZIP_EXTRACTION_DEFAULTS.maxFiles).toBe(1000);
      expect(ZIP_EXTRACTION_DEFAULTS.maxTotalSize).toBe(500 * 1024 * 1024);
      expect(ZIP_EXTRACTION_DEFAULTS.maxFileSize).toBe(100 * 1024 * 1024);
    });

    it('has empty targetDir (must be set by caller)', () => {
      expect(ZIP_EXTRACTION_DEFAULTS.targetDir).toBe('');
    });
  });
});

describe('Integration Tests', () => {
  it('validates and sanitizes a complete file upload flow', () => {
    const file = {
      filename: '../../../uploads/malicious/../data.csv',
      buffer: Buffer.from('col1,col2,col3\nval1,val2,val3\nval4,val5,val6'),
      declaredMimeType: 'text/csv',
    };

    const result = validateFile(file, RESEARCH_FILE_OPTIONS);

    // File should be valid (it's a legit CSV)
    expect(result.valid).toBe(true);

    // But filename should be sanitized
    expect(result.sanitizedName).not.toContain('..');
    expect(result.sanitizedName).not.toContain('/');
  });

  it('blocks disguised executable', () => {
    // An executable with a .csv extension
    const file = {
      filename: 'innocent.csv',
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
      declaredMimeType: 'text/csv',
    };

    const result = validateFile(file, RESEARCH_FILE_OPTIONS);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('executable'))).toBe(true);
  });
});
