/**
 * Express Server Entry Point
 *
 * Configures and starts the ResearchFlow Canvas backend server.
 * Includes CORS, JSON parsing, authentication, RBAC, and error handling.
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 * Phase A - Task 15: Environment validation added
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import governanceRoutes from './routes/governance.js';
import datasetRoutes from './routes/datasets.js';
import conferenceRoutes from './routes/conference.js';
import { healthRouter } from './routes/health.js';
import metricsRouter from './routes/metrics.js';
import adminRouter from './routes/admin.js';
import integrationsRouter from './routes/integrations.js';
import { mockAuthMiddleware } from './middleware/auth.js';
import { initSentry, sentryRequestHandler, sentryErrorHandler } from './services/sentry.service.js';
import { metricsMiddleware } from './middleware/metrics.middleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import { validateEnv } from './config/env-validator.js';
import { logger } from './logger/file-logger.js';

// Load environment variables
dotenv.config();

// Validate environment variables (exits on failure)
const env = validateEnv();

// Initialize Sentry for error tracking (if SENTRY_DSN is set)
initSentry().catch(() => {
  logger.warn('[Sentry] Failed to initialize - continuing without error tracking');
});

const app = express();
const PORT = env.PORT;
const NODE_ENV = env.NODE_ENV;

// Middleware
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development only)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// Metrics middleware (track all requests)
app.use(metricsMiddleware);

// Health check routes (no auth required)
// Mounted at / for K8s probes (/healthz, /readyz) and legacy (/health)
app.use('/', healthRouter);
// Also mount at /api/health for normalized API access
app.use('/api', healthRouter);

// Prometheus metrics (no auth required)
app.use('/metrics', metricsRouter);

// Mock authentication middleware (sets req.user for RBAC)
app.use(mockAuthMiddleware);

// API Routes
app.use('/api/governance', governanceRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/ros', conferenceRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/integrations', integrationsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info('ResearchFlow Canvas Server starting', {
    environment: NODE_ENV,
    port: PORT,
    governanceMode: process.env.GOVERNANCE_MODE || 'DEMO',
    healthCheck: `http://localhost:${PORT}/health`,
    apiBase: `http://localhost:${PORT}/api`,
    features: ['RBAC Middleware', 'Data Classification', 'Approval Gates', 'Claim Linter', 'PHI Scanning']
  });
});

// Phase A - Task 28: Enhanced graceful shutdown handler
// Ensures clean shutdown without corrupting queues or losing in-flight requests
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`Already shutting down, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;

  logger.info(`${signal} received: initiating graceful shutdown`);

  // Set a hard timeout to force exit if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000); // 30 second hard timeout

  try {
    // 1. Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err.message });
      } else {
        logger.info('HTTP server closed');
      }

      try {
        // 2. Close Redis/BullMQ connections (if available)
        // Note: Import these dynamically to avoid circular dependencies
        try {
          const { closeQueues } = await import('./queues/index.js');
          if (closeQueues) {
            await closeQueues();
            logger.info('Queue connections closed');
          }
        } catch (queueErr) {
          // Queues may not be initialized
          logger.debug('No queue connections to close');
        }

        // 3. Close database connections (if available)
        try {
          const { closeDatabaseConnection } = await import('./config/database.js');
          if (closeDatabaseConnection) {
            await closeDatabaseConnection();
            logger.info('Database connection closed');
          }
        } catch (dbErr) {
          // Database may not be initialized
          logger.debug('No database connection to close');
        }

        // 4. Flush logs
        logger.info('Shutdown complete');

        clearTimeout(forceExitTimeout);
        process.exit(0);
      } catch (cleanupErr) {
        logger.error('Error during shutdown cleanup', { error: (cleanupErr as Error).message });
        clearTimeout(forceExitTimeout);
        process.exit(1);
      }
    });
  } catch (shutdownErr) {
    logger.error('Error initiating shutdown', { error: (shutdownErr as Error).message });
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions during shutdown
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
