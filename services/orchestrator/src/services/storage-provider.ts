/**
 * Storage Provider Service
 *
 * Provides a unified interface for artifact storage with support for:
 * - Local filesystem (development/simple deployments)
 * - S3-compatible storage (AWS S3, MinIO)
 *
 * CRITICAL: Never store or log PHI in unencrypted form.
 * All sensitive data should be encrypted before storage.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Readable } from 'stream';

export type StorageBackend = 'local' | 's3';

export interface StorageConfig {
  backend: StorageBackend;
  // Local storage config
  localPath?: string;
  // S3 config
  s3Bucket?: string;
  s3Region?: string;
  s3Endpoint?: string;  // For MinIO or other S3-compatible storage
  s3ForcePathStyle?: boolean;  // Required for MinIO
  // Common config
  encryptionEnabled?: boolean;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  etag?: string;
}

export interface UploadResult {
  key: string;
  size: number;
  etag: string;
  location: string;
}

export interface SignedUrlOptions {
  expiresIn?: number;  // Seconds, default 3600
  contentType?: string;
  contentDisposition?: string;
}

// Default configuration from environment
function getDefaultConfig(): StorageConfig {
  const backend = (process.env.STORAGE_BACKEND as StorageBackend) || 'local';

  return {
    backend,
    localPath: process.env.ARTIFACT_PATH || '/data/artifacts',
    s3Bucket: process.env.AWS_S3_BUCKET,
    s3Region: process.env.AWS_REGION || 'us-east-1',
    s3Endpoint: process.env.S3_ENDPOINT,  // For MinIO
    s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    encryptionEnabled: process.env.STORAGE_ENCRYPTION !== 'false',
  };
}

// Singleton S3 client
let s3Client: S3Client | null = null;

function getS3Client(config: StorageConfig): S3Client {
  if (!s3Client) {
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: config.s3Region,
    };

    // Custom endpoint for MinIO
    if (config.s3Endpoint) {
      clientConfig.endpoint = config.s3Endpoint;
      clientConfig.forcePathStyle = config.s3ForcePathStyle ?? true;
    }

    s3Client = new S3Client(clientConfig);
  }

  return s3Client;
}

/**
 * Storage Provider Class
 */
export class StorageProvider {
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...getDefaultConfig(), ...config };
  }

  /**
   * Upload data to storage
   */
  async upload(key: string, data: Buffer | Readable | string, contentType?: string): Promise<UploadResult> {
    const normalizedKey = this.normalizeKey(key);

    if (this.config.backend === 's3') {
      return this.uploadToS3(normalizedKey, data, contentType);
    } else {
      return this.uploadToLocal(normalizedKey, data);
    }
  }

  /**
   * Download data from storage
   */
  async download(key: string): Promise<Buffer> {
    const normalizedKey = this.normalizeKey(key);

    if (this.config.backend === 's3') {
      return this.downloadFromS3(normalizedKey);
    } else {
      return this.downloadFromLocal(normalizedKey);
    }
  }

  /**
   * Get a readable stream for large files
   */
  async getStream(key: string): Promise<Readable> {
    const normalizedKey = this.normalizeKey(key);

    if (this.config.backend === 's3') {
      return this.getStreamFromS3(normalizedKey);
    } else {
      return this.getStreamFromLocal(normalizedKey);
    }
  }

  /**
   * Delete an object from storage
   */
  async delete(key: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    if (this.config.backend === 's3') {
      await this.deleteFromS3(normalizedKey);
    } else {
      await this.deleteFromLocal(normalizedKey);
    }
  }

  /**
   * Check if an object exists
   */
  async exists(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);

    if (this.config.backend === 's3') {
      return this.existsInS3(normalizedKey);
    } else {
      return this.existsInLocal(normalizedKey);
    }
  }

  /**
   * Get object metadata
   */
  async getMetadata(key: string): Promise<StorageObject | null> {
    const normalizedKey = this.normalizeKey(key);

    if (this.config.backend === 's3') {
      return this.getMetadataFromS3(normalizedKey);
    } else {
      return this.getMetadataFromLocal(normalizedKey);
    }
  }

  /**
   * List objects with a prefix
   */
  async list(prefix: string, maxKeys: number = 1000): Promise<StorageObject[]> {
    const normalizedPrefix = this.normalizeKey(prefix);

    if (this.config.backend === 's3') {
      return this.listFromS3(normalizedPrefix, maxKeys);
    } else {
      return this.listFromLocal(normalizedPrefix, maxKeys);
    }
  }

  /**
   * Generate a signed URL for direct download
   * Only supported for S3 backend
   */
  async getSignedDownloadUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    if (this.config.backend !== 's3') {
      throw new Error('Signed URLs are only supported with S3 backend');
    }

    const normalizedKey = this.normalizeKey(key);
    const client = getS3Client(this.config);

    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: normalizedKey,
      ResponseContentDisposition: options.contentDisposition,
      ResponseContentType: options.contentType,
    });

    return getSignedUrl(client, command, {
      expiresIn: options.expiresIn || 3600,
    });
  }

  /**
   * Generate a signed URL for direct upload
   * Only supported for S3 backend
   */
  async getSignedUploadUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    if (this.config.backend !== 's3') {
      throw new Error('Signed URLs are only supported with S3 backend');
    }

    const normalizedKey = this.normalizeKey(key);
    const client = getS3Client(this.config);

    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: normalizedKey,
      ContentType: options.contentType,
    });

    return getSignedUrl(client, command, {
      expiresIn: options.expiresIn || 3600,
    });
  }

  // Private methods - S3

  private async uploadToS3(key: string, data: Buffer | Readable | string, contentType?: string): Promise<UploadResult> {
    const client = getS3Client(this.config);
    const body = typeof data === 'string' ? Buffer.from(data) : data;

    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      ServerSideEncryption: this.config.encryptionEnabled ? 'AES256' : undefined,
    });

    const response = await client.send(command);
    const size = Buffer.isBuffer(body) ? body.length : 0;

    return {
      key,
      size,
      etag: response.ETag || '',
      location: `s3://${this.config.s3Bucket}/${key}`,
    };
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    const client = getS3Client(this.config);

    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  private async getStreamFromS3(key: string): Promise<Readable> {
    const client = getS3Client(this.config);

    const command = new GetObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    return response.Body as Readable;
  }

  private async deleteFromS3(key: string): Promise<void> {
    const client = getS3Client(this.config);

    const command = new DeleteObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
    });

    await client.send(command);
  }

  private async existsInS3(key: string): Promise<boolean> {
    const client = getS3Client(this.config);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
      });

      await client.send(command);
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  private async getMetadataFromS3(key: string): Promise<StorageObject | null> {
    const client = getS3Client(this.config);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
      });

      const response = await client.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
        etag: response.ETag,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  private async listFromS3(prefix: string, maxKeys: number): Promise<StorageObject[]> {
    const client = getS3Client(this.config);

    const command = new ListObjectsV2Command({
      Bucket: this.config.s3Bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await client.send(command);

    return (response.Contents || []).map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      etag: obj.ETag,
    }));
  }

  // Private methods - Local

  private async uploadToLocal(key: string, data: Buffer | Readable | string): Promise<UploadResult> {
    const filePath = path.join(this.config.localPath!, key);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    let buffer: Buffer;
    if (typeof data === 'string') {
      buffer = Buffer.from(data);
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      // Readable stream
      const chunks: Uint8Array[] = [];
      for await (const chunk of data) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    }

    await fs.writeFile(filePath, buffer);

    const etag = crypto.createHash('md5').update(buffer).digest('hex');

    return {
      key,
      size: buffer.length,
      etag,
      location: `file://${filePath}`,
    };
  }

  private async downloadFromLocal(key: string): Promise<Buffer> {
    const filePath = path.join(this.config.localPath!, key);
    return fs.readFile(filePath);
  }

  private async getStreamFromLocal(key: string): Promise<Readable> {
    const filePath = path.join(this.config.localPath!, key);
    const { createReadStream } = await import('fs');
    return createReadStream(filePath);
  }

  private async deleteFromLocal(key: string): Promise<void> {
    const filePath = path.join(this.config.localPath!, key);
    await fs.unlink(filePath);
  }

  private async existsInLocal(key: string): Promise<boolean> {
    const filePath = path.join(this.config.localPath!, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async getMetadataFromLocal(key: string): Promise<StorageObject | null> {
    const filePath = path.join(this.config.localPath!, key);
    try {
      const stats = await fs.stat(filePath);
      return {
        key,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  private async listFromLocal(prefix: string, maxKeys: number): Promise<StorageObject[]> {
    const dirPath = path.join(this.config.localPath!, prefix);
    const results: StorageObject[] = [];

    try {
      await this.listLocalRecursive(dirPath, prefix, results, maxKeys);
    } catch {
      // Directory doesn't exist
    }

    return results.slice(0, maxKeys);
  }

  private async listLocalRecursive(dirPath: string, prefix: string, results: StorageObject[], maxKeys: number): Promise<void> {
    if (results.length >= maxKeys) return;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxKeys) break;

      const entryPath = path.join(dirPath, entry.name);
      const key = path.join(prefix, entry.name);

      if (entry.isDirectory()) {
        await this.listLocalRecursive(entryPath, key, results, maxKeys);
      } else {
        const stats = await fs.stat(entryPath);
        results.push({
          key,
          size: stats.size,
          lastModified: stats.mtime,
        });
      }
    }
  }

  // Helper methods

  private normalizeKey(key: string): string {
    // Remove leading slashes and normalize path
    return key.replace(/^\/+/, '').replace(/\/+/g, '/');
  }
}

// Default singleton instance
let defaultProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!defaultProvider) {
    defaultProvider = new StorageProvider();
  }
  return defaultProvider;
}
