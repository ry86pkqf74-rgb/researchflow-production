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
app.listen(PORT, () => {
  logger.info('ResearchFlow Canvas Server starting', {
    environment: NODE_ENV,
    port: PORT,
    governanceMode: process.env.GOVERNANCE_MODE || 'DEMO',
    healthCheck: `http://localhost:${PORT}/health`,
    apiBase: `http://localhost:${PORT}/api`,
    features: ['RBAC Middleware', 'Data Classification', 'Approval Gates', 'Claim Linter', 'PHI Scanning']
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
