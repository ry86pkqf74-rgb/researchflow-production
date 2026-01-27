/**
 * Projects API Client
 *
 * CRUD operations for projects with stats and activity.
 */

import { api, ApiResponse } from './client';

// Types
export interface Project {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  owner_id: string;
  org_id?: string;
  status: 'active' | 'archived' | 'completed';
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joined_at: string;
}

export interface ProjectStats {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  total_workflows: number;
  active_runs: number;
  total_milestones: number;
  completed_milestones: number;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: 'active' | 'archived' | 'completed';
  settings?: Record<string, any>;
}

// API Functions
export const projectsApi = {
  /**
   * List all projects the user has access to
   */
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ projects: Project[]; total: number }>('/api/projects', params),

  /**
   * Get a specific project by ID
   */
  get: (projectId: string) =>
    api.get<{ project: Project }>(`/api/projects/${projectId}`),

  /**
   * Create a new project
   */
  create: (data: CreateProjectInput) =>
    api.post<{ project: Project }>('/api/projects', data),

  /**
   * Update a project
   */
  update: (projectId: string, data: UpdateProjectInput) =>
    api.patch<{ project: Project }>(`/api/projects/${projectId}`, data),

  /**
   * Delete (archive) a project
   */
  delete: (projectId: string) =>
    api.delete<{ success: boolean }>(`/api/projects/${projectId}`),

  /**
   * Get project statistics
   */
  getStats: (projectId: string) =>
    api.get<{ stats: ProjectStats }>(`/api/projects/${projectId}/stats`),

  /**
   * Get aggregate stats for all projects
   */
  getAllStats: () =>
    api.get<{ stats: Record<string, any> }>('/api/projects/stats'),

  /**
   * Get recent activity for a project
   */
  getActivity: (projectId: string, params?: { limit?: number }) =>
    api.get<{ activity: ProjectActivity[] }>(`/api/projects/${projectId}/activity`, params),

  /**
   * Get project members
   */
  getMembers: (projectId: string) =>
    api.get<{ members: ProjectMember[] }>(`/api/projects/${projectId}/members`),

  /**
   * Add a member to a project
   */
  addMember: (projectId: string, userId: string, role: string) =>
    api.post<{ member: ProjectMember }>(`/api/projects/${projectId}/members`, { userId, role }),

  /**
   * Remove a member from a project
   */
  removeMember: (projectId: string, userId: string) =>
    api.delete<{ success: boolean }>(`/api/projects/${projectId}/members/${userId}`),

  /**
   * Get project templates
   */
  getTemplates: () =>
    api.get<{ templates: any[] }>('/api/projects/templates'),

  /**
   * Link a workflow to a project
   */
  linkWorkflow: (projectId: string, workflowId: string) =>
    api.post<{ success: boolean }>(`/api/projects/${projectId}/workflows`, { workflowId }),

  /**
   * Unlink a workflow from a project
   */
  unlinkWorkflow: (projectId: string, workflowId: string) =>
    api.delete<{ success: boolean }>(`/api/projects/${projectId}/workflows/${workflowId}`),
};

export default projectsApi;
