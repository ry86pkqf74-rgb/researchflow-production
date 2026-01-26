/**
 * Doc Kits Routes
 *
 * API endpoints for managing document preparation kits.
 */

import express, { type Request, type Response } from 'express';
import { docKitsService } from '../../services/docs-first/doc-kits.service.js';
import { requirePermission } from '../../middleware/rbac.js';
import { blockInStandby } from '../../middleware/governance-gates.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';

const router = express.Router();

// POST /api/docs-first/doc-kits - Create kit
router.post('/',
  blockInStandby(),
  requirePermission('CREATE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { topicBriefId, venueId } = req.body;

    if (!topicBriefId || !venueId) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR',
        required: ['topicBriefId', 'venueId']
      });
    }

    try {
      const result = await docKitsService.createKit(
        topicBriefId,
        venueId,
        req.user!.id
      );

      res.status(201).json(result);
    } catch (error) {
      if ((error as Error).message === 'Venue not found') {
        return res.status(404).json({
          error: 'Venue not found',
          code: 'VENUE_NOT_FOUND'
        });
      }
      throw error;
    }
  })
);

// GET /api/docs-first/doc-kits/:id - Get kit with items
router.get('/:id',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const result = await docKitsService.getKitWithItems(id);
      res.json(result);
    } catch (error) {
      if ((error as Error).message === 'Doc Kit not found') {
        return res.status(404).json({
          error: 'Doc Kit not found',
          code: 'KIT_NOT_FOUND'
        });
      }
      throw error;
    }
  })
);

// PATCH /api/docs-first/doc-kit-items/:id - Update item
router.patch('/items/:id',
  blockInStandby(),
  requirePermission('UPDATE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, content } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Missing required field: status',
        code: 'VALIDATION_ERROR'
      });
    }

    const item = await docKitsService.updateItemStatus(
      id,
      status,
      content || null,
      req.user!.id
    );

    res.json({ item });
  })
);

export default router;
