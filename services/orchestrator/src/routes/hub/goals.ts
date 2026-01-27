/**
 * Hub Goals API Routes
 *
 * CRUD operations for high-level goals with milestones,
 * progress tracking, and task linking.
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
const GoalStatusSchema = z.enum(['on_track', 'at_risk', 'behind', 'completed', 'cancelled']);

const MilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  targetDate: z.string().datetime(),
  completed: z.boolean().default(false),
  completedAt: z.string().datetime().optional().nullable(),
});

const CreateGoalSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  targetDate: z.string().datetime(),
  status: GoalStatusSchema.optional().default('on_track'),
  progress: z.number().min(0).max(100).optional().default(0),
  milestones: z.array(MilestoneSchema).optional().default([]),
  linkedTaskIds: z.array(z.string().uuid()).optional().default([]),
});

const UpdateGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  targetDate: z.string().datetime().optional(),
  status: GoalStatusSchema.optional(),
  progress: z.number().min(0).max(100).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  linkedTaskIds: z.array(z.string().uuid()).optional(),
});

/**
 * GET /api/hub/goals
 * List goals for a project
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, status } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    let query = `
      SELECT * FROM hub_goals
      WHERE project_id = $1
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY target_date ASC, created_at DESC';

    const result = await pool.query(query, params);
    res.json({ goals: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/goals
 * Create a new goal
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateGoalSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO hub_goals (
        project_id, title, description, target_date, status,
        progress, milestones, linked_task_ids, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.projectId,
        input.title,
        input.description || null,
        input.targetDate,
        input.status,
        input.progress,
        JSON.stringify(input.milestones),
        input.linkedTaskIds,
        userId,
      ]
    );

    res.status(201).json({ goal: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/goals/:goalId
 * Get a specific goal
 */
router.get('/:goalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'SELECT * FROM hub_goals WHERE id = $1',
      [goalId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ goal: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/hub/goals/:goalId
 * Update a goal
 */
router.patch('/:goalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalId } = req.params;
    const input = UpdateGoalSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.targetDate !== undefined) {
      updates.push(`target_date = $${paramIndex++}`);
      values.push(input.targetDate);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.progress !== undefined) {
      updates.push(`progress = $${paramIndex++}`);
      values.push(input.progress);
    }
    if (input.milestones !== undefined) {
      updates.push(`milestones = $${paramIndex++}`);
      values.push(JSON.stringify(input.milestones));
    }
    if (input.linkedTaskIds !== undefined) {
      updates.push(`linked_task_ids = $${paramIndex++}`);
      values.push(input.linkedTaskIds);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(goalId);

    const result = await pool.query(
      `UPDATE hub_goals SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ goal: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * DELETE /api/hub/goals/:goalId
 * Delete a goal (hard delete)
 */
router.delete('/:goalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'DELETE FROM hub_goals WHERE id = $1 RETURNING id',
      [goalId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ success: true, deletedId: goalId });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/goals/:goalId/milestones
 * Add a milestone to a goal
 */
router.post('/:goalId/milestones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalId } = req.params;
    const milestone = MilestoneSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Get current goal
    const goalResult = await pool.query(
      'SELECT milestones FROM hub_goals WHERE id = $1',
      [goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const milestones = goalResult.rows[0].milestones || [];
    milestones.push(milestone);

    const result = await pool.query(
      'UPDATE hub_goals SET milestones = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(milestones), goalId]
    );

    res.json({ goal: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * PATCH /api/hub/goals/:goalId/milestones/:milestoneId
 * Update a milestone within a goal
 */
router.patch('/:goalId/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalId, milestoneId } = req.params;
    const updates = req.body;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Get current goal
    const goalResult = await pool.query(
      'SELECT milestones FROM hub_goals WHERE id = $1',
      [goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const milestones = goalResult.rows[0].milestones || [];
    const milestoneIndex = milestones.findIndex((m: any) => m.id === milestoneId);

    if (milestoneIndex === -1) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Update milestone fields
    milestones[milestoneIndex] = { ...milestones[milestoneIndex], ...updates };

    // If marking as completed, set completedAt
    if (updates.completed === true && !milestones[milestoneIndex].completedAt) {
      milestones[milestoneIndex].completedAt = new Date().toISOString();
    }

    const result = await pool.query(
      'UPDATE hub_goals SET milestones = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(milestones), goalId]
    );

    res.json({ goal: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/goals/:goalId/link-tasks
 * Link tasks to a goal
 */
router.post('/:goalId/link-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalId } = req.params;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds must be an array' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Get current linked tasks
    const goalResult = await pool.query(
      'SELECT linked_task_ids FROM hub_goals WHERE id = $1',
      [goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const existingIds = new Set(goalResult.rows[0].linked_task_ids || []);
    taskIds.forEach((id: string) => existingIds.add(id));

    const result = await pool.query(
      'UPDATE hub_goals SET linked_task_ids = $1 WHERE id = $2 RETURNING *',
      [Array.from(existingIds), goalId]
    );

    res.json({ goal: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hub/goals/:goalId/progress
 * Calculate goal progress from linked tasks
 */
router.get('/:goalId/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Get goal with linked tasks
    const goalResult = await pool.query(
      'SELECT * FROM hub_goals WHERE id = $1',
      [goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    const linkedTaskIds = goal.linked_task_ids || [];

    if (linkedTaskIds.length === 0) {
      return res.json({
        goalId,
        progress: goal.progress,
        taskProgress: null,
        milestoneProgress: calculateMilestoneProgress(goal.milestones || []),
      });
    }

    // Calculate progress from linked tasks
    const taskResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'done') as completed
      FROM hub_tasks
      WHERE id = ANY($1)
    `, [linkedTaskIds]);

    const { total, completed } = taskResult.rows[0];
    const taskProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      goalId,
      progress: goal.progress,
      taskProgress,
      tasksTotal: parseInt(total),
      tasksCompleted: parseInt(completed),
      milestoneProgress: calculateMilestoneProgress(goal.milestones || []),
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to calculate milestone progress
function calculateMilestoneProgress(milestones: any[]): number {
  if (milestones.length === 0) return 0;
  const completed = milestones.filter(m => m.completed).length;
  return Math.round((completed / milestones.length) * 100);
}

export default router;
