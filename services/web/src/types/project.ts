/**
 * Project and Workflow Types
 *
 * Data models for the Research Project Manager feature.
 * Projects contain multiple workflows, each representing a full research pipeline.
 */

// ============================================================================
// Project Types
// ============================================================================

export type ProjectStatus = 'active' | 'archived' | 'completed';

export type AIApprovalMode = 'REQUIRE_EACH' | 'REQUIRE_ONCE' | 'AUTO';

export type PHIProtectionLevel = 'strict' | 'standard';

export type GovernanceLevel = 'basic' | 'enhanced' | 'full';

export interface ProjectSettings {
  /** Default dataset to use for new workflows */
  defaultDatasetId?: string;
  /** AI approval mode for this project */
  aiMode: AIApprovalMode;
  /** PHI protection level */
  phiProtection: PHIProtectionLevel;
  /** Governance level for attestations and audit */
  governanceLevel: GovernanceLevel;
}

export type CollaboratorRole = 'owner' | 'editor' | 'viewer';

export interface Collaborator {
  userId: string;
  email: string;
  name: string;
  role: CollaboratorRole;
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: ProjectStatus;
  workflowCount: number;
  settings: ProjectSettings;
  collaborators: Collaborator[];
}

export interface ProjectWithWorkflows extends Project {
  workflows: Workflow[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  settings?: Partial<ProjectSettings>;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowStatus = 'draft' | 'in_progress' | 'paused' | 'completed' | 'failed';

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export interface StageOutput {
  id: string;
  type: 'text' | 'table' | 'chart' | 'document' | 'list';
  title: string;
  content: string;
  createdAt: string;
}

export interface AttestationRecord {
  id: string;
  attestedBy: string;
  attestedAt: string;
  checklistItems: {
    id: string;
    label: string;
    checked: boolean;
  }[];
  signature?: string;
}

export interface WorkflowStageState {
  stageId: number;
  stageName: string;
  stageGroup: string;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  outputs: StageOutput[];
  attestation?: AttestationRecord;
  aiApproved?: boolean;
  phiCleared?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  stageId?: number;
  metadata?: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  filename: string;
  type: string;
  size: number;
  sha256: string;
  createdAt: string;
  createdBy: string;
  stageId: number;
  url?: string;
}

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: WorkflowStatus;
  currentStage: number;
  totalStages: number;
  progress: number; // 0-100
  stages: WorkflowStageState[];
  artifacts: Artifact[];
  auditLog: AuditLogEntry[];
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  templateId?: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  currentStage?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ProjectsListResponse {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectDetailResponse {
  project: ProjectWithWorkflows;
}

export interface WorkflowDetailResponse {
  workflow: Workflow;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  archivedProjects: number;
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
}

export interface RecentActivity {
  id: string;
  type: 'project_created' | 'workflow_created' | 'workflow_completed' | 'stage_completed';
  projectId: string;
  projectName: string;
  workflowId?: string;
  workflowName?: string;
  timestamp: string;
  actor: string;
}
