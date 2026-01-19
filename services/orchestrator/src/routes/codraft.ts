/**
 * Co-draft Routes
 *
 * AI-assisted drafting endpoints for expanding, clarifying,
 * or suggesting improvements to manuscript content.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createJob } from '../services/manuscriptJobs';
import { postWorkerTask } from '../clients/workerClient';
import { assertNoPhiOrThrow } from '../security/phiGuard';
import { createAuditEvent } from '../services/revisionsService';
import type {
  CoDraftRequest,
  CoDraftResponse,
  ManuscriptSectionKey,
} from '../../../../shared/contracts/manuscripts';

const router = Router();

/**
 * POST /api/manuscripts/:id/codraft
 *
 * Get AI suggestions for expanding/clarifying selected text
 */
router.post(
  '/:id/codraft',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const { sectionKey, instruction, selectedText } = req.body as Omit<
        CoDraftRequest,
        'manuscriptId'
      >;

      if (!instruction) {
        return res.status(400).json({ error: 'instruction is required' });
      }

      // PHI scan the selected text
      if (selectedText) {
        try {
          assertNoPhiOrThrow('codraft_selected', selectedText);
        } catch (phiError: any) {
          await createAuditEvent(manuscriptId, 'PHI_BLOCKED', (req as any).user?.id || 'system', {
            operation: 'codraft',
            sectionKey,
            locations: phiError.locations,
          });

          return res.status(403).json({
            error: 'PHI_BLOCKED',
            message: 'PHI detected in selected text',
            locations: phiError.locations,
          });
        }
      }

      // Create job
      const job = await createJob({
        manuscriptId,
        jobType: 'CODRAFT',
        requestJson: {
          manuscriptId,
          sectionKey,
          instruction,
          selectedText,
        },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/codraft', {
          jobId: job.id,
          manuscriptId,
          sectionKey,
          instruction,
          selectedText,
        });
      } catch (workerError) {
        console.error('Worker task submission failed:', workerError);
      }

      const response: CoDraftResponse = {
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
 * POST /api/manuscripts/:id/peer-review
 *
 * Run simulated peer review
 */
router.post(
  '/:id/peer-review',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const { journalStyleId } = req.body;
      const actor = (req as any).user?.id || 'anonymous';

      // Create job
      const job = await createJob({
        manuscriptId,
        jobType: 'PEER_REVIEW',
        requestJson: {
          manuscriptId,
          journalStyleId,
        },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/peer_review', {
          jobId: job.id,
          manuscriptId,
          journalStyleId,
        });
      } catch {
        // Continue
      }

      // Audit
      await createAuditEvent(manuscriptId, 'PEER_REVIEW_SIMULATED', actor, {
        jobId: job.id,
        journalStyleId,
      });

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
 * POST /api/manuscripts/:id/claims/verify
 *
 * Verify claims in manuscript
 */
router.post(
  '/:id/claims/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const actor = (req as any).user?.id || 'anonymous';

      // Create job
      const job = await createJob({
        manuscriptId,
        jobType: 'CLAIM_VERIFY',
        requestJson: { manuscriptId },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/claim_verify', {
          jobId: job.id,
          manuscriptId,
        });
      } catch {
        // Continue
      }

      // Audit
      await createAuditEvent(manuscriptId, 'CLAIM_VERIFICATION', actor, {
        jobId: job.id,
      });

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
 * POST /api/manuscripts/:id/translate
 *
 * Translate a section to another language
 */
router.post(
  '/:id/translate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const { sectionKey, targetLanguage } = req.body;
      const actor = (req as any).user?.id || 'anonymous';

      if (!sectionKey || !targetLanguage) {
        return res.status(400).json({
          error: 'sectionKey and targetLanguage are required',
        });
      }

      // Create job
      const job = await createJob({
        manuscriptId,
        jobType: 'TRANSLATE',
        requestJson: {
          manuscriptId,
          sectionKey,
          targetLanguage,
        },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/translate', {
          jobId: job.id,
          manuscriptId,
          sectionKey,
          targetLanguage,
        });
      } catch {
        // Continue
      }

      // Audit
      await createAuditEvent(manuscriptId, 'TRANSLATION_REQUESTED', actor, {
        jobId: job.id,
        sectionKey,
        targetLanguage,
      });

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
