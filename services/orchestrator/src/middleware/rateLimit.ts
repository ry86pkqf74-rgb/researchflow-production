import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response } from 'express';
import { createClient } from 'redis';
import { createLogger } from '../utils/logger';

const logger = createLogger('rateLimit');

/**
 * Initialize Redis client for distributed rate limiting
 */
let redisClient: ReturnType<typeof createClient> | null = null;

async function initializeRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', {
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });

    await redisClient.connect();
    logger.info('Redis client connected for rate limiting');
    return redisClient;
  } catch (error) {
    logger.warn('Failed to connect to Redis for rate limiting, using memory store', {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Custom key generator that uses user ID if authenticated, IP otherwise
 */
function keyGenerator(req: Request): string {
  // Use authenticated user ID if available
  if (req.user && typeof req.user === 'object' && 'id' in req.user) {
    return `user:${(req.user as any).id}`;
  }

  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0]) ||
    req.socket.remoteAddress ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Skip function for health check endpoints
 */
function skip(req: Request): boolean {
  const skipPaths = ['/health', '/api/health', '/health/ready', '/api/health/ready', '/metrics', '/api/metrics'];
  return skipPaths.includes(req.path);
}

/**
 * Default rate limiter (100 requests per minute)
 * Applied globally to all endpoints
 */
export async function createDefaultLimiter() {
  const client = await initializeRedisClient();

  const store = client
    ? new RedisStore({
        client,
        prefix: 'rl:default:',
        sendCommand: async (client: any, args: string[]) => {
          return client.sendCommand(args);
        },
      } as any)
    : undefined;

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    keyGenerator,
    skip,
    store,
    statusCode: 429,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        keyGenerator: keyGenerator(req),
        path: req.path,
        method: req.method,
      });
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

/**
 * Auth endpoints rate limiter (10 requests per minute)
 * Stricter limit to prevent brute force attacks
 */
export async function createAuthLimiter() {
  const client = await initializeRedisClient();

  const store = client
    ? new RedisStore({
        client,
        prefix: 'rl:auth:',
        sendCommand: async (client: any, args: string[]) => {
          return client.sendCommand(args);
        },
      } as any)
    : undefined;

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per window
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip,
    store,
    statusCode: 429,
    handler: (req: Request, res: Response) => {
      logger.warn('Auth rate limit exceeded', {
        keyGenerator: keyGenerator(req),
        path: req.path,
        method: req.method,
      });
      res.status(429).json({
        error: 'Too many authentication attempts',
        message: 'Please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

/**
 * API endpoints rate limiter (200 requests per minute)
 * Generous limit for API consumers
 */
export async function createApiLimiter() {
  const client = await initializeRedisClient();

  const store = client
    ? new RedisStore({
        client,
        prefix: 'rl:api:',
        sendCommand: async (client: any, args: string[]) => {
          return client.sendCommand(args);
        },
      } as any)
    : undefined;

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per window
    message: 'API rate limit exceeded, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip,
    store,
    statusCode: 429,
    handler: (req: Request, res: Response) => {
      logger.warn('API rate limit exceeded', {
        keyGenerator: keyGenerator(req),
        path: req.path,
        method: req.method,
      });
      res.status(429).json({
        error: 'API rate limit exceeded',
        message: 'Please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

/**
 * Cleanup function to close Redis connection
 */
export async function closeRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis client closed');
    } catch (error) {
      logger.error('Error closing Redis client', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
