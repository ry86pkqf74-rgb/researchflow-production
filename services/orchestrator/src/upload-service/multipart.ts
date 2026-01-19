/**
 * Resumable Multipart Uploads - Task 157
 *
 * S3-compatible multipart upload with presigned URLs for direct browser uploads.
 * Supports resume on failure.
 */

import { randomUUID } from 'crypto';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../logger/file-logger.js';

// Minimum part size (5MB) per S3 requirements
const MIN_PART_SIZE = 5 * 1024 * 1024;
// Maximum part size (100MB) for practical uploads
const MAX_PART_SIZE = 100 * 1024 * 1024;
// Default part size (10MB)
const DEFAULT_PART_SIZE = 10 * 1024 * 1024;
// Maximum number of parts
const MAX_PARTS = 10000;
// Presigned URL expiration (1 hour)
const PRESIGN_EXPIRATION = 3600;

/**
 * Upload session stored in database
 */
export interface UploadSession {
  id: string;
  userId: string;
  bucket: string;
  key: string;
  uploadId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  partSize: number;
  totalParts: number;
  completedParts: number[];
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'aborted';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  metadata?: Record<string, string>;
}

/**
 * Part upload info
 */
export interface PartUploadInfo {
  partNumber: number;
  presignedUrl: string;
  startByte: number;
  endByte: number;
  size: number;
}

/**
 * Completed part info
 */
export interface CompletedPart {
  partNumber: number;
  etag: string;
  size: number;
}

/**
 * Get S3 client (configured from environment)
 */
function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // For MinIO
  });
}

/**
 * Get configured S3 bucket
 */
function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }
  return bucket;
}

/**
 * Calculate optimal part size
 */
function calculatePartSize(totalSize: number): number {
  // Start with default
  let partSize = DEFAULT_PART_SIZE;

  // Calculate minimum needed to stay under MAX_PARTS
  const minPartSize = Math.ceil(totalSize / MAX_PARTS);
  if (minPartSize > partSize) {
    partSize = Math.min(minPartSize, MAX_PART_SIZE);
  }

  // Ensure at least MIN_PART_SIZE
  return Math.max(partSize, MIN_PART_SIZE);
}

/**
 * Start a new multipart upload session
 */
export async function startMultipartUpload(params: {
  userId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  metadata?: Record<string, string>;
}): Promise<UploadSession> {
  const s3 = getS3Client();
  const bucket = getBucket();

  // Generate unique key
  const key = `uploads/${params.userId}/${randomUUID()}/${params.filename}`;

  // Calculate part size
  const partSize = calculatePartSize(params.totalSize);
  const totalParts = Math.ceil(params.totalSize / partSize);

  if (totalParts > MAX_PARTS) {
    throw new Error(
      `File too large: would require ${totalParts} parts (max ${MAX_PARTS})`
    );
  }

  // Create multipart upload in S3
  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.mimeType,
    Metadata: params.metadata,
  });

  const response = await s3.send(command);

  if (!response.UploadId) {
    throw new Error('Failed to create multipart upload');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const session: UploadSession = {
    id: randomUUID(),
    userId: params.userId,
    bucket,
    key,
    uploadId: response.UploadId,
    filename: params.filename,
    mimeType: params.mimeType,
    totalSize: params.totalSize,
    partSize,
    totalParts,
    completedParts: [],
    status: 'pending',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadata: params.metadata,
  };

  // TODO: Store session in database
  logger.info(`[Upload] Created multipart upload session ${session.id}`);

  return session;
}

/**
 * Get presigned URLs for uploading parts
 */
export async function getPartUploadUrls(
  session: UploadSession,
  partNumbers?: number[]
): Promise<PartUploadInfo[]> {
  const s3 = getS3Client();

  // Default to all incomplete parts
  const partsToUpload = partNumbers ?? Array.from(
    { length: session.totalParts },
    (_, i) => i + 1
  ).filter(n => !session.completedParts.includes(n));

  const parts: PartUploadInfo[] = [];

  for (const partNumber of partsToUpload) {
    const startByte = (partNumber - 1) * session.partSize;
    const endByte = Math.min(startByte + session.partSize, session.totalSize);
    const size = endByte - startByte;

    // Create presigned URL for this part
    const command = new UploadPartCommand({
      Bucket: session.bucket,
      Key: session.key,
      UploadId: session.uploadId,
      PartNumber: partNumber,
      ContentLength: size,
    });

    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGN_EXPIRATION,
    });

    parts.push({
      partNumber,
      presignedUrl,
      startByte,
      endByte,
      size,
    });
  }

  return parts;
}

/**
 * Mark a part as completed
 */
export async function markPartCompleted(
  session: UploadSession,
  part: CompletedPart
): Promise<UploadSession> {
  if (!session.completedParts.includes(part.partNumber)) {
    session.completedParts.push(part.partNumber);
    session.completedParts.sort((a, b) => a - b);
  }

  session.status = 'uploading';
  session.updatedAt = new Date().toISOString();

  // TODO: Update session in database
  logger.info(
    `[Upload] Part ${part.partNumber}/${session.totalParts} completed for session ${session.id}`
  );

  return session;
}

/**
 * List already uploaded parts (for resume)
 */
export async function listUploadedParts(
  session: UploadSession
): Promise<CompletedPart[]> {
  const s3 = getS3Client();

  const command = new ListPartsCommand({
    Bucket: session.bucket,
    Key: session.key,
    UploadId: session.uploadId,
  });

  const response = await s3.send(command);

  return (response.Parts ?? []).map(part => ({
    partNumber: part.PartNumber!,
    etag: part.ETag!,
    size: part.Size!,
  }));
}

/**
 * Complete the multipart upload
 */
export async function completeMultipartUpload(
  session: UploadSession,
  completedParts: CompletedPart[]
): Promise<{
  location: string;
  key: string;
  etag: string;
}> {
  const s3 = getS3Client();

  // Sort parts by part number
  const sortedParts = [...completedParts].sort(
    (a, b) => a.partNumber - b.partNumber
  );

  const command = new CompleteMultipartUploadCommand({
    Bucket: session.bucket,
    Key: session.key,
    UploadId: session.uploadId,
    MultipartUpload: {
      Parts: sortedParts.map(part => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      })),
    },
  });

  const response = await s3.send(command);

  session.status = 'completed';
  session.updatedAt = new Date().toISOString();

  // TODO: Update session in database
  logger.info(`[Upload] Multipart upload ${session.id} completed`);

  return {
    location: response.Location ?? `s3://${session.bucket}/${session.key}`,
    key: session.key,
    etag: response.ETag ?? '',
  };
}

/**
 * Abort a multipart upload
 */
export async function abortMultipartUpload(
  session: UploadSession
): Promise<void> {
  const s3 = getS3Client();

  const command = new AbortMultipartUploadCommand({
    Bucket: session.bucket,
    Key: session.key,
    UploadId: session.uploadId,
  });

  await s3.send(command);

  session.status = 'aborted';
  session.updatedAt = new Date().toISOString();

  // TODO: Update session in database
  logger.info(`[Upload] Multipart upload ${session.id} aborted`);
}

/**
 * Get presigned URL for downloading a completed file
 */
export async function getDownloadUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const s3 = getS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Calculate upload progress
 */
export function calculateProgress(session: UploadSession): {
  completedParts: number;
  totalParts: number;
  completedBytes: number;
  totalBytes: number;
  percentComplete: number;
} {
  const completedParts = session.completedParts.length;
  const completedBytes = session.completedParts.reduce((sum, partNumber) => {
    const startByte = (partNumber - 1) * session.partSize;
    const endByte = Math.min(startByte + session.partSize, session.totalSize);
    return sum + (endByte - startByte);
  }, 0);

  return {
    completedParts,
    totalParts: session.totalParts,
    completedBytes,
    totalBytes: session.totalSize,
    percentComplete: Math.round((completedBytes / session.totalSize) * 100),
  };
}

export default {
  startMultipartUpload,
  getPartUploadUrls,
  markPartCompleted,
  listUploadedParts,
  completeMultipartUpload,
  abortMultipartUpload,
  getDownloadUrl,
  calculateProgress,
};
