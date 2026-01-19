/**
 * Health Check Routes
 * Readiness and liveness probes for Kubernetes/Docker
 */

import { Router, Request, Response } from 'express';
import { getRedisConnection } from '../redis';
import { db } from '../db';

const router = Router();

/**
 * GET /health
 * Basic liveness probe
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'manuscript-service',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Readiness probe - checks dependencies
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // Check Redis
  try {
    const redisStart = Date.now();
    const redis = getRedisConnection();
    await redis.ping();
    checks.redis = { status: 'ok', latency: Date.now() - redisStart };
  } catch (error) {
    checks.redis = { status: 'error' };
  }

  // Check PostgreSQL
  try {
    const pgStart = Date.now();
    await db.execute('SELECT 1');
    checks.postgres = { status: 'ok', latency: Date.now() - pgStart };
  } catch (error) {
    checks.postgres = { status: 'error' };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    service: 'manuscript-service',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/live
 * Liveness probe - checks if service is running
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    service: 'manuscript-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
