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
import { 
  logActivity, 
  getProjectActivity, 
  getRecentActivity,
  ActivityActions, 
  EntityTypes 
} from '../services/activityService';

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

const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

const UpdateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
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
      totalWorkflows: 0,
      activeWorkflows: 0,
      completedWorkflows: 0,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/projects/activity
 * Get recent activity across user's projects
 */
router.get('/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = '50' } = req.query;
    const limitNum = parseInt(limit as string, 10) || 50;

    const activities = await getRecentActivity(userId, limitNum);

    const transformedActivities = activities.map((activity) => ({
      id: activity.id,
      projectId: activity.projectId,
      userId: activity.userId,
      userEmail: activity.userEmail,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      entityName: activity.entityName,
      details: activity.details,
      createdAt: activity.createdAt,
    }));

    res.json(transformedActivities);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
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
      workflows: [],
    };

    res.json({ project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

/**
 * GET /api/projects/:projectId/activity
 * Get activity for specific project
 */
router.get('/:projectId/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessCheck = await pool.query(
      `SELECT 1 FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id IS NOT NULL)`,
      [projectId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { limit = '50', offset = '0' } = req.query;
    const limitNum = parseInt(limit as string, 10) || 50;
    const offsetNum = parseInt(offset as string, 10) || 0;

    const activities = await getProjectActivity(projectId, limitNum, offsetNum);

    const transformedActivities = activities.map((activity) => ({
      id: activity.id,
      projectId: activity.projectId,
      userId: activity.userId,
      userEmail: activity.userEmail,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      entityName: activity.entityName,
      details: activity.details,
      createdAt: activity.createdAt,
    }));

    res.json(transformedActivities);
  } catch (error) {
    console.error('Error fetching project activity:', error);
    res.status(500).json({ error: 'Failed to fetch project activity' });
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

    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [row.id, userId]
    );

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

    try {
      await logActivity({
        projectId: row.id,
        userId,
        action: ActivityActions.PROJECT_CREATED,
        entityType: EntityTypes.PROJECT,
        entityId: row.id,
        entityName: input.name,
        details: {
          description: input.description,
          orgId: input.orgId,
          templateId: input.templateId,
        },
      });
    } catch (logError) {
      console.error('Error logging project creation activity:', logError);
    }

    try {
      await logActivity({
        projectId: row.id,
        userId,
        action: ActivityActions.PROJECT_CREATED,
        entityType: EntityTypes.PROJECT,
        entityId: row.id,
        entityName: input.name,
        details: {
          description: input.description,
          orgId: input.orgId,
          templateId: input.templateId,
        },
      });
    } catch (logError) {
      console.error('Error logging project creation activity:', logError);
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

    const accessCheck = await pool.query(
      `SELECT pm.role FROM projects p
       JOIN project_members pm ON p.id = pm.project_id
       WHERE p.id = $1 AND pm.user_id = $2 AND pm.role IN ('owner', 'admin')`,
      [projectId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Not authorized to update this project' });
    }

    const currentProject = await pool.query(
      `SELECT name, description, status, settings FROM projects WHERE id = $1`,
      [projectId]
    );

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    const changedFields: Record<string, any> = {};

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
      if (currentProject.rows[0]) {
        changedFields.name = { from: currentProject.rows[0].name, to: input.name };
      }
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
      if (currentProject.rows[0]) {
        changedFields.description = { from: currentProject.rows[0].description, to: input.description };
      }
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
      if (currentProject.rows[0]) {
        changedFields.status = { from: currentProject.rows[0].status, to: input.status };
      }
    }
    if (input.settings !== undefined) {
      updates.push(`settings = settings || $${paramIndex++}`);
      values.push(input.settings);
      changedFields.settings = input.settings;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(projectId);
    const updateQuery = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, values);

    try {
      await logActivity({
        projectId,
        userId,
        action: ActivityActions.PROJECT_UPDATED,
        entityType: EntityTypes.PROJECT,
        entityId: projectId,
        entityName: result.rows[0]?.name,
        details: changedFields,
      });
    } catch (logError) {
      console.error('Error logging project update activity:', logError);
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

    const accessCheck = await pool.query(
      `SELECT name FROM projects WHERE id = $1 AND owner_id = $2`,
      [projectId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Only project owner can delete' });
    }

    const projectName = accessCheck.rows[0].name;

    if (permanent === 'true') {
      await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      
      try {
        await logActivity({
          projectId,
          userId,
          action: ActivityActions.PROJECT_DELETED,
          entityType: EntityTypes.PROJECT,
          entityId: projectId,
          entityName: projectName,
          details: { permanent: true },
        });
      } catch (logError) {
        console.error('Error logging project deletion activity:', logError);
      }

      res.json({ deleted: true });
    } else {
      await pool.query(
        `UPDATE projects SET status = 'archived' WHERE id = $1`,
        [projectId]
      );

      try {
        await logActivity({
          projectId,
          userId,
          action: ActivityActions.PROJECT_ARCHIVED,
          entityType: EntityTypes.PROJECT,
          entityId: projectId,
          entityName: projectName,
          details: { permanent: false },
        });
      } catch (logError) {
        console.error('Error logging project archival activity:', logError);
      }

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

    if (workflowId) {
      await pool.query(
        `INSERT INTO project_workflows (project_id, workflow_id, added_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, workflow_id) DO NOTHING`,
        [projectId, workflowId, userId]
      );

      try {
        await logActivity({
          projectId,
          userId,
          action: ActivityActions.WORKFLOW_ADDED,
          entityType: EntityTypes.WORKFLOW,
          entityId: workflowId,
          entityName: name,
          details: { description },
        });
      } catch (logError) {
        console.error('Error logging workflow addition activity:', logError);
      }

      res.status(201).json({ success: true });
    } else {
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

// =============================================================================
// TEAM MEMBER MANAGEMENT
// =============================================================================

/**
 * GET /api/projects/:projectId/members
 * List all members of a project
 * Access: Any project member
 */
router.get('/:projectId/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has access to project
    const accessCheck = await pool.query(
      `SELECT 1 FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id IS NOT NULL)`,
      [projectId, userId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all members with user details
    const result = await pool.query(
      `SELECT pm.id, pm.user_id, pm.role, pm.joined_at, u.email, u.first_name, u.last_name
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at DESC`,
      [projectId]
    );

    const members = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
      role: row.role,
      joinedAt: row.joined_at,
    }));

    res.json({ members, total: result.rowCount });
  } catch (error) {
    console.error('Error listing project members:', error);
    res.status(500).json({ error: 'Failed to list project members' });
  }
});

/**
 * POST /api/projects/:projectId/members
 * Add a member to project
 * RBAC: owner/admin only
 */
router.post('/:projectId/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = AddMemberSchema.parse(req.body);

    // Check if user is owner/admin
    const roleCheck = await pool.query(
      `SELECT pm.role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2 AND pm.role IN ('owner', 'admin')`,
      [projectId, userId]
    );

    if (roleCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Only project owner/admin can add members' });
    }

    // Find user by email
    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [input.email]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUserId = userResult.rows[0].id;

    // Check if already a member
    const existingMember = await pool.query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, targetUserId]
    );

    if (existingMember.rowCount > 0) {
      return res.status(409).json({ error: 'User is already a project member' });
    }

    // Add member
    const result = await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, role, joined_at`,
      [projectId, targetUserId, input.role]
    );

    const row = result.rows[0];

    // Get user details for response
    const userDetails = await pool.query(
      `SELECT email, first_name, last_name FROM users WHERE id = $1`,
      [row.user_id]
    );

    const userData = userDetails.rows[0];
    const member = {
      id: row.id,
      userId: row.user_id,
      email: userData.email,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email,
      role: row.role,
      joinedAt: row.joined_at,
    };

    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error adding project member:', error);
    res.status(500).json({ error: 'Failed to add project member' });
  }
});

/**
 * PATCH /api/projects/:projectId/members/:userId
 * Update member role
 * RBAC: owner/admin only
 */
router.patch('/:projectId/members/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId, userId: targetUserId } = req.params;
    const requesterId = (req as any).user?.id;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = UpdateMemberRoleSchema.parse(req.body);

    // Check if requester is owner/admin
    const roleCheck = await pool.query(
      `SELECT pm.role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2 AND pm.role IN ('owner', 'admin')`,
      [projectId, requesterId]
    );

    if (roleCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Only project owner/admin can update member roles' });
    }

    // Verify target member exists
    const memberCheck = await pool.query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, targetUserId]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found in project' });
    }

    // Cannot change owner role
    const ownerCheck = await pool.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, targetUserId]
    );

    if (ownerCheck.rows[0].role === 'owner' && input.role !== 'owner') {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    // Update role
    const result = await pool.query(
      `UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3
       RETURNING id, user_id, role, joined_at`,
      [input.role, projectId, targetUserId]
    );

    const row = result.rows[0];

    // Get user details for response
    const userDetails = await pool.query(
      `SELECT email, first_name, last_name FROM users WHERE id = $1`,
      [row.user_id]
    );

    const userData = userDetails.rows[0];
    const member = {
      id: row.id,
      userId: row.user_id,
      email: userData.email,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email,
      role: row.role,
      joinedAt: row.joined_at,
    };

    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

/**
 * DELETE /api/projects/:projectId/members/:userId
 * Remove member from project
 * RBAC: owner/admin only
 */
router.delete('/:projectId/members/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId, userId: targetUserId } = req.params;
    const requesterId = (req as any).user?.id;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if requester is owner/admin
    const roleCheck = await pool.query(
      `SELECT pm.role FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2 AND pm.role IN ('owner', 'admin')`,
      [projectId, requesterId]
    );

    if (roleCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Only project owner/admin can remove members' });
    }

    // Verify target member exists
    const memberCheck = await pool.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, targetUserId]
    );

    if (memberCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found in project' });
    }

    // Cannot remove owner
    if (memberCheck.rows[0].role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    // Remove member
    await pool.query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, targetUserId]
    );

    res.json({ deleted: true });
  } catch (error) {
    console.error('Error removing project member:', error);
    res.status(500).json({ error: 'Failed to remove project member' });
  }
});

export default router;
