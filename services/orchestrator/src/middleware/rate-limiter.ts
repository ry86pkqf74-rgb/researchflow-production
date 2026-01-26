/**
 * Rate Limiter Middleware (Task 71)
 *
 * Implements application-level rate limiting with:
 * - Role-based quotas (VIEWER, RESEARCHER, STEWARD, ADMIN)
 * - Redis-backed distributed counters
 * - Endpoint-specific limits
 * - Audit logging for violations
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logAction } from '../services/audit-service';

// Feature flag
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';

// Configuration from environment
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute default
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

/**
 * Rate limit configuration by role
 */
const ROLE_LIMITS: Record<string, number> = {
  VIEWER: 60,      // 60 req/min
  RESEARCHER: 300, // 300 req/min
  STEWARD: 600,    // 600 req/min
  ADMIN: 1200,     // 1200 req/min
  anonymous: 30,   // 30 req/min for unauthenticated
};

/**
 * Special limits for specific endpoint patterns
 */
const ENDPOINT_LIMITS: Record<string, number> = {
  '/api/ai': 10,        // AI endpoints: 10 req/min
  '/api/upload': 5,     // Upload endpoints: 5 req/min
  '/api/export': 2,     // Export endpoints: 2 req/min
  '/api/consent': 20,   // Consent endpoints: 20 req/min
  '/api/governance': 30, // Governance endpoints: 30 req/min
};

/**
 * In-memory rate limit store (use Redis in production)
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

/**
 * Get or create rate limit entry
 */
function getEntry(key: string): RateLimitEntry {
  const now = Date.now();
  let entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
    memoryStore.set(key, entry);
  }

  return entry;
}

/**
 * Increment and check rate limit
 */
function checkRateLimit(key: string, limit: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
} {
  const entry = getEntry(key);
  entry.count++;

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    total: entry.count,
  };
}

/**
 * Get the appropriate limit for a request
 */
function getLimit(req: Request): number {
  // Check endpoint-specific limits first
  for (const [pattern, limit] of Object.entries(ENDPOINT_LIMITS)) {
    if (req.path.startsWith(pattern)) {
      return limit;
    }
  }

  // Use role-based limit
  const role = (req.user as any)?.role || 'anonymous';
  return ROLE_LIMITS[role] || ROLE_LIMITS.anonymous;
}

/**
 * Generate rate limit key for a request
 */
function getKey(req: Request, keyType: 'user' | 'ip' | 'combined' = 'combined'): string {
  const userId = (req.user as any)?.id;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  switch (keyType) {
    case 'user':
      return `rl:user:${userId || 'anonymous'}`;
    case 'ip':
      return `rl:ip:${ip}`;
    case 'combined':
    default:
      return userId ? `rl:user:${userId}` : `rl:ip:${ip}`;
  }
}

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
  const {
    keyGenerator = (req) => getKey(req),
    skip = () => false,
    handler,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if rate limiting is enabled
    if (!RATE_LIMIT_ENABLED) {
      return next();
    }

    // Check if this request should be skipped
    if (skip(req)) {
      return next();
    }

    // Skip health checks
    if (req.path === '/health' || req.path === '/health/ready') {
      return next();
    }

    const key = keyGenerator(req);
    const limit = options.max || getLimit(req);

    const result = checkRateLimit(key, limit);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      // Log rate limit violation
      await logAction({
        eventType: 'RATE_LIMIT',
        action: 'EXCEEDED',
        userId: (req.user as any)?.id,
        resourceType: 'endpoint',
        resourceId: req.path,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          path: req.path,
          method: req.method,
          limit,
          count: result.total,
          key: key.replace(/rl:(user|ip):/, ''), // Don't log full key
        },
      });

      // Use custom handler if provided
      if (handler) {
        return handler(req, res);
      }

      // Default 429 response
      res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000).toString());

      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        limit,
        windowMs: RATE_LIMIT_WINDOW_MS,
      });
    }

    next();
  };
}

/**
 * Rate limiter for AI-specific endpoints (stricter limits)
 */
export function createAIRateLimiter(): RequestHandler {
  return createRateLimiter({
    max: 10, // 10 AI requests per minute
    keyGenerator: (req) => `rl:ai:${(req.user as any)?.id || req.ip}`,
  });
}

/**
 * Rate limiter for upload endpoints
 */
export function createUploadRateLimiter(): RequestHandler {
  return createRateLimiter({
    max: 5, // 5 uploads per minute
    keyGenerator: (req) => `rl:upload:${(req.user as any)?.id || req.ip}`,
  });
}

/**
 * Rate limiter for export endpoints
 */
export function createExportRateLimiter(): RequestHandler {
  return createRateLimiter({
    max: 2, // 2 exports per minute
    keyGenerator: (req) => `rl:export:${(req.user as any)?.id || req.ip}`,
  });
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): {
  count: number;
  remaining: number;
  resetAt: number;
} | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;

  const limit = RATE_LIMIT_MAX_REQUESTS;
  return {
    count: entry.count,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Reset rate limit for a key (admin function)
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of memoryStore.entries()) {
    if (now >= entry.resetAt) {
      memoryStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  cleanupExpiredEntries();
}, 5 * 60 * 1000);

export default createRateLimiter;
