/**
 * Prometheus Metrics Route
 *
 * Exposes /metrics endpoint for Prometheus scraping.
 * This route does NOT require authentication - standard Prometheus practice.
 * CRITICAL: Metrics must NEVER contain PHI values.
 */

import { Router, Request, Response } from 'express';
import { getMetrics } from '../services/metrics.service';
import { logger } from '../logger/file-logger.js';

const router = Router();

/**
 * GET /metrics
 * Returns Prometheus-formatted metrics
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

export default router;
