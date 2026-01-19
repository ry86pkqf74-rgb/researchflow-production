/**
 * HTTP Metrics Middleware
 *
 * Records request duration and status for Prometheus metrics.
 * Does NOT log any PHI - only path patterns and numeric stats.
 */

import { Request, Response, NextFunction } from 'express';
import { recordHTTPRequest } from '../services/metrics.service';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Skip metrics for the metrics endpoint itself
  if (req.path === '/metrics') {
    next();
    return;
  }

  // Record metrics on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    recordHTTPRequest(req.method, req.path, res.statusCode, duration);
  });

  next();
}
