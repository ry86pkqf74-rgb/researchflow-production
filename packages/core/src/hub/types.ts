/**
 * Planning Hub Types for ResearchFlow
 *
 * This module defines TypeScript types for the Planning Hub feature,
 * including pages, databases, tasks, goals, and timeline projections.
 */

import { z } from 'zod';

// =============================================================================
// Hub Page Schema (Notion-like pages)
// =============================================================================

export const HubPageSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  title: z.string().min(1).max(500),
  icon: z.string().max(10).optional(),
  coverUrl: z.string().url().optional(),
  blocks: z.any(), // JSONB block content
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
  isArchived: z.boolean().default(false),
  phiDetected: z.boolean().default(false),
  phiCategories: z.array(z.string()).default([]),
});

export type HubPage = z.infer<typeof HubPageSchema>;

export const CreateHubPageSchema = HubPageSchema.pick({
  projectId: true,
  parentId: true,
  title: true,
  icon: true,
  blocks: true,
});

export type CreateHubPage = z.infer<typeof CreateHubPageSchema>;

export const UpdateHubPageSchema = HubPageSchema.pick({
  title: true,
  icon: true,
  coverUrl: true,
  blocks: true,
  isArchived: true,
}).partial();

export type UpdateHubPage = z.infer<typeof UpdateHubPageSchema>;

// =============================================================================
// Hub Database Schema (Notion-like databases)
// =============================================================================

export const HubDatabasePropertyTypeSchema = z.enum([
  'title',
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'person',
  'checkbox',
  'url',
  'email',
  'relation',
  'formula',
  'status',
]);

export type HubDatabasePropertyType = z.infer<typeof HubDatabasePropertyTypeSchema>;

export const HubDatabasePropertySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: HubDatabasePropertyTypeSchema,
  options: z.any().optional(), // For select/multi_select options
  config: z.any().optional(), // For formula/relation config
});

export type HubDatabaseProperty = z.infer<typeof HubDatabasePropertySchema>;

export const HubDatabaseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  properties: z.array(HubDatabasePropertySchema),
  defaultView: z.enum(['table', 'calendar', 'gallery', 'list']).default('table'),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
  isArchived: z.boolean().default(false),
});

export type HubDatabase = z.infer<typeof HubDatabaseSchema>;

// =============================================================================
// Hub Record Schema (rows in hub databases)
// =============================================================================

export const HubRecordSchema = z.object({
  id: z.string().uuid(),
  databaseId: z.string().uuid(),
  properties: z.record(z.any()), // Property values keyed by property ID
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
  isArchived: z.boolean().default(false),
  phiDetected: z.boolean().default(false),
});

export type HubRecord = z.infer<typeof HubRecordSchema>;

// =============================================================================
// Hub Task Schema
// =============================================================================

export const TaskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'blocked',
  'in_review',
  'done',
  'cancelled',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const HubTaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  databaseId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: TaskStatusSchema.default('todo'),
  priority: z.number().min(0).max(5).default(0),
  assigneeId: z.string().uuid().nullable(),
  dueDate: z.date().nullable(),
  startDate: z.date().nullable(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
  // Workflow integration
  workflowStageId: z.string().uuid().nullable(),
  workflowJobId: z.string().uuid().nullable(),
  artifactId: z.string().uuid().nullable(),
  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  createdBy: z.string().uuid(),
});

export type HubTask = z.infer<typeof HubTaskSchema>;

// =============================================================================
// Hub Goal Schema
// =============================================================================

export const GoalStatusSchema = z.enum([
  'on_track',
  'at_risk',
  'behind',
  'completed',
  'cancelled',
]);

export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const HubMilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  targetDate: z.date(),
  isCompleted: z.boolean(),
  completedAt: z.date().optional(),
});

export type HubMilestone = z.infer<typeof HubMilestoneSchema>;

export const HubGoalSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  targetDate: z.date(),
  status: GoalStatusSchema.default('on_track'),
  progress: z.number().min(0).max(100).default(0),
  milestones: z.array(HubMilestoneSchema),
  linkedTaskIds: z.array(z.string().uuid()),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
});

export type HubGoal = z.infer<typeof HubGoalSchema>;

// =============================================================================
// Hub Link Schema (graph edges)
// =============================================================================

export const HubEntityTypeSchema = z.enum([
  'page',
  'database',
  'record',
  'task',
  'goal',
  'artifact',
]);

export type HubEntityType = z.infer<typeof HubEntityTypeSchema>;

export const HubLinkTypeSchema = z.enum([
  'reference',
  'blocks',
  'parent',
  'dependency',
]);

export type HubLinkType = z.infer<typeof HubLinkTypeSchema>;

export const HubLinkSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  sourceType: HubEntityTypeSchema,
  sourceId: z.string().uuid(),
  targetType: HubEntityTypeSchema,
  targetId: z.string().uuid(),
  linkType: HubLinkTypeSchema,
  createdAt: z.date(),
  createdBy: z.string().uuid(),
});

export type HubLink = z.infer<typeof HubLinkSchema>;

// =============================================================================
// Hub Workflow Link (ties to ROS workflow)
// =============================================================================

export const WorkflowEntityTypeSchema = z.enum([
  'stage',
  'job',
  'artifact',
]);

export type WorkflowEntityType = z.infer<typeof WorkflowEntityTypeSchema>;

export const LinkBehaviorSchema = z.enum([
  'sync_status',
  'trigger_on_complete',
  'watch_only',
]);

export type LinkBehavior = z.infer<typeof LinkBehaviorSchema>;

export const HubWorkflowLinkSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  hubEntityType: HubEntityTypeSchema,
  hubEntityId: z.string().uuid(),
  workflowEntityType: WorkflowEntityTypeSchema,
  workflowEntityId: z.string().uuid(),
  linkBehavior: LinkBehaviorSchema.default('sync_status'),
  createdAt: z.date(),
  createdBy: z.string().uuid(),
});

export type HubWorkflowLink = z.infer<typeof HubWorkflowLinkSchema>;

// =============================================================================
// Timeline Projection Schema
// =============================================================================

export const HubProjectionInputSchema = z.object({
  projectId: z.string().uuid(),
  includeGoals: z.boolean().default(true),
  includeTasks: z.boolean().default(true),
  includeWorkflowStages: z.boolean().default(true),
  asOfDate: z.date().optional(),
});

export type HubProjectionInput = z.infer<typeof HubProjectionInputSchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const DeadlineRiskSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
  entityTitle: z.string(),
  deadline: z.date(),
  projectedDate: z.date(),
  daysOverdue: z.number(),
  riskLevel: RiskLevelSchema,
});

export type DeadlineRisk = z.infer<typeof DeadlineRiskSchema>;

export const StageProjectionSchema = z.object({
  stageId: z.string(),
  stageName: z.string(),
  status: z.string(),
  estimatedStart: z.date().nullable(),
  estimatedEnd: z.date().nullable(),
  confidence: z.number().min(0).max(1),
});

export type StageProjection = z.infer<typeof StageProjectionSchema>;

export const ProjectionSummarySchema = z.object({
  totalTasks: z.number(),
  completedTasks: z.number(),
  overdueTasks: z.number(),
  blockedTasks: z.number(),
  averageVelocity: z.number().nullable(),
});

export type ProjectionSummary = z.infer<typeof ProjectionSummarySchema>;

export const HubProjectionOutputSchema = z.object({
  runId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  startedAt: z.date(),
  completedAt: z.date().nullable(),
  results: z.object({
    projectedCompletionDate: z.date().nullable(),
    criticalPathTasks: z.array(z.string().uuid()),
    deadlineRisks: z.array(DeadlineRiskSchema),
    stageProjections: z.array(StageProjectionSchema),
    summary: ProjectionSummarySchema,
  }).nullable(),
  error: z.string().nullable(),
});

export type HubProjectionOutput = z.infer<typeof HubProjectionOutputSchema>;

// =============================================================================
// Block Types (for page content)
// =============================================================================

export const BlockTypeSchema = z.enum([
  'paragraph',
  'heading',
  'bulleted_list',
  'numbered_list',
  'todo',
  'toggle',
  'code',
  'quote',
  'callout',
  'divider',
  'table',
  'image',
  'embed',
  'database_embed',
]);

export type BlockType = z.infer<typeof BlockTypeSchema>;

export const HubBlockSchema = z.object({
  id: z.string().uuid(),
  type: BlockTypeSchema,
  content: z.any(),
  children: z.array(z.lazy(() => HubBlockSchema)).optional(),
});

export type HubBlock = z.infer<typeof HubBlockSchema>;
