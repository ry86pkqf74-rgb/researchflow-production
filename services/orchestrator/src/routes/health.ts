/**
 * Health Check Routes
 *
 * Kubernetes-style health endpoints:
 * - /healthz: Liveness probe (is the process alive?)
 * - /readyz: Readiness probe (can accept traffic?)
 * - /health: Legacy endpoint for backwards compatibility
 *
 * Phase A - Task 31: Healthcheck Endpoints + K8s Probes
 */

import { Router, Request, Response } from 'express';

export const healthRouter = Router();

/**
 * Liveness Probe
 * Returns 200 if the process is alive and can accept requests
 * Should NOT check external dependencies
 */
healthRouter.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'orchestrator',
  });
});

/**
 * Readiness Probe
 * Returns 200 if the service is ready to accept traffic
 * Should check critical dependencies (Redis, database, etc.)
 */
healthRouter.get('/readyz', async (req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  let ready = true;

  try {
    // TODO: Add Redis connection check when Redis client is available
    // Example:
    // try {
    //   await redisClient.ping();
    //   checks.redis = 'ok';
    // } catch (error) {
    //   checks.redis = 'error';
    //   ready = false;
    // }

    // TODO: Add database connection check when DB is configured
    // Example:
    // try {
    //   await db.query('SELECT 1');
    //   checks.database = 'ok';
    // } catch (error) {
    //   checks.database = 'error';
    //   ready = false;
    // }

    // For now, always ready
    checks.system = 'ok';

    if (ready) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'orchestrator',
        checks,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        service: 'orchestrator',
        checks,
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'orchestrator',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Legacy Health Endpoint
 * Maintained for backwards compatibility
 */
healthRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    governanceMode: process.env.GOVERNANCE_MODE || 'DEMO',
    service: 'orchestrator',
  });
});

/**
 * Detailed Health Status (for monitoring/debugging)
 * Returns more detailed information about the service
 */
healthRouter.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'orchestrator',
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime),
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
      },
      checks: {
        // Add dependency checks here
        system: 'ok',
      },
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
