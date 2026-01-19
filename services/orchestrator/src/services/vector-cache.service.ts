/**
 * Redis Vector Caching Service
 * Task: Cache vector embeddings for faster similarity search
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import { logger } from '../logger/file-logger.js';

export interface VectorCacheEntry {
  vector: number[];
  metadata?: Record<string, any>;
  createdAt: string;
  ttl?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorCacheConfig {
  redisUrl?: string;
  prefix?: string;
  defaultTtl?: number;
  maxCacheSize?: number;
}

/**
 * Redis Vector Cache Service
 * Provides fast vector embedding caching and approximate similarity search
 */
export class VectorCacheService {
  private static instance: VectorCacheService;
  private redis: Redis;
  private prefix: string;
  private defaultTtl: number;
  private maxCacheSize: number;

  private constructor(config: VectorCacheConfig = {}) {
    this.redis = new Redis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.prefix = config.prefix || 'vector:';
    this.defaultTtl = config.defaultTtl || 3600; // 1 hour default
    this.maxCacheSize = config.maxCacheSize || 100000;

    // Handle Redis errors
    this.redis.on('error', (err) => {
      logger.error('Vector cache Redis error:', err);
    });
  }

  static getInstance(config?: VectorCacheConfig): VectorCacheService {
    if (!this.instance) {
      this.instance = new VectorCacheService(config);
    }
    return this.instance;
  }

  /**
   * Generate cache key for a vector based on content hash
   */
  private generateKey(content: string, namespace?: string): string {
    const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    return namespace ? `${this.prefix}${namespace}:${hash}` : `${this.prefix}${hash}`;
  }

  /**
   * Cache a vector embedding
   */
  async cacheVector(
    id: string,
    vector: number[],
    metadata?: Record<string, any>,
    ttl?: number
  ): Promise<void> {
    const key = `${this.prefix}${id}`;
    const entry: VectorCacheEntry = {
      vector,
      metadata,
      createdAt: new Date().toISOString(),
      ttl: ttl || this.defaultTtl
    };

    await this.redis.setex(
      key,
      ttl || this.defaultTtl,
      JSON.stringify(entry)
    );

    // Add to index for similarity search
    await this.addToIndex(id, vector);
  }

  /**
   * Get cached vector by ID
   */
  async getVector(id: string): Promise<VectorCacheEntry | null> {
    const key = `${this.prefix}${id}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as VectorCacheEntry;
    } catch {
      return null;
    }
  }

  /**
   * Cache vector for content (auto-generates key from content hash)
   */
  async cacheContentVector(
    content: string,
    vector: number[],
    namespace?: string,
    metadata?: Record<string, any>,
    ttl?: number
  ): Promise<string> {
    const key = this.generateKey(content, namespace);
    const id = key.replace(this.prefix, '');

    await this.cacheVector(id, vector, metadata, ttl);
    return id;
  }

  /**
   * Get vector for content
   */
  async getContentVector(content: string, namespace?: string): Promise<VectorCacheEntry | null> {
    const key = this.generateKey(content, namespace);
    const id = key.replace(this.prefix, '');
    return this.getVector(id);
  }

  /**
   * Add vector to similarity search index
   * Uses a simple inverted index approach with LSH buckets
   */
  private async addToIndex(id: string, vector: number[]): Promise<void> {
    // Create LSH buckets for approximate nearest neighbor search
    const buckets = this.computeLSHBuckets(vector, 8);

    for (const bucket of buckets) {
      const bucketKey = `${this.prefix}index:${bucket}`;
      await this.redis.sadd(bucketKey, id);
      await this.redis.expire(bucketKey, this.defaultTtl * 2);
    }

    // Store vector dimension for validation
    await this.redis.hset(`${this.prefix}meta:${id}`, 'dim', vector.length.toString());
  }

  /**
   * Compute LSH buckets for a vector
   * Uses random hyperplane projection
   */
  private computeLSHBuckets(vector: number[], numBuckets: number): string[] {
    const buckets: string[] = [];
    const dim = vector.length;

    for (let i = 0; i < numBuckets; i++) {
      // Use deterministic "random" hyperplane based on bucket index
      let projection = 0;
      for (let j = 0; j < dim; j++) {
        // Simple hash-based coefficient
        const coef = Math.sin((i + 1) * (j + 1) * 0.1);
        projection += vector[j] * coef;
      }

      // Binary quantization
      const bit = projection >= 0 ? '1' : '0';
      buckets.push(`lsh:${i}:${bit}`);
    }

    return buckets;
  }

  /**
   * Find similar vectors using approximate nearest neighbor search
   */
  async findSimilar(
    queryVector: number[],
    limit: number = 10,
    minScore: number = 0.5
  ): Promise<VectorSearchResult[]> {
    // Get candidate IDs from LSH buckets
    const buckets = this.computeLSHBuckets(queryVector, 8);
    const candidateIds = new Set<string>();

    for (const bucket of buckets) {
      const bucketKey = `${this.prefix}index:${bucket}`;
      const ids = await this.redis.smembers(bucketKey);
      ids.forEach(id => candidateIds.add(id));
    }

    // Score candidates by cosine similarity
    const results: VectorSearchResult[] = [];

    for (const id of candidateIds) {
      const entry = await this.getVector(id);
      if (!entry) continue;

      const score = this.cosineSimilarity(queryVector, entry.vector);
      if (score >= minScore) {
        results.push({
          id,
          score,
          metadata: entry.metadata
        });
      }
    }

    // Sort by score and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Batch cache multiple vectors
   */
  async batchCacheVectors(
    entries: Array<{ id: string; vector: number[]; metadata?: Record<string, any> }>,
    ttl?: number
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const entry of entries) {
      const key = `${this.prefix}${entry.id}`;
      const cacheEntry: VectorCacheEntry = {
        vector: entry.vector,
        metadata: entry.metadata,
        createdAt: new Date().toISOString()
      };

      pipeline.setex(key, ttl || this.defaultTtl, JSON.stringify(cacheEntry));
    }

    await pipeline.exec();

    // Add to index in separate batch
    for (const entry of entries) {
      await this.addToIndex(entry.id, entry.vector);
    }
  }

  /**
   * Delete cached vector
   */
  async deleteVector(id: string): Promise<boolean> {
    const key = `${this.prefix}${id}`;
    const result = await this.redis.del(key);
    await this.redis.del(`${this.prefix}meta:${id}`);
    return result > 0;
  }

  /**
   * Clear all cached vectors
   */
  async clearAll(): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalCached: number;
    memoryUsed: string;
    hitRate?: number;
  }> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    const info = await this.redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);

    return {
      totalCached: keys.filter(k => !k.includes(':index:') && !k.includes(':meta:')).length,
      memoryUsed: memoryMatch ? memoryMatch[1] : 'unknown'
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        healthy: true,
        latency: Date.now() - start
      };
    } catch {
      return {
        healthy: false,
        latency: Date.now() - start
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const vectorCacheService = VectorCacheService.getInstance();
