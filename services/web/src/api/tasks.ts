/**
 * Tasks API Client
 *
 * CRUD operations for tasks with filtering and stats.
 */

import { api } from './client';

// Types
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done' | 'cancelled';

export interface Task {
  id: string;
  project_id: string;
  database_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  workflow_stage_id?: string;
  workflow_job_id?: string;
  artifact_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  created_by: string;
}

export interface TaskStats {
  todo_count: number;
  in_progress_count: number;
  blocked_count: number;
  in_review_count: number;
  done_count: number;
  cancelled_count: number;
  overdue_count: number;
  total_count: number;
  avg_completion_hours?: number;
}

export interface CreateTaskInput {
  projectId: string;
  databaseId?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  assigneeId?: string;
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  workflowStageId?: string;
  workflowJobId?: string;
  artifactId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedHours?: number;
  actualHours?: number;
  workflowStageId?: string | null;
  workflowJobId?: string | null;
  artifactId?: string | null;
}

export interface TaskFilters {
  projectId: string;
  status?: TaskStatus;
  assigneeId?: string;
  databaseId?: string;
  dueWithin?: number; // days
}

// API Functions
export const tasksApi = {
  /**
   * List tasks for a project
   */
  list: (filters: TaskFilters) =>
    api.get<{ tasks: Task[]; total: number }>('/api/hub/tasks', filters),

  /**
   * Get a specific task
   */
  get: (taskId: string) =>
    api.get<{ task: Task }>(`/api/hub/tasks/${taskId}`),

  /**
   * Create a new task
   */
  create: (data: CreateTaskInput) =>
    api.post<{ task: Task }>('/api/hub/tasks', data),

  /**
   * Update a task
   */
  update: (taskId: string, data: UpdateTaskInput) =>
    api.patch<{ task: Task }>(`/api/hub/tasks/${taskId}`, data),

  /**
   * Delete a task
   */
  delete: (taskId: string) =>
    api.delete<{ success: boolean; deletedId: string }>(`/api/hub/tasks/${taskId}`),

  /**
   * Get task statistics for a project
   */
  getStats: (projectId: string) =>
    api.get<{ stats: TaskStats }>(`/api/hub/tasks/stats/${projectId}`),

  /**
   * Quick status update
   */
  updateStatus: (taskId: string, status: TaskStatus) =>
    api.patch<{ task: Task }>(`/api/hub/tasks/${taskId}`, { status }),

  /**
   * Assign a task to a user
   */
  assign: (taskId: string, assigneeId: string | null) =>
    api.patch<{ task: Task }>(`/api/hub/tasks/${taskId}`, { assigneeId }),

  /**
   * Get overdue tasks for a project
   */
  getOverdue: (projectId: string) =>
    api.get<{ tasks: Task[]; total: number }>('/api/hub/tasks', {
      projectId,
      dueWithin: 0,
    }),

  /**
   * Get tasks due within N days
   */
  getDueSoon: (projectId: string, days: number) =>
    api.get<{ tasks: Task[]; total: number }>('/api/hub/tasks', {
      projectId,
      dueWithin: days,
    }),
};

export default tasksApi;
