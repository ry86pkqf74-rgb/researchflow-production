import { Request, Response, NextFunction } from 'express';
import * as prometheus from 'prom-client';

/**
 * Prometheus Metrics Setup for ResearchFlow Orchestrator Service
 * Provides comprehensive monitoring of:
 * - HTTP request metrics (latency, count by status/route)
 * - Business metrics (active users, pending approvals)
 * - Custom application metrics
 */

// Create a register for custom metrics
const register = new prometheus.Registry();

// Metrics defaults
prometheus.collectDefaultMetrics({ register });

/**
 * HTTP Request Duration Histogram
 * Tracks request latency in milliseconds with buckets from 10ms to 5 seconds
 */
export const httpRequestDurationHistogram = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 300, 500, 750, 1000, 2000, 3000, 5000],
  registers: [register],
});

/**
 * HTTP Request Counter
 * Counts total requests by method, route, and status code
 */
export const httpRequestCounter = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

/**
 * HTTP Request Size Histogram
 * Tracks request payload size in bytes
 */
export const httpRequestSizeHistogram = new prometheus.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});

/**
 * HTTP Response Size Histogram
 * Tracks response payload size in bytes
 */
export const httpResponseSizeHistogram = new prometheus.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});

/**
 * Active Users Gauge
 * Current number of authenticated users with active sessions
 */
export const activeUsersGauge = new prometheus.Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
  registers: [register],
});

/**
 * Pending Approvals Gauge
 * Current number of pending document approvals
 */
export const pendingApprovalsGauge = new prometheus.Gauge({
  name: 'pending_approvals',
  help: 'Number of pending document approvals',
  registers: [register],
});

/**
 * Document Processing Time Histogram
 * Tracks time to process documents in milliseconds
 */
export const documentProcessingTimeHistogram = new prometheus.Histogram({
  name: 'document_processing_time_ms',
  help: 'Time to process documents in milliseconds',
  labelNames: ['operation_type', 'status'],
  buckets: [100, 500, 1000, 5000, 10000, 30000, 60000, 120000, 300000],
  registers: [register],
});

/**
 * Database Query Duration Histogram
 * Tracks database query execution time in milliseconds
 */
export const dbQueryDurationHistogram = new prometheus.Histogram({
  name: 'db_query_duration_ms',
  help: 'Duration of database queries in milliseconds',
  labelNames: ['operation', 'table'],
  buckets: [1, 5, 10, 50, 100, 500, 1000, 5000],
  registers: [register],
});

/**
 * Database Operation Counter
 * Counts total database operations
 */
export const dbOperationCounter = new prometheus.Counter({
  name: 'db_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

/**
 * Cache Hit Ratio
 * Tracks cache hits vs misses
 */
export const cacheHitCounter = new prometheus.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_name'],
  registers: [register],
});

export const cacheMissCounter = new prometheus.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_name'],
  registers: [register],
});

/**
 * Queue Depth Histogram
 * Tracks job queue depth
 */
export const queueDepthHistogram = new prometheus.Histogram({
  name: 'queue_depth',
  help: 'Depth of job queue',
  labelNames: ['queue_name'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000],
  registers: [register],
});

/**
 * Error Counter
 * Counts errors by type and service
 */
export const errorCounter = new prometheus.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'service'],
  registers: [register],
});

/**
 * Request Context Middleware
 * Adds request timing and sizing capabilities
 */
export const requestContextMiddleware = (
  req: Request & { startTime?: number; contentLength?: number },
  res: Response,
  next: NextFunction,
) => {
  // Record start time
  req.startTime = Date.now();

  // Record request size if available
  if (req.headers['content-length']) {
    req.contentLength = parseInt(req.headers['content-length'], 10);
  }

  // Capture original send method
  const originalSend = res.send;

  // Override send to capture response size
  res.send = function (data: any) {
    if (data) {
      const size = Buffer.byteLength(
        typeof data === 'string' ? data : JSON.stringify(data),
      );
      httpResponseSizeHistogram
        .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
        .observe(size);
    }
    return originalSend.call(this, data);
  };

  next();
};

/**
 * HTTP Metrics Middleware
 * Collects metrics for all HTTP requests
 */
export const httpMetricsMiddleware = (
  req: Request & { startTime?: number; contentLength?: number },
  res: Response,
  next: NextFunction,
) => {
  // Handle response finish event
  const onFinish = () => {
    // Calculate duration
    const duration = Date.now() - (req.startTime || Date.now());

    // Get route path (normalize for metrics)
    const route = req.route?.path || req.path;

    // Record metrics
    httpRequestDurationHistogram
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestCounter
      .labels(req.method, route, res.statusCode.toString())
      .inc();

    // Record request size if available
    if (req.contentLength) {
      httpRequestSizeHistogram.labels(req.method, route).observe(req.contentLength);
    }

    // Remove listener
    res.removeListener('finish', onFinish);
  };

  res.on('finish', onFinish);
  next();
};

/**
 * Update Active Users Metric
 * Call this periodically or when user state changes
 */
export const updateActiveUsers = async (
  getActiveUserCount: () => Promise<number>,
) => {
  try {
    const count = await getActiveUserCount();
    activeUsersGauge.set(count);
  } catch (error) {
    console.error('Error updating active users metric:', error);
  }
};

/**
 * Update Pending Approvals Metric
 * Call this periodically or when approval state changes
 */
export const updatePendingApprovals = async (
  getPendingCount: () => Promise<number>,
) => {
  try {
    const count = await getPendingCount();
    pendingApprovalsGauge.set(count);
  } catch (error) {
    console.error('Error updating pending approvals metric:', error);
  }
};

/**
 * Track Database Operation
 * Wrapper for database operations with automatic timing and error tracking
 */
export const trackDatabaseOperation = async <T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    dbQueryDurationHistogram.labels(operation, table).observe(duration);
    dbOperationCounter.labels(operation, table, 'success').inc();

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    dbQueryDurationHistogram.labels(operation, table).observe(duration);
    dbOperationCounter.labels(operation, table, 'error').inc();
    errorCounter.labels('database', 'orchestrator').inc();

    throw error;
  }
};

/**
 * Track Cache Access
 * Record cache hits and misses
 */
export const trackCacheAccess = (cacheName: string, isHit: boolean) => {
  if (isHit) {
    cacheHitCounter.labels(cacheName).inc();
  } else {
    cacheMissCounter.labels(cacheName).inc();
  }
};

/**
 * Track Document Processing
 * Wrapper for document processing operations
 */
export const trackDocumentProcessing = async <T>(
  operationType: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    documentProcessingTimeHistogram.labels(operationType, 'success').observe(duration);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    documentProcessingTimeHistogram.labels(operationType, 'error').observe(duration);
    errorCounter.labels('document_processing', 'orchestrator').inc();

    throw error;
  }
};

/**
 * Track Queue Depth
 * Update queue depth gauge
 */
export const updateQueueDepth = (queueName: string, depth: number) => {
  queueDepthHistogram.labels(queueName).observe(depth);
};

/**
 * Metrics Endpoint Handler
 * Returns metrics in Prometheus text format
 */
export const metricsHandler = async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  try {
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
};

/**
 * Health Check Endpoint Handler
 * Simple endpoint to verify service is running
 */
export const healthCheckHandler = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'orchestrator',
    uptime: process.uptime(),
  });
};

/**
 * Export register for integration
 */
export { register };

/**
 * Initialize Metrics
 * Sets up periodic tasks for business metrics
 */
export const initializeMetrics = (
  getActiveUserCount?: () => Promise<number>,
  getPendingApprovalCount?: () => Promise<number>,
) => {
  // Update active users every 30 seconds
  if (getActiveUserCount) {
    setInterval(async () => {
      await updateActiveUsers(getActiveUserCount);
    }, 30000);
  }

  // Update pending approvals every 30 seconds
  if (getPendingApprovalCount) {
    setInterval(async () => {
      await updatePendingApprovals(getPendingApprovalCount);
    }, 30000);
  }

  console.log('Prometheus metrics initialized');
};
