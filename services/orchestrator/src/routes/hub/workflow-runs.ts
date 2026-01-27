/**
 * Hub Workflow Runs API Routes
 *
 * Tracking workflow executions with step-level details
 * for the multi-project dashboard.
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
const RunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
const TriggerTypeSchema = z.enum(['manual', 'schedule', 'event', 'api']);
const StepStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'skipped']);

const CreateRunSchema = z.object({
  workflowId: z.string().uuid(),
  versionId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  triggerType: TriggerTypeSchema.optional().default('manual'),
  inputs: z.record(z.any()).optional().default({}),
});

const UpdateRunSchema = z.object({
  status: RunStatusSchema.optional(),
  outputs: z.record(z.any()).optional(),
  errorMessage: z.string().optional().nullable(),
  stepStatuses: z.array(z.any()).optional(),
});

const CreateStepSchema = z.object({
  runId: z.string().uuid(),
  stepId: z.string().min(1).max(100),
  stepName: z.string().max(255).optional(),
  status: StepStatusSchema.optional().default('pending'),
  inputs: z.record(z.any()).optional().default({}),
});

const UpdateStepSchema = z.object({
  status: StepStatusSchema.optional(),
  outputs: z.record(z.any()).optional(),
  errorMessage: z.string().optional().nullable(),
});

/**
 * GET /api/hub/workflow-runs
 * List workflow runs
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId, projectId, status, limit = '50', offset = '0' } = req.query;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    let query = `
      SELECT wr.*,
             w.name as workflow_name,
             p.name as project_name
      FROM workflow_runs wr
      LEFT JOIN workflows w ON wr.workflow_id = w.id
      LEFT JOIN projects p ON wr.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (workflowId) {
      query += ` AND wr.workflow_id = $${paramIndex++}`;
      params.push(workflowId);
    }

    if (projectId) {
      query += ` AND wr.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (status) {
      query += ` AND wr.status = $${paramIndex++}`;
      params.push(status);
    }

    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;

    query += ` ORDER BY wr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limitNum, offsetNum);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM workflow_runs WHERE 1=1`;
    const countParams: any[] = [];
    let countIdx = 1;

    if (workflowId) {
      countQuery += ` AND workflow_id = $${countIdx++}`;
      countParams.push(workflowId);
    }
    if (projectId) {
      countQuery += ` AND project_id = $${countIdx++}`;
      countParams.push(projectId);
    }
    if (status) {
      countQuery += ` AND status = $${countIdx++}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      runs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hub/workflow-runs/stats
 * Get workflow run statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, workflowId, days = '30' } = req.query;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const daysNum = parseInt(days as string) || 30;

    let query = `
      SELECT
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE status = 'running') as running_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_duration_ms,
        MIN(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as min_duration_ms,
        MAX(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as max_duration_ms,
        ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as success_rate
      FROM workflow_runs
      WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (projectId) {
      query += ` AND project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (workflowId) {
      query += ` AND workflow_id = $${paramIndex++}`;
      params.push(workflowId);
    }

    const result = await pool.query(query, params);

    // Get daily breakdown
    let dailyQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM workflow_runs
      WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
    `;
    const dailyParams: any[] = [];
    let dailyIdx = 1;

    if (projectId) {
      dailyQuery += ` AND project_id = $${dailyIdx++}`;
      dailyParams.push(projectId);
    }
    if (workflowId) {
      dailyQuery += ` AND workflow_id = $${dailyIdx++}`;
      dailyParams.push(workflowId);
    }

    dailyQuery += ` GROUP BY DATE(created_at) ORDER BY date DESC`;

    const dailyResult = await pool.query(dailyQuery, dailyParams);

    res.json({
      stats: result.rows[0],
      dailyBreakdown: dailyResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/workflow-runs
 * Create a new workflow run
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateRunSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO workflow_runs (
        workflow_id, version_id, project_id, trigger_type,
        inputs, status, created_by
      )
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [
        input.workflowId,
        input.versionId || null,
        input.projectId || null,
        input.triggerType,
        JSON.stringify(input.inputs),
        userId,
      ]
    );

    res.status(201).json({ run: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/workflow-runs/:runId
 * Get a specific workflow run with steps
 */
router.get('/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `SELECT wr.*,
              w.name as workflow_name,
              p.name as project_name
       FROM workflow_runs wr
       LEFT JOIN workflows w ON wr.workflow_id = w.id
       LEFT JOIN projects p ON wr.project_id = p.id
       WHERE wr.id = $1`,
      [runId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow run not found' });
    }

    // Get steps
    const stepsResult = await pool.query(
      `SELECT * FROM workflow_run_steps
       WHERE run_id = $1
       ORDER BY created_at ASC`,
      [runId]
    );

    res.json({
      run: result.rows[0],
      steps: stepsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/hub/workflow-runs/:runId
 * Update a workflow run
 */
router.patch('/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const input = UpdateRunSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);

      // Set started_at when transitioning to running
      if (input.status === 'running') {
        updates.push(`started_at = COALESCE(started_at, NOW())`);
      }

      // Set completed_at and duration when finishing
      if (['completed', 'failed', 'cancelled'].includes(input.status)) {
        updates.push(`completed_at = NOW()`);
        updates.push(`duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000`);
      }
    }

    if (input.outputs !== undefined) {
      updates.push(`outputs = $${paramIndex++}`);
      values.push(JSON.stringify(input.outputs));
    }

    if (input.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(input.errorMessage);
    }

    if (input.stepStatuses !== undefined) {
      updates.push(`step_statuses = $${paramIndex++}`);
      values.push(JSON.stringify(input.stepStatuses));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(runId);

    const result = await pool.query(
      `UPDATE workflow_runs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow run not found' });
    }

    res.json({ run: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * POST /api/hub/workflow-runs/:runId/start
 * Start a workflow run
 */
router.post('/:runId/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `UPDATE workflow_runs SET status = 'running', started_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [runId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found or already started' });
    }

    res.json({ run: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/workflow-runs/:runId/cancel
 * Cancel a workflow run
 */
router.post('/:runId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `UPDATE workflow_runs SET status = 'cancelled', completed_at = NOW(),
              duration_ms = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) * 1000
       WHERE id = $1 AND status IN ('pending', 'running')
       RETURNING *`,
      [runId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found or already completed' });
    }

    res.json({ run: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/workflow-runs/:runId/steps
 * Add a step to a workflow run
 */
router.post('/:runId/steps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const input = CreateStepSchema.parse({ ...req.body, runId });

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO workflow_run_steps (run_id, step_id, step_name, status, inputs)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.runId,
        input.stepId,
        input.stepName || null,
        input.status,
        JSON.stringify(input.inputs),
      ]
    );

    res.status(201).json({ step: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * PATCH /api/hub/workflow-runs/:runId/steps/:stepId
 * Update a workflow run step
 */
router.patch('/:runId/steps/:stepDbId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId, stepDbId } = req.params;
    const input = UpdateStepSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);

      if (input.status === 'running') {
        updates.push(`started_at = COALESCE(started_at, NOW())`);
      }

      if (['completed', 'failed', 'skipped'].includes(input.status)) {
        updates.push(`completed_at = NOW()`);
        updates.push(`duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000`);
      }
    }

    if (input.outputs !== undefined) {
      updates.push(`outputs = $${paramIndex++}`);
      values.push(JSON.stringify(input.outputs));
    }

    if (input.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(input.errorMessage);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(stepDbId, runId);

    const result = await pool.query(
      `UPDATE workflow_run_steps SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND run_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Step not found' });
    }

    res.json({ step: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

export default router;
