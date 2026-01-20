/**
 * Venues Routes
 *
 * API endpoints for managing target publication/presentation venues.
 */

import express, { type Request, type Response } from 'express';
import { db } from '../../lib/db.js';
import { venues, type Venue } from '@researchflow/core/schema';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { blockInStandby } from '../../middleware/governance-gates.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { eq, and } from 'drizzle-orm';
import { createAuditEntry } from '../../services/auditService.js';

const router = express.Router();

// GET /api/docs-first/venues - List venues
router.get('/',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { type, search } = req.query;

    const conditions = [eq(venues.deletedAt, null)];

    if (type) {
      conditions.push(eq(venues.type, type as string));
    }

    const results = await db.select()
      .from(venues)
      .where(and(...conditions))
      .orderBy(venues.name);

    // Simple search filter if provided
    let filteredResults = results;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredResults = results.filter(v =>
        v.name.toLowerCase().includes(searchLower)
      );
    }

    res.json({ venues: filteredResults });
  })
);

// GET /api/docs-first/venues/:id - Get single venue
router.get('/:id',
  requirePermission('VIEW'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await db.select()
      .from(venues)
      .where(and(eq(venues.id, id), eq(venues.deletedAt, null)))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({
        error: 'Venue not found',
        code: 'VENUE_NOT_FOUND'
      });
    }

    res.json({ venue: result[0] });
  })
);

// POST /api/docs-first/venues - Create venue (ADMIN only)
router.post('/',
  blockInStandby(),
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, type, impactFactor, acceptanceRate, wordLimit, abstractLimit, guidelinesUrl, submissionDeadline } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR',
        required: ['name', 'type']
      });
    }

    const [venue] = await db.insert(venues)
      .values({
        name,
        type,
        impactFactor,
        acceptanceRate,
        wordLimit,
        abstractLimit,
        guidelinesUrl,
        submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : undefined,
      })
      .returning();

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'CREATE_VENUE',
      userId: req.user!.id,
      resourceType: 'venue',
      resourceId: venue.id,
      details: { name: venue.name, type: venue.type }
    });

    res.status(201).json({ venue });
  })
);

// PATCH /api/docs-first/venues/:id - Update venue (ADMIN only)
router.patch('/:id',
  blockInStandby(),
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const [venue] = await db.update(venues)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(venues.id, id))
      .returning();

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'UPDATE_VENUE',
      userId: req.user!.id,
      resourceType: 'venue',
      resourceId: id,
      details: { changedFields: Object.keys(req.body) }
    });

    res.json({ venue });
  })
);

export default router;
