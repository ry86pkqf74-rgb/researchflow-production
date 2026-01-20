/**
 * Express Server Entry Point
 *
 * Configures and starts the ResearchFlow Canvas backend server.
 * Includes CORS, JSON parsing, authentication, RBAC, and error handling.
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import governanceRoutes from './routes/governance.js';
import datasetRoutes from './routes/datasets.js';
import conferenceRoutes from './routes/conference.js';
import orcidRoutes from './routes/orcid';
import { mockAuthMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// Mock authentication middleware (sets req.user for RBAC)
app.use(mockAuthMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    governanceMode: process.env.GOVERNANCE_MODE || 'DEMO'
  });
});

// API Routes
app.use('/api/governance', governanceRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/ros', conferenceRoutes);
app.use('/api/orcid', orcidRoutes);

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
  console.log('  ✓ ORCID Integration');
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
