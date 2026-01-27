/**
 * Workflows Router
 * REST API for workflow CRUD, versioning, templates, and policy management
 * 
 * Endpoints:
 * - GET    /api/workflows              - List workflows
 * - POST   /api/workflows              - Create workflow
 * - GET    /api/workflows/templates    - List templates
 * - GET    /api/workflows/templates/:key - Get template
 * - GET    /api/workflows/:id          - Get workflow + latest version
 * - PUT    /api/workflows/:id          - Update workflow metadata
 * - DELETE /api/workflows/:id          - Delete workflow
 * - POST   /api/workflows/:id/versions - Create new version
 * - GET    /api/workflows/:id/versions - List versions
 * - GET    /api/workflows/:id/versions/:v - Get specific version
 * - POST   /api/workflows/:id/publish  - Publish workflow
 * - POST   /api/workflows/:id/archive  - Archive workflow
 * - POST   /api/workflows/:id/duplicate - Duplicate workflow
 * - GET    /api/workflows/:id/policy   - Get policy
 * - POST   /api/workflows/:id/policy   - Set policy
 * 
 * @packageDocumentation
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireRole, logAuditEvent } from '../middleware/rbac';
import * as workflowService from '../services/workflowService';
import {
  WorkflowDefinitionSchema,
  WorkflowPolicySchema,
  type WorkflowDefinition,
  type WorkflowPolicy,
} from '@researchflow/core/types';

const router = Router();

// =====================
// REQUEST SCHEMAS
// =====================

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  definition: WorkflowDefinitionSchema.optional(),
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const CreateVersionSchema = z.object({
  definition: WorkflowDefinitionSchema,
  changelog: z.string().optional(),
});

// =====================
// HELPER FUNCTIONS
// =====================

function getUserFromRequest(req: Request): { id: string | undefined; orgId?: string; role?: string } {
  const user = (req as any).user;
  return {
    id: user?.id,  // Don't default to 'anonymous' - let it be undefined if no user
    orgId: user?.orgId,
    role: user?.role,
  };
}

// =====================
// WORKFLOWS CRUD
// =====================

// GET /api/workflows - List workflows
router.get('/', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflows = await workflowService.listWorkflows(orgId);
    res.json({ workflows });
  } catch (error) {
    console.error('[workflows] List error:', error);
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

// POST /api/workflows - Create workflow
router.post('/', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const parsed = CreateWorkflowSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    const workflow = await workflowService.createWorkflow({
      name: parsed.data.name,
      description: parsed.data.description,
      orgId,
      createdBy: userId,
      definition: parsed.data.definition as WorkflowDefinition | undefined,
    });

    await logAuditEvent({
      eventType: 'WORKFLOW_CREATED',
      userId,
      resourceType: 'workflow',
      resourceId: workflow.id,
      action: 'CREATE',
      details: { name: workflow.name },
    });

    res.status(201).json({ workflow });
  } catch (error) {
    console.error('[workflows] Create error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// GET /api/workflows/templates - List templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    console.log('[workflows] Fetching templates...');
    const templates = await workflowService.listTemplates();
    console.log(`[workflows] Returning ${templates.length} templates`);
    res.json({ templates });
  } catch (error) {
    console.error('[workflows] Templates list error:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// POST /api/workflows/templates/seed - Seed templates if empty (admin only)
router.post('/templates/seed', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    console.log('[workflows] Seeding templates...');
    const result = await workflowService.seedTemplatesIfEmpty();
    res.json(result);
  } catch (error) {
    console.error('[workflows] Templates seed error:', error);
    res.status(500).json({ error: 'Failed to seed templates' });
  }
});

// GET /api/workflows/templates/:key - Get specific template
router.get('/templates/:key', async (req: Request, res: Response) => {
  try {
    const template = await workflowService.getTemplate(req.params.key);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ template });
  } catch (error) {
    console.error('[workflows] Template get error:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// GET /api/workflows/:id - Get workflow + latest version
router.get('/:id', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const latestVersion = await workflowService.getLatestVersion(workflow.id);
    const policy = await workflowService.getWorkflowPolicy(workflow.id);

    res.json({ workflow, latestVersion, policy });
  } catch (error) {
    console.error('[workflows] Get error:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// PUT /api/workflows/:id - Update workflow metadata
router.put('/:id', requireRole('STEWARD'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const parsed = UpdateWorkflowSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    // Check workflow exists and user has access
    const existing = await workflowService.getWorkflow(req.params.id, orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = await workflowService.updateWorkflow(req.params.id, parsed.data);

    await logAuditEvent({
      eventType: 'WORKFLOW_UPDATED',
      userId,
      resourceType: 'workflow',
      resourceId: req.params.id,
      action: 'UPDATE',
      details: parsed.data,
    });

    res.json({ workflow });
  } catch (error) {
    console.error('[workflows] Update error:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', requireRole('STEWARD'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);

    // Check workflow exists and user has access
    const existing = await workflowService.getWorkflow(req.params.id, orgId);
    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await workflowService.deleteWorkflow(req.params.id);

    await logAuditEvent({
      eventType: 'WORKFLOW_DELETED',
      userId,
      resourceType: 'workflow',
      resourceId: req.params.id,
      action: 'DELETE',
      details: { name: existing.name },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[workflows] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// =====================
// VERSIONS
// =====================

// POST /api/workflows/:id/versions - Create new version
router.post('/:id/versions', requireRole('STEWARD'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const parsed = CreateVersionSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }

    // Check workflow exists and user has access
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Check if published (locked)
    if (workflow.status === 'published') {
      return res.status(400).json({ 
        error: 'Cannot modify published workflow. Create a new workflow or archive this one first.' 
      });
    }

    const version = await workflowService.createWorkflowVersion({
      workflowId: workflow.id,
      definition: parsed.data.definition as WorkflowDefinition,
      changelog: parsed.data.changelog,
      createdBy: userId,
    });

    await logAuditEvent({
      eventType: 'WORKFLOW_VERSION_CREATED',
      userId,
      resourceType: 'workflow_version',
      resourceId: version.id,
      action: 'CREATE',
      details: { workflowId: workflow.id, version: version.version },
    });

    res.status(201).json({ version });
  } catch (error) {
    console.error('[workflows] Create version error:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// GET /api/workflows/:id/versions - List all versions
router.get('/:id/versions', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const versions = await workflowService.listVersions(workflow.id);
    res.json({ versions });
  } catch (error) {
    console.error('[workflows] List versions error:', error);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// GET /api/workflows/:id/versions/latest - Get latest version
router.get('/:id/versions/latest', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const version = await workflowService.getLatestVersion(workflow.id);
    if (!version) {
      return res.status(404).json({ error: 'No versions found for this workflow' });
    }

    res.json(version);
  } catch (error) {
    console.error('[workflows] Get latest version error:', error);
    res.status(500).json({ error: 'Failed to get latest version' });
  }
});

// GET /api/workflows/:id/versions/:version - Get specific version
router.get('/:id/versions/:version', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const versionNum = parseInt(req.params.version);
    if (isNaN(versionNum)) {
      return res.status(400).json({ error: 'Invalid version number' });
    }

    const version = await workflowService.getWorkflowVersion(workflow.id, versionNum);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ version });
  } catch (error) {
    console.error('[workflows] Get version error:', error);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

// =====================
// PUBLISH / ARCHIVE
// =====================

// POST /api/workflows/:id/publish - Publish workflow (locks it)
router.post('/:id/publish', requireRole('STEWARD'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Ensure at least one version exists
    const latestVersion = await workflowService.getLatestVersion(workflow.id);
    if (!latestVersion) {
      return res.status(400).json({ error: 'Workflow must have at least one version before publishing' });
    }

    const published = await workflowService.publishWorkflow(workflow.id);

    await logAuditEvent({
      eventType: 'WORKFLOW_PUBLISHED',
      userId,
      resourceType: 'workflow',
      resourceId: workflow.id,
      action: 'PUBLISH',
      details: { version: latestVersion.version },
    });

    res.json({ workflow: published });
  } catch (error) {
    console.error('[workflows] Publish error:', error);
    res.status(500).json({ error: 'Failed to publish workflow' });
  }
});

// POST /api/workflows/:id/archive - Archive workflow
router.post('/:id/archive', requireRole('STEWARD'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const archived = await workflowService.archiveWorkflow(workflow.id);

    await logAuditEvent({
      eventType: 'WORKFLOW_ARCHIVED',
      userId,
      resourceType: 'workflow',
      resourceId: workflow.id,
      action: 'ARCHIVE',
      details: {},
    });

    res.json({ workflow: archived });
  } catch (error) {
    console.error('[workflows] Archive error:', error);
    res.status(500).json({ error: 'Failed to archive workflow' });
  }
});

// POST /api/workflows/:id/duplicate - Duplicate workflow
router.post('/:id/duplicate', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Get the latest version to duplicate
    const latestVersion = await workflowService.getLatestVersion(workflow.id);

    // Create new workflow with duplicated data
    const duplicated = await workflowService.createWorkflow({
      name: `${workflow.name} (Copy)`,
      description: workflow.description,
      orgId: workflow.orgId,
      createdBy: userId,
      definition: latestVersion?.definition as WorkflowDefinition | undefined,
    });

    // If there was a version, create it for the duplicate
    if (latestVersion) {
      await workflowService.createWorkflowVersion({
        workflowId: duplicated.id,
        definition: latestVersion.definition as WorkflowDefinition,
        changelog: 'Duplicated from workflow: ' + workflow.name,
        createdBy: userId,
      });
    }

    // Copy policy if it exists
    const policy = await workflowService.getWorkflowPolicy(workflow.id);
    if (policy?.policy) {
      await workflowService.setWorkflowPolicy(
        duplicated.id,
        policy.policy as WorkflowPolicy,
        userId
      );
    }

    await logAuditEvent({
      eventType: 'WORKFLOW_DUPLICATED',
      userId,
      resourceType: 'workflow',
      resourceId: duplicated.id,
      action: 'DUPLICATE',
      details: { originalId: workflow.id, originalName: workflow.name },
    });

    res.status(201).json({ workflow: duplicated });
  } catch (error) {
    console.error('[workflows] Duplicate error:', error);
    res.status(500).json({ error: 'Failed to duplicate workflow' });
  }
});

// =====================
// POLICIES
// =====================

// GET /api/workflows/:id/policy - Get workflow policy
router.get('/:id/policy', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const policyRecord = await workflowService.getWorkflowPolicy(workflow.id);
    res.json({ policy: policyRecord?.policy || null });
  } catch (error) {
    console.error('[workflows] Get policy error:', error);
    res.status(500).json({ error: 'Failed to get policy' });
  }
});

// POST /api/workflows/:id/policy - Set workflow policy
router.post('/:id/policy', requireRole('STEWARD'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const parsed = WorkflowPolicySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid policy', details: parsed.error.issues });
    }

    const workflow = await workflowService.getWorkflow(req.params.id, orgId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const policyRecord = await workflowService.setWorkflowPolicy(
      workflow.id,
      parsed.data as WorkflowPolicy,
      userId
    );

    await logAuditEvent({
      eventType: 'WORKFLOW_POLICY_UPDATED',
      userId,
      resourceType: 'workflow_policy',
      resourceId: workflow.id,
      action: 'UPDATE',
      details: { policy: parsed.data },
    });

    res.json({ policy: policyRecord.policy });
  } catch (error) {
    console.error('[workflows] Set policy error:', error);
    res.status(500).json({ error: 'Failed to set policy' });
  }
});

// POST /api/workflows/:id/execute - Execute workflow
router.post('/:id/execute', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id: userId, orgId } = getUserFromRequest(req);
    const { inputs } = req.body;

    const workflow = await workflowService.getWorkflow(req.params.id, orgId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Get the latest published version
    const version = await workflowService.getLatestPublishedVersion(workflow.id);
    if (!version) {
      return res.status(400).json({ 
        error: 'No published version available',
        message: 'Workflow must be published before execution' 
      });
    }

    // Create execution record
    const executionId = crypto.randomUUID();
    const execution = {
      id: executionId,
      workflowId: workflow.id,
      versionId: version.id,
      userId,
      status: 'running',
      inputs: inputs || {},
      outputs: {},
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    // Log execution start
    await logAuditEvent({
      eventType: 'WORKFLOW_EXECUTED',
      userId,
      resourceType: 'workflow',
      resourceId: workflow.id,
      action: 'EXECUTE',
      details: { executionId, inputs },
    });

    // Return execution ID immediately for async processing
    res.json({
      executionId,
      status: 'running',
      message: 'Workflow execution started',
      workflowId: workflow.id,
      versionId: version.id,
    });

    // TODO: Send to worker service for actual execution
    // This would be done via the worker service or a job queue
  } catch (error) {
    console.error('[workflows] Execute error:', error);
    res.status(500).json({ error: 'Failed to execute workflow' });
  }
});

// GET /api/workflows/:id/executions - List workflow executions
router.get('/:id/executions', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // TODO: Fetch executions from database
    // For now, return empty array
    res.json({ executions: [] });
  } catch (error) {
    console.error('[workflows] List executions error:', error);
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

// GET /api/workflows/:id/executions/:executionId - Get execution details
router.get('/:id/executions/:executionId', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { orgId } = getUserFromRequest(req);
    const workflow = await workflowService.getWorkflow(req.params.id, orgId);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // TODO: Fetch execution from database
    res.status(404).json({ error: 'Execution not found' });
  } catch (error) {
    console.error('[workflows] Get execution error:', error);
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

export default router;
