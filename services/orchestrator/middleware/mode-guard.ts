/**
 * Mode guard middleware for ResearchFlow Canvas
 * Enforces strict separation between DEMO and LIVE modes
 */

import { Request, Response, NextFunction } from 'express';
import { AppMode, MODE_CONFIGS } from '@researchflow/core';

/**
 * Get current mode from environment or default to DEMO for safety
 */
export const getCurrentMode = (): AppMode => {
  const mode = process.env.GOVERNANCE_MODE as AppMode;
  if (mode === AppMode.STANDBY) return AppMode.STANDBY;
  if (mode === AppMode.LIVE) return AppMode.LIVE;
  return AppMode.DEMO; // Default to DEMO for safety
};

/**
 * Get current mode configuration
 */
export const getCurrentModeConfig = () => {
  return MODE_CONFIGS[getCurrentMode()];
};

/**
 * Helper: return mock data for demo mode based on endpoint
 */
function getMockResponseForEndpoint(path: string, _method: string): any {
  // Return appropriate mock data based on endpoint
  const mockData: Record<string, any> = {
    // AI generation endpoints
    '/api/ros/ai/generate': {
      text: '[DEMO MODE] This is a sample AI-generated response showing how the system works.',
      mode: 'DEMO',
      mockResponse: true
    },
    '/api/ros/ai/analyze': {
      analysis: '[DEMO MODE] Sample analysis results would appear here.',
      insights: [
        'This is a demonstration of AI-powered analysis',
        'In LIVE mode, this would show real insights from your data'
      ],
      mode: 'DEMO',
      mockResponse: true
    },
    '/api/ros/ai/topic-brief': {
      researchBrief: `[DEMO MODE - Sample Research Brief]

Topic: Impact of Telemedicine on Diabetes Management
Scope: Retrospective cohort study, 2020-2024

Suggested Refinements:
- Consider adjusting for socioeconomic confounders
- Address selection bias in telemedicine adoption
- Plan for missing A1C values (~15% expected)

Alternative Designs: Consider propensity score matching for causal inference`,
      mode: 'DEMO',
      mockResponse: true
    },
    '/api/ros/ai/literature-search': {
      results: [
        {
          title: '[DEMO] Sample Article 1: Telemedicine Effectiveness in Chronic Disease Management',
          year: 2024,
          relevance: 'High',
          abstract: 'This is a demonstration of how literature search results would appear...'
        },
        {
          title: '[DEMO] Sample Article 2: Remote Patient Monitoring and Health Outcomes',
          year: 2023,
          relevance: 'Medium',
          abstract: 'Another example of a relevant research article...'
        },
      ],
      mode: 'DEMO',
      mockResponse: true
    },
    '/api/ros/ai/statistical-plan': {
      summary: '[DEMO MODE] Sample statistical analysis plan',
      methods: [
        'Propensity score matching',
        'Multivariable regression analysis',
        'Sensitivity analysis for missing data'
      ],
      expectedTables: [
        'Table 1: Baseline characteristics',
        'Table 2: Primary outcomes by exposure group',
        'Table 3: Subgroup analyses'
      ],
      mode: 'DEMO',
      mockResponse: true
    },
    '/api/ros/ai/manuscript-draft': {
      text: '[DEMO MODE] This represents where your AI-generated manuscript draft would appear in LIVE mode. The system would generate publication-ready content based on your research data and analysis.',
      sections: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion'],
      mode: 'DEMO',
      mockResponse: true
    },
    // PHI scanning endpoint
    '/api/ros/phi/scan': {
      status: 'PASS',
      detected: [],
      message: '[DEMO MODE] PHI scan simulation - no sensitive data detected',
      mode: 'DEMO',
      mockResponse: true
    },
  };

  // Check for exact match
  if (mockData[path]) {
    return mockData[path];
  }

  // Check for pattern matches
  if (path.includes('/api/ros/ai/')) {
    return {
      mode: 'DEMO',
      message: 'This is a demonstration. Real AI calls are disabled in DEMO mode.',
      mockResponse: true,
      data: {
        demo: true,
        endpoint: path,
        note: 'Switch to LIVE mode for real AI-powered functionality'
      }
    };
  }

  // Default mock response
  return {
    demo: true,
    mode: 'DEMO',
    message: 'Demo mode active - real operations are disabled',
    endpoint: path
  };
}

/**
 * Middleware: Block AI calls in DEMO mode and return mock responses
 */
export const blockAIInDemo = (req: Request, res: Response, next: NextFunction) => {
  const mode = getCurrentMode();

  if (mode === AppMode.DEMO) {
    // Log the blocked AI call attempt (if audit logging is configured)
    console.log(`[DEMO MODE] Blocked AI call to ${req.path} - returning mock response`);

    // Return mock response instead of calling real AI
    return res.json(getMockResponseForEndpoint(req.path, req.method));
  }

  // In LIVE mode, proceed to actual AI service
  next();
};

/**
 * Middleware: Require authentication for LIVE mode routes
 */
export const requireLiveAuth = (req: Request, res: Response, next: NextFunction) => {
  const mode = getCurrentMode();

  if (mode === AppMode.LIVE) {
    // In LIVE mode, authentication is required
    if (!req.user && !req.headers.authorization) {
      return res.status(401).json({
        error: 'Authentication required for LIVE mode',
        mode: 'LIVE',
        message: 'Please authenticate to access this resource in LIVE mode'
      });
    }
  }

  // DEMO mode doesn't require auth, or user is authenticated in LIVE mode
  next();
};

/**
 * Middleware: Block data upload in DEMO mode
 */
export const blockDataUploadInDemo = (_req: Request, res: Response, next: NextFunction) => {
  const mode = getCurrentMode();

  if (mode === AppMode.DEMO) {
    return res.status(403).json({
      error: 'Data upload not allowed in DEMO mode',
      mode: 'DEMO',
      message: 'Switch to LIVE mode to upload real research data'
    });
  }

  next();
};

/**
 * Middleware: Block export in DEMO mode
 */
export const blockExportInDemo = (_req: Request, res: Response, next: NextFunction) => {
  const mode = getCurrentMode();

  if (mode === AppMode.DEMO) {
    return res.status(403).json({
      error: 'Export not allowed in DEMO mode',
      mode: 'DEMO',
      message: 'Switch to LIVE mode to export your research artifacts'
    });
  }

  next();
};

/**
 * Middleware: Add mode information to all responses
 */
export const addModeInfo = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function(body: any) {
    const mode = getCurrentMode();
    const config = MODE_CONFIGS[mode];

    // Add mode information to the response
    const enrichedBody = {
      ...body,
      _meta: {
        mode,
        requiresAuth: config.requiresAuth,
        allowsRealAI: config.allowsRealAI,
        timestamp: new Date().toISOString()
      }
    };

    return originalJson(enrichedBody);
  };

  next();
};

/**
 * Utility: Check if current mode allows real AI calls
 */
export const allowsRealAI = (): boolean => {
  const config = getCurrentModeConfig();
  return config.allowsRealAI;
};

/**
 * Utility: Check if current mode requires authentication
 */
export const requiresAuth = (): boolean => {
  const config = getCurrentModeConfig();
  return config.requiresAuth;
};

/**
 * List of allowed paths in STANDBY mode (read-only status/config)
 */
const STANDBY_ALLOWED_PATHS = [
  '/api/status',
  '/api/health',
  '/api/governance/mode',
  '/api/governance/config',
  '/api/config',
  '/status',
  '/health'
];

/**
 * Check if a path is allowed in STANDBY mode
 */
const isPathAllowedInStandby = (path: string): boolean => {
  return STANDBY_ALLOWED_PATHS.some(allowed => 
    path === allowed || path.startsWith(allowed + '/')
  );
};

/**
 * Middleware: Enforce STANDBY mode - blocks ALL operations except status/config reads
 * 
 * STANDBY mode is a "locked" state where:
 * - Only GET requests to /status and /config endpoints are allowed
 * - All POST, PUT, DELETE, PATCH requests are blocked
 * - All other GET requests are blocked
 * - Returns 503 Service Unavailable
 */
export const enforceStandbyMode = (req: Request, res: Response, next: NextFunction) => {
  const mode = getCurrentMode();
  
  if (mode !== AppMode.STANDBY) {
    // Not in STANDBY mode, proceed normally
    return next();
  }
  
  const method = req.method.toUpperCase();
  const path = req.path;
  
  // In STANDBY mode, only GET requests to status/config are allowed
  if (method !== 'GET') {
    console.log(`[STANDBY MODE] Blocked ${method} request to ${path}`);
    return res.status(503).json({
      error: 'System in STANDBY mode',
      mode: 'STANDBY',
      message: 'No data processing is allowed in STANDBY mode. Only status and configuration reads are permitted.',
      allowedOperations: [
        'GET /api/status',
        'GET /api/health',
        'GET /api/governance/mode',
        'GET /api/governance/config'
      ]
    });
  }
  
  // Check if the GET request is to an allowed path
  if (!isPathAllowedInStandby(path)) {
    console.log(`[STANDBY MODE] Blocked GET request to non-status path: ${path}`);
    return res.status(503).json({
      error: 'System in STANDBY mode',
      mode: 'STANDBY',
      message: 'Only status and configuration endpoints are accessible in STANDBY mode.',
      allowedOperations: [
        'GET /api/status',
        'GET /api/health',
        'GET /api/governance/mode',
        'GET /api/governance/config'
      ]
    });
  }
  
  // Allowed path in STANDBY mode
  next();
};

/**
 * Middleware: Block write operations in STANDBY mode
 * 
 * Use this middleware on routes that should block writes but allow reads.
 * Less restrictive than enforceStandbyMode - allows GET requests to any endpoint.
 */
export const blockWritesInStandby = (req: Request, res: Response, next: NextFunction) => {
  const mode = getCurrentMode();
  
  if (mode !== AppMode.STANDBY) {
    return next();
  }
  
  const method = req.method.toUpperCase();
  const writeOperations = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (writeOperations.includes(method)) {
    console.log(`[STANDBY MODE] Blocked ${method} operation to ${req.path}`);
    return res.status(503).json({
      error: 'Write operations blocked in STANDBY mode',
      mode: 'STANDBY',
      message: 'The system is in maintenance mode. Write operations are temporarily disabled.',
      blockedOperation: method
    });
  }
  
  next();
};

/**
 * Utility: Check if system is in STANDBY mode
 */
export const isStandbyMode = (): boolean => {
  return getCurrentMode() === AppMode.STANDBY;
};
