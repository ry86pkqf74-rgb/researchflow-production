/**
 * Upload Service with S3 Presigned URLs
 *
 * Handles secure file uploads using presigned URLs:
 * - Generate upload URLs (PUT)
 * - Generate download URLs (GET)
 * - Support for multipart uploads
 * - Streaming upload support
 */

import crypto from 'crypto';
import { logger } from '../logger/file-logger.js';

// S3 client type (using AWS SDK v3 interface)
interface S3Client {
  send(command: any): Promise<any>;
}

interface UploadConfig {
  bucket: string;
  region: string;
  urlExpiration: number; // seconds
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
}

interface PendingUpload {
  artifactId: string;
  filename: string;
  contentType: string;
  size?: number;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'completed' | 'expired';
}

const defaultConfig: UploadConfig = {
  bucket: process.env.S3_BUCKET || 'researchflow-artifacts',
  region: process.env.AWS_REGION || 'us-east-1',
  urlExpiration: 3600, // 1 hour
  maxFileSize: 5 * 1024 * 1024 * 1024, // 5 GB
  allowedMimeTypes: [
    'application/json',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
    'application/parquet',
    'application/x-parquet',
    'image/png',
    'image/jpeg'
  ]
};

export class UploadService {
  private config: UploadConfig;
  private pendingUploads: Map<string, PendingUpload> = new Map();
  private s3Client?: S3Client;

  constructor(config?: Partial<UploadConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.initS3Client();
  }

  private async initS3Client(): Promise<void> {
    // Dynamically import AWS SDK to avoid issues if not installed
    try {
      const { S3Client: AWS_S3Client } = await import('@aws-sdk/client-s3');
      this.s3Client = new AWS_S3Client({ region: this.config.region });
    } catch (error) {
      logger.warn('AWS SDK not available, using mock S3 service');
    }
  }

  /**
   * Request a presigned URL for uploading a file
   */
  async requestUploadUrl(
    filename: string,
    contentType: string,
    userId: string = 'system'
  ): Promise<{
    uploadUrl: string;
    artifactId: string;
    expiresAt: Date;
    headers: Record<string, string>;
  }> {
    // Validate content type
    if (!this.config.allowedMimeTypes.includes(contentType)) {
      throw new Error(`Content type not allowed: ${contentType}`);
    }

    // Generate artifact ID
    const artifactId = this.generateArtifactId();
    const key = this.generateS3Key(artifactId, filename);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + this.config.urlExpiration * 1000);

    // Track pending upload
    this.pendingUploads.set(artifactId, {
      artifactId,
      filename,
      contentType,
      userId,
      createdAt: new Date(),
      expiresAt,
      status: 'pending'
    });

    // Generate presigned URL
    if (this.s3Client) {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: {
          'artifact-id': artifactId,
          'original-filename': encodeURIComponent(filename),
          'uploaded-by': userId
        }
      });

      const uploadUrl = await getSignedUrl(this.s3Client as any, command, {
        expiresIn: this.config.urlExpiration
      });

      return {
        uploadUrl,
        artifactId,
        expiresAt,
        headers: {
          'Content-Type': contentType
        }
      };
    } else {
      // Mock presigned URL for development
      return {
        uploadUrl: `http://localhost:9000/${this.config.bucket}/${key}?X-Amz-Algorithm=mock`,
        artifactId,
        expiresAt,
        headers: {
          'Content-Type': contentType
        }
      };
    }
  }

  /**
   * Confirm upload completion
   */
  async confirmUpload(artifactId: string): Promise<{
    id: string;
    status: string;
    filename: string;
    contentType: string;
    size?: number;
    url?: string;
  }> {
    const pending = this.pendingUploads.get(artifactId);

    if (!pending) {
      throw new Error(`Upload not found: ${artifactId}`);
    }

    if (pending.status !== 'pending') {
      throw new Error(`Upload already ${pending.status}`);
    }

    if (new Date() > pending.expiresAt) {
      pending.status = 'expired';
      throw new Error('Upload URL expired');
    }

    // Verify file exists in S3
    const key = this.generateS3Key(artifactId, pending.filename);
    let size: number | undefined;

    if (this.s3Client) {
      try {
        const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
        const result = await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.config.bucket,
            Key: key
          })
        );
        size = result.ContentLength;
      } catch (error) {
        throw new Error('File not found in storage. Upload may have failed.');
      }
    }

    // Update status
    pending.status = 'completed';
    pending.size = size;

    return {
      id: artifactId,
      status: 'completed',
      filename: pending.filename,
      contentType: pending.contentType,
      size,
      url: this.getStorageUrl(key)
    };
  }

  /**
   * Request a presigned URL for downloading a file
   */
  async requestDownloadUrl(
    artifactId: string,
    filename?: string
  ): Promise<{
    downloadUrl: string;
    expiresAt: Date;
  }> {
    const key = filename
      ? this.generateS3Key(artifactId, filename)
      : `artifacts/${artifactId}`;

    const expiresAt = new Date(Date.now() + this.config.urlExpiration * 1000);

    if (this.s3Client) {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      const downloadUrl = await getSignedUrl(this.s3Client as any, command, {
        expiresIn: this.config.urlExpiration
      });

      return { downloadUrl, expiresAt };
    } else {
      return {
        downloadUrl: `http://localhost:9000/${this.config.bucket}/${key}?X-Amz-Algorithm=mock`,
        expiresAt
      };
    }
  }

  /**
   * Initialize multipart upload for large files
   */
  async initMultipartUpload(
    filename: string,
    contentType: string,
    userId: string
  ): Promise<{
    uploadId: string;
    artifactId: string;
    key: string;
  }> {
    const artifactId = this.generateArtifactId();
    const key = this.generateS3Key(artifactId, filename);

    if (this.s3Client) {
      const { CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3');

      const result = await this.s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.config.bucket,
          Key: key,
          ContentType: contentType,
          Metadata: {
            'artifact-id': artifactId,
            'uploaded-by': userId
          }
        })
      );

      return {
        uploadId: result.UploadId!,
        artifactId,
        key
      };
    } else {
      return {
        uploadId: `mock-upload-${Date.now()}`,
        artifactId,
        key
      };
    }
  }

  /**
   * Get presigned URL for multipart upload part
   */
  async getPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<string> {
    if (this.s3Client) {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { UploadPartCommand } = await import('@aws-sdk/client-s3');

      const command = new UploadPartCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber
      });

      return getSignedUrl(this.s3Client as any, command, {
        expiresIn: this.config.urlExpiration
      });
    } else {
      return `http://localhost:9000/upload-part?uploadId=${uploadId}&partNumber=${partNumber}`;
    }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[]
  ): Promise<void> {
    if (this.s3Client) {
      const { CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3');

      await this.s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.config.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts }
        })
      );
    }
  }

  // Helper methods

  private generateArtifactId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `art_${timestamp}_${random}`;
  }

  private generateS3Key(artifactId: string, filename: string): string {
    const ext = filename.split('.').pop() || '';
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `artifacts/${artifactId}/${sanitizedFilename}`;
  }

  private getStorageUrl(key: string): string {
    return `s3://${this.config.bucket}/${key}`;
  }

  /**
   * Cleanup expired pending uploads
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, upload] of this.pendingUploads) {
      if (upload.status === 'pending' && now > upload.expiresAt) {
        upload.status = 'expired';
        this.pendingUploads.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export default UploadService;
