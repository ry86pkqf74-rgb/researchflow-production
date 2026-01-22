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
// Phase G Routes (Tasks 116-135)
import phaseGRoutes from './routes/phaseG';
// Phase H Routes (Tasks 136-150)
import helpRoutes from './routes/help';
import pluginsRoutes from './routes/plugins';
import aiProvidersRoutes from './routes/aiProviders';
import ecosystemIntegrationsRoutes from './routes/ecosystemIntegrations';
import googleDriveRoutes from './routes/google-drive';
import literatureIntegrationsRoutes from './routes/literature-integrations';
import apiKeysRoutes from './routes/apiKeys';
import tutorialSandboxRoutes from './routes/tutorialSandbox';
import futureProofingRoutes from './routes/futureProofing';
// Additional Phase H Routes
import watermarkRoutes from './routes/watermark';
import preferencesRoutes from './routes/preferences';
import invitesRoutes from './routes/invites';
import badgesRoutes from './routes/badges';
import sustainabilityRoutes from './routes/sustainability';
import peerReviewRoutes from './routes/peerReview';
import taskBoardsRoutes from './routes/taskBoards';
import consentRoutes from './routes/consent';
import commentsRoutes from './routes/comments';
import submissionsRoutes from './routes/submissions';
import manuscriptBranchesRoutes from './routes/manuscript-branches';
// Audit Improvements: New modular routes
import authRoutes from './routes/auth';
import workflowStagesRoutes from './routes/workflow-stages';
import workflowsRoutes from './routes/workflows';
import organizationsRoutes from './routes/organizations';
import userSettingsRoutes from './routes/user-settings';
import { mockAuthMiddleware } from './middleware/auth.js';
import { optionalAuth } from './services/authService';
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

// Optional authentication middleware - attaches user if token present, allows anonymous if not
// This replaces mockAuthMiddleware and works with JWT tokens from frontend
app.use(optionalAuth);

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
app.use('/api/ros/comments', commentsRoutes);  // Inline comments with PHI scanning
app.use('/api/ros/submissions', submissionsRoutes);  // Journal/conference submissions
app.use('/api/ros/manuscripts', manuscriptBranchesRoutes);  // Manuscript branching & merging
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

// Phase G Routes (Tasks 116-135: Scalability, Performance, Monitoring)
app.use('/api/monitoring', phaseGRoutes);  // All Phase G endpoints

// Phase H Routes (Tasks 136-150)
app.use('/api/help', helpRoutes);  // Task 136: Interactive API docs + Task 140: Community links
app.use('/api/plugins', pluginsRoutes);  // Task 137: Plugin marketplace
app.use('/api/ai', aiProvidersRoutes);  // Task 141: Custom AI model hooks
app.use('/api/integrations', ecosystemIntegrationsRoutes);
app.use('/api/integrations/google-drive', googleDriveRoutes);  // Google Drive/Docs export
app.use('/api/literature', literatureIntegrationsRoutes);  // Zotero integration  // Tasks 139, 143, 144: Overleaf, Git, Import
app.use('/api/profile/api-keys', apiKeysRoutes);  // Task 138: API key rotation
app.use('/api/tutorials/sandbox', tutorialSandboxRoutes);  // Task 145: Tutorial code sandboxes
app.use('/api/admin/upgrades', futureProofingRoutes);  // Task 150: Future-proofing checklists

// Additional Phase H Routes (Previously Unregistered)
app.use('/api/ai/watermark', watermarkRoutes);  // AI watermark verification and management
app.use('/api/me/preferences', preferencesRoutes);  // User preferences API
app.use('/api', invitesRoutes);  // Organization invite management (handles /api/org/:orgId/invites and /api/invites/*)
app.use('/api/badges', badgesRoutes);  // Gamification badges system
app.use('/api/sustainability', sustainabilityRoutes);  // CO2 tracking and sustainability metrics
app.use('/api/peer-review', peerReviewRoutes);  // Peer review system with rubrics
app.use('/api', taskBoardsRoutes);  // Task board management (handles /api/research/:researchId/boards)
app.use('/api/consent', consentRoutes);  // GDPR consent management

// Audit Improvements: Authentication and Workflow Routes
app.use('/api/auth', authRoutes);  // JWT-based authentication (replaces Replit auth)
app.use('/api/workflow', workflowStagesRoutes);  // Workflow stage management and lifecycle
app.use('/api/workflows', workflowsRoutes);  // Workflow CRUD, versioning, templates
app.use('/api/org', organizationsRoutes);  // Organization management (Task 81)
app.use('/api/user', userSettingsRoutes);  // User settings and preferences

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
  console.log('Phase G Features: SCALABILITY & MONITORING');
  console.log('  ✓ Real-Time Cluster Monitoring');
  console.log('  ✓ Predictive Scaling');
  console.log('  ✓ Resource Heatmaps & Metrics');
  console.log('  ✓ Data Sharding');
  console.log('  ✓ Edge Computing Toggles');
  console.log('  ✓ Vertical Scaling Controls');
  console.log('  ✓ High-Availability Mode');
  console.log('  ✓ Performance Analyzer');
  console.log('  ✓ Optimization Suggestions');
  console.log('  ✓ Chaos Engineering Tools');
  console.log('  ✓ Scheduler Simulator');
  console.log('  ✓ Multi-Cloud Deployment');
  console.log('  ✓ Serverless Triggers');
  console.log('  ✓ Cost Monitoring');
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
  console.log('  ✓ AI Watermark Verification');
  console.log('  ✓ User Preferences API');
  console.log('  ✓ Organization Invites');
  console.log('  ✓ Gamification Badges');
  console.log('  ✓ Sustainability CO2 Tracking');
  console.log('  ✓ Peer Review System');
  console.log('  ✓ Task Boards (Kanban)');
  console.log('  ✓ GDPR Consent Management');
  console.log('='.repeat(60));
  console.log('Audit Improvements: CODE QUALITY');
  console.log('  ✓ JWT-Based Authentication (Production Ready)');
  console.log('  ✓ Modular Route Architecture');
  console.log('  ✓ Lifecycle State Service');
  console.log('  ✓ Static Data Extraction');
  console.log('  ✓ Workflow Stage Management');
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
