/**
 * Artifact Compression Service
 * Task: Compress artifacts for storage and transfer efficiency
 */

import zlib from 'zlib';
import { promisify } from 'util';
import { Readable, Transform } from 'stream';

// Promisified compression functions
const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);
const brotliCompressAsync = promisify(zlib.brotliCompress);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);
const deflateAsync = promisify(zlib.deflate);
const inflateAsync = promisify(zlib.inflate);

export type CompressionAlgorithm = 'gzip' | 'brotli' | 'deflate' | 'none';

export interface CompressionOptions {
  algorithm?: CompressionAlgorithm;
  level?: number; // 1-9 for gzip/deflate, 0-11 for brotli
  minSize?: number; // Minimum size in bytes to compress
}

export interface CompressionResult {
  data: Buffer;
  originalSize: number;
  compressedSize: number;
  algorithm: CompressionAlgorithm;
  compressionRatio: number;
  compressed: boolean;
}

export interface DecompressionResult {
  data: Buffer;
  compressedSize: number;
  decompressedSize: number;
  algorithm: CompressionAlgorithm;
}

/**
 * Artifact Compression Service
 * Provides compression and decompression for artifacts
 */
export class CompressionService {
  private static instance: CompressionService;
  private defaultAlgorithm: CompressionAlgorithm;
  private defaultLevel: number;
  private minCompressSize: number;

  private constructor() {
    this.defaultAlgorithm = (process.env.COMPRESSION_ALGORITHM as CompressionAlgorithm) || 'gzip';
    this.defaultLevel = parseInt(process.env.COMPRESSION_LEVEL || '6', 10);
    this.minCompressSize = parseInt(process.env.MIN_COMPRESS_SIZE || '1024', 10); // 1KB default
  }

  static getInstance(): CompressionService {
    if (!this.instance) {
      this.instance = new CompressionService();
    }
    return this.instance;
  }

  /**
   * Compress data
   */
  async compress(data: Buffer | string, options: CompressionOptions = {}): Promise<CompressionResult> {
    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const algorithm = options.algorithm || this.defaultAlgorithm;
    const level = options.level || this.defaultLevel;
    const minSize = options.minSize ?? this.minCompressSize;

    // Skip compression for small data
    if (inputBuffer.length < minSize) {
      return {
        data: inputBuffer,
        originalSize: inputBuffer.length,
        compressedSize: inputBuffer.length,
        algorithm: 'none',
        compressionRatio: 1,
        compressed: false
      };
    }

    let compressedBuffer: Buffer;

    switch (algorithm) {
      case 'gzip':
        compressedBuffer = await gzipAsync(inputBuffer, { level });
        break;

      case 'brotli':
        compressedBuffer = await brotliCompressAsync(inputBuffer, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(level, 11)
          }
        });
        break;

      case 'deflate':
        compressedBuffer = await deflateAsync(inputBuffer, { level });
        break;

      case 'none':
      default:
        return {
          data: inputBuffer,
          originalSize: inputBuffer.length,
          compressedSize: inputBuffer.length,
          algorithm: 'none',
          compressionRatio: 1,
          compressed: false
        };
    }

    const compressionRatio = compressedBuffer.length / inputBuffer.length;

    // If compression didn't help, return original
    if (compressionRatio >= 0.95) {
      return {
        data: inputBuffer,
        originalSize: inputBuffer.length,
        compressedSize: inputBuffer.length,
        algorithm: 'none',
        compressionRatio: 1,
        compressed: false
      };
    }

    return {
      data: compressedBuffer,
      originalSize: inputBuffer.length,
      compressedSize: compressedBuffer.length,
      algorithm,
      compressionRatio,
      compressed: true
    };
  }

  /**
   * Decompress data
   */
  async decompress(data: Buffer, algorithm: CompressionAlgorithm): Promise<DecompressionResult> {
    if (algorithm === 'none') {
      return {
        data,
        compressedSize: data.length,
        decompressedSize: data.length,
        algorithm: 'none'
      };
    }

    let decompressedBuffer: Buffer;

    switch (algorithm) {
      case 'gzip':
        decompressedBuffer = await gunzipAsync(data);
        break;

      case 'brotli':
        decompressedBuffer = await brotliDecompressAsync(data);
        break;

      case 'deflate':
        decompressedBuffer = await inflateAsync(data);
        break;

      default:
        throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }

    return {
      data: decompressedBuffer,
      compressedSize: data.length,
      decompressedSize: decompressedBuffer.length,
      algorithm
    };
  }

  /**
   * Auto-detect compression algorithm from data
   */
  detectAlgorithm(data: Buffer): CompressionAlgorithm {
    // Check magic bytes
    if (data.length < 2) return 'none';

    // Gzip magic number: 1f 8b
    if (data[0] === 0x1f && data[1] === 0x8b) {
      return 'gzip';
    }

    // Zlib/deflate magic: 78 (9c, 01, da, 5e)
    if (data[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(data[1])) {
      return 'deflate';
    }

    // Brotli doesn't have a standard magic number, check for CE/CF prefix
    // (this is heuristic and may not be reliable)

    return 'none';
  }

  /**
   * Decompress with auto-detection
   */
  async autoDecompress(data: Buffer): Promise<DecompressionResult> {
    const algorithm = this.detectAlgorithm(data);
    return this.decompress(data, algorithm);
  }

  /**
   * Create compression stream for streaming data
   */
  createCompressionStream(algorithm?: CompressionAlgorithm, level?: number): Transform {
    const algo = algorithm || this.defaultAlgorithm;
    const lvl = level || this.defaultLevel;

    switch (algo) {
      case 'gzip':
        return zlib.createGzip({ level: lvl });

      case 'brotli':
        return zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(lvl, 11)
          }
        });

      case 'deflate':
        return zlib.createDeflate({ level: lvl });

      default:
        // Pass-through transform for no compression
        return new Transform({
          transform(chunk, encoding, callback) {
            callback(null, chunk);
          }
        });
    }
  }

  /**
   * Create decompression stream for streaming data
   */
  createDecompressionStream(algorithm: CompressionAlgorithm): Transform {
    switch (algorithm) {
      case 'gzip':
        return zlib.createGunzip();

      case 'brotli':
        return zlib.createBrotliDecompress();

      case 'deflate':
        return zlib.createInflate();

      default:
        // Pass-through transform for no compression
        return new Transform({
          transform(chunk, encoding, callback) {
            callback(null, chunk);
          }
        });
    }
  }

  /**
   * Compress a stream
   */
  compressStream(input: Readable, options: CompressionOptions = {}): Readable {
    const compressionStream = this.createCompressionStream(
      options.algorithm,
      options.level
    );
    return input.pipe(compressionStream);
  }

  /**
   * Decompress a stream
   */
  decompressStream(input: Readable, algorithm: CompressionAlgorithm): Readable {
    const decompressionStream = this.createDecompressionStream(algorithm);
    return input.pipe(decompressionStream);
  }

  /**
   * Get optimal algorithm for content type
   */
  getOptimalAlgorithm(contentType: string, size: number): CompressionAlgorithm {
    // Skip compression for already compressed formats
    const skipCompression = [
      'application/zip',
      'application/gzip',
      'application/x-gzip',
      'application/x-bzip2',
      'application/x-7z-compressed',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/',
      'audio/'
    ];

    if (skipCompression.some(type => contentType.startsWith(type))) {
      return 'none';
    }

    // Use brotli for text-based content (better compression ratio)
    const textTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/x-javascript'
    ];

    if (textTypes.some(type => contentType.startsWith(type))) {
      return size > 10000 ? 'brotli' : 'gzip'; // Brotli for larger files
    }

    // Default to gzip for other types
    return 'gzip';
  }

  /**
   * Estimate compression ratio for content type
   */
  estimateCompressionRatio(contentType: string): number {
    const ratios: Record<string, number> = {
      'text/plain': 0.3,
      'text/html': 0.2,
      'text/css': 0.2,
      'text/javascript': 0.25,
      'application/json': 0.25,
      'application/xml': 0.2,
      'application/pdf': 0.95, // Already compressed
      'image/png': 0.98,
      'image/jpeg': 0.99
    };

    for (const [type, ratio] of Object.entries(ratios)) {
      if (contentType.startsWith(type)) {
        return ratio;
      }
    }

    return 0.7; // Default estimate
  }

  /**
   * Get content encoding header for algorithm
   */
  getContentEncoding(algorithm: CompressionAlgorithm): string | null {
    switch (algorithm) {
      case 'gzip':
        return 'gzip';
      case 'brotli':
        return 'br';
      case 'deflate':
        return 'deflate';
      default:
        return null;
    }
  }

  /**
   * Parse content encoding header to algorithm
   */
  parseContentEncoding(encoding: string): CompressionAlgorithm {
    const normalized = encoding.toLowerCase().trim();

    switch (normalized) {
      case 'gzip':
      case 'x-gzip':
        return 'gzip';
      case 'br':
        return 'brotli';
      case 'deflate':
        return 'deflate';
      default:
        return 'none';
    }
  }

  /**
   * Get compression statistics
   */
  calculateSavings(originalSize: number, compressedSize: number): {
    savedBytes: number;
    savedPercentage: number;
    ratio: number;
  } {
    const savedBytes = originalSize - compressedSize;
    const savedPercentage = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0;
    const ratio = originalSize > 0 ? compressedSize / originalSize : 1;

    return {
      savedBytes,
      savedPercentage: Math.round(savedPercentage * 100) / 100,
      ratio: Math.round(ratio * 1000) / 1000
    };
  }
}

export const compressionService = CompressionService.getInstance();
