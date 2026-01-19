/**
 * Redis Connection for Manuscript Service
 * Used for BullMQ job queues and caching
 */

import Redis from 'ioredis';

// Parse Redis URL or use defaults
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client for general use
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

// Create separate connection for BullMQ (required for proper queue operation)
export const createRedisConnection = () => new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// BullMQ connection config
export const bullMqConnection = {
  host: new URL(redisUrl).hostname || 'localhost',
  port: parseInt(new URL(redisUrl).port || '6379'),
};

// Health check
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
  console.log('[Redis] Connection closed');
}

// Event handlers
redis.on('error', (error) => {
  console.error('[Redis] Connection error:', error);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});
