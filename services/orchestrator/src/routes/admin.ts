/**
 * Admin Routes
 *
 * Administrative endpoints for system monitoring and management.
 * RBAC: Requires ADMIN role for all endpoints.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import CacheService from '../services/cache.service';

const router = Router();

// RBAC middleware - require ADMIN role
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Request & { user?: { role?: string } }).user;

  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Forbidden',
      code: 'ADMIN_REQUIRED',
      message: 'This endpoint requires ADMIN role'
    });
    return;
  }

  next();
}

router.use(requireAdmin);

/**
 * GET /api/admin/health-summary
 * Returns aggregated system health metrics for admin dashboard
 */
router.get('/health-summary', async (_req: Request, res: Response) => {
  try {
    const summary: {
      timestamp: string;
      servicesHealthy: Record<string, boolean>;
      queueDepth: number;
      tokenBurn: {
        input: number;
        output: number;
        total: number;
        period: string;
      };
      costBurn: {
        total: number;
        byTier: Record<string, number>;
        period: string;
        currency: string;
      };
      cacheStats: {
        hitRate: number;
        hits: number;
        misses: number;
      };
      phiStats: {
        scansTotal: number;
        detectionsTotal: number;
        blocksTotal: number;
      };
    } = {
      timestamp: new Date().toISOString(),
      servicesHealthy: {},
      queueDepth: 0,
      tokenBurn: {
        input: 0,
        output: 0,
        total: 0,
        period: '24h'
      },
      costBurn: {
        total: 0,
        byTier: {},
        period: '24h',
        currency: 'USD'
      },
      cacheStats: {
        hitRate: 0,
        hits: 0,
        misses: 0
      },
      phiStats: {
        scansTotal: 0,
        detectionsTotal: 0,
        blocksTotal: 0
      }
    };

    // Check orchestrator health (self)
    summary.servicesHealthy['orchestrator'] = true;

    // Check Redis health
    try {
      const redisHealthy = await checkRedisHealth();
      summary.servicesHealthy['redis'] = redisHealthy;

      // Note: Cache stats would be collected from metrics service
      // For now, return placeholder values
      summary.cacheStats = {
        hitRate: 0,
        hits: 0,
        misses: 0
      };
    } catch {
      summary.servicesHealthy['redis'] = false;
    }

    // Check worker health (via Redis queue)
    try {
      const queueDepth = await getQueueDepth();
      summary.queueDepth = queueDepth;
      // If we can read queue, worker infrastructure is accessible
      summary.servicesHealthy['worker-queue'] = true;
    } catch {
      summary.servicesHealthy['worker-queue'] = false;
    }

    // Check manuscript-service health
    try {
      const manuscriptHealthy = await checkManuscriptServiceHealth();
      summary.servicesHealthy['manuscript-service'] = manuscriptHealthy;
    } catch {
      summary.servicesHealthy['manuscript-service'] = false;
    }

    // Note: Token/cost burn and PHI stats would come from a metrics aggregation
    // service or database. For now, return placeholders indicating the shape.
    // In production, these would be populated from Prometheus queries or
    // a time-series database.

    res.json(summary);
  } catch (error) {
    console.error('Error generating health summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'HEALTH_SUMMARY_FAILED',
      message: 'Failed to generate health summary'
    });
  }
});

/**
 * GET /api/admin/services
 * Returns list of all services and their health status
 */
router.get('/services', async (_req: Request, res: Response) => {
  const services = [
    {
      name: 'orchestrator',
      description: 'Main API gateway and business logic',
      port: process.env.PORT || 3001,
      healthEndpoint: '/health'
    },
    {
      name: 'manuscript-service',
      description: 'Manuscript generation and management',
      port: 3003,
      healthEndpoint: '/health'
    },
    {
      name: 'worker',
      description: 'Background job processing',
      port: 8000,
      healthEndpoint: '/health'
    },
    {
      name: 'worker-consumer',
      description: 'Redis job queue consumer',
      port: 8001,
      healthEndpoint: '/health'
    },
    {
      name: 'redis',
      description: 'Cache and job queue',
      port: 6379,
      healthEndpoint: null
    },
    {
      name: 'postgres',
      description: 'Primary database',
      port: 5432,
      healthEndpoint: null
    }
  ];

  const healthChecks = await Promise.all(
    services.map(async (service) => ({
      ...service,
      healthy: await checkServiceHealth(service.name)
    }))
  );

  res.json({
    services: healthChecks,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/admin/config
 * Returns non-sensitive configuration values
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    governanceMode: process.env.GOVERNANCE_MODE || 'DEMO',
    features: {
      phiScanning: true,
      aiRouter: true,
      caching: true,
      metrics: true
    },
    limits: {
      maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10),
      maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '10', 10),
      defaultCacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10)
    },
    version: process.env.RELEASE_VERSION || 'development',
    timestamp: new Date().toISOString()
  });
});

// Helper functions

async function checkRedisHealth(): Promise<boolean> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url: redisUrl });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

async function getQueueDepth(): Promise<number> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url: redisUrl });
    await client.connect();
    const depth = await client.lLen('researchflow:jobs:pending');
    await client.quit();
    return depth;
  } catch {
    return -1;
  }
}

async function checkManuscriptServiceHealth(): Promise<boolean> {
  try {
    const url = process.env.MANUSCRIPT_SERVICE_URL || 'http://manuscript-service:3003';
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkServiceHealth(serviceName: string): Promise<boolean> {
  switch (serviceName) {
    case 'orchestrator':
      return true; // Self
    case 'redis':
      return checkRedisHealth();
    case 'manuscript-service':
      return checkManuscriptServiceHealth();
    case 'worker':
      try {
        const url = process.env.WORKER_URL || 'http://worker:8000';
        const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        return response.ok;
      } catch {
        return false;
      }
    case 'worker-consumer':
      try {
        const url = process.env.WORKER_CONSUMER_URL || 'http://worker-consumer:8001';
        const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        return response.ok;
      } catch {
        return false;
      }
    case 'postgres':
      // Would check DB connection - simplified for now
      return true;
    default:
      return false;
  }
}

export default router;
