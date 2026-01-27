/**
 * Hub Milestones API Routes
 *
 * CRUD operations for project milestones with goal linking
 * and calendar integration.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const router = Router();

// Get database pool from app context
const getPool = (req: Request): Pool => {
  return (req.app as any).locals?.pool || (req as any).pool;
};

// Validation schemas
const MilestoneStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'missed']);

const CreateMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  goalId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  targetDate: z.string().datetime(),
  status: MilestoneStatusSchema.optional().default('pending'),
  sortOrder: z.number().int().optional().default(0),
  linkedTaskIds: z.array(z.string().uuid()).optional().default([]),
  metadata: z.record(z.any()).optional().default({}),
});

const UpdateMilestoneSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  targetDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional().nullable(),
  status: MilestoneStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
  linkedTaskIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/hub/milestones
 * List milestones for a project
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, goalId, status } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    let query = `
      SELECT m.*, g.title as goal_title
      FROM milestones m
      LEFT JOIN hub_goals g ON m.goal_id = g.id
      WHERE m.project_id = $1
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (goalId) {
      query += ` AND m.goal_id = $${paramIndex++}`;
      params.push(goalId);
    }

    if (status) {
      query += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY m.target_date ASC, m.sort_order ASC';

    const result = await pool.query(query, params);
    res.json({ milestones: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/milestones
 * Create a new milestone
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateMilestoneSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO milestones (
        project_id, goal_id, title, description, target_date,
        status, sort_order, linked_task_ids, metadata, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.projectId,
        input.goalId || null,
        input.title,
        input.description || null,
        input.targetDate,
        input.status,
        input.sortOrder,
        input.linkedTaskIds,
        JSON.stringify(input.metadata),
        userId,
      ]
    );

    // Log activity
    await pool.query(
      `INSERT INTO project_activity (project_id, user_id, action, entity_type, entity_id, entity_name)
       VALUES ($1, $2, 'created', 'milestone', $3, $4)`,
      [input.projectId, userId, result.rows[0].id, input.title]
    ).catch(() => {}); // Non-blocking

    res.status(201).json({ milestone: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/milestones/:milestoneId
 * Get a specific milestone
 */
router.get('/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { milestoneId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `SELECT m.*, g.title as goal_title
       FROM milestones m
       LEFT JOIN hub_goals g ON m.goal_id = g.id
       WHERE m.id = $1`,
      [milestoneId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Get linked tasks
    const tasksResult = await pool.query(
      `SELECT * FROM hub_tasks WHERE id = ANY($1)`,
      [result.rows[0].linked_task_ids || []]
    );

    res.json({
      milestone: result.rows[0],
      linkedTasks: tasksResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/hub/milestones/:milestoneId
 * Update a milestone
 */
router.patch('/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { milestoneId } = req.params;
    const input = UpdateMilestoneSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = [
      'title', 'description', 'targetDate', 'completedDate',
      'status', 'sortOrder', 'linkedTaskIds', 'metadata',
    ];

    const dbFields: Record<string, string> = {
      targetDate: 'target_date',
      completedDate: 'completed_date',
      sortOrder: 'sort_order',
      linkedTaskIds: 'linked_task_ids',
    };

    for (const field of fields) {
      if ((input as any)[field] !== undefined) {
        const dbField = dbFields[field] || field.toLowerCase();
        updates.push(`${dbField} = $${paramIndex++}`);

        let value = (input as any)[field];
        if (field === 'metadata') {
          value = JSON.stringify(value);
        }
        values.push(value);
      }
    }

    // If status is 'completed' and no completedDate provided, set it
    if (input.status === 'completed' && !input.completedDate) {
      updates.push(`completed_date = NOW()`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(milestoneId);

    const result = await pool.query(
      `UPDATE milestones SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Log activity
    await pool.query(
      `INSERT INTO project_activity (project_id, user_id, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, 'updated', 'milestone', $3, $4, $5)`,
      [result.rows[0].project_id, userId, milestoneId, result.rows[0].title, JSON.stringify(input)]
    ).catch(() => {}); // Non-blocking

    res.json({ milestone: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * DELETE /api/hub/milestones/:milestoneId
 * Delete a milestone
 */
router.delete('/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { milestoneId } = req.params;
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Get milestone before deleting for activity log
    const existing = await pool.query(
      'SELECT project_id, title FROM milestones WHERE id = $1',
      [milestoneId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await pool.query('DELETE FROM milestones WHERE id = $1', [milestoneId]);

    // Log activity
    await pool.query(
      `INSERT INTO project_activity (project_id, user_id, action, entity_type, entity_id, entity_name)
       VALUES ($1, $2, 'deleted', 'milestone', $3, $4)`,
      [existing.rows[0].project_id, userId, milestoneId, existing.rows[0].title]
    ).catch(() => {}); // Non-blocking

    res.json({ success: true, deletedId: milestoneId });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/milestones/:milestoneId/complete
 * Mark a milestone as completed
 */
router.post('/:milestoneId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { milestoneId } = req.params;
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `UPDATE milestones SET status = 'completed', completed_date = NOW()
       WHERE id = $1 RETURNING *`,
      [milestoneId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Log activity
    await pool.query(
      `INSERT INTO project_activity (project_id, user_id, action, entity_type, entity_id, entity_name)
       VALUES ($1, $2, 'completed', 'milestone', $3, $4)`,
      [result.rows[0].project_id, userId, milestoneId, result.rows[0].title]
    ).catch(() => {}); // Non-blocking

    res.json({ milestone: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
