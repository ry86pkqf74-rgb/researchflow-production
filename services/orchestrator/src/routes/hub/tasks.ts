/**
 * Hub Tasks API Routes
 *
 * CRUD operations for structured tasks with workflow integration
 * and time tracking.
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
const TaskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'in_review', 'done', 'cancelled']);

const CreateTaskSchema = z.object({
  projectId: z.string().uuid(),
  databaseId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: TaskStatusSchema.optional().default('todo'),
  priority: z.number().min(0).max(5).optional().default(0),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().positive().optional(),
  workflowStageId: z.string().uuid().optional().nullable(),
  workflowJobId: z.string().uuid().optional().nullable(),
  artifactId: z.string().uuid().optional().nullable(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: TaskStatusSchema.optional(),
  priority: z.number().min(0).max(5).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
  workflowStageId: z.string().uuid().optional().nullable(),
  workflowJobId: z.string().uuid().optional().nullable(),
  artifactId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/hub/tasks
 * List tasks for a project
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, status, assigneeId, databaseId, dueWithin } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    let query = `
      SELECT * FROM hub_tasks
      WHERE project_id = $1
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (assigneeId) {
      query += ` AND assignee_id = $${paramIndex++}`;
      params.push(assigneeId);
    }

    if (databaseId) {
      query += ` AND database_id = $${paramIndex++}`;
      params.push(databaseId);
    }

    // Filter by due date within N days
    if (dueWithin) {
      const days = parseInt(dueWithin as string);
      query += ` AND due_date IS NOT NULL AND due_date <= NOW() + INTERVAL '${days} days'`;
    }

    query += ' ORDER BY priority DESC, due_date ASC NULLS LAST, created_at DESC';

    const result = await pool.query(query, params);
    res.json({ tasks: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/tasks
 * Create a new task
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateTaskSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO hub_tasks (
        project_id, database_id, title, description, status, priority,
        assignee_id, due_date, start_date, estimated_hours,
        workflow_stage_id, workflow_job_id, artifact_id, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.projectId,
        input.databaseId || null,
        input.title,
        input.description,
        input.status,
        input.priority,
        input.assigneeId || null,
        input.dueDate || null,
        input.startDate || null,
        input.estimatedHours || null,
        input.workflowStageId || null,
        input.workflowJobId || null,
        input.artifactId || null,
        userId,
      ]
    );

    res.status(201).json({ task: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/tasks/:taskId
 * Get a specific task
 */
router.get('/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'SELECT * FROM hub_tasks WHERE id = $1',
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/hub/tasks/:taskId
 * Update a task
 */
router.patch('/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const input = UpdateTaskSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = [
      'title', 'description', 'status', 'priority', 'assigneeId',
      'dueDate', 'startDate', 'estimatedHours', 'actualHours',
      'workflowStageId', 'workflowJobId', 'artifactId',
    ];

    const dbFields: Record<string, string> = {
      assigneeId: 'assignee_id',
      dueDate: 'due_date',
      startDate: 'start_date',
      estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours',
      workflowStageId: 'workflow_stage_id',
      workflowJobId: 'workflow_job_id',
      artifactId: 'artifact_id',
    };

    for (const field of fields) {
      if ((input as any)[field] !== undefined) {
        const dbField = dbFields[field] || field.toLowerCase();
        updates.push(`${dbField} = $${paramIndex++}`);
        values.push((input as any)[field]);
      }
    }

    // If status is 'done', set completed_at
    if (input.status === 'done') {
      updates.push(`completed_at = NOW()`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(taskId);

    const result = await pool.query(
      `UPDATE hub_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * DELETE /api/hub/tasks/:taskId
 * Delete a task (hard delete)
 */
router.delete('/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'DELETE FROM hub_tasks WHERE id = $1 RETURNING id',
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, deletedId: taskId });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hub/tasks/stats/:projectId
 * Get task statistics for a project
 */
router.get('/stats/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'todo') as todo_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked_count,
        COUNT(*) FILTER (WHERE status = 'in_review') as in_review_count,
        COUNT(*) FILTER (WHERE status = 'done') as done_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done', 'cancelled')) as overdue_count,
        COUNT(*) as total_count,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) FILTER (WHERE completed_at IS NOT NULL) as avg_completion_hours
      FROM hub_tasks
      WHERE project_id = $1
    `, [projectId]);

    res.json({ stats: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
