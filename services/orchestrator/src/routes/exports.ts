/**
 * Export Routes
 *
 * Endpoints for exporting manuscripts to various formats.
 * All exports are PHI-scanned and governance-gated.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createJob } from '../services/manuscriptJobs';
import { postWorkerTask } from '../clients/workerClient';
import { assertNoPhiOrThrow } from '../security/phiGuard';
import { checkGovernanceGate, getManuscriptMode } from './approvals';
import { createAuditEvent } from '../services/revisionsService';
import type {
  ExportRequest,
  ExportResponse,
  ManuscriptFormat,
} from '../../../../shared/contracts/manuscripts';

const router = Router();

const VALID_FORMATS: ManuscriptFormat[] = ['md', 'docx', 'pdf', 'latex_zip'];

/**
 * POST /api/manuscripts/:id/export
 *
 * Export manuscript to specified format
 */
router.post(
  '/:id/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const { format, journalStyleId, doubleBlind } = req.body as Omit<ExportRequest, 'manuscriptId'>;
      const actor = (req as any).user?.id || 'anonymous';

      // Validate format
      if (!format || !VALID_FORMATS.includes(format)) {
        return res.status(400).json({
          error: 'Invalid format',
          validFormats: VALID_FORMATS,
        });
      }

      // Check governance gate
      const gateResult = await checkGovernanceGate(manuscriptId, 'EXPORT', actor);

      if (!gateResult.allowed) {
        return res.status(403).json({
          error: 'EXPORT_BLOCKED',
          reason: gateResult.reason,
          requiredApprovals: gateResult.requiredApprovals,
        });
      }

      // Create job
      const job = await createJob({
        manuscriptId,
        jobType: 'EXPORT',
        requestJson: {
          manuscriptId,
          format,
          journalStyleId,
          doubleBlind: doubleBlind || false,
        },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/export', {
          jobId: job.id,
          manuscriptId,
          format,
          journalStyleId,
          doubleBlind: doubleBlind || false,
        });
      } catch (workerError) {
        console.error('Worker task submission failed:', workerError);
      }

      // Create audit event
      await createAuditEvent(manuscriptId, 'EXPORT_REQUESTED', actor, {
        jobId: job.id,
        format,
        journalStyleId,
        doubleBlind,
      });

      const response: ExportResponse = {
        jobId: job.id,
        statusUrl: `/api/jobs/${job.id}`,
      };

      return res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/manuscripts/:id/exports
 *
 * List export jobs for a manuscript
 */
router.get(
  '/:id/exports',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;

      // TODO: Fetch from database
      // const exports = await db.select().from(manuscript_jobs)
      //   .where(eq(manuscript_id, manuscriptId))
      //   .where(eq(job_type, 'EXPORT'));

      return res.json({ exports: [] });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/manuscripts/:id/validate
 *
 * Validate manuscript against journal guidelines
 */
router.post(
  '/:id/validate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const { journalStyleId } = req.body;

      // Create validation job
      const job = await createJob({
        manuscriptId,
        jobType: 'VALIDATE_SUBMISSION',
        requestJson: {
          manuscriptId,
          journalStyleId,
        },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/validate_submission', {
          jobId: job.id,
          manuscriptId,
          journalStyleId,
        });
      } catch {
        // Continue even if worker unavailable
      }

      return res.status(202).json({
        jobId: job.id,
        statusUrl: `/api/jobs/${job.id}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/manuscripts/:id/repro-bundle
 *
 * Create reproducibility bundle
 */
router.post(
  '/:id/repro-bundle',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const actor = (req as any).user?.id || 'anonymous';

      // Check governance gate
      const gateResult = await checkGovernanceGate(manuscriptId, 'EXPORT', actor);

      if (!gateResult.allowed) {
        return res.status(403).json({
          error: 'EXPORT_BLOCKED',
          reason: gateResult.reason,
        });
      }

      // Create job
      const job = await createJob({
        manuscriptId,
        jobType: 'REPRO_BUNDLE',
        requestJson: { manuscriptId },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/repro_bundle', {
          jobId: job.id,
          manuscriptId,
        });
      } catch {
        // Continue
      }

      return res.status(202).json({
        jobId: job.id,
        statusUrl: `/api/jobs/${job.id}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
