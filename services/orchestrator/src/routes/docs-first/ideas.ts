/**
 * Ideas Routes
 *
 * API endpoints for managing research idea backlog and scorecards.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { ideasService } from '../../services/docs-first/ideas.service.js';
import { requirePermission } from '../../middleware/rbac.js';
import { blockInStandby } from '../../middleware/governance-gates.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateIdeaSchema = z.object({
  researchId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateIdeaSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(['BACKLOG', 'EVALUATING', 'APPROVED', 'REJECTED', 'CONVERTED']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ScorecardSchema = z.object({
  noveltyScore: z.number().int().min(1).max(5).optional(),
  feasibilityScore: z.number().int().min(1).max(5).optional(),
  impactScore: z.number().int().min(1).max(5).optional(),
  alignmentScore: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

// POST /api/docs-first/ideas - Create idea
router.post('/',
  blockInStandby(),
  requirePermission('CREATE'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = CreateIdeaSchema.parse(req.body);
      const idea = await ideasService.createIdea(data, req.user!.id);

      res.status(201).json({ idea });
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

// GET /api/docs-first/ideas - List ideas
router.get('/',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { researchId, status, limit, offset } = req.query;

    const result = await ideasService.listIdeas({
      researchId: researchId as string,
      status: status as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json(result);
  })
);

// GET /api/docs-first/ideas/:id - Get single idea
router.get('/:id',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const idea = await ideasService.getIdea(id);

    if (!idea) {
      return res.status(404).json({
        error: 'Idea not found',
        code: 'IDEA_NOT_FOUND'
      });
    }

    res.json({ idea });
  })
);

// PATCH /api/docs-first/ideas/:id - Update idea
router.patch('/:id',
  blockInStandby(),
  requirePermission('UPDATE'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = UpdateIdeaSchema.parse(req.body);

      const idea = await ideasService.updateIdea(id, updates, req.user!.id);

      res.json({ idea });
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

// DELETE /api/docs-first/ideas/:id - Soft delete idea
router.delete('/:id',
  blockInStandby(),
  requirePermission('DELETE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await ideasService.deleteIdea(id, req.user!.id);

    res.status(204).send();
  })
);

// POST /api/docs-first/ideas/:id/scorecard - Create/update scorecard
router.post('/:id/scorecard',
  blockInStandby(),
  requirePermission('CREATE'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const scores = ScorecardSchema.parse(req.body);

      const scorecard = await ideasService.createOrUpdateScorecard(
        id,
        scores,
        req.user!.id
      );

      res.status(200).json({ scorecard });
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

// GET /api/docs-first/ideas/:id/scorecard - Get scorecard
router.get('/:id/scorecard',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const scorecard = await ideasService.getScorecard(id);

    if (!scorecard) {
      return res.status(404).json({
        error: 'Scorecard not found',
        code: 'SCORECARD_NOT_FOUND'
      });
    }

    res.json({ scorecard });
  })
);

// POST /api/docs-first/ideas/:id/convert - Convert to topic brief
router.post('/:id/convert',
  blockInStandby(),
  requirePermission('CREATE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const briefId = await ideasService.convertToTopicBrief(id, req.user!.id);

    res.status(201).json({
      message: 'Idea converted to Topic Brief',
      topicBriefId: briefId
    });
  })
);

export default router;
