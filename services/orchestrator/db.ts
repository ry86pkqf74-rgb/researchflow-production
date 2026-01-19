/**
 * Database Connection Module
 *
 * Provides connection pooling with read replica support for scaling.
 * - Primary (write) pool: Used for all write operations
 * - Replica (read) pool: Used for read-only operations (optional)
 *
 * Configuration:
 * - DATABASE_URL: Primary database connection string (required)
 * - READONLY_DATABASE_URL: Read replica connection string (optional)
 */

import { Pool, PoolConfig } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@researchflow/core/schema";

// Pool configuration defaults
const poolDefaults: Partial<PoolConfig> = {
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Connection timeout
  allowExitOnIdle: true,      // Allow process to exit if pool is idle
};

// Allow running without DATABASE_URL in test environments
// Tests that need DB will skip or mock when not available
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Primary (write) pool
export const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ...poolDefaults,
}) : null;

// Read replica pool (optional)
// Falls back to primary if READONLY_DATABASE_URL is not set
export const readPool = process.env.READONLY_DATABASE_URL ? new Pool({
  connectionString: process.env.READONLY_DATABASE_URL,
  ...poolDefaults,
}) : pool;

// Primary database instance (for writes)
export const db = pool ? drizzle(pool, { schema }) : null;

// Read-only database instance (uses replica if available)
export const readDb = readPool ? drizzle(readPool, { schema }) : null;

/**
 * Get the appropriate database instance based on operation type.
 *
 * @param mode - 'read' for read-only operations, 'write' for write operations
 * @returns The database instance
 *
 * Usage:
 * ```typescript
 * // For read operations (can use replica)
 * const users = await getDb('read').select().from(schema.users);
 *
 * // For write operations (must use primary)
 * await getDb('write').insert(schema.users).values({ name: 'John' });
 *
 * // For read-after-write consistency (use primary)
 * await getDb('write').insert(schema.users).values({ name: 'John' });
 * const user = await getDb('write').select().from(schema.users);
 * ```
 */
export function getDb(mode: 'read' | 'write' = 'write'): NodePgDatabase<typeof schema> | null {
  if (mode === 'read' && readDb) {
    return readDb;
  }
  return db;
}

/**
 * Check database health (both primary and replica if configured)
 */
export async function checkDbHealth(): Promise<{
  primary: { healthy: boolean; latencyMs?: number; error?: string };
  replica?: { healthy: boolean; latencyMs?: number; error?: string };
}> {
  const result: {
    primary: { healthy: boolean; latencyMs?: number; error?: string };
    replica?: { healthy: boolean; latencyMs?: number; error?: string };
  } = {
    primary: { healthy: false },
  };

  // Check primary
  if (pool) {
    try {
      const start = Date.now();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      result.primary = {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      result.primary = {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Check replica if configured separately
  if (process.env.READONLY_DATABASE_URL && readPool && readPool !== pool) {
    try {
      const start = Date.now();
      const client = await readPool.connect();
      await client.query('SELECT 1');
      client.release();
      result.replica = {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      result.replica = {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  return result;
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats(): {
  primary: { total: number; idle: number; waiting: number } | null;
  replica: { total: number; idle: number; waiting: number } | null;
} {
  return {
    primary: pool ? {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    } : null,
    replica: readPool && readPool !== pool ? {
      total: readPool.totalCount,
      idle: readPool.idleCount,
      waiting: readPool.waitingCount,
    } : null,
  };
}

/**
 * Graceful shutdown - close all database connections
 */
export async function closeDb(): Promise<void> {
  if (readPool && readPool !== pool) {
    await readPool.end();
  }
  if (pool) {
    await pool.end();
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('[DB] SIGTERM received, closing database connections');
  await closeDb();
});

process.on('SIGINT', async () => {
  console.log('[DB] SIGINT received, closing database connections');
  await closeDb();
});
