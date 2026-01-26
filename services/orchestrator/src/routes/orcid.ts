/**
 * ORCID API Routes
 *
 * Endpoints for ORCID integration:
 * - Profile lookup
 * - Ownership verification via OAuth
 * - Configuration status
 *
 * Priority: P1 - Important (Phase 3 Integration)
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getOrcidService,
  OrcidNotConfiguredError,
  OrcidApiError
} from '../services/orcid';
import { createGovernanceLogEntry } from '../../utils/governance-log';

// Simple async handler wrapper
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const router = Router();

/**
 * GET /api/orcid/status
 * Check if ORCID integration is configured
 * Public endpoint - no authentication required
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const orcidService = getOrcidService();
    const status = orcidService.getConfigStatus();

    res.json({
      status: 'ok',
      orcid: status
    });
  })
);

/**
 * GET /api/orcid/lookup/:orcidId
 * Lookup ORCID profile by ID
 * Public endpoint - returns publicly available ORCID data
 *
 * URL Parameters:
 * - orcidId: ORCID identifier (format: 0000-0000-0000-0000)
 *
 * Query Parameters:
 * - includeWorks: Include publications (default: true)
 * - includeAffiliations: Include affiliations (default: true)
 */
router.get(
  '/lookup/:orcidId',
  asyncHandler(async (req, res) => {
    const { orcidId } = req.params;
    const includeWorks = req.query.includeWorks !== 'false';
    const includeAffiliations = req.query.includeAffiliations !== 'false';

    // Validate ORCID ID format
    const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
    if (!orcidPattern.test(orcidId)) {
      res.status(400).json({
        error: 'Invalid ORCID ID format',
        code: 'INVALID_ORCID_FORMAT',
        message: 'ORCID ID must be in format 0000-0000-0000-000X',
        provided: orcidId
      });
      return;
    }

    const orcidService = getOrcidService();

    // Check if ORCID is configured (optional for public lookups)
    // Public ORCID data can be fetched without authentication
    try {
      const metadata = await orcidService.fetchAuthorMetadata(orcidId);

      // Filter response based on query parameters
      const response: any = {
        orcidId: metadata.orcidId,
        name: metadata.name,
        fetchedAt: metadata.fetchedAt
      };

      if (includeAffiliations) {
        response.affiliations = metadata.affiliations;
      }

      if (includeWorks) {
        response.works = metadata.works;
      }

      res.json({
        status: 'ok',
        data: response
      });
    } catch (error) {
      if (error instanceof OrcidApiError) {
        res.status(error.statusCode).json({
          error: 'ORCID lookup failed',
          code: 'ORCID_LOOKUP_ERROR',
          message: error.message,
          orcidId
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * POST /api/orcid/verify
 * Verify ORCID ownership via OAuth code exchange
 * Requires ORCID integration to be configured
 *
 * Request Body:
 * - code: OAuth authorization code from ORCID callback
 * - redirectUri: The redirect URI used in the authorization request
 */
router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { code, redirectUri } = req.body;

    // Validate required fields
    if (!code) {
      res.status(400).json({
        error: 'Missing authorization code',
        code: 'MISSING_CODE',
        message: 'OAuth authorization code is required'
      });
      return;
    }

    if (!redirectUri) {
      res.status(400).json({
        error: 'Missing redirect URI',
        code: 'MISSING_REDIRECT_URI',
        message: 'Redirect URI is required for token exchange'
      });
      return;
    }

    const orcidService = getOrcidService();

    // Check if ORCID is configured
    if (!orcidService.isConfigured()) {
      res.status(503).json({
        error: 'ORCID integration not configured',
        code: 'ORCID_NOT_CONFIGURED',
        message: 'ORCID verification is not available. Set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET environment variables.'
      });
      return;
    }

    try {
      const result = await orcidService.verifyOwnership(code, redirectUri);

      if (result.verified) {
        res.json({
          status: 'ok',
          verified: true,
          orcidId: result.orcidId,
          name: result.name,
          verifiedAt: result.verifiedAt
        });
      } else {
        res.status(401).json({
          error: 'ORCID verification failed',
          code: 'VERIFICATION_FAILED',
          message: result.error || 'Failed to verify ORCID ownership',
          verified: false
        });
      }
    } catch (error) {
      if (error instanceof OrcidNotConfiguredError) {
        res.status(503).json({
          error: 'ORCID integration not configured',
          code: 'ORCID_NOT_CONFIGURED',
          message: error.message
        });
        return;
      }

      if (error instanceof OrcidApiError) {
        res.status(error.statusCode).json({
          error: 'ORCID verification failed',
          code: 'ORCID_API_ERROR',
          message: error.message
        });
        return;
      }

      throw error;
    }
  })
);

/**
 * GET /api/orcid/auth/url
 * Get the ORCID OAuth authorization URL
 * Requires ORCID integration to be configured
 *
 * Query Parameters:
 * - redirectUri: The callback URL for OAuth
 * - state: Optional state parameter for CSRF protection
 * - scope: OAuth scope (default: /authenticate)
 */
router.get(
  '/auth/url',
  asyncHandler(async (req, res) => {
    const { redirectUri, state, scope } = req.query;

    if (!redirectUri || typeof redirectUri !== 'string') {
      res.status(400).json({
        error: 'Missing redirect URI',
        code: 'MISSING_REDIRECT_URI',
        message: 'Redirect URI is required to generate authorization URL'
      });
      return;
    }

    const orcidService = getOrcidService();

    // Check if ORCID is configured
    if (!orcidService.isConfigured()) {
      res.status(503).json({
        error: 'ORCID integration not configured',
        code: 'ORCID_NOT_CONFIGURED',
        message: 'ORCID authentication is not available. Set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET environment variables.'
      });
      return;
    }

    try {
      const authUrl = orcidService.getAuthorizationUrl(
        redirectUri,
        (state as string) || crypto.randomUUID(),
        (scope as string) || '/authenticate'
      );

      res.json({
        status: 'ok',
        authorizationUrl: authUrl
      });
    } catch (error) {
      if (error instanceof OrcidNotConfiguredError) {
        res.status(503).json({
          error: 'ORCID integration not configured',
          code: 'ORCID_NOT_CONFIGURED',
          message: error.message
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * GET /api/orcid/callback
 * OAuth callback endpoint for ORCID authentication
 * This is where ORCID redirects after user authorization
 *
 * Query Parameters:
 * - code: Authorization code from ORCID
 * - state: State parameter for CSRF verification
 * - error: Error code if authorization failed
 * - error_description: Error description if authorization failed
 */
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      // Log the OAuth error
      createGovernanceLogEntry(
        'ORCID_VERIFIED',
        'ORCID OAuth callback received error',
        {
          resourceType: 'orcid',
          details: {
            error,
            errorDescription: error_description,
            state
          }
        }
      );

      res.status(400).json({
        error: 'ORCID authorization denied',
        code: error,
        message: error_description || 'User denied ORCID authorization',
        state
      });
      return;
    }

    if (!code) {
      res.status(400).json({
        error: 'Missing authorization code',
        code: 'MISSING_CODE',
        message: 'No authorization code received from ORCID'
      });
      return;
    }

    // Return the code and state for the frontend to process
    // The actual token exchange should be done via POST /api/orcid/verify
    res.json({
      status: 'ok',
      message: 'Authorization code received. Use POST /api/orcid/verify to complete verification.',
      code,
      state
    });
  })
);

export default router;
