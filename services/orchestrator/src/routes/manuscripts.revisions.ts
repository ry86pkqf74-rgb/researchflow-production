/**
 * Manuscript Revisions Routes
 *
 * Endpoints for managing section revisions with versioning and rollback.
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  commitSectionRevision,
  getLatestRevision,
  getRevisionHistory,
  rollbackToRevision,
  getAllRevisions,
  getSectionWordCounts,
  getAuditTrail,
} from '../services/revisionsService';
import { assertNoPhiOrThrow } from '../security/phiGuard';
import type {
  ManuscriptSectionKey,
  RollbackRequest,
  RollbackResponse,
} from '../../../../shared/contracts/manuscripts';

const router = Router();

/**
 * GET /api/manuscripts/:id/sections/:sectionKey/revisions
 *
 * Get revision history for a section
 */
router.get(
  '/:id/sections/:sectionKey/revisions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const sectionKey = req.params.sectionKey.toUpperCase() as ManuscriptSectionKey;

      const revisions = await getRevisionHistory(manuscriptId, sectionKey);

      return res.json({ revisions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/manuscripts/:id/sections/:sectionKey/latest
 *
 * Get the latest revision for a section
 */
router.get(
  '/:id/sections/:sectionKey/latest',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const sectionKey = req.params.sectionKey.toUpperCase() as ManuscriptSectionKey;

      const revision = await getLatestRevision(manuscriptId, sectionKey);

      if (!revision) {
        return res.status(404).json({ error: 'No revision found for this section' });
      }

      return res.json({ revision });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/manuscripts/:id/sections/:sectionKey/commit
 *
 * Commit a new revision for a section
 */
router.post(
  '/:id/sections/:sectionKey/commit',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const sectionKey = req.params.sectionKey.toUpperCase() as ManuscriptSectionKey;
      const { contentMd, contentJson, commitMessage } = req.body;

      if (!contentMd || typeof contentMd !== 'string') {
        return res.status(400).json({ error: 'contentMd is required' });
      }

      // PHI scan the content
      try {
        assertNoPhiOrThrow(`commit:${sectionKey}`, contentMd);
        if (contentJson) {
          assertNoPhiOrThrow(`commit:${sectionKey}:json`, JSON.stringify(contentJson));
        }
      } catch (phiError: any) {
        return res.status(403).json({
          error: 'PHI_BLOCKED',
          message: 'PHI detected in content. Please remove PHI before committing.',
          locations: phiError.locations,
        });
      }

      const result = await commitSectionRevision({
        manuscriptId,
        sectionKey,
        contentMd,
        contentJson,
        actor: (req as any).user?.id || 'anonymous',
        commitMessage,
      });

      return res.status(201).json({
        ok: true,
        revision: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/manuscripts/:id/sections/:sectionKey/rollback
 *
 * Rollback to a specific revision (creates new revision copying content)
 */
router.post(
  '/:id/sections/:sectionKey/rollback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const sectionKey = req.params.sectionKey.toUpperCase() as ManuscriptSectionKey;
      const { targetRevisionId } = req.body as RollbackRequest;

      if (!targetRevisionId) {
        return res.status(400).json({ error: 'targetRevisionId is required' });
      }

      const result = await rollbackToRevision(
        manuscriptId,
        sectionKey,
        targetRevisionId,
        (req as any).user?.id || 'anonymous'
      );

      const response: RollbackResponse = {
        ok: true,
        revision: result,
      };

      return res.json(response);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }
);

/**
 * GET /api/manuscripts/:id/revisions
 *
 * Get all revisions for a manuscript (all sections)
 */
router.get(
  '/:id/revisions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const revisions = await getAllRevisions(manuscriptId);

      return res.json({ revisions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/manuscripts/:id/word-counts
 *
 * Get word counts for all sections
 */
router.get(
  '/:id/word-counts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const wordCounts = await getSectionWordCounts(manuscriptId);

      return res.json({ wordCounts });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/manuscripts/:id/audit
 *
 * Get audit trail for a manuscript
 */
router.get(
  '/:id/audit',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await getAuditTrail(manuscriptId, { limit, offset });

      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
