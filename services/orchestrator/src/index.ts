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

// Load environment variables
dotenv.config();

// Validate environment variables (exits on failure)
const env = validateEnv();

// Initialize Sentry for error tracking (if SENTRY_DSN is set)
initSentry().catch(() => {
  console.warn('[Sentry] Failed to initialize - continuing without error tracking');
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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Metrics middleware (track all requests)
app.use(metricsMiddleware);

// Health check routes (no auth required)
app.use('/', healthRouter);

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
  console.log('='.repeat(60));
  console.log('ResearchFlow Canvas Server');
  console.log('='.repeat(60));
  console.log(`Environment:      ${NODE_ENV}`);
  console.log(`Port:             ${PORT}`);
  console.log(`Governance Mode:  ${process.env.GOVERNANCE_MODE || 'DEMO'}`);
  console.log(`Health Check:     http://localhost:${PORT}/health`);
  console.log(`API Base:         http://localhost:${PORT}/api`);
  console.log('='.repeat(60));
  console.log('Phase 1-2 Features: ACTIVE');
  console.log('  ✓ RBAC Middleware');
  console.log('  ✓ Data Classification');
  console.log('  ✓ Approval Gates');
  console.log('  ✓ Claim Linter');
  console.log('  ✓ PHI Scanning');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
