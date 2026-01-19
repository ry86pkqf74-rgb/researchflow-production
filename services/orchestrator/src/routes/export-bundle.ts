/**
 * Export Bundle API Routes
 *
 * Handles reproducibility bundle export requests with governance controls:
 * - Request bundle export (RESEARCHER)
 * - Approve/deny requests (STEWARD)
 * - PHI override handling (STEWARD)
 * - Download approved bundles (RESEARCHER)
 *
 * Priority: P0 - CRITICAL (Governance)
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole, logAuditEvent, ROLES } from '../middleware/rbac';
import { blockExportInDemo } from '../../middleware/mode-guard';
import { logger } from '../logger/file-logger.js';
import {
  createBundleRequest,
  approveBundleRequest,
  denyBundleRequest,
  requestPHIOverride,
  generateBundleArchive,
  getBundleRequestStatus,
  getPendingBundleRequests,
  getProjectBundleRequests,
} from '../services/reproducibility-bundle';

const router = Router();

/**
 * GET /requests/pending
 * Get all pending export requests (for Steward approval queue)
 * Requires: STEWARD role
 */
router.get(
  '/requests/pending',
  requireRole(ROLES.STEWARD),
  asyncHandler(async (req: Request, res: Response) => {
    const requests = await getPendingBundleRequests();
    res.json(requests);
  })
);

/**
 * GET /requests
 * Get all export requests for a project
 * Requires: RESEARCHER role
 */
router.get(
  '/requests',
  requireRole(ROLES.RESEARCHER),
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, researchId } = req.query;
    const id = (projectId || researchId) as string;
    
    if (!id) {
      return res.status(400).json({
        error: 'projectId or researchId is required',
        code: 'MISSING_ID',
      });
    }
    
    const requests = await getProjectBundleRequests(id);
    res.json(requests);
  })
);

/**
 * POST /bundle/request
 * Request a new reproducibility bundle export
 * Requires: RESEARCHER role
 */
router.post(
  '/bundle/request',
  blockExportInDemo,
  requireRole(ROLES.RESEARCHER),
  logAuditEvent('BUNDLE_EXPORT_REQUEST', 'reproducibility_bundle'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      researchId,
      reason,
      includeTopics,
      includeSAPs,
      includeArtifacts,
      includeAuditLogs,
      includePrompts,
    } = req.body;

    if (!researchId) {
      return res.status(400).json({
        error: 'researchId is required',
        code: 'MISSING_RESEARCH_ID',
      });
    }

    const user = req.user as any;
    const result = await createBundleRequest({
      researchId,
      requestedBy: user?.id || 'anonymous',
      requestedByRole: user?.role || 'RESEARCHER',
      requestedByEmail: user?.email,
      requestedByName: user?.name,
      reason: reason || 'Reproducibility bundle export request',
      includeTopics: includeTopics ?? true,
      includeSAPs: includeSAPs ?? true,
      includeArtifacts: includeArtifacts ?? true,
      includeAuditLogs: includeAuditLogs ?? true,
      includePrompts: includePrompts ?? true,
    });

    if (result.status === 'PHI_BLOCKED') {
      return res.status(403).json({
        error: 'PHI detected in export content',
        code: 'PHI_DETECTED',
        phiScanSummary: result.phiScanSummary,
        message: 'Request PHI override from a STEWARD to proceed',
        requestId: result.requestId,
        bundleId: result.bundleId,
      });
    }

    if (result.status === 'ERROR') {
      return res.status(500).json({
        error: result.message,
        code: 'BUNDLE_REQUEST_FAILED',
      });
    }

    res.status(202).json({
      message: 'Bundle export request created, pending approval',
      requestId: result.requestId,
      bundleId: result.bundleId,
      status: result.status,
      phiScanSummary: result.phiScanSummary,
    });
  })
);

/**
 * POST /bundle/approve/:requestId
 * Approve a pending bundle export request
 * Requires: STEWARD role
 */
router.post(
  '/bundle/approve/:requestId',
  blockExportInDemo,
  requireRole(ROLES.STEWARD),
  logAuditEvent('BUNDLE_EXPORT_APPROVED', 'reproducibility_bundle'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { reason } = req.body;

    const user = req.user as any;
    const result = await approveBundleRequest(
      requestId,
      user?.id || 'anonymous',
      user?.role || 'STEWARD',
      reason
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: result.code,
      });
    }

    res.json({
      message: 'Bundle export approved',
      requestId,
      downloadUrl: `/api/ros/export/bundle/download/${requestId}`,
      expiresAt: result.expiresAt,
    });
  })
);

/**
 * POST /bundle/deny/:requestId
 * Deny a pending bundle export request
 * Requires: STEWARD role
 */
router.post(
  '/bundle/deny/:requestId',
  blockExportInDemo,
  requireRole(ROLES.STEWARD),
  logAuditEvent('BUNDLE_EXPORT_DENIED', 'reproducibility_bundle'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Denial reason is required',
        code: 'MISSING_REASON',
      });
    }

    const user = req.user as any;
    const result = await denyBundleRequest(
      requestId,
      user?.id || 'anonymous',
      user?.role || 'STEWARD',
      reason
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: result.code,
      });
    }

    res.json({
      message: 'Bundle export request denied',
      requestId,
      denialReason: reason,
    });
  })
);

/**
 * POST /bundle/phi-override/:requestId
 * Request PHI override for a blocked export
 * Requires: STEWARD role
 */
router.post(
  '/bundle/phi-override/:requestId',
  blockExportInDemo,
  requireRole(ROLES.STEWARD),
  logAuditEvent('BUNDLE_PHI_OVERRIDE', 'reproducibility_bundle'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { justification, conditions } = req.body;

    if (!justification || justification.length < 20) {
      return res.status(400).json({
        error: 'Detailed justification required (minimum 20 characters)',
        code: 'INSUFFICIENT_JUSTIFICATION',
      });
    }

    const user = req.user as any;
    const result = await requestPHIOverride(
      requestId,
      user?.id || 'anonymous',
      user?.role || 'STEWARD',
      justification,
      conditions
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: result.code,
      });
    }

    res.json({
      message: 'PHI override granted. Request is now pending approval.',
      requestId,
      overrideExpiresAt: result.expiresAt,
      conditions: result.conditions,
      nextStep: 'Request can now be approved via POST /bundle/approve/:requestId',
    });
  })
);

/**
 * GET /bundle/status/:requestId
 * Get status of a bundle export request
 * Requires: RESEARCHER role
 */
router.get(
  '/bundle/status/:requestId',
  blockExportInDemo,
  requireRole(ROLES.RESEARCHER),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;

    const status = await getBundleRequestStatus(requestId);

    if (!status) {
      return res.status(404).json({
        error: 'Bundle request not found',
        code: 'REQUEST_NOT_FOUND',
      });
    }

    res.json(status);
  })
);

/**
 * GET /bundle/download/:requestId
 * Download an approved bundle
 * Requires: RESEARCHER role + approved request
 */
router.get(
  '/bundle/download/:requestId',
  blockExportInDemo,
  requireRole(ROLES.RESEARCHER),
  logAuditEvent('BUNDLE_DOWNLOADED', 'reproducibility_bundle'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;

    const status = await getBundleRequestStatus(requestId);

    if (!status) {
      return res.status(404).json({
        error: 'Bundle request not found',
        code: 'REQUEST_NOT_FOUND',
      });
    }

    if (status.status !== 'APPROVED') {
      return res.status(403).json({
        error: 'Bundle not approved for download',
        code: 'NOT_APPROVED',
        currentStatus: status.status,
      });
    }

    if (status.expiresAt && new Date(status.expiresAt) < new Date()) {
      return res.status(410).json({
        error: 'Download link has expired',
        code: 'DOWNLOAD_EXPIRED',
        expiredAt: status.expiresAt,
      });
    }

    try {
      const { archive, manifest } = await generateBundleArchive(requestId);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reproducibility-bundle-${status.researchId}-${Date.now()}.zip`
      );

      archive.pipe(res);
      await archive.finalize();
    } catch (error) {
      logger.error('Error generating bundle archive:', error);
      res.status(500).json({
        error: 'Failed to generate bundle archive',
        code: 'ARCHIVE_GENERATION_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
