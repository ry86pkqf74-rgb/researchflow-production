/**
 * Artifact Routes
 * Download and listing endpoints for manuscript artifacts
 */

import { Router, Request, Response } from 'express';
import { requireUserContext } from '../auth';
import { manuscriptStore } from '../services/manuscript-store';
import { sanitizePhiFindings } from '../services/phi-sanitize';

const router = Router();

// Apply user context requirement to all routes
router.use(requireUserContext);

/**
 * GET /api/artifacts/:manuscriptId/exports
 * List available exports for a manuscript
 */
router.get('/:manuscriptId/exports', async (req: Request, res: Response) => {
  try {
    const exports = await manuscriptStore.getExports(req.params.manuscriptId);

    // GOVERNANCE: Sanitize any PHI from export metadata
    const sanitizedExports = exports.map(exp => sanitizePhiFindings(exp));

    res.json({
      manuscriptId: req.params.manuscriptId,
      exports: sanitizedExports,
    });
  } catch (error) {
    console.error('[Artifacts] List exports error:', error);
    res.status(500).json({
      error: 'Failed to list exports',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/artifacts/:manuscriptId/exports/:exportId
 * Get specific export metadata (not the file itself)
 */
router.get('/:manuscriptId/exports/:exportId', async (req: Request, res: Response) => {
  try {
    const exportData = await manuscriptStore.getExport(
      req.params.manuscriptId,
      req.params.exportId
    );

    if (!exportData) {
      return res.status(404).json({ error: 'Export not found' });
    }

    // GOVERNANCE: Sanitize PHI before returning
    const sanitized = sanitizePhiFindings(exportData);

    res.json(sanitized);
  } catch (error) {
    console.error('[Artifacts] Get export error:', error);
    res.status(500).json({
      error: 'Failed to get export',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/artifacts/:manuscriptId/exports/:exportId/download
 * Download exported file
 * NOTE: PHI scan must have passed before export is downloadable
 */
router.get('/:manuscriptId/exports/:exportId/download', async (req: Request, res: Response) => {
  try {
    const exportData = await manuscriptStore.getExport(
      req.params.manuscriptId,
      req.params.exportId
    );

    if (!exportData) {
      return res.status(404).json({ error: 'Export not found' });
    }

    // GOVERNANCE: Check PHI scan status
    if (!exportData.phiScanPassed) {
      return res.status(403).json({
        error: 'Export blocked',
        reason: 'PHI scan did not pass. Please review and remediate PHI findings before downloading.',
        attestationRequired: true,
      });
    }

    // In production, this would stream from object storage
    // For now, return the file path/URL
    res.json({
      downloadUrl: exportData.fileUrl,
      filename: exportData.filename,
      format: exportData.format,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiry
    });
  } catch (error) {
    console.error('[Artifacts] Download error:', error);
    res.status(500).json({
      error: 'Failed to get download URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/artifacts/:manuscriptId/reviews
 * List peer review results for a manuscript
 */
router.get('/:manuscriptId/reviews', async (req: Request, res: Response) => {
  try {
    const reviews = await manuscriptStore.getReviews(req.params.manuscriptId);

    // GOVERNANCE: Sanitize any PHI from review content
    const sanitizedReviews = reviews.map(review => sanitizePhiFindings(review));

    res.json({
      manuscriptId: req.params.manuscriptId,
      reviews: sanitizedReviews,
    });
  } catch (error) {
    console.error('[Artifacts] List reviews error:', error);
    res.status(500).json({
      error: 'Failed to list reviews',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/artifacts/:manuscriptId/plagiarism
 * Get plagiarism check results
 */
router.get('/:manuscriptId/plagiarism', async (req: Request, res: Response) => {
  try {
    const results = await manuscriptStore.getPlagiarismResults(req.params.manuscriptId);

    if (!results) {
      return res.status(404).json({ error: 'No plagiarism check results found' });
    }

    // GOVERNANCE: Results already sanitized by plagiarism service
    // but double-check to ensure no matched text is exposed
    const sanitized = sanitizePhiFindings(results);

    res.json(sanitized);
  } catch (error) {
    console.error('[Artifacts] Plagiarism results error:', error);
    res.status(500).json({
      error: 'Failed to get plagiarism results',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/artifacts/:manuscriptId/claims
 * Get scientific claim verification results
 */
router.get('/:manuscriptId/claims', async (req: Request, res: Response) => {
  try {
    const claims = await manuscriptStore.getClaimVerificationResults(req.params.manuscriptId);

    if (!claims) {
      return res.status(404).json({ error: 'No claim verification results found' });
    }

    // GOVERNANCE: Sanitize any PHI
    const sanitized = sanitizePhiFindings(claims);

    res.json(sanitized);
  } catch (error) {
    console.error('[Artifacts] Claims results error:', error);
    res.status(500).json({
      error: 'Failed to get claim verification results',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
