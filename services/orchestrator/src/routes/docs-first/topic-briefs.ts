/**
 * Topic Briefs Routes
 *
 * API endpoints for managing research planning documents and scope freezing.
 */

import express, { type Request, type Response } from 'express';
import { topicBriefsService } from '../../services/docs-first/topic-briefs.service.js';
import { scopeFreezeService } from '../../services/docs-first/scope-freeze.service.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { blockInStandby } from '../../middleware/governance-gates.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { docAnchors } from '@researchflow/core/schema';
import { eq, desc } from 'drizzle-orm';

const router = express.Router();

const CreateTopicBriefSchema = z.object({
  researchId: z.string().min(1),
  ideaId: z.string().optional(),
  title: z.string().min(1).max(500),
  researchQuestion: z.string().min(1),
  hypothesis: z.string().optional(),
  population: z.string().optional(),
  intervention: z.string().optional(),
  comparison: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
  background: z.string().optional(),
  methodsOverview: z.string().optional(),
  expectedFindings: z.string().optional(),
});

// POST /api/docs-first/topic-briefs - Create brief
router.post('/',
  blockInStandby(),
  requirePermission('CREATE'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = CreateTopicBriefSchema.parse(req.body);
      const brief = await topicBriefsService.createBrief(data, req.user!.id);
      res.status(201).json({ brief });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }
      throw error;
    }
  })
);

// GET /api/docs-first/topic-briefs - List briefs
router.get('/',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { researchId, status, limit, offset } = req.query;
    const result = await topicBriefsService.listBriefs({
      researchId: researchId as string,
      status: status as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    res.json(result);
  })
);

// GET /api/docs-first/topic-briefs/:id - Get single brief
router.get('/:id',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const brief = await topicBriefsService.getBrief(id);

    if (!brief) {
      return res.status(404).json({
        error: 'Topic Brief not found',
        code: 'BRIEF_NOT_FOUND'
      });
    }

    res.json({ brief });
  })
);

// PATCH /api/docs-first/topic-briefs/:id - Update brief
router.patch('/:id',
  blockInStandby(),
  requirePermission('UPDATE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const brief = await topicBriefsService.updateBrief(id, req.body, req.user!.id);
      res.json({ brief });
    } catch (error) {
      if ((error as Error).message === 'Cannot update frozen Topic Brief') {
        return res.status(403).json({
          error: 'Cannot update frozen Topic Brief',
          code: 'BRIEF_FROZEN'
        });
      }
      throw error;
    }
  })
);

// DELETE /api/docs-first/topic-briefs/:id - Soft delete brief
router.delete('/:id',
  blockInStandby(),
  requirePermission('DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await topicBriefsService.deleteBrief(id, req.user!.id);
    res.status(204).send();
  })
);

// POST /api/docs-first/topic-briefs/:id/freeze - Freeze scope (STEWARD only)
router.post('/:id/freeze',
  blockInStandby(),
  requireRole('STEWARD'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const anchor = await scopeFreezeService.freezeBrief(id, req.user!.id);

      res.status(201).json({
        message: 'Topic Brief frozen successfully',
        anchor: {
          id: anchor.id,
          versionNumber: anchor.versionNumber,
          hash: anchor.currentHash,
          frozenAt: anchor.createdAt
        }
      });
    } catch (error) {
      if ((error as Error).message === 'Topic Brief already frozen') {
        return res.status(409).json({
          error: 'Topic Brief already frozen',
          code: 'ALREADY_FROZEN'
        });
      }
      throw error;
    }
  })
);

// GET /api/docs-first/topic-briefs/:id/snapshot - Get frozen snapshot
router.get('/:id/snapshot',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const snapshot = await scopeFreezeService.getLatestSnapshot(id);

    if (!snapshot) {
      return res.status(404).json({
        error: 'No frozen snapshot found',
        code: 'NO_SNAPSHOT'
      });
    }

    res.json({ snapshot });
  })
);

// GET /api/docs-first/anchors/:id/verify - Verify anchor integrity
router.get('/anchors/:id/verify',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await scopeFreezeService.verifyAnchor(id);

    res.json(result);
  })
);

export default router;
