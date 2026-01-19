/**
 * S3 Backup Service - Task 154
 *
 * Backup database dumps, artifacts, manifests, and logs to S3.
 * Supports scheduled and on-demand backups.
 */

import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { createReadStream, createWriteStream, statSync } from 'fs';
import { unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
// @ts-ignore - @aws-sdk/lib-storage is an optional dependency
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from '../logger/file-logger.js';

/**
 * Backup configuration
 */
export interface BackupConfig {
  /** S3 bucket for backups */
  bucket: string;
  /** Prefix for backup keys */
  prefix?: string;
  /** Retention period in days */
  retentionDays?: number;
  /** Database connection string */
  databaseUrl?: string;
  /** Local artifacts directory */
  artifactsDir?: string;
  /** Local logs directory */
  logsDir?: string;
}

/**
 * Backup result
 */
export interface BackupResult {
  id: string;
  type: 'database' | 'artifacts' | 'logs' | 'manifests';
  key: string;
  size: number;
  compressed: boolean;
  createdAt: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Get S3 client
 */
function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });
}

/**
 * Get default backup configuration
 */
function getDefaultConfig(): BackupConfig {
  return {
    bucket: process.env.S3_BACKUP_BUCKET ?? process.env.S3_BUCKET ?? 'researchflow-backups',
    prefix: 'backups',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10),
    databaseUrl: process.env.DATABASE_URL,
    artifactsDir: process.env.ARTIFACTS_DIR ?? './data/artifacts',
    logsDir: process.env.LOGS_DIR ?? './data/logs',
  };
}

/**
 * Generate backup key with timestamp
 */
function generateBackupKey(
  type: string,
  prefix: string,
  extension: string
): string {
  const now = new Date();
  const datePath = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `${prefix}/${type}/${datePath}/${timestamp}.${extension}`;
}

/**
 * Backup PostgreSQL database using pg_dump
 */
export async function backupDatabase(
  config: Partial<BackupConfig> = {}
): Promise<BackupResult> {
  const cfg = { ...getDefaultConfig(), ...config };
  const startTime = Date.now();
  const backupId = randomUUID();

  if (!cfg.databaseUrl) {
    return {
      id: backupId,
      type: 'database',
      key: '',
      size: 0,
      compressed: false,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      success: false,
      error: 'DATABASE_URL not configured',
    };
  }

  const tmpFile = join(tmpdir(), `db-backup-${backupId}.sql.gz`);
  const key = generateBackupKey('database', cfg.prefix ?? 'backups', 'sql.gz');

  try {
    // Run pg_dump and compress
    await new Promise<void>((resolve, reject) => {
      const pgDump = spawn('pg_dump', [cfg.databaseUrl!, '--no-owner', '--no-acl'], {
        env: { ...process.env },
      });

      const gzip = createGzip();
      const output = createWriteStream(tmpFile);

      pgDump.stdout.pipe(gzip).pipe(output);

      pgDump.stderr.on('data', (data) => {
        logger.error(`[Backup] pg_dump stderr: ${data}`);
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });

      pgDump.on('error', reject);
    });

    // Get file size
    const stats = statSync(tmpFile);

    // Upload to S3
    const s3 = getS3Client();
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: cfg.bucket,
        Key: key,
        Body: createReadStream(tmpFile),
        ContentType: 'application/gzip',
        Metadata: {
          'backup-type': 'database',
          'backup-id': backupId,
          'created-at': new Date().toISOString(),
        },
      },
    });

    await upload.done();

    // Cleanup temp file
    await unlink(tmpFile);

    logger.info(`[Backup] Database backup completed: ${key} (${stats.size} bytes)`);

    return {
      id: backupId,
      type: 'database',
      key,
      size: stats.size,
      compressed: true,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    // Cleanup temp file on error
    try {
      await unlink(tmpFile);
    } catch {}

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Backup] Database backup failed: ${errorMessage}`);

    return {
      id: backupId,
      type: 'database',
      key,
      size: 0,
      compressed: true,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Backup artifacts directory
 */
export async function backupArtifacts(
  config: Partial<BackupConfig> = {}
): Promise<BackupResult> {
  const cfg = { ...getDefaultConfig(), ...config };
  const startTime = Date.now();
  const backupId = randomUUID();
  const key = generateBackupKey('artifacts', cfg.prefix ?? 'backups', 'tar.gz');
  const tmpFile = join(tmpdir(), `artifacts-backup-${backupId}.tar.gz`);

  try {
    // Create tarball
    await new Promise<void>((resolve, reject) => {
      const tar = spawn('tar', ['-czf', tmpFile, '-C', cfg.artifactsDir!, '.']);

      tar.stderr.on('data', (data) => {
        logger.error(`[Backup] tar stderr: ${data}`);
      });

      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar exited with code ${code}`));
        }
      });

      tar.on('error', reject);
    });

    const stats = statSync(tmpFile);

    // Upload to S3
    const s3 = getS3Client();
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: cfg.bucket,
        Key: key,
        Body: createReadStream(tmpFile),
        ContentType: 'application/gzip',
        Metadata: {
          'backup-type': 'artifacts',
          'backup-id': backupId,
          'created-at': new Date().toISOString(),
        },
      },
    });

    await upload.done();
    await unlink(tmpFile);

    logger.info(`[Backup] Artifacts backup completed: ${key} (${stats.size} bytes)`);

    return {
      id: backupId,
      type: 'artifacts',
      key,
      size: stats.size,
      compressed: true,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    try {
      await unlink(tmpFile);
    } catch {}

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Backup] Artifacts backup failed: ${errorMessage}`);

    return {
      id: backupId,
      type: 'artifacts',
      key,
      size: 0,
      compressed: true,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Backup logs directory
 */
export async function backupLogs(
  config: Partial<BackupConfig> = {}
): Promise<BackupResult> {
  const cfg = { ...getDefaultConfig(), ...config };
  const startTime = Date.now();
  const backupId = randomUUID();
  const key = generateBackupKey('logs', cfg.prefix ?? 'backups', 'tar.gz');
  const tmpFile = join(tmpdir(), `logs-backup-${backupId}.tar.gz`);

  try {
    await new Promise<void>((resolve, reject) => {
      const tar = spawn('tar', ['-czf', tmpFile, '-C', cfg.logsDir!, '.']);

      tar.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar exited with code ${code}`));
      });

      tar.on('error', reject);
    });

    const stats = statSync(tmpFile);

    const s3 = getS3Client();
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: cfg.bucket,
        Key: key,
        Body: createReadStream(tmpFile),
        ContentType: 'application/gzip',
        Metadata: {
          'backup-type': 'logs',
          'backup-id': backupId,
          'created-at': new Date().toISOString(),
        },
      },
    });

    await upload.done();
    await unlink(tmpFile);

    logger.info(`[Backup] Logs backup completed: ${key} (${stats.size} bytes)`);

    return {
      id: backupId,
      type: 'logs',
      key,
      size: stats.size,
      compressed: true,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    try {
      await unlink(tmpFile);
    } catch {}

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      id: backupId,
      type: 'logs',
      key,
      size: 0,
      compressed: true,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Run all backups
 */
export async function runFullBackup(
  config: Partial<BackupConfig> = {}
): Promise<BackupResult[]> {
  logger.info('[Backup] Starting full backup...');

  const results: BackupResult[] = [];

  // Run backups in parallel
  const [dbResult, artifactsResult, logsResult] = await Promise.all([
    backupDatabase(config),
    backupArtifacts(config),
    backupLogs(config),
  ]);

  results.push(dbResult, artifactsResult, logsResult);

  const successful = results.filter(r => r.success).length;
  logger.info(`[Backup] Full backup completed: ${successful}/${results.length} successful`);

  return results;
}

/**
 * List backups
 */
export async function listBackups(
  config: Partial<BackupConfig> = {},
  type?: 'database' | 'artifacts' | 'logs' | 'manifests'
): Promise<Array<{
  key: string;
  size: number;
  lastModified: Date;
  type: string;
}>> {
  const cfg = { ...getDefaultConfig(), ...config };
  const s3 = getS3Client();

  const prefix = type
    ? `${cfg.prefix}/${type}/`
    : `${cfg.prefix}/`;

  const command = new ListObjectsV2Command({
    Bucket: cfg.bucket,
    Prefix: prefix,
  });

  const response = await s3.send(command);

  return (response.Contents ?? []).map(obj => ({
    key: obj.Key!,
    size: obj.Size!,
    lastModified: obj.LastModified!,
    type: obj.Key!.split('/')[1] ?? 'unknown',
  }));
}

/**
 * Clean up old backups based on retention policy
 */
export async function cleanupOldBackups(
  config: Partial<BackupConfig> = {}
): Promise<number> {
  const cfg = { ...getDefaultConfig(), ...config };
  const s3 = getS3Client();
  const retentionMs = (cfg.retentionDays ?? 30) * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - retentionMs);

  const backups = await listBackups(config);
  const toDelete = backups.filter(b => b.lastModified < cutoffDate);

  if (toDelete.length === 0) {
    logger.info('[Backup] No old backups to clean up');
    return 0;
  }

  // Delete in batches of 1000 (S3 limit)
  const batchSize = 1000;
  let deletedCount = 0;

  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);

    const command = new DeleteObjectsCommand({
      Bucket: cfg.bucket,
      Delete: {
        Objects: batch.map(b => ({ Key: b.key })),
      },
    });

    const response = await s3.send(command);
    deletedCount += response.Deleted?.length ?? 0;
  }

  logger.info(`[Backup] Cleaned up ${deletedCount} old backups`);
  return deletedCount;
}

export default {
  backupDatabase,
  backupArtifacts,
  backupLogs,
  runFullBackup,
  listBackups,
  cleanupOldBackups,
};
