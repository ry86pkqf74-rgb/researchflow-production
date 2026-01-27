/**
 * Guidelines Proxy Routes
 *
 * Proxies requests to the Python FastAPI Guideline Engine service.
 * This architecture separates the deterministic calculator (Python) from
 * the Node.js orchestrator for better maintainability.
 */

import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const router = Router();

// Guideline Engine URL (Python FastAPI service)
const ENGINE_URL = process.env.GUIDELINE_ENGINE_URL || 'http://guideline-engine:8001';

// Axios instance with default timeout
const engineClient = axios.create({
  baseURL: ENGINE_URL,
  timeout: 60000, // 60 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Generic proxy handler
 */
async function proxyRequest(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const config: AxiosRequestConfig = {
      method,
      url: path,
      params: req.query,
      data: method !== 'get' ? req.body : undefined,
    };

    // Forward user context if available
    if (req.user?.id) {
      config.params = { ...config.params, user_id: req.user.id };
    }

    const response = await engineClient.request(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      // Forward error response from engine
      res.status(axiosError.response.status).json(axiosError.response.data);
    } else if (axiosError.request) {
      // No response received
      res.status(503).json({
        error: 'Guideline Engine unavailable',
        code: 'ENGINE_UNAVAILABLE',
      });
    } else {
      // Request setup error
      res.status(500).json({
        error: axiosError.message,
        code: 'PROXY_ERROR',
      });
    }
  }
}

// =============================================================================
// SYSTEM CARDS
// =============================================================================

/**
 * Search system cards
 * GET /api/guidelines/search
 */
router.get('/search', (req, res) => {
  proxyRequest('get', '/guidelines/search', req, res);
});

/**
 * Get system card by ID with rules
 * GET /api/guidelines/:id
 */
router.get('/:id', (req, res) => {
  proxyRequest('get', `/guidelines/${req.params.id}`, req, res);
});

/**
 * Create a new system card
 * POST /api/guidelines
 */
router.post('/', (req, res) => {
  proxyRequest('post', '/guidelines', req, res);
});

// =============================================================================
// CALCULATOR
// =============================================================================

/**
 * Calculate score/stage
 * POST /api/guidelines/calculate
 */
router.post('/calculate', (req, res) => {
  proxyRequest('post', '/guidelines/calculate', req, res);
});

// =============================================================================
// RULE SPECS
// =============================================================================

/**
 * Create a rule spec for a system
 * POST /api/guidelines/:id/rules
 */
router.post('/:id/rules', (req, res) => {
  proxyRequest('post', `/guidelines/${req.params.id}/rules`, req, res);
});

/**
 * Validate a rule spec against test cases
 * POST /api/guidelines/rules/:ruleId/validate
 */
router.post('/rules/:ruleId/validate', (req, res) => {
  proxyRequest('post', `/guidelines/rules/${req.params.ruleId}/validate`, req, res);
});

// =============================================================================
// BLUEPRINTS
// =============================================================================

/**
 * Get user's blueprints
 * GET /api/guidelines/blueprints/mine
 */
router.get('/blueprints/mine', (req, res) => {
  if (!req.user?.id && !req.query.user_id) {
    return res.status(400).json({ error: 'User ID required' });
  }
  proxyRequest('get', '/guidelines/blueprints/mine', req, res);
});

/**
 * Get blueprints for a system card
 * GET /api/guidelines/:id/blueprints
 */
router.get('/:id/blueprints', (req, res) => {
  proxyRequest('get', `/guidelines/${req.params.id}/blueprints`, req, res);
});

/**
 * Get a specific blueprint
 * GET /api/guidelines/blueprints/:blueprintId
 */
router.get('/blueprints/:blueprintId', (req, res) => {
  proxyRequest('get', `/guidelines/blueprints/${req.params.blueprintId}`, req, res);
});

/**
 * Generate a validation blueprint (AI-assisted)
 * POST /api/guidelines/ideate
 */
router.post('/ideate', (req, res) => {
  proxyRequest('post', '/guidelines/ideate', req, res);
});

/**
 * Update a blueprint
 * PATCH /api/guidelines/blueprints/:blueprintId
 */
router.patch('/blueprints/:blueprintId', (req, res) => {
  proxyRequest('patch', `/guidelines/blueprints/${req.params.blueprintId}`, req, res);
});

/**
 * Export blueprint to manuscript format
 * POST /api/guidelines/blueprints/:blueprintId/export
 */
router.post('/blueprints/:blueprintId/export', (req, res) => {
  proxyRequest('post', `/guidelines/blueprints/${req.params.blueprintId}/export`, req, res);
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Check Guideline Engine health
 * GET /api/guidelines/health
 */
router.get('/health', async (req, res) => {
  try {
    const response = await engineClient.get('/health');
    res.json({
      orchestrator: 'healthy',
      engine: response.data,
    });
  } catch (error) {
    res.status(503).json({
      orchestrator: 'healthy',
      engine: 'unavailable',
    });
  }
});

export default router;
