/**
 * Express Server Entry Point
 *
 * Configures and starts the ResearchFlow Canvas backend server.
 * Includes CORS, JSON parsing, authentication, RBAC, and error handling.
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import governanceRoutes from './routes/governance.js';
import datasetRoutes from './routes/datasets.js';
import conferenceRoutes from './routes/conference.js';
import webhooksRoutes from './routes/webhooks.js';
import orcidRoutes from './routes/orcid';
import artifactsV2Routes from './routes/v2/artifacts.routes';
import ideasRoutes from './routes/docs-first/ideas.js';
import topicBriefsRoutes from './routes/docs-first/topic-briefs.js';
import venuesRoutes from './routes/docs-first/venues.js';
import docKitsRoutes from './routes/docs-first/doc-kits.js';
import experimentsRoutes from './routes/experiments';
import customFieldsRoutes from './routes/custom-fields';
import searchRoutes from './routes/search';
import semanticSearchRoutes from './routes/semanticSearch';
import tutorialsRoutes from './routes/tutorials';
// Phase H Routes (Tasks 136-150)
import helpRoutes from './routes/help';
import pluginsRoutes from './routes/plugins';
import aiProvidersRoutes from './routes/aiProviders';
import ecosystemIntegrationsRoutes from './routes/ecosystemIntegrations';
import apiKeysRoutes from './routes/apiKeys';
import tutorialSandboxRoutes from './routes/tutorialSandbox';
import futureProofingRoutes from './routes/futureProofing';
import { mockAuthMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { CollaborationWebSocketServer } from './collaboration/websocket-server';

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
app.use('/api/ros/conference', conferenceRoutes);
app.use('/api/orcid', orcidRoutes);

// V2 API Routes (new collaboration + provenance features)
app.use('/api/v2/artifacts', artifactsV2Routes);

// Docs-First API Routes (Phase 1)
app.use('/api/docs-first/ideas', ideasRoutes);
app.use('/api/docs-first/topic-briefs', topicBriefsRoutes);
app.use('/api/docs-first/venues', venuesRoutes);
app.use('/api/docs-first/doc-kits', docKitsRoutes);

// Phase F API Routes (UI/UX Enhancements)
app.use('/api/experiments', experimentsRoutes);
app.use('/api/custom-fields', customFieldsRoutes);
app.use('/api/tutorials', tutorialsRoutes);  // Task 108: Inline Tutorials

// Search API Routes (Task 98, Task 107)
app.use('/api/search', searchRoutes);
app.use('/api/search', semanticSearchRoutes);  // Semantic search endpoints
app.use('/api/embeddings', semanticSearchRoutes);  // Embedding generation endpoint

// Webhook Routes (Stripe, Zoom, etc.)
// Note: These routes have their own body parsing for signature verification
app.use('/api/webhooks', webhooksRoutes);

// Phase H Routes (Tasks 136-150)
app.use('/api/help', helpRoutes);  // Task 136: Interactive API docs + Task 140: Community links
app.use('/api/plugins', pluginsRoutes);  // Task 137: Plugin marketplace
app.use('/api/ai', aiProvidersRoutes);  // Task 141: Custom AI model hooks
app.use('/api/integrations', ecosystemIntegrationsRoutes);  // Tasks 139, 143, 144: Overleaf, Git, Import
app.use('/api/profile/api-keys', apiKeysRoutes);  // Task 138: API key rotation
app.use('/api/tutorials/sandbox', tutorialSandboxRoutes);  // Task 145: Tutorial code sandboxes
app.use('/api/admin/upgrades', futureProofingRoutes);  // Task 150: Future-proofing checklists

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

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket server for collaboration
let wsServer: CollaborationWebSocketServer | null = null;
try {
  wsServer = new CollaborationWebSocketServer(httpServer);
} catch (error) {
  console.error('Failed to initialize WebSocket server:', error);
  console.log('Continuing without collaboration features...');
}

// Start server
httpServer.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('ResearchFlow Canvas Server');
  console.log('='.repeat(60));
  console.log(`Environment:      ${NODE_ENV}`);
  console.log(`Port:             ${PORT}`);
  console.log(`Governance Mode:  ${process.env.GOVERNANCE_MODE || 'DEMO'}`);
  console.log(`Health Check:     http://localhost:${PORT}/health`);
  console.log(`API Base:         http://localhost:${PORT}/api`);
  console.log(`WebSocket:        ws://localhost:${PORT}/collaboration`);
  console.log('='.repeat(60));
  console.log('Phase 1-2 Features: ACTIVE');
  console.log('  ✓ RBAC Middleware');
  console.log('  ✓ Data Classification');
  console.log('  ✓ Approval Gates');
  console.log('  ✓ Claim Linter');
  console.log('  ✓ PHI Scanning');
  console.log('  ✓ ORCID Integration');
  console.log('='.repeat(60));
  console.log('Phase 3 Features: NEW');
  console.log('  ✓ Artifact Provenance Graph');
  console.log('  ✓ Real-time Collaboration (Yjs CRDT)');
  console.log('  ✓ Version Control & Diff');
  console.log('  ✓ Comment System');
  console.log('='.repeat(60));
  console.log('Phase F Features: FOUNDATION');
  console.log('  ✓ Feature Flags & A/B Experiments');
  console.log('  ✓ Custom Fields (Org-level schemas)');
  console.log('  ✓ Frontend Hooks (useFeatureFlag, useExperiment)');
  console.log('='.repeat(60));
  console.log('Phase H Features: ECOSYSTEM');
  console.log('  ✓ Interactive API Documentation (Swagger/OpenAPI)');
  console.log('  ✓ Plugin Marketplace');
  console.log('  ✓ Custom AI Model Hooks');
  console.log('  ✓ Overleaf Integration');
  console.log('  ✓ Git Sync Integration');
  console.log('  ✓ Data Import Wizards');
  console.log('  ✓ Tutorial Code Sandboxes');
  console.log('  ✓ API Key Rotation');
  console.log('  ✓ Scientific Notation Localization');
  console.log('  ✓ Future-Proofing Checklists');
  console.log('='.repeat(60));
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutdown signal received: cleaning up...');

  // Shutdown WebSocket server
  if (wsServer) {
    await wsServer.shutdown();
  }

  // Close HTTP server
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
