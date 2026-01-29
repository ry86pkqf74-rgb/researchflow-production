import { query } from '../../db';

export enum ActivityActions {
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',
  PROJECT_ARCHIVED = 'project_archived',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  WORKFLOW_ADDED = 'workflow_added',
  WORKFLOW_REMOVED = 'workflow_removed',
  SETTINGS_UPDATED = 'settings_updated'
}

export enum EntityTypes {
  PROJECT = 'project',
  MEMBER = 'member',
  WORKFLOW = 'workflow',
  SETTINGS = 'settings'
}

interface ActivityLogParams {
  projectId: string;
  userId: string;
  action: ActivityActions;
  entityType: EntityTypes;
  entityId: string;
  entityName: string;
  details?: Record<string, unknown>;
}

export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    await query(
      `INSERT INTO project_activity (project_id, user_id, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [params.projectId, params.userId, params.action, params.entityType, params.entityId, params.entityName, JSON.stringify(params.details || {})]
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function getProjectActivity(projectId: string, limit = 50, offset = 0) {
  const result = await query(
    `SELECT pa.*, u.email as user_email 
     FROM project_activity pa
     LEFT JOIN users u ON pa.user_id = u.id
     WHERE pa.project_id = $1
     ORDER BY pa.created_at DESC
     LIMIT $2 OFFSET $3`,
    [projectId, limit, offset]
  );
  return result.rows;
}

export async function getRecentActivity(userId: string, limit = 20) {
  const result = await query(
    `SELECT pa.*, u.email as user_email
     FROM project_activity pa
     LEFT JOIN users u ON pa.user_id = u.id
     WHERE pa.project_id IN (
       SELECT id FROM projects WHERE owner_id = $1
       UNION
       SELECT project_id FROM project_members WHERE user_id = $1
     )
     ORDER BY pa.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}
