/**
 * ROS Worker Proxy Router
 *
 * Forwards /api/ros/* requests to the Python worker service.
 * Acts as API gateway for centralized auth, logging, and audit.
 *
 * Phase 03: ROS Gateway Consistency
 * See docs/architecture/perf-optimization-roadmap.md
 */

import { Router, Request, Response, NextFunction } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { config } from '../config/env';

const router = Router();

/**
 * Proxy configuration from environment
 */
const WORKER_URL = config.workerUrl;
const ROS_PROXY_ENABLED = config.rosProxyEnabled;
const PROXY_TIMEOUT_MS = config.rosProxyTimeoutMs;

/**
 * Headers that should not be forwarded to the worker
 */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

/**
 * Headers that should not be logged (PHI safety)
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
]);

/**
 * Clean headers for forwarding (remove hop-by-hop headers)
 */
function cleanHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value !== undefined) {
      cleaned[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }
  return cleaned;
}

/**
 * Log proxy request (PHI-safe - never log body)
 */
function logProxyRequest(req: Request, targetUrl: string, duration?: number): void {
  const safeHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
      safeHeaders[key] = Array.isArray(value) ? '[array]' : (value ?? '');
    } else {
      safeHeaders[key] = '[REDACTED]';
    }
  }

  console.log(JSON.stringify({
    type: 'ros_proxy',
    method: req.method,
    path: req.path,
    targetUrl,
    headers: safeHeaders,
    durationMs: duration,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Proxy middleware - forwards request to worker and pipes response
 */
async function proxyToWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Check if proxy is enabled
  if (!ROS_PROXY_ENABLED) {
    res.status(503).json({
      error: 'ROS proxy disabled',
      message: 'ROS_PROXY_ENABLED is set to false',
    });
    return;
  }

  const startTime = Date.now();

  try {
    // Build target URL
    const targetUrl = new URL(req.originalUrl, WORKER_URL);
    const isHttps = targetUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Prepare request options
    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...cleanHeaders(req.headers),
        'x-forwarded-for': req.ip || req.socket.remoteAddress || 'unknown',
        'x-forwarded-proto': req.protocol,
        'x-ros-proxy': 'orchestrator',
      },
      timeout: PROXY_TIMEOUT_MS,
    };

    // Log outgoing request (no body)
    logProxyRequest(req, targetUrl.toString());

    // Create proxy request
    const proxyReq = httpModule.request(options, (proxyRes) => {
      const duration = Date.now() - startTime;

      // Log response
      console.log(JSON.stringify({
        type: 'ros_proxy_response',
        method: req.method,
        path: req.path,
        statusCode: proxyRes.statusCode,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      }));

      // Forward status and headers
      res.status(proxyRes.statusCode || 502);

      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value !== undefined) {
          res.setHeader(key, value);
        }
      }

      // Pipe response body (supports streaming)
      proxyRes.pipe(res);
    });

    // Handle proxy errors
    proxyReq.on('error', (err) => {
      const duration = Date.now() - startTime;
      console.error(JSON.stringify({
        type: 'ros_proxy_error',
        method: req.method,
        path: req.path,
        error: err.message,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      }));

      if (!res.headersSent) {
        res.status(502).json({
          error: 'Worker unavailable',
          message: 'Failed to connect to worker service',
          code: 'PROXY_ERROR',
        });
      }
    });

    // Handle timeout
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      const duration = Date.now() - startTime;
      console.error(JSON.stringify({
        type: 'ros_proxy_timeout',
        method: req.method,
        path: req.path,
        timeoutMs: PROXY_TIMEOUT_MS,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      }));

      if (!res.headersSent) {
        res.status(504).json({
          error: 'Worker timeout',
          message: `Request to worker timed out after ${PROXY_TIMEOUT_MS}ms`,
          code: 'PROXY_TIMEOUT',
        });
      }
    });

    // Pipe request body to worker (supports streaming uploads)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      type: 'ros_proxy_exception',
      method: req.method,
      path: req.path,
      error: err instanceof Error ? err.message : 'Unknown error',
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }));

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Proxy error',
        message: 'Internal proxy error',
        code: 'PROXY_INTERNAL_ERROR',
      });
    }
  }
}

/**
 * Mount proxy on /api/ros/* paths
 * This should be mounted BEFORE any overlapping routes in the main app
 */
router.all('/*', proxyToWorker);

/**
 * Health check for proxy status
 */
router.get('/proxy/health', (req: Request, res: Response) => {
  res.json({
    enabled: ROS_PROXY_ENABLED,
    workerUrl: WORKER_URL,
    timeoutMs: PROXY_TIMEOUT_MS,
  });
});

export default router;
