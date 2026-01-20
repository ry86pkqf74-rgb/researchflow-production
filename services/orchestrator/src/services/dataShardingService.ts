/**
 * Data Sharding Service
 *
 * Phase G - Task 123: Data Sharding for Large Artifacts
 *
 * Implements sharding for large artifacts:
 * - Splits large files/data into configurable chunks
 * - Maintains manifest for shard metadata
 * - Supports reassembly and streaming retrieval
 * - Optionally integrates with cloud storage (S3, GCS)
 */

import { z } from 'zod';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

// ============================================================================
// Types & Schemas
// ============================================================================

export const ShardMetadataSchema = z.object({
  shardId: z.string().uuid(),
  index: z.number().int().min(0),
  size: z.number().int(),
  checksum: z.string(),
  path: z.string(),
  createdAt: z.string().datetime(),
});

export const ArtifactManifestSchema = z.object({
  artifactId: z.string().uuid(),
  originalName: z.string(),
  originalSize: z.number().int(),
  mimeType: z.string().optional(),
  shardSize: z.number().int(),
  totalShards: z.number().int(),
  shards: z.array(ShardMetadataSchema),
  checksum: z.string(),
  storageBackend: z.enum(['local', 's3', 'gcs', 'azure']),
  createdAt: z.string().datetime(),
  createdBy: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ShardingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  shardSizeBytes: z.number().int().default(50 * 1024 * 1024), // 50MB default
  minSizeForSharding: z.number().int().default(100 * 1024 * 1024), // 100MB threshold
  storageBackend: z.enum(['local', 's3', 'gcs', 'azure']).default('local'),
  compressionEnabled: z.boolean().default(false),
  encryptionEnabled: z.boolean().default(false),
});

export const ShardUploadResultSchema = z.object({
  success: z.boolean(),
  artifactId: z.string().uuid(),
  manifest: ArtifactManifestSchema.optional(),
  sharded: z.boolean(),
  error: z.string().optional(),
});

export type ShardMetadata = z.infer<typeof ShardMetadataSchema>;
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;
export type ShardingConfig = z.infer<typeof ShardingConfigSchema>;
export type ShardUploadResult = z.infer<typeof ShardUploadResultSchema>;

// ============================================================================
// Data Sharding Service
// ============================================================================

class DataShardingService {
  private config: ShardingConfig;
  private baseStoragePath: string;
  private manifests: Map<string, ArtifactManifest> = new Map();

  constructor() {
    this.config = {
      enabled: process.env.SHARDING_ENABLED !== 'false',
      shardSizeBytes: parseInt(process.env.SHARD_SIZE_BYTES || '52428800', 10), // 50MB
      minSizeForSharding: parseInt(process.env.SHARDING_THRESHOLD_BYTES || '104857600', 10), // 100MB
      storageBackend: (process.env.STORAGE_BACKEND as ShardingConfig['storageBackend']) || 'local',
      compressionEnabled: process.env.SHARD_COMPRESSION === 'true',
      encryptionEnabled: process.env.SHARD_ENCRYPTION === 'true',
    };

    this.baseStoragePath = process.env.ARTIFACT_PATH || '/tmp/researchflow/artifacts';
  }

  /**
   * Check if sharding should be applied to data of given size
   */
  shouldShard(dataSize: number): boolean {
    return this.config.enabled && dataSize >= this.config.minSizeForSharding;
  }

  /**
   * Shard data into chunks
   */
  async shardData(
    data: Buffer | string,
    artifactId: string,
    options?: {
      originalName?: string;
      mimeType?: string;
      createdBy?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ShardUploadResult> {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    const dataSize = buffer.length;

    // Check if sharding is needed
    if (!this.shouldShard(dataSize)) {
      // Store as single file
      return this.storeSingleArtifact(buffer, artifactId, options);
    }

    try {
      const shards: ShardMetadata[] = [];
      const shardSize = this.config.shardSizeBytes;
      const totalShards = Math.ceil(dataSize / shardSize);

      // Create storage directory
      const artifactDir = path.join(this.baseStoragePath, artifactId);
      await fs.mkdir(artifactDir, { recursive: true });

      // Calculate overall checksum
      const overallChecksum = this.calculateChecksum(buffer);

      // Create shards
      for (let i = 0; i < totalShards; i++) {
        const start = i * shardSize;
        const end = Math.min(start + shardSize, dataSize);
        const shardBuffer = buffer.subarray(start, end);

        const shardId = crypto.randomUUID();
        const shardPath = path.join(artifactDir, `shard_${i.toString().padStart(4, '0')}`);

        // Calculate shard checksum
        const shardChecksum = this.calculateChecksum(shardBuffer);

        // Write shard
        await this.writeShardToStorage(shardPath, shardBuffer);

        shards.push({
          shardId,
          index: i,
          size: shardBuffer.length,
          checksum: shardChecksum,
          path: shardPath,
          createdAt: new Date().toISOString(),
        });
      }

      // Create manifest
      const manifest: ArtifactManifest = {
        artifactId,
        originalName: options?.originalName || `artifact_${artifactId}`,
        originalSize: dataSize,
        mimeType: options?.mimeType,
        shardSize,
        totalShards,
        shards,
        checksum: overallChecksum,
        storageBackend: this.config.storageBackend,
        createdAt: new Date().toISOString(),
        createdBy: options?.createdBy,
        metadata: options?.metadata,
      };

      // Store manifest
      await this.saveManifest(manifest);
      this.manifests.set(artifactId, manifest);

      return {
        success: true,
        artifactId,
        manifest,
        sharded: true,
      };
    } catch (error) {
      return {
        success: false,
        artifactId,
        sharded: false,
        error: error instanceof Error ? error.message : 'Unknown error during sharding',
      };
    }
  }

  /**
   * Store as single artifact (no sharding)
   */
  private async storeSingleArtifact(
    buffer: Buffer,
    artifactId: string,
    options?: {
      originalName?: string;
      mimeType?: string;
      createdBy?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ShardUploadResult> {
    try {
      const artifactDir = path.join(this.baseStoragePath, artifactId);
      await fs.mkdir(artifactDir, { recursive: true });

      const filePath = path.join(artifactDir, 'data');
      await this.writeShardToStorage(filePath, buffer);

      const checksum = this.calculateChecksum(buffer);
      const shardId = crypto.randomUUID();

      const manifest: ArtifactManifest = {
        artifactId,
        originalName: options?.originalName || `artifact_${artifactId}`,
        originalSize: buffer.length,
        mimeType: options?.mimeType,
        shardSize: buffer.length,
        totalShards: 1,
        shards: [{
          shardId,
          index: 0,
          size: buffer.length,
          checksum,
          path: filePath,
          createdAt: new Date().toISOString(),
        }],
        checksum,
        storageBackend: this.config.storageBackend,
        createdAt: new Date().toISOString(),
        createdBy: options?.createdBy,
        metadata: options?.metadata,
      };

      await this.saveManifest(manifest);
      this.manifests.set(artifactId, manifest);

      return {
        success: true,
        artifactId,
        manifest,
        sharded: false,
      };
    } catch (error) {
      return {
        success: false,
        artifactId,
        sharded: false,
        error: error instanceof Error ? error.message : 'Unknown error storing artifact',
      };
    }
  }

  /**
   * Write shard to storage backend
   */
  private async writeShardToStorage(path: string, data: Buffer): Promise<void> {
    switch (this.config.storageBackend) {
      case 'local':
        await fs.writeFile(path, data);
        break;
      case 's3':
        // In production: await s3Client.putObject({ Bucket, Key: path, Body: data })
        await fs.writeFile(path, data); // Fallback to local
        break;
      case 'gcs':
        // In production: await gcsClient.bucket(bucket).file(path).save(data)
        await fs.writeFile(path, data);
        break;
      case 'azure':
        // In production: await blobClient.upload(data)
        await fs.writeFile(path, data);
        break;
    }
  }

  /**
   * Read shard from storage backend
   */
  private async readShardFromStorage(shardPath: string): Promise<Buffer> {
    switch (this.config.storageBackend) {
      case 'local':
        return fs.readFile(shardPath);
      case 's3':
      case 'gcs':
      case 'azure':
        // In production, use appropriate SDK
        return fs.readFile(shardPath);
    }
  }

  /**
   * Reassemble artifact from shards
   */
  async reassembleArtifact(artifactId: string): Promise<Buffer | null> {
    const manifest = await this.getManifest(artifactId);
    if (!manifest) {
      return null;
    }

    // Sort shards by index
    const sortedShards = [...manifest.shards].sort((a, b) => a.index - b.index);

    // Read and concatenate all shards
    const chunks: Buffer[] = [];
    for (const shard of sortedShards) {
      const data = await this.readShardFromStorage(shard.path);

      // Verify checksum
      const actualChecksum = this.calculateChecksum(data);
      if (actualChecksum !== shard.checksum) {
        throw new Error(`Checksum mismatch for shard ${shard.index}`);
      }

      chunks.push(data);
    }

    const reassembled = Buffer.concat(chunks);

    // Verify overall checksum
    const actualChecksum = this.calculateChecksum(reassembled);
    if (actualChecksum !== manifest.checksum) {
      throw new Error('Reassembled artifact checksum mismatch');
    }

    return reassembled;
  }

  /**
   * Stream shards for large artifact download
   */
  async *streamShards(artifactId: string): AsyncGenerator<{ index: number; data: Buffer; total: number }> {
    const manifest = await this.getManifest(artifactId);
    if (!manifest) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const sortedShards = [...manifest.shards].sort((a, b) => a.index - b.index);

    for (const shard of sortedShards) {
      const data = await this.readShardFromStorage(shard.path);
      yield {
        index: shard.index,
        data,
        total: manifest.totalShards,
      };
    }
  }

  /**
   * Get artifact manifest
   */
  async getManifest(artifactId: string): Promise<ArtifactManifest | null> {
    // Check cache first
    if (this.manifests.has(artifactId)) {
      return this.manifests.get(artifactId)!;
    }

    // Try to load from disk
    const manifestPath = path.join(this.baseStoragePath, artifactId, 'manifest.json');
    try {
      const data = await fs.readFile(manifestPath, 'utf-8');
      const manifest = ArtifactManifestSchema.parse(JSON.parse(data));
      this.manifests.set(artifactId, manifest);
      return manifest;
    } catch {
      return null;
    }
  }

  /**
   * Save manifest to storage
   */
  private async saveManifest(manifest: ArtifactManifest): Promise<void> {
    const manifestPath = path.join(this.baseStoragePath, manifest.artifactId, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Delete artifact and all shards
   */
  async deleteArtifact(artifactId: string): Promise<boolean> {
    const manifest = await this.getManifest(artifactId);
    if (!manifest) {
      return false;
    }

    try {
      // Delete all shards
      for (const shard of manifest.shards) {
        try {
          await fs.unlink(shard.path);
        } catch {
          // Ignore individual shard deletion errors
        }
      }

      // Delete manifest
      const manifestPath = path.join(this.baseStoragePath, artifactId, 'manifest.json');
      await fs.unlink(manifestPath);

      // Delete directory
      const artifactDir = path.join(this.baseStoragePath, artifactId);
      await fs.rmdir(artifactDir);

      // Remove from cache
      this.manifests.delete(artifactId);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate SHA-256 checksum
   */
  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get current configuration
   */
  getConfig(): ShardingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ShardingConfig>): ShardingConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  /**
   * Get sharding statistics
   */
  getStats(): {
    totalArtifacts: number;
    totalShards: number;
    totalSizeBytes: number;
    averageShardsPerArtifact: number;
  } {
    let totalShards = 0;
    let totalSize = 0;

    for (const manifest of this.manifests.values()) {
      totalShards += manifest.totalShards;
      totalSize += manifest.originalSize;
    }

    const totalArtifacts = this.manifests.size;

    return {
      totalArtifacts,
      totalShards,
      totalSizeBytes: totalSize,
      averageShardsPerArtifact: totalArtifacts > 0 ? totalShards / totalArtifacts : 0,
    };
  }
}

// Export singleton instance
export const dataShardingService = new DataShardingService();

export default dataShardingService;
