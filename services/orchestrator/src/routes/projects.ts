/**
 * Projects API Routes
 *
 * CRUD operations for multi-project organization.
 * Provides endpoints for managing projects, workflows within projects, and team members.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db as pool } from '../../db';
import { requireAuth } from '../services/authService';

const router = Router();

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  orgId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  settings: z.record(z.unknown()).optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  settings: z.record(z.unknown()).optional(),
});

// =============================================================================
// LIST PROJECTS
// =============================================================================

/**
 * GET /api/projects
 * List all projects for current user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, limit = '20', offset = '0' } = req.query;

    let query = `
      SELECT p.*,
             COUNT(DISTINCT pw.workflow_id) as workflow_count,
             COUNT(DISTINCT pm.user_id) as member_count,
             COALESCE(
               (SELECT json_agg(json_build_object('userId', pm2.user_id, 'email', u.email, 'name', u.email, 'role', pm2.role, 'addedAt', pm2.joined_at))
                FROM project_members pm2
                JOIN users u ON pm2.user_id = u.id
                WHERE pm2.project_id = p.id),
               '[]'::json
             ) as collaborators
      FROM projects p
      LEFT JOIN project_workflows pw ON p.id = pw.project_id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.owner_id = $1 OR pm.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` GROUP BY p.id ORDER BY p.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const result = await pool.query(query, params);

    // Transform to match frontend expectations
    const projects = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.owner_id,
      status: row.status,
      workflowCount: parseInt(row.workflow_count, 10) || 0,
      settings: row.settings || {},
      collaborators: row.collaborators || [],
    }));

    res.json({ projects, total: result.rowCount });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// =============================================================================
// GET PROJECT STATS
// =============================================================================

/**
 * GET /api/projects/stats
 * Get aggregate stats for user's projects
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active') as active_projects,
         COUNT(*) FILTER (WHERE status = 'completed') as completed_projects,
         COUNT(*) FILTER (WHERE status = 'archived') as archived_projects,
         COUNT(*) as total_projects
       FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.owner_id = $1 OR pm.user_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    const stats = {
      totalProjects: parseInt(row.total_projects, 10) || 0,
      activeProjects: parseInt(row.active_projects, 10) || 0,
      completedProjects: parseInt(row.completed_projects, 10) || 0,
      archivedProjects: parseInt(row.archived_projects, 10) || 0,
      totalWorkflows: 0, // Would need to aggregate from project_workflows
      activeWorkflows: 0,
      completedWorkflows: 0,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// =============================================================================
// GET SINGLE PROJECT
// =============================================================================

/**
 * GET /api/projects/:projectId
 * Get single project with details
 */
router.get('/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check access
    const accessCheck = await pool.query(
      `SELECT 1 FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id IS NOT NULL)`,
      [projectId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `SELECT p.*,
              COUNT(DISTINCT pw.workflow_id) as workflow_count,
              COUNT(DISTINCT pm.user_id) as member_count,
              COALESCE(
                (SELECT json_agg(json_build_object('userId', pm2.user_id, 'email', u.email, 'name', u.email, 'role', pm2.role, 'addedAt', pm2.joined_at))
                 FROM project_members pm2
                 JOIN users u ON pm2.user_id = u.id
                 WHERE pm2.project_id = p.id),
                '[]'::json
              ) as collaborators
       FROM projects p
       LEFT JOIN project_workflows pw ON p.id = pw.project_id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [projectId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const row = result.rows[0];
    const project = {
      id: row.id,
      name: row.name,
      description: row.description || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.owner_id,
      status: row.status,
      workflowCount: parseInt(row.workflow_count, 10) || 0,
      settings: row.settings || {},
      collaborators: row.collaborators || [],
      workflows: [], // Would need to join from workflows table
    };

    res.json({ project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// =============================================================================
// CREATE PROJECT
// =============================================================================

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = CreateProjectSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO projects (name, description, owner_id, org_id, settings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.name, input.description || null, userId, input.orgId || null, input.settings || {}]
    );

    const row = result.rows[0];

    // Add owner as member
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [row.id, userId]
    );

    // If template specified, apply template configuration
    if (input.templateId) {
      const template = await pool.query(
        `SELECT * FROM workflow_templates WHERE id = $1`,
        [input.templateId]
      );
      if (template.rows[0]) {
        await pool.query(
          `UPDATE projects SET settings = settings || $1 WHERE id = $2`,
          [{ template: template.rows[0] }, row.id]
        );
      }
    }

    const project = {
      id: row.id,
      name: row.name,
      description: row.description || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.owner_id,
      status: row.status,
      workflowCount: 0,
      settings: row.settings || {},
      collaborators: [],
    };

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// =============================================================================
// UPDATE PROJECT
// =============================================================================

/**
 * PATCH /api/projects/:projectId
 * Update project
 */
router.patch('/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = UpdateProjectSchema.parse(req.body);

    // Check ownership or admin
    const accessCheck = await pool.query(
      `SELECT pm.role FROM projects p
       JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND pm.user_id = $2 AND pm.role IN ('owner', 'admin')`,
      [projectId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Not authorized to update this project' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.settings !== undefined) {
      updates.push(`settings = settings || $${paramIndex++}`);
      values.push(input.settings);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(projectId);
    const result = await pool.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const row = result.rows[0];
    const project = {
      id: row.id,
      name: row.name,
      description: row.description || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.owner_id,
      status: row.status,
      workflowCount: 0,
      settings: row.settings || {},
      collaborators: [],
    };

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// =============================================================================
// DELETE PROJECT
// =============================================================================

/**
 * DELETE /api/projects/:projectId
 * Delete/archive project
 */
router.delete('/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { permanent } = req.query;

    // Check ownership
    const accessCheck = await pool.query(
      `SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2`,
      [projectId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Only project owner can delete' });
    }

    if (permanent === 'true') {
      await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      res.json({ deleted: true });
    } else {
      await pool.query(
        `UPDATE projects SET status = 'archived' WHERE id = $1`,
        [projectId]
      );
      res.json({ archived: true });
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// =============================================================================
// ADD WORKFLOW TO PROJECT
// =============================================================================

/**
 * POST /api/projects/:projectId/workflows
 * Add workflow to project
 */
router.post('/:projectId/workflows', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { workflowId, name, description } = req.body;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, just create the link if workflowId is provided
    if (workflowId) {
      await pool.query(
        `INSERT INTO project_workflows (project_id, workflow_id, added_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, workflow_id) DO NOTHING`,
        [projectId, workflowId, userId]
      );
      res.status(201).json({ success: true });
    } else {
      // Create a mock workflow response for now
      const workflow = {
        id: `wf-${Date.now()}`,
        projectId,
        name: name || 'New Workflow',
        description: description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        currentStage: 0,
        totalStages: 8,
        progress: 0,
        stages: [],
        artifacts: [],
        auditLog: [],
      };
      res.status(201).json(workflow);
    }
  } catch (error) {
    console.error('Error adding workflow:', error);
    res.status(500).json({ error: 'Failed to add workflow' });
  }
});

// =============================================================================
// GET RECENT ACTIVITY
// =============================================================================

/**
 * GET /api/projects/activity
 * Get recent activity across projects
 */
router.get('/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    // Return empty for now - would need audit log integration
    res.json([]);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// =============================================================================
// LIST WORKFLOW TEMPLATES
// =============================================================================

/**
 * GET /api/projects/templates
 * List available workflow templates
 */
router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM workflow_templates WHERE is_active = TRUE ORDER BY name ASC`
    );

    const templates = result.rows.map((row: any) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      definition: row.definition,
      isDefault: row.key === 'clinical_research',
    }));

    res.json(templates);
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

export default router;
