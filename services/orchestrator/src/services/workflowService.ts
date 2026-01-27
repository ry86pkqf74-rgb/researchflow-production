/**
 * Workflow Service
 * CRUD operations for workflows, versions, templates, and policies
 * 
 * @packageDocumentation
 */

import { db } from '../../db';
import {
  workflows,
  workflowVersions,
  workflowTemplates,
  workflowPolicies,
  workflowRunCheckpoints,
} from '@researchflow/core/schema';
import { eq, and, desc } from 'drizzle-orm';
import type {
  WorkflowDefinition,
  WorkflowPolicy,
} from '@researchflow/core/types/workflow';

// =====================
// TYPES
// =====================

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  orgId?: string;
  createdBy?: string;  // Optional - will be null in DB if not provided
  definition?: WorkflowDefinition;
}

export interface CreateVersionInput {
  workflowId: string;
  definition: WorkflowDefinition;
  changelog?: string;
  createdBy?: string;  // Optional - will be null in DB if not provided
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  status?: 'draft' | 'published' | 'archived';
}

// =====================
// WORKFLOWS
// =====================

export async function createWorkflow(input: CreateWorkflowInput) {
  const [workflow] = await db.insert(workflows).values({
    name: input.name,
    description: input.description,
    orgId: input.orgId,
    createdBy: input.createdBy || null,  // Use null if no user provided
    status: 'draft',
  }).returning();

  // Create initial version if definition provided
  if (input.definition) {
    await createWorkflowVersion({
      workflowId: workflow.id,
      definition: input.definition,
      changelog: 'Initial version',
      createdBy: input.createdBy,
    });
  }

  return workflow;
}

export async function getWorkflow(id: string, orgId?: string) {
  const conditions = orgId
    ? and(eq(workflows.id, id), eq(workflows.orgId, orgId))
    : eq(workflows.id, id);

  const [workflow] = await db.select().from(workflows).where(conditions);
  return workflow || null;
}

export async function listWorkflows(orgId?: string) {
  const conditions = orgId ? eq(workflows.orgId, orgId) : undefined;
  return db.select().from(workflows).where(conditions).orderBy(desc(workflows.updatedAt));
}

export async function updateWorkflow(id: string, updates: UpdateWorkflowInput) {
  const [workflow] = await db.update(workflows)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(workflows.id, id))
    .returning();
  return workflow || null;
}

export async function deleteWorkflow(id: string) {
  const [deleted] = await db.delete(workflows)
    .where(eq(workflows.id, id))
    .returning();
  return deleted || null;
}

export async function publishWorkflow(id: string) {
  return updateWorkflow(id, { status: 'published' });
}

export async function archiveWorkflow(id: string) {
  return updateWorkflow(id, { status: 'archived' });
}

// =====================
// WORKFLOW VERSIONS
// =====================

export async function createWorkflowVersion(input: CreateVersionInput) {
  // Get current max version
  const [latest] = await db
    .select({ version: workflowVersions.version })
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, input.workflowId))
    .orderBy(desc(workflowVersions.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;

  const [version] = await db.insert(workflowVersions).values({
    workflowId: input.workflowId,
    version: nextVersion,
    definition: input.definition,
    changelog: input.changelog,
    createdBy: input.createdBy || null,  // Use null if no user provided
  }).returning();

  // Update workflow's updatedAt
  await db.update(workflows)
    .set({ updatedAt: new Date() })
    .where(eq(workflows.id, input.workflowId));

  return version;
}

export async function getWorkflowVersion(workflowId: string, version: number) {
  const [v] = await db.select()
    .from(workflowVersions)
    .where(and(
      eq(workflowVersions.workflowId, workflowId),
      eq(workflowVersions.version, version)
    ));
  return v || null;
}

export async function getLatestVersion(workflowId: string) {
  const [v] = await db.select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId))
    .orderBy(desc(workflowVersions.version))
    .limit(1);
  return v || null;
}

export async function getLatestPublishedVersion(workflowId: string) {
  // For now, just return the latest version
  // In the future, we could add a 'published' flag to versions table
  return getLatestVersion(workflowId);
}

export async function listVersions(workflowId: string) {
  return db.select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId))
    .orderBy(desc(workflowVersions.version));
}

// =====================
// WORKFLOW TEMPLATES
// =====================

export async function listTemplates(activeOnly = true) {
  const conditions = activeOnly ? eq(workflowTemplates.isActive, true) : undefined;
  return db.select().from(workflowTemplates).where(conditions);
}

export async function getTemplate(key: string) {
  const [template] = await db.select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.key, key));
  return template || null;
}

export async function createTemplate(input: {
  key: string;
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  category?: string;
}) {
  const [template] = await db.insert(workflowTemplates).values({
    key: input.key,
    name: input.name,
    description: input.description,
    definition: input.definition,
    category: input.category || 'general',
    isActive: true,
  }).returning();
  return template;
}

// =====================
// WORKFLOW POLICIES
// =====================

export async function setWorkflowPolicy(
  workflowId: string,
  policy: WorkflowPolicy,
  updatedBy: string
) {
  const existing = await db.select()
    .from(workflowPolicies)
    .where(eq(workflowPolicies.workflowId, workflowId));

  if (existing.length > 0) {
    const [updated] = await db.update(workflowPolicies)
      .set({ policy, updatedBy, updatedAt: new Date() })
      .where(eq(workflowPolicies.workflowId, workflowId))
      .returning();
    return updated;
  } else {
    const [created] = await db.insert(workflowPolicies).values({
      workflowId,
      policy,
      updatedBy,
    }).returning();
    return created;
  }
}

export async function getWorkflowPolicy(workflowId: string) {
  const [policy] = await db.select()
    .from(workflowPolicies)
    .where(eq(workflowPolicies.workflowId, workflowId));
  return policy || null;
}

export async function deleteWorkflowPolicy(workflowId: string) {
  const [deleted] = await db.delete(workflowPolicies)
    .where(eq(workflowPolicies.workflowId, workflowId))
    .returning();
  return deleted || null;
}

// =====================
// WORKFLOW RUN CHECKPOINTS
// =====================

export async function createCheckpoint(input: {
  runId: string;
  workflowId: string;
  workflowVersion: number;
  currentNodeId: string;
  completedNodes?: string[];
  nodeOutputs?: Record<string, unknown>;
  status?: 'running' | 'paused' | 'completed' | 'failed';
  errorMessage?: string;
}) {
  const [checkpoint] = await db.insert(workflowRunCheckpoints).values({
    runId: input.runId,
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    currentNodeId: input.currentNodeId,
    completedNodes: input.completedNodes || [],
    nodeOutputs: input.nodeOutputs || {},
    status: input.status || 'running',
    errorMessage: input.errorMessage,
  }).returning();
  return checkpoint;
}

export async function getCheckpoint(runId: string) {
  const [checkpoint] = await db.select()
    .from(workflowRunCheckpoints)
    .where(eq(workflowRunCheckpoints.runId, runId))
    .orderBy(desc(workflowRunCheckpoints.updatedAt))
    .limit(1);
  return checkpoint || null;
}

export async function updateCheckpoint(
  runId: string,
  updates: {
    currentNodeId?: string;
    completedNodes?: string[];
    nodeOutputs?: Record<string, unknown>;
    status?: 'running' | 'paused' | 'completed' | 'failed';
    errorMessage?: string;
  }
) {
  const [checkpoint] = await db.update(workflowRunCheckpoints)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(workflowRunCheckpoints.runId, runId))
    .returning();
  return checkpoint || null;
}

export async function listCheckpoints(workflowId: string) {
  return db.select()
    .from(workflowRunCheckpoints)
    .where(eq(workflowRunCheckpoints.workflowId, workflowId))
    .orderBy(desc(workflowRunCheckpoints.createdAt));
}
