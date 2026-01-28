/**
 * ResearchFlow Notion Integration Types
 * 
 * Type definitions for the Notion database schemas:
 * - ResearchFlow Deployment Tasks
 * - Deployment Execution Log
 */

// ============================================================================
// Deployment Tasks Types
// ============================================================================

export type TaskStatus = '🔴 Critical' | '🟡 In Progress' | '🟢 Complete' | '⚪ Pending';

export type AITool = 
  | 'Claude' 
  | 'GPT-4' 
  | 'Grok' 
  | 'Mercury' 
  | 'Sourcegraph' 
  | 'Figma' 
  | 'Cursor' 
  | 'Continue.dev';

export type TaskPhase = 
  | 'Phase 1: Security' 
  | 'Phase 2: API' 
  | 'Phase 3: Frontend' 
  | 'Phase 4: Deploy';

export type TaskPriority = 'P0 - Critical' | 'P1 - High' | 'P2 - Medium' | 'P3 - Low';

export interface DeploymentTask {
  // Core identifiers
  taskId: string;        // Task ID - Unique identifier for API lookups
  name: string;          // Task - Title property
  
  // Status tracking
  status: TaskStatus;
  progressPercent: number;  // 0-100
  
  // Timestamps
  startedAt?: Date;
  completedAt?: Date;
  lastUpdated?: Date;
  
  // Metadata
  aiTool?: AITool;
  phase?: TaskPhase;
  priority?: TaskPriority;
  filePath?: string;
  notes?: string;
  
  // Relations
  executionLogs?: string[];  // Array of Execution Log page URLs
  
  // Notion metadata (read-only from API)
  url?: string;
  createdTime?: Date;
}

export interface CreateDeploymentTaskInput {
  taskId: string;
  name: string;
  status?: TaskStatus;
  progressPercent?: number;
  aiTool?: AITool;
  phase?: TaskPhase;
  priority?: TaskPriority;
  filePath?: string;
  notes?: string;
}

export interface UpdateDeploymentTaskInput {
  status?: TaskStatus;
  progressPercent?: number;
  startedAt?: Date;
  completedAt?: Date;
  lastUpdated?: Date;
  aiTool?: AITool;
  phase?: TaskPhase;
  priority?: TaskPriority;
  filePath?: string;
  notes?: string;
  executionLogs?: string[];
}

// ============================================================================
// Execution Log Types
// ============================================================================

export type ExecutionStatus = 'Pending' | 'Running' | 'Complete' | 'Failed';

export type ExecutionStream = 
  | 'Frontend' 
  | 'Backend' 
  | 'Testing' 
  | 'AI Integration' 
  | 'Design';

export interface ExecutionLog {
  // Core identifiers
  executionId: string;     // Execution ID - Unique identifier for API lookups
  name: string;            // Name - Title property
  toolInstanceId?: string; // Tracks which specific tool instance is running
  
  // Status tracking
  status: ExecutionStatus;
  progressPercent: number;  // 0-100
  
  // Timestamps
  startedAt?: Date;
  completedAt?: Date;
  
  // Computed (formula in Notion)
  durationMin?: number;
  
  // Metadata
  stream?: ExecutionStream;
  notes?: string;
  blockingIssues?: string;
  
  // Notion metadata (read-only from API)
  url?: string;
  createdTime?: Date;
}

export interface CreateExecutionLogInput {
  executionId: string;
  name: string;
  toolInstanceId?: string;
  status?: ExecutionStatus;
  progressPercent?: number;
  startedAt?: Date;
  stream?: ExecutionStream;
  notes?: string;
}

export interface UpdateExecutionLogInput {
  status?: ExecutionStatus;
  progressPercent?: number;
  completedAt?: Date;
  stream?: ExecutionStream;
  notes?: string;
  blockingIssues?: string;
}

// ============================================================================
// API Configuration
// ============================================================================

export interface NotionConfig {
  apiKey: string;
  deploymentTasksDataSourceId: string;  // collection://52e84cac-8ed0-4231-b9c8-5b854d042b9b
  executionLogDataSourceId: string;     // collection://79d9d19c-9de3-4674-976f-fa9ad96ea826
}

// ============================================================================
// Execution Session Types (for tracking tool runs)
// ============================================================================

export interface ExecutionSession {
  executionId: string;
  taskId?: string;
  toolInstanceId: string;
  name: string;
  stream: ExecutionStream;
  startedAt: Date;
  
  // Internal tracking
  progressInterval?: NodeJS.Timeout;
  currentProgress: number;
}

export interface StartExecutionOptions {
  taskId?: string;        // Link to a deployment task
  name: string;
  toolInstanceId?: string;
  stream: ExecutionStream;
  notes?: string;
  autoUpdateProgress?: boolean;
  progressIntervalMs?: number;
}

export interface CompleteExecutionOptions {
  status: 'Complete' | 'Failed';
  notes?: string;
  blockingIssues?: string;
}
