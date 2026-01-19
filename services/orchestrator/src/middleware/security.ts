/**
 * Phase A - Task 14: Rate limiting + IP allow/deny lists middleware
 *
 * Provides:
 * - Rate limiting per IP address
 * - IP allowlist/denylist functionality
 * - Trust proxy configuration for running behind load balancers
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { logger } from '../logger/file-logger.js';

// IP range checking utility (simplified - use ip-range-check for production)
function ipInRange(ip: string, range: string): boolean {
  // Handle exact match
  if (ip === range) return true;

  // Handle CIDR notation (simplified)
  if (range.includes('/')) {
    // For proper CIDR handling, use the ip-range-check package
    // This is a simplified version
    const [rangeIp, bits] = range.split('/');
    const numBits = parseInt(bits, 10);

    // Simple prefix match for /8, /16, /24
    if (numBits === 8) return ip.startsWith(rangeIp.split('.')[0] + '.');
    if (numBits === 16) return ip.startsWith(rangeIp.split('.').slice(0, 2).join('.') + '.');
    if (numBits === 24) return ip.startsWith(rangeIp.split('.').slice(0, 3).join('.') + '.');
  }

  return false;
}

function ipInRanges(ip: string, ranges: string[]): boolean {
  return ranges.some((range) => ipInRange(ip, range));
}

/**
 * Parse comma-separated IP list from environment variable
 */
function parseIpList(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Security middleware configuration
 */
export interface SecurityMiddlewareConfig {
  /** Rate limit per minute (default: 120) */
  rateLimit?: number;
  /** Allowed IPs (comma-separated in env, or array) */
  allowIps?: string[];
  /** Denied IPs (comma-separated in env, or array) */
  denyIps?: string[];
  /** Skip rate limiting for these paths */
  skipPaths?: string[];
  /** Trust proxy setting */
  trustProxy?: boolean | number | string;
}

/**
 * Build the security middleware stack
 */
export function buildSecurityMiddleware(config: SecurityMiddlewareConfig = {}): {
  limiter: RateLimitRequestHandler;
  ipGuard: RequestHandler;
  trustProxy: boolean | number | string;
} {
  // Parse configuration
  const ratePerMinute = config.rateLimit ?? parseInt(process.env.RATE_LIMIT_PER_MIN ?? '120', 10);
  const allowIps = config.allowIps ?? parseIpList(process.env.ALLOW_IPS);
  const denyIps = config.denyIps ?? parseIpList(process.env.DENY_IPS);
  const skipPaths = config.skipPaths ?? ['/healthz', '/readyz', '/health', '/metrics'];
  const trustProxy = config.trustProxy ?? 1;

  // Rate limiter
  const limiterOptions: Partial<Options> = {
    windowMs: 60 * 1000, // 1 minute
    limit: ratePerMinute,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      error: 'rate_limit_exceeded',
      message: 'Too many requests, please try again later.',
      retryAfter: 60,
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return skipPaths.some((path) => req.path === path);
    },
    keyGenerator: (req: Request) => {
      // Use X-Forwarded-For if behind proxy, otherwise use IP
      const ip = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
      return ip;
    },
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
      });
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Too many requests, please try again later.',
        retryAfter: 60,
      });
    },
  };

  const limiter = rateLimit(limiterOptions);

  // IP guard middleware
  const ipGuard: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const rawIp = req.ip || req.socket.remoteAddress || '';
    const ip = rawIp.replace('::ffff:', ''); // Normalize IPv6-mapped IPv4

    // Check denylist first
    if (denyIps.length > 0 && ipInRanges(ip, denyIps)) {
      logger.warn('IP denied', { ip, path: req.path });
      res.status(403).json({
        error: 'ip_denied',
        message: 'Access denied from this IP address.',
      });
      return;
    }

    // If allowlist is configured, only allow those IPs
    if (allowIps.length > 0 && !ipInRanges(ip, allowIps)) {
      logger.warn('IP not in allowlist', { ip, path: req.path });
      res.status(403).json({
        error: 'ip_not_allowed',
        message: 'Access not allowed from this IP address.',
      });
      return;
    }

    next();
  };

  return { limiter, ipGuard, trustProxy };
}

/**
 * Apply security middleware to an Express app
 */
export function applySecurityMiddleware(
  app: { set: (key: string, value: unknown) => void; use: (...handlers: RequestHandler[]) => void },
  config: SecurityMiddlewareConfig = {}
): void {
  const { limiter, ipGuard, trustProxy } = buildSecurityMiddleware(config);

  // Trust proxy setting (required for rate limiting behind load balancer)
  app.set('trust proxy', trustProxy);

  // Apply IP guard first (blocks before rate limiting)
  app.use(ipGuard);

  // Apply rate limiter to /api routes
  app.use('/api', limiter);

  logger.info('Security middleware applied', {
    rateLimit: config.rateLimit ?? 120,
    hasAllowlist: (config.allowIps ?? parseIpList(process.env.ALLOW_IPS)).length > 0,
    hasDenylist: (config.denyIps ?? parseIpList(process.env.DENY_IPS)).length > 0,
  });
}

export default buildSecurityMiddleware;
