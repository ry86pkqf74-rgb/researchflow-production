/**
 * Manuscript Generation Routes
 *
 * Endpoints for AI-powered manuscript section generation.
 * All operations are PHI-scanned and governance-gated.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createJob } from '../services/manuscriptJobs';
import { postWorkerTask } from '../clients/workerClient';
import { assertNoPhiInObjectOrThrow } from '../security/phiGuard';
import { createAuditEvent } from '../services/revisionsService';
import type {
  GenerateSectionRequest,
  GenerateSectionResponse,
  ManuscriptSectionKey,
} from '../../../../shared/contracts/manuscripts';

const router = Router();

const VALID_SECTIONS: ManuscriptSectionKey[] = [
  'TITLE',
  'ABSTRACT',
  'INTRODUCTION',
  'METHODS',
  'RESULTS',
  'DISCUSSION',
  'REFERENCES',
  'FIGURES',
  'TABLES',
  'SUPPLEMENT',
  'ACKNOWLEDGEMENTS',
  'CONFLICTS',
];

/**
 * POST /api/manuscripts/:id/sections/:sectionKey/generate
 *
 * Generate a manuscript section using AI
 */
router.post(
  '/:id/sections/:sectionKey/generate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const sectionKey = req.params.sectionKey.toUpperCase() as ManuscriptSectionKey;

      // Validate section key
      if (!VALID_SECTIONS.includes(sectionKey)) {
        return res.status(400).json({
          error: 'Invalid section key',
          validSections: VALID_SECTIONS,
        });
      }

      const body = req.body as Omit<GenerateSectionRequest, 'manuscriptId' | 'sectionKey'>;

      // PHI scan the request (inputs should only contain refs, not PHI)
      try {
        assertNoPhiInObjectOrThrow('generate_section_request', body);
      } catch (phiError: any) {
        // Log PHI block audit event
        await createAuditEvent(manuscriptId, 'PHI_BLOCKED', (req as any).user?.id || 'system', {
          sectionKey,
          operation: 'generate_section',
          locations: phiError.locations,
        });

        return res.status(403).json({
          error: 'PHI_BLOCKED',
          message: 'PHI detected in request. Only de-identified references are allowed.',
          locations: phiError.locations,
        });
      }

      // Create job record
      const job = await createJob({
        manuscriptId,
        jobType: 'GENERATE_SECTION',
        requestJson: {
          manuscriptId,
          sectionKey,
          inputs: body.inputs || {},
          constraints: body.constraints || {},
        },
      });

      // Enqueue to worker
      try {
        await postWorkerTask('/tasks/generate_section', {
          jobId: job.id,
          manuscriptId,
          sectionKey,
          inputs: body.inputs || {},
          constraints: body.constraints || {},
        });
      } catch (workerError) {
        // Worker unreachable - job will be picked up later
        console.error('Worker task submission failed:', workerError);
      }

      // Create audit event
      await createAuditEvent(
        manuscriptId,
        'SECTION_GENERATED',
        (req as any).user?.id || 'system',
        {
          sectionKey,
          jobId: job.id,
          constraints: body.constraints,
        }
      );

      const response: GenerateSectionResponse = {
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
 * POST /api/manuscripts/:id/generate-all
 *
 * Generate all IMRaD sections for a manuscript
 */
router.post(
  '/:id/generate-all',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const body = req.body as {
        inputs?: GenerateSectionRequest['inputs'];
        constraints?: GenerateSectionRequest['constraints'];
        sections?: ManuscriptSectionKey[];
      };

      const sectionsToGenerate = body.sections || [
        'INTRODUCTION',
        'METHODS',
        'RESULTS',
        'DISCUSSION',
        'ABSTRACT',
      ];

      // PHI scan
      try {
        assertNoPhiInObjectOrThrow('generate_all_request', body);
      } catch (phiError: any) {
        return res.status(403).json({
          error: 'PHI_BLOCKED',
          locations: phiError.locations,
        });
      }

      // Create jobs for each section
      const jobs: Array<{ sectionKey: string; jobId: string; statusUrl: string }> = [];

      for (const sectionKey of sectionsToGenerate) {
        const job = await createJob({
          manuscriptId,
          jobType: 'GENERATE_SECTION',
          requestJson: {
            manuscriptId,
            sectionKey,
            inputs: body.inputs || {},
            constraints: body.constraints || {},
          },
        });

        jobs.push({
          sectionKey,
          jobId: job.id,
          statusUrl: `/api/jobs/${job.id}`,
        });

        // Enqueue to worker
        try {
          await postWorkerTask('/tasks/generate_section', {
            jobId: job.id,
            manuscriptId,
            sectionKey,
            inputs: body.inputs || {},
            constraints: body.constraints || {},
          });
        } catch {
          // Continue with other sections
        }
      }

      return res.status(202).json({ jobs });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
