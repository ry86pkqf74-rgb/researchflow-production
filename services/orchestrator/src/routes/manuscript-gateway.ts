/**
 * Manuscript Service Gateway
 * Proxies requests to the manuscript-service microservice
 * Phase B: Manuscript Productionization Integration
 */

import { Router, Request, Response, NextFunction } from 'express';
import http from 'http';
import https from 'https';
import { logger } from '../logger/file-logger.js';

const router = Router();

// Manuscript service URL
const MANUSCRIPT_SERVICE_URL = process.env.MANUSCRIPT_SERVICE_URL || 'http://manuscript-service:3003';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'dev-service-token';

/**
 * Proxy request to manuscript service
 */
async function proxyToManuscriptService(
  req: Request,
  res: Response,
  targetPath: string
): Promise<void> {
  const url = new URL(targetPath, MANUSCRIPT_SERVICE_URL);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const options: http.RequestOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'x-service-token': SERVICE_TOKEN,
      // Forward user context from request
      'x-user-id': (req as any).user?.id || (req as any).userContext?.userId || 'anonymous',
      'x-user-email': (req as any).user?.email || (req as any).userContext?.email || '',
      'x-user-role': (req as any).user?.role || (req as any).userContext?.role || 'viewer',
    },
  };

  return new Promise((resolve, reject) => {
    const proxyReq = httpModule.request(options, (proxyRes) => {
      // Set status code
      res.status(proxyRes.statusCode || 500);

      // Forward headers (excluding hop-by-hop headers)
      const hopByHopHeaders = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade'];
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (!hopByHopHeaders.includes(key.toLowerCase()) && value) {
          res.setHeader(key, value);
        }
      });

      // Pipe response body
      let data = '';
      proxyRes.on('data', (chunk) => {
        data += chunk;
      });

      proxyRes.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.json(jsonData);
        } catch {
          res.send(data);
        }
        resolve();
      });
    });

    proxyReq.on('error', (error) => {
      logger.error('[Manuscript Gateway] Proxy error:', error);
      res.status(503).json({
        error: 'Manuscript service unavailable',
        message: error.message,
      });
      resolve();
    });

    // Forward request body if present
    if (req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
    }

    proxyReq.end();
  });
}

/**
 * Health check for manuscript service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    await proxyToManuscriptService(req, res, '/health');
  } catch (error) {
    res.status(503).json({
      error: 'Manuscript service health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ==========================================
// Manuscript CRUD Operations
// ==========================================

/**
 * POST /api/manuscripts
 * Create a new manuscript
 */
router.post('/', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, '/api/manuscripts');
});

/**
 * GET /api/manuscripts/:id
 * Get manuscript by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}`);
});

/**
 * GET /api/manuscripts/:id/versions
 * Get version history
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/versions`);
});

/**
 * GET /api/manuscripts/:id/diff
 * Get diff between versions
 */
router.get('/:id/diff', async (req: Request, res: Response) => {
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/diff?${queryString}`);
});

// ==========================================
// Job-based Operations
// ==========================================

/**
 * POST /api/manuscripts/:id/outline
 * Generate manuscript outline
 */
router.post('/:id/outline', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/outline`);
});

/**
 * POST /api/manuscripts/:id/intro
 * Draft section with literature integration
 */
router.post('/:id/intro', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/intro`);
});

/**
 * POST /api/manuscripts/:id/review
 * Simulate peer review
 */
router.post('/:id/review', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/review`);
});

/**
 * POST /api/manuscripts/:id/export
 * Export manuscript (with PHI scan gate)
 */
router.post('/:id/export', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/export`);
});

/**
 * POST /api/manuscripts/:id/plagiarism
 * Run plagiarism check
 */
router.post('/:id/plagiarism', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/plagiarism`);
});

/**
 * POST /api/manuscripts/:id/comments/summarize
 * Summarize review comments
 */
router.post('/:id/comments/summarize', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/${req.params.id}/comments/summarize`);
});

// ==========================================
// Job Status
// ==========================================

/**
 * GET /api/manuscripts/jobs/:jobId
 * Get job status
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/manuscripts/jobs/${req.params.jobId}`);
});

/**
 * GET /api/manuscripts/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, '/api/manuscripts/queue/stats');
});

// ==========================================
// Artifact Operations
// ==========================================

/**
 * GET /api/manuscripts/artifacts/:manuscriptId/exports
 * List exports for a manuscript
 */
router.get('/artifacts/:manuscriptId/exports', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/artifacts/${req.params.manuscriptId}/exports`);
});

/**
 * GET /api/manuscripts/artifacts/:manuscriptId/exports/:exportId
 * Get specific export metadata
 */
router.get('/artifacts/:manuscriptId/exports/:exportId', async (req: Request, res: Response) => {
  await proxyToManuscriptService(
    req,
    res,
    `/api/artifacts/${req.params.manuscriptId}/exports/${req.params.exportId}`
  );
});

/**
 * GET /api/manuscripts/artifacts/:manuscriptId/exports/:exportId/download
 * Download export (PHI scan must have passed)
 */
router.get('/artifacts/:manuscriptId/exports/:exportId/download', async (req: Request, res: Response) => {
  await proxyToManuscriptService(
    req,
    res,
    `/api/artifacts/${req.params.manuscriptId}/exports/${req.params.exportId}/download`
  );
});

/**
 * GET /api/manuscripts/artifacts/:manuscriptId/reviews
 * List peer review results
 */
router.get('/artifacts/:manuscriptId/reviews', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/artifacts/${req.params.manuscriptId}/reviews`);
});

/**
 * GET /api/manuscripts/artifacts/:manuscriptId/plagiarism
 * Get plagiarism check results
 */
router.get('/artifacts/:manuscriptId/plagiarism', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/artifacts/${req.params.manuscriptId}/plagiarism`);
});

/**
 * GET /api/manuscripts/artifacts/:manuscriptId/claims
 * Get claim verification results
 */
router.get('/artifacts/:manuscriptId/claims', async (req: Request, res: Response) => {
  await proxyToManuscriptService(req, res, `/api/artifacts/${req.params.manuscriptId}/claims`);
});

export default router;
