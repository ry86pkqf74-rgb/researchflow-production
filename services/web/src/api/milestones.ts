/**
 * Milestones API Client
 *
 * CRUD operations for project milestones.
 */

import { api } from './client';

// Types
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'missed';

export interface Milestone {
  id: string;
  project_id: string;
  goal_id?: string;
  goal_title?: string;
  title: string;
  description?: string;
  target_date: string;
  completed_date?: string;
  status: MilestoneStatus;
  sort_order: number;
  linked_task_ids: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateMilestoneInput {
  projectId: string;
  goalId?: string;
  title: string;
  description?: string;
  targetDate: string;
  status?: MilestoneStatus;
  sortOrder?: number;
  linkedTaskIds?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  targetDate?: string;
  completedDate?: string | null;
  status?: MilestoneStatus;
  sortOrder?: number;
  linkedTaskIds?: string[];
  metadata?: Record<string, any>;
}

export interface MilestoneFilters {
  projectId: string;
  goalId?: string;
  status?: MilestoneStatus;
}

// API Functions
export const milestonesApi = {
  /**
   * List milestones for a project
   */
  list: (filters: MilestoneFilters) =>
    api.get<{ milestones: Milestone[]; total: number }>('/api/hub/milestones', filters),

  /**
   * Get a specific milestone with linked tasks
   */
  get: (milestoneId: string) =>
    api.get<{ milestone: Milestone; linkedTasks: any[] }>(`/api/hub/milestones/${milestoneId}`),

  /**
   * Create a new milestone
   */
  create: (data: CreateMilestoneInput) =>
    api.post<{ milestone: Milestone }>('/api/hub/milestones', data),

  /**
   * Update a milestone
   */
  update: (milestoneId: string, data: UpdateMilestoneInput) =>
    api.patch<{ milestone: Milestone }>(`/api/hub/milestones/${milestoneId}`, data),

  /**
   * Delete a milestone
   */
  delete: (milestoneId: string) =>
    api.delete<{ success: boolean; deletedId: string }>(`/api/hub/milestones/${milestoneId}`),

  /**
   * Mark a milestone as completed
   */
  complete: (milestoneId: string) =>
    api.post<{ milestone: Milestone }>(`/api/hub/milestones/${milestoneId}/complete`),

  /**
   * Get upcoming milestones
   */
  getUpcoming: (projectId: string, status?: MilestoneStatus) =>
    api.get<{ milestones: Milestone[]; total: number }>('/api/hub/milestones', {
      projectId,
      status: status || 'pending',
    }),
};

export default milestonesApi;
