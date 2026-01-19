/**
 * Database Connection for Manuscript Service
 * Uses shared schema from @researchflow/core
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@researchflow/core/schema';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export pool for direct queries if needed
export { pool };

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
  console.log('[DB] Connection pool closed');
}
