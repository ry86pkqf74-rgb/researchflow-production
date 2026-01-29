import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@researchflow/core/schema";

// Allow running without DATABASE_URL in test environments
// Tests that need DB will skip or mock when not available
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Only initialize pool and db if DATABASE_URL is provided
export const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
}) : null;

export const db = pool ? drizzle(pool, { schema }) : null;

// Raw query function for direct SQL access
export async function query(text: string, params?: unknown[]) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool.query(text, params);
}
