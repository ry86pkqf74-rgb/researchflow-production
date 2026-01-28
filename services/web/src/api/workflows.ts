/**
 * Workflows API Client
 *
 * CRUD operations for workflows, versions, and execution runs.
 */

import { api } from './client';

// Types
export type WorkflowStatus = 'draft' | 'published' | 'archived';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TriggerType = 'manual' | 'schedule' | 'event' | 'api';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  org_id?: string;
  status: WorkflowStatus;
  current_version?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  definition: Record<string, any>;
  changelog?: string;
  created_at: string;
  created_by?: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_name?: string;
  version_id?: string;
  project_id?: string;
  project_name?: string;
  status: RunStatus;
  trigger_type: TriggerType;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  error_message?: string;
  step_statuses: any[];
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  created_by: string;
}

export interface WorkflowRunStep {
  id: string;
  run_id: string;
  step_id: string;
  step_name?: string;
  status: StepStatus;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  retry_count: number;
  created_at: string;
}

export interface WorkflowRunStats {
  total_runs: number;
  completed_count: number;
  failed_count: number;
  running_count: number;
  pending_count: number;
  cancelled_count: number;
  avg_duration_ms?: number;
  min_duration_ms?: number;
  max_duration_ms?: number;
  success_rate?: number;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  definition?: Record<string, any>;
  templateKey?: string;
}

export interface CreateRunInput {
  workflowId: string;
  versionId?: string;
  projectId?: string;
  triggerType?: TriggerType;
  inputs?: Record<string, any>;
}

// API Functions
export const workflowsApi = {
  // === Workflows ===

  /**
   * List all workflows
   */
  list: () =>
    api.get<{ workflows: Workflow[] }>('/api/workflows'),

  /**
   * Get a specific workflow with latest version and policy
   */
  get: (workflowId: string) =>
    api.get<{ workflow: Workflow; latestVersion: WorkflowVersion | null; policy: any }>(`/api/workflows/${workflowId}`),

  /**
   * Create a new workflow
   */
  create: (data: CreateWorkflowInput) =>
    api.post<{ workflow: Workflow; templateUsed?: string }>('/api/workflows', data),

  /**
   * Update a workflow
   */
  update: (workflowId: string, data: Partial<CreateWorkflowInput>) =>
    api.put<{ workflow: Workflow }>(`/api/workflows/${workflowId}`, data),

  /**
   * Delete a workflow
   */
  delete: (workflowId: string) =>
    api.delete<{ success: boolean }>(`/api/workflows/${workflowId}`),

  /**
   * Publish a workflow
   */
  publish: (workflowId: string) =>
    api.post<{ workflow: Workflow }>(`/api/workflows/${workflowId}/publish`),

  /**
   * Archive a workflow
   */
  archive: (workflowId: string) =>
    api.post<{ workflow: Workflow }>(`/api/workflows/${workflowId}/archive`),

  /**
   * Duplicate a workflow
   */
  duplicate: (workflowId: string) =>
    api.post<{ workflow: Workflow }>(`/api/workflows/${workflowId}/duplicate`),

  // === Templates ===

  /**
   * List workflow templates
   */
  getTemplates: () =>
    api.get<{ templates: any[] }>('/api/workflows/templates'),

  /**
   * Get a specific template
   */
  getTemplate: (key: string) =>
    api.get<{ template: any }>(`/api/workflows/templates/${key}`),

  // === Versions ===

  /**
   * List workflow versions
   */
  listVersions: (workflowId: string) =>
    api.get<{ versions: WorkflowVersion[] }>(`/api/workflows/${workflowId}/versions`),

  /**
   * Get latest version
   */
  getLatestVersion: (workflowId: string) =>
    api.get<WorkflowVersion>(`/api/workflows/${workflowId}/versions/latest`),

  /**
   * Create a new version
   */
  createVersion: (workflowId: string, definition: Record<string, any>, changelog?: string) =>
    api.post<{ version: WorkflowVersion }>(`/api/workflows/${workflowId}/versions`, { definition, changelog }),

  // === Runs ===

  /**
   * List workflow runs
   */
  listRuns: (params?: { workflowId?: string; projectId?: string; status?: RunStatus; limit?: number; offset?: number }) =>
    api.get<{ runs: WorkflowRun[]; total: number; limit: number; offset: number }>('/api/hub/workflow-runs', params),

  /**
   * Get workflow run stats
   */
  getRunStats: (params?: { projectId?: string; workflowId?: string; days?: number }) =>
    api.get<{ stats: WorkflowRunStats; dailyBreakdown: any[] }>('/api/hub/workflow-runs/stats', params),

  /**
   * Get a specific run with steps
   */
  getRun: (runId: string) =>
    api.get<{ run: WorkflowRun; steps: WorkflowRunStep[] }>(`/api/hub/workflow-runs/${runId}`),

  /**
   * Create a new run
   */
  createRun: (data: CreateRunInput) =>
    api.post<{ run: WorkflowRun }>('/api/hub/workflow-runs', data),

  /**
   * Start a run
   */
  startRun: (runId: string) =>
    api.post<{ run: WorkflowRun }>(`/api/hub/workflow-runs/${runId}/start`),

  /**
   * Cancel a run
   */
  cancelRun: (runId: string) =>
    api.post<{ run: WorkflowRun }>(`/api/hub/workflow-runs/${runId}/cancel`),

  /**
   * Update a run
   */
  updateRun: (runId: string, data: Partial<WorkflowRun>) =>
    api.patch<{ run: WorkflowRun }>(`/api/hub/workflow-runs/${runId}`, data),

  /**
   * Execute a workflow (create run and start)
   */
  execute: async (workflowId: string, inputs?: Record<string, any>, projectId?: string) => {
    const createResult = await workflowsApi.createRun({
      workflowId,
      inputs,
      projectId,
      triggerType: 'manual',
    });

    if (createResult.error || !createResult.data) {
      return createResult;
    }

    return workflowsApi.startRun(createResult.data.run.id);
  },
};

  // === Workflow State Resume ===

  /**
   * Resume workflow state - fetch all stage outputs and cumulative data
   * Used when user returns to continue their workflow
   */
  resume: (identifier: { projectId?: string; researchId?: string }) =>
    api.get<{
      manifest: {
        id: string;
        currentStage: number;
        governanceMode: 'DEMO' | 'LIVE';
        cumulativeData: Record<string, unknown>;
      } | null;
      stages: Array<{
        stageNumber: number;
        stageName: string;
        status: string;
        inputData: Record<string, unknown>;
        outputData: Record<string, unknown>;
        completedAt?: string;
      }>;
      executionState: Record<number, { status: string; result?: unknown }>;
      scopeValuesByStage: Record<number, Record<string, string>>;
    }>('/api/workflow/resume', identifier),

  /**
   * Save workflow inputs for a stage (without executing)
   * Allows saving draft inputs that can be resumed later
   */
  saveStageInputs: (stageId: number, inputs: Record<string, unknown>, researchId?: string) =>
    api.post<{ success: boolean }>(`/api/workflow/stages/${stageId}/inputs`, { inputs, researchId }),
};

export default workflowsApi;
