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
// FALLBACK TEMPLATES (used when DB is empty or unavailable)
// =====================
const FALLBACK_TEMPLATES = [
  {
    key: 'standard-research',
    name: 'Standard Research Pipeline',
    description: 'Complete 20-stage research workflow from topic declaration to archive',
    category: 'research',
    isActive: true,
    definition: {
      schemaVersion: '1.0',
      nodes: [
        { id: 'stage-1', type: 'stage', label: 'Topic Declaration', stageId: 1, position: { x: 250, y: 0 } },
        { id: 'stage-2', type: 'stage', label: 'Literature Search', stageId: 2, position: { x: 250, y: 100 } },
        { id: 'stage-3', type: 'stage', label: 'IRB Proposal', stageId: 3, position: { x: 250, y: 200 } },
        { id: 'stage-4', type: 'stage', label: 'Planned Extraction', stageId: 4, position: { x: 250, y: 300 } },
        { id: 'gate-phi', type: 'gate', label: 'PHI Check Gate', gateType: 'phi_check', position: { x: 250, y: 400 } },
        { id: 'stage-5', type: 'stage', label: 'PHI Scanning', stageId: 5, position: { x: 250, y: 500 } },
        { id: 'stage-6', type: 'stage', label: 'Schema Extraction', stageId: 6, position: { x: 250, y: 600 } },
        { id: 'stage-7', type: 'stage', label: 'Final Scrubbing', stageId: 7, position: { x: 250, y: 700 } },
        { id: 'stage-11', type: 'stage', label: 'Statistical Analysis', stageId: 11, position: { x: 250, y: 800 } },
        { id: 'gate-ai', type: 'gate', label: 'AI Approval Gate', gateType: 'ai_approval', position: { x: 250, y: 900 } },
        { id: 'stage-14', type: 'stage', label: 'Manuscript Draft', stageId: 14, position: { x: 250, y: 1000 } },
        { id: 'stage-19', type: 'stage', label: 'Archive', stageId: 19, position: { x: 250, y: 1100 } }
      ],
      edges: [
        { id: 'e1-2', from: 'stage-1', to: 'stage-2' },
        { id: 'e2-3', from: 'stage-2', to: 'stage-3' },
        { id: 'e3-4', from: 'stage-3', to: 'stage-4' },
        { id: 'e4-gate', from: 'stage-4', to: 'gate-phi' },
        { id: 'egate-5', from: 'gate-phi', to: 'stage-5' },
        { id: 'e5-6', from: 'stage-5', to: 'stage-6' },
        { id: 'e6-7', from: 'stage-6', to: 'stage-7' },
        { id: 'e7-11', from: 'stage-7', to: 'stage-11' },
        { id: 'e11-gate', from: 'stage-11', to: 'gate-ai' },
        { id: 'egate-14', from: 'gate-ai', to: 'stage-14' },
        { id: 'e14-19', from: 'stage-14', to: 'stage-19' }
      ],
      entryNodeId: 'stage-1'
    },
    createdAt: new Date()
  },
  {
    key: 'quick-analysis',
    name: 'Quick Analysis Pipeline',
    description: 'Abbreviated pipeline for rapid data analysis without full manuscript generation',
    category: 'research',
    isActive: true,
    definition: {
      schemaVersion: '1.0',
      nodes: [
        { id: 'stage-1', type: 'stage', label: 'Topic Declaration', stageId: 1, position: { x: 250, y: 0 } },
        { id: 'stage-5', type: 'stage', label: 'PHI Scanning', stageId: 5, position: { x: 250, y: 100 } },
        { id: 'stage-6', type: 'stage', label: 'Schema Extraction', stageId: 6, position: { x: 250, y: 200 } },
        { id: 'stage-11', type: 'stage', label: 'Statistical Analysis', stageId: 11, position: { x: 250, y: 300 } },
        { id: 'stage-12', type: 'stage', label: 'Results Summary', stageId: 12, position: { x: 250, y: 400 } }
      ],
      edges: [
        { id: 'e1-5', from: 'stage-1', to: 'stage-5' },
        { id: 'e5-6', from: 'stage-5', to: 'stage-6' },
        { id: 'e6-11', from: 'stage-6', to: 'stage-11' },
        { id: 'e11-12', from: 'stage-11', to: 'stage-12' }
      ],
      entryNodeId: 'stage-1'
    },
    createdAt: new Date()
  },
  {
    key: 'conference-prep',
    name: 'Conference Preparation',
    description: 'Focused workflow for Stage 20 conference materials generation',
    category: 'conference',
    isActive: true,
    definition: {
      schemaVersion: '1.0',
      nodes: [
        { id: 'stage-1', type: 'stage', label: 'Topic Declaration', stageId: 1, position: { x: 250, y: 0 } },
        { id: 'stage-2', type: 'stage', label: 'Literature Search', stageId: 2, position: { x: 250, y: 100 } },
        { id: 'stage-14', type: 'stage', label: 'Manuscript Draft', stageId: 14, position: { x: 250, y: 200 } },
        { id: 'stage-20', type: 'stage', label: 'Conference Prep', stageId: 20, position: { x: 250, y: 300 } }
      ],
      edges: [
        { id: 'e1-2', from: 'stage-1', to: 'stage-2' },
        { id: 'e2-14', from: 'stage-2', to: 'stage-14' },
        { id: 'e14-20', from: 'stage-14', to: 'stage-20' }
      ],
      entryNodeId: 'stage-1'
    },
    createdAt: new Date()
  },
  {
    key: 'literature-review',
    name: 'Literature Review Only',
    description: 'Focused workflow for comprehensive literature review and evidence synthesis',
    category: 'research',
    isActive: true,
    definition: {
      schemaVersion: '1.0',
      nodes: [
        { id: 'stage-1', type: 'stage', label: 'Topic Declaration', stageId: 1, position: { x: 250, y: 0 } },
        { id: 'stage-2', type: 'stage', label: 'Literature Search', stageId: 2, position: { x: 250, y: 100 } },
        { id: 'stage-12', type: 'stage', label: 'Results Summary', stageId: 12, position: { x: 250, y: 200 } }
      ],
      edges: [
        { id: 'e1-2', from: 'stage-1', to: 'stage-2' },
        { id: 'e2-12', from: 'stage-2', to: 'stage-12' }
      ],
      entryNodeId: 'stage-1'
    },
    createdAt: new Date()
  }
];

// =====================
// DB HELPER
// =====================
function ensureDb() {
  if (!db) {
    throw new Error('Database connection not available');
  }
  return db;
}

// =====================
// WORKFLOWS
// =====================

export async function createWorkflow(input: CreateWorkflowInput) {
  const database = ensureDb();
  const [workflow] = await database.insert(workflows).values({
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
  const database = ensureDb();
  const conditions = orgId
    ? and(eq(workflows.id, id), eq(workflows.orgId, orgId))
    : eq(workflows.id, id);

  const [workflow] = await database.select().from(workflows).where(conditions);
  return workflow || null;
}

export async function listWorkflows(orgId?: string) {
  const database = ensureDb();
  const conditions = orgId ? eq(workflows.orgId, orgId) : undefined;
  return database.select().from(workflows).where(conditions).orderBy(desc(workflows.updatedAt));
}

export async function updateWorkflow(id: string, updates: UpdateWorkflowInput) {
  const database = ensureDb();
  const [workflow] = await database.update(workflows)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(workflows.id, id))
    .returning();
  return workflow || null;
}

export async function deleteWorkflow(id: string) {
  const database = ensureDb();
  const [deleted] = await database.delete(workflows)
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
  const database = ensureDb();
  
  // Get current max version
  const [latest] = await database
    .select({ version: workflowVersions.version })
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, input.workflowId))
    .orderBy(desc(workflowVersions.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;

  const [version] = await database.insert(workflowVersions).values({
    workflowId: input.workflowId,
    version: nextVersion,
    definition: input.definition,
    changelog: input.changelog,
    createdBy: input.createdBy || null,  // Use null if no user provided
  }).returning();

  // Update workflow's updatedAt
  await database.update(workflows)
    .set({ updatedAt: new Date() })
    .where(eq(workflows.id, input.workflowId));

  return version;
}

export async function getWorkflowVersion(workflowId: string, version: number) {
  const database = ensureDb();
  const [v] = await database.select()
    .from(workflowVersions)
    .where(and(
      eq(workflowVersions.workflowId, workflowId),
      eq(workflowVersions.version, version)
    ));
  return v || null;
}

export async function getLatestVersion(workflowId: string) {
  const database = ensureDb();
  const [v] = await database.select()
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
  const database = ensureDb();
  return database.select()
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId))
    .orderBy(desc(workflowVersions.version));
}

// =====================
// WORKFLOW TEMPLATES
// =====================

export async function listTemplates(activeOnly = true) {
  // Try to get templates from database
  try {
    if (db) {
      const conditions = activeOnly ? eq(workflowTemplates.isActive, true) : undefined;
      const dbTemplates = await db.select().from(workflowTemplates).where(conditions);
      
      // If we have templates in DB, return them
      if (dbTemplates && dbTemplates.length > 0) {
        console.log(`[Templates] Returning ${dbTemplates.length} templates from database`);
        return dbTemplates;
      }
    }
  } catch (error) {
    console.warn('[Templates] Database query failed, using fallback templates:', error);
  }
  
  // Fallback to hardcoded templates if DB is empty or unavailable
  console.log(`[Templates] Using ${FALLBACK_TEMPLATES.length} fallback templates`);
  return activeOnly 
    ? FALLBACK_TEMPLATES.filter(t => t.isActive)
    : FALLBACK_TEMPLATES;
}

export async function getTemplate(key: string) {
  // Try database first
  try {
    if (db) {
      const [template] = await db.select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.key, key));
      if (template) {
        return template;
      }
    }
  } catch (error) {
    console.warn('[Templates] Database query failed, checking fallback templates:', error);
  }
  
  // Fallback to hardcoded templates
  return FALLBACK_TEMPLATES.find(t => t.key === key) || null;
}

export async function createTemplate(input: {
  key: string;
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  category?: string;
}) {
  const database = ensureDb();
  const [template] = await database.insert(workflowTemplates).values({
    key: input.key,
    name: input.name,
    description: input.description,
    definition: input.definition,
    category: input.category || 'general',
    isActive: true,
  }).returning();
  return template;
}

/**
 * Seed templates into database if they don't exist
 * Useful for ensuring templates are available after fresh DB setup
 */
export async function seedTemplatesIfEmpty() {
  try {
    if (!db) {
      console.log('[Templates] No database connection, skipping seed');
      return { seeded: false, reason: 'no_db' };
    }
    
    const existing = await db.select().from(workflowTemplates);
    if (existing.length > 0) {
      console.log(`[Templates] ${existing.length} templates already exist, skipping seed`);
      return { seeded: false, reason: 'already_exists', count: existing.length };
    }
    
    // Insert fallback templates
    for (const template of FALLBACK_TEMPLATES) {
      await db.insert(workflowTemplates).values({
        key: template.key,
        name: template.name,
        description: template.description,
        definition: template.definition as any,
        category: template.category,
        isActive: template.isActive,
      }).onConflictDoNothing();
    }
    
    console.log(`[Templates] Seeded ${FALLBACK_TEMPLATES.length} templates`);
    return { seeded: true, count: FALLBACK_TEMPLATES.length };
  } catch (error) {
    console.error('[Templates] Seed failed:', error);
    return { seeded: false, reason: 'error', error };
  }
}

// =====================
// WORKFLOW POLICIES
// =====================

export async function setWorkflowPolicy(
  workflowId: string,
  policy: WorkflowPolicy,
  updatedBy: string
) {
  const database = ensureDb();
  const existing = await database.select()
    .from(workflowPolicies)
    .where(eq(workflowPolicies.workflowId, workflowId));

  if (existing.length > 0) {
    const [updated] = await database.update(workflowPolicies)
      .set({ policy, updatedBy, updatedAt: new Date() })
      .where(eq(workflowPolicies.workflowId, workflowId))
      .returning();
    return updated;
  } else {
    const [created] = await database.insert(workflowPolicies).values({
      workflowId,
      policy,
      updatedBy,
    }).returning();
    return created;
  }
}

export async function getWorkflowPolicy(workflowId: string) {
  const database = ensureDb();
  const [policy] = await database.select()
    .from(workflowPolicies)
    .where(eq(workflowPolicies.workflowId, workflowId));
  return policy || null;
}

export async function deleteWorkflowPolicy(workflowId: string) {
  const database = ensureDb();
  const [deleted] = await database.delete(workflowPolicies)
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
  const database = ensureDb();
  const [checkpoint] = await database.insert(workflowRunCheckpoints).values({
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
  const database = ensureDb();
  const [checkpoint] = await database.select()
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
  const database = ensureDb();
  const [checkpoint] = await database.update(workflowRunCheckpoints)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(workflowRunCheckpoints.runId, runId))
    .returning();
  return checkpoint || null;
}

export async function listCheckpoints(workflowId: string) {
  const database = ensureDb();
  return database.select()
    .from(workflowRunCheckpoints)
    .where(eq(workflowRunCheckpoints.workflowId, workflowId))
    .orderBy(desc(workflowRunCheckpoints.createdAt));
}
