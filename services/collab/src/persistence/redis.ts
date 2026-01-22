/**
 * Redis Persistence Adapter
 *
 * Uses Redis for fast, distributed document storage.
 * Ideal for real-time collaboration with multiple server instances.
 */

import Redis from "ioredis";
import type { PersistenceAdapter } from "./index.js";

/**
 * Redis persistence adapter using ioredis
 */
export class RedisPersistenceAdapter implements PersistenceAdapter {
  readonly name = "redis";

  private readonly client: Redis;
  private readonly keyPrefix: string;
  private closed = false;

  /**
   * Create Redis persistence adapter
   * @param redisUrl - Redis connection URL
   * @param keyPrefix - Prefix for document keys (default: "collab:doc:")
   */
  constructor(redisUrl: string, keyPrefix: string = "collab:doc:") {
    this.keyPrefix = keyPrefix;

    // Configure Redis client with sensible defaults
    this.client = new Redis(redisUrl, {
      // Retry strategy: exponential backoff with max 10 retries
      retryStrategy(times) {
        if (times > 10) {
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      // Connection timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Reconnection
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      // Enable offline queue to allow commands while disconnected/reconnecting
      enableOfflineQueue: true,
    });

    // Handle connection events
    this.client.on("error", (error) => {
      console.error("[collab-redis] Connection error:", error.message);
    });

    this.client.on("connect", () => {
      console.log("[collab-redis] Connected to Redis");
    });

    this.client.on("close", () => {
      console.log("[collab-redis] Connection closed");
    });
  }

  /**
   * Build the full Redis key for a document
   */
  private getKey(documentName: string): string {
    return `${this.keyPrefix}${documentName}`;
  }

  /**
   * Store document state in Redis
   */
  async storeDocument(documentName: string, state: Uint8Array): Promise<void> {
    this.ensureNotClosed();

    const key = this.getKey(documentName);
    // Convert Uint8Array to Buffer for Redis storage
    const buffer = Buffer.from(state);

    // Store with optional TTL for automatic cleanup (30 days by default)
    const ttlSeconds = parseInt(process.env.COLLAB_DOC_TTL_SECONDS || "2592000", 10);
    await this.client.set(key, buffer, "EX", ttlSeconds);
  }

  /**
   * Fetch document state from Redis
   */
  async fetchDocument(documentName: string): Promise<Uint8Array | null> {
    this.ensureNotClosed();

    const key = this.getKey(documentName);
    const data = await this.client.getBuffer(key);

    if (!data) {
      return null;
    }

    // Refresh TTL on access
    const ttlSeconds = parseInt(process.env.COLLAB_DOC_TTL_SECONDS || "2592000", 10);
    await this.client.expire(key, ttlSeconds);

    return new Uint8Array(data);
  }

  /**
   * Delete document from Redis
   */
  async deleteDocument(documentName: string): Promise<void> {
    this.ensureNotClosed();
    const key = this.getKey(documentName);
    await this.client.del(key);
  }

  /**
   * Check Redis connection health
   */
  async isHealthy(): Promise<boolean> {
    if (this.closed) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await this.client.quit();
    }
  }

  /**
   * Get all document names matching the prefix (for debugging/admin)
   * Warning: Uses SCAN which may be slow on large datasets
   */
  async getDocumentNames(): Promise<string[]> {
    this.ensureNotClosed();

    const names: string[] = [];
    const pattern = `${this.keyPrefix}*`;

    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      for (const key of keys) {
        names.push(key.slice(this.keyPrefix.length));
      }
    } while (cursor !== "0");

    return names;
  }

  /**
   * Ensure adapter hasn't been closed
   */
  private ensureNotClosed(): void {
    if (this.closed) {
      throw new Error("RedisPersistenceAdapter has been closed");
    }
  }
}
