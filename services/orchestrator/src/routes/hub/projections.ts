/**
 * Hub Projections API Routes
 *
 * Timeline projection endpoints for workflow planning.
 * Handles async projection runs and retrieval of results.
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
const ProjectionStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

const ProjectionParamsSchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeGoals: z.boolean().optional().default(true),
  includeTasks: z.boolean().optional().default(true),
  includeWorkflow: z.boolean().optional().default(true),
  scenarioType: z.enum(['optimistic', 'realistic', 'pessimistic']).optional().default('realistic'),
  customParams: z.record(z.any()).optional(),
});

const CreateProjectionRunSchema = z.object({
  projectId: z.string().uuid(),
  inputParams: ProjectionParamsSchema,
});

/**
 * GET /api/hub/projections
 * List projection runs for a project
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, status, limit = '20' } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    let query = `
      SELECT r.*, o.results, o.error
      FROM hub_projection_runs r
      LEFT JOIN hub_projection_outputs o ON o.run_id = r.id
      WHERE r.project_id = $1
    `;
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY r.started_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const result = await pool.query(query, params);
    res.json({ projectionRuns: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/projections
 * Create a new projection run
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateProjectionRunSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO hub_projection_runs (
        project_id, status, input_params, created_by
      )
       VALUES ($1, 'pending', $2, $3)
       RETURNING *`,
      [
        input.projectId,
        JSON.stringify(input.inputParams),
        userId,
      ]
    );

    const run = result.rows[0];

    // Trigger async projection computation (would call worker service)
    // For now, we'll simulate by marking it as running
    await pool.query(
      `UPDATE hub_projection_runs SET status = 'running' WHERE id = $1`,
      [run.id]
    );

    res.status(201).json({ projectionRun: { ...run, status: 'running' } });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/projections/:runId
 * Get a specific projection run with results
 */
router.get('/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(`
      SELECT r.*, o.results, o.error
      FROM hub_projection_runs r
      LEFT JOIN hub_projection_outputs o ON o.run_id = r.id
      WHERE r.id = $1
    `, [runId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projection run not found' });
    }

    res.json({ projectionRun: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/projections/:runId/cancel
 * Cancel a pending or running projection
 */
router.post('/:runId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `UPDATE hub_projection_runs
       SET status = 'cancelled'
       WHERE id = $1 AND status IN ('pending', 'running')
       RETURNING *`,
      [runId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projection run not found or cannot be cancelled' });
    }

    res.json({ projectionRun: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/projections/:runId/output
 * Store projection output (called by worker service)
 */
router.post('/:runId/output', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const { results, error } = req.body;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Verify run exists
    const runResult = await pool.query(
      'SELECT id FROM hub_projection_runs WHERE id = $1',
      [runId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projection run not found' });
    }

    // Insert output
    await pool.query(
      `INSERT INTO hub_projection_outputs (run_id, results, error)
       VALUES ($1, $2, $3)`,
      [runId, results ? JSON.stringify(results) : null, error || null]
    );

    // Update run status
    const newStatus = error ? 'failed' : 'completed';
    await pool.query(
      `UPDATE hub_projection_runs
       SET status = $1, completed_at = NOW()
       WHERE id = $2`,
      [newStatus, runId]
    );

    res.json({ success: true, status: newStatus });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hub/projections/latest/:projectId
 * Get the latest completed projection for a project
 */
router.get('/latest/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(`
      SELECT r.*, o.results, o.error
      FROM hub_projection_runs r
      LEFT JOIN hub_projection_outputs o ON o.run_id = r.id
      WHERE r.project_id = $1 AND r.status = 'completed'
      ORDER BY r.completed_at DESC
      LIMIT 1
    `, [projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No completed projections found' });
    }

    res.json({ projectionRun: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/projections/quick
 * Quick synchronous projection (for simple scenarios)
 */
router.post('/quick', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = ProjectionParamsSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Gather data for projection
    const [goalsResult, tasksResult] = await Promise.all([
      params.includeGoals
        ? pool.query(
            'SELECT * FROM hub_goals WHERE project_id = $1 ORDER BY target_date',
            [params.projectId]
          )
        : Promise.resolve({ rows: [] }),
      params.includeTasks
        ? pool.query(
            `SELECT * FROM hub_tasks WHERE project_id = $1
             AND status NOT IN ('done', 'cancelled')
             ORDER BY priority DESC, due_date ASC NULLS LAST`,
            [params.projectId]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const goals = goalsResult.rows;
    const tasks = tasksResult.rows;

    // Calculate simple timeline projection
    const projection = calculateQuickProjection(goals, tasks, params);

    res.json({ projection });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * Simple projection calculation (synchronous)
 */
function calculateQuickProjection(
  goals: any[],
  tasks: any[],
  params: z.infer<typeof ProjectionParamsSchema>
): any {
  const now = new Date();
  const scenarioMultipliers: Record<string, number> = {
    optimistic: 0.8,
    realistic: 1.0,
    pessimistic: 1.5,
  };
  const multiplier = scenarioMultipliers[params.scenarioType || 'realistic'];

  // Calculate task timeline
  const taskTimeline = tasks.map(task => {
    const estimatedHours = (task.estimated_hours || 4) * multiplier;
    const startDate = task.start_date ? new Date(task.start_date) : now;
    const projectedEndDate = new Date(startDate.getTime() + estimatedHours * 3600 * 1000);

    return {
      taskId: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      estimatedHours: task.estimated_hours,
      adjustedHours: estimatedHours,
      startDate: startDate.toISOString(),
      projectedEndDate: projectedEndDate.toISOString(),
      dueDate: task.due_date,
      isOverdue: task.due_date && new Date(task.due_date) < now,
      willBeOverdue: task.due_date && projectedEndDate > new Date(task.due_date),
    };
  });

  // Calculate goal timeline
  const goalTimeline = goals.map(goal => {
    const linkedTasks = taskTimeline.filter(t =>
      (goal.linked_task_ids || []).includes(t.taskId)
    );
    const completedMilestones = (goal.milestones || []).filter((m: any) => m.completed).length;
    const totalMilestones = (goal.milestones || []).length;

    // Estimate completion based on linked tasks
    let projectedCompletion: string | null = null;
    if (linkedTasks.length > 0) {
      const latestTaskEnd = linkedTasks.reduce((latest, t) =>
        new Date(t.projectedEndDate) > latest ? new Date(t.projectedEndDate) : latest,
        new Date(0)
      );
      projectedCompletion = latestTaskEnd.toISOString();
    }

    const targetDate = new Date(goal.target_date);
    const isAtRisk = projectedCompletion && new Date(projectedCompletion) > targetDate;

    return {
      goalId: goal.id,
      title: goal.title,
      status: goal.status,
      progress: goal.progress,
      targetDate: goal.target_date,
      projectedCompletion,
      isAtRisk,
      milestoneProgress: {
        completed: completedMilestones,
        total: totalMilestones,
        percentage: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
      },
      linkedTaskCount: linkedTasks.length,
    };
  });

  // Summary statistics
  const totalTasks = tasks.length;
  const overdueTasks = taskTimeline.filter(t => t.isOverdue).length;
  const atRiskTasks = taskTimeline.filter(t => t.willBeOverdue && !t.isOverdue).length;
  const goalsAtRisk = goalTimeline.filter(g => g.isAtRisk).length;

  return {
    generatedAt: now.toISOString(),
    scenarioType: params.scenarioType,
    summary: {
      totalTasks,
      overdueTasks,
      atRiskTasks,
      totalGoals: goals.length,
      goalsAtRisk,
    },
    taskTimeline,
    goalTimeline,
  };
}

export default router;
