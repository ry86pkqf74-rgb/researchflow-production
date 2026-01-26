/**
 * Persistence Adapter Factory
 *
 * Creates the appropriate persistence adapter based on environment configuration.
 * Priority: Redis > Postgres > Memory (fallback)
 */

import { MemoryPersistenceAdapter } from "./memory.js";
import { RedisPersistenceAdapter } from "./redis.js";
import { PostgresPersistenceAdapter } from "./postgres.js";

/**
 * Base interface for all persistence adapters
 */
export interface PersistenceAdapter {
  /**
   * Unique name for this adapter
   */
  readonly name: string;

  /**
   * Store a Yjs document state
   * @param documentName - Unique document identifier (e.g., manuscript ID)
   * @param state - Yjs document state as Uint8Array
   */
  storeDocument(documentName: string, state: Uint8Array): Promise<void>;

  /**
   * Fetch a Yjs document state
   * @param documentName - Unique document identifier
   * @returns Document state or null if not found
   */
  fetchDocument(documentName: string): Promise<Uint8Array | null>;

  /**
   * Delete a document from storage
   * @param documentName - Unique document identifier
   */
  deleteDocument(documentName: string): Promise<void>;

  /**
   * Check if adapter is connected and healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Close connections and cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Persistence configuration from environment
 */
export interface PersistenceConfig {
  redisUrl?: string;
  postgresUrl?: string;
  keyPrefix?: string;
}

/**
 * Logger interface for persistence operations
 */
export interface PersistenceLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console-based logger
 */
const defaultLogger: PersistenceLogger = {
  info(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ timestamp, level: "info", source: "collab-persistence", message, ...meta }));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.warn(JSON.stringify({ timestamp, level: "warn", source: "collab-persistence", message, ...meta }));
  },
  error(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.error(JSON.stringify({ timestamp, level: "error", source: "collab-persistence", message, ...meta }));
  },
};

/**
 * Create persistence adapter based on environment configuration
 *
 * Priority:
 * 1. Redis (if REDIS_URL is set) - fastest, good for real-time collab
 * 2. Postgres (if DATABASE_URL is set) - durable, integrates with existing data
 * 3. Memory (fallback) - development only, no persistence across restarts
 */
export async function createPersistenceAdapter(
  config?: Partial<PersistenceConfig>,
  logger: PersistenceLogger = defaultLogger
): Promise<PersistenceAdapter> {
  const redisUrl = config?.redisUrl ?? process.env.REDIS_URL;
  const postgresUrl = config?.postgresUrl ?? process.env.DATABASE_URL;
  const keyPrefix = config?.keyPrefix ?? "collab:doc:";

  // Try Redis first
  if (redisUrl) {
    try {
      logger.info("Attempting Redis persistence connection", { keyPrefix });
      const adapter = new RedisPersistenceAdapter(redisUrl, keyPrefix);
      const healthy = await adapter.isHealthy();
      if (healthy) {
        logger.info("Redis persistence adapter initialized successfully");
        return adapter;
      } else {
        logger.warn("Redis connection unhealthy, falling back");
        await adapter.close();
      }
    } catch (error) {
      logger.error("Failed to initialize Redis persistence", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Try Postgres second
  if (postgresUrl) {
    try {
      logger.info("Attempting Postgres persistence connection");
      const adapter = new PostgresPersistenceAdapter(postgresUrl);
      const healthy = await adapter.isHealthy();
      if (healthy) {
        logger.info("Postgres persistence adapter initialized successfully");
        return adapter;
      } else {
        logger.warn("Postgres connection unhealthy, falling back");
        await adapter.close();
      }
    } catch (error) {
      logger.error("Failed to initialize Postgres persistence", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to memory
  logger.warn("Using in-memory persistence (data will not survive restarts)", {
    hasRedisUrl: !!redisUrl,
    hasPostgresUrl: !!postgresUrl,
  });
  return new MemoryPersistenceAdapter();
}

export { MemoryPersistenceAdapter } from "./memory.js";
export { RedisPersistenceAdapter } from "./redis.js";
export { PostgresPersistenceAdapter } from "./postgres.js";
