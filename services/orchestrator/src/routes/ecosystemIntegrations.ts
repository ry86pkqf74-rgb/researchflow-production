/**
 * Ecosystem Integrations Routes
 * Task 139 - Overleaf integration
 * Task 143 - Git sync integration
 * Task 144 - Data import wizards
 */

import { Router, Request, Response } from 'express';
import {
  generateOverleafPackage,
  recordExport,
  getExportHistory,
  getMockManuscript,
  ManuscriptExportOptionsSchema,
} from '../services/overleafService';
import {
  createIntegration,
  getIntegration,
  getProjectIntegrations,
  updateIntegration,
  deleteIntegration,
  syncToRepository,
  getSyncHistory,
  testConnection,
  prepareArtifactsForSync,
  GitProviderSchema,
} from '../services/gitSyncService';
import {
  previewSource,
  createImportJob,
  getImportJob,
  listImportJobs,
  cancelImportJob,
  executeImport,
  ImportSourceTypeSchema,
} from '../services/dataImportService';

export const ecosystemIntegrationsRouter = Router();

// ─────────────────────────────────────────────────────────────
// Overleaf Export (Task 139)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/integrations/overleaf/export
 * Export manuscript to Overleaf-compatible ZIP
 */
ecosystemIntegrationsRouter.post('/overleaf/export', async (req: Request, res: Response) => {
  try {
    const parseResult = ManuscriptExportOptionsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid export options',
        details: parseResult.error.issues,
      });
    }

    const options = parseResult.data;
    const userId = (req as any).userId ?? 'system';

    // Get manuscript (in production, fetch from database)
    const manuscript = getMockManuscript(options.manuscriptId);
    if (!manuscript) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    // Generate package
    const entries = generateOverleafPackage(manuscript, options);

    // Record export
    recordExport(options.manuscriptId, userId, 'overleaf', options, entries.length);

    // In production, use archiver to create actual ZIP
    // For now, return file listing
    res.json({
      message: 'Overleaf package ready',
      manuscriptId: options.manuscriptId,
      title: manuscript.title,
      files: entries.map(e => ({
        path: e.path,
        size: typeof e.content === 'string' ? e.content.length : e.content.length,
      })),
      instructions: [
        '1. Download the ZIP file',
        '2. Go to Overleaf → New Project → Upload Project',
        '3. Select the downloaded ZIP file',
        '4. Compile the document',
      ],
    });
  } catch (error: any) {
    console.error('Error exporting to Overleaf:', error);
    res.status(500).json({ error: error.message ?? 'Export failed' });
  }
});

/**
 * GET /api/integrations/overleaf/history/:manuscriptId
 * Get export history for a manuscript
 */
ecosystemIntegrationsRouter.get('/overleaf/history/:manuscriptId', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const history = getExportHistory(req.params.manuscriptId, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting export history:', error);
    res.status(500).json({ error: 'Failed to get export history' });
  }
});

// ─────────────────────────────────────────────────────────────
// Git Sync (Task 143)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/integrations/git
 * List git integrations for a project
 */
ecosystemIntegrationsRouter.get('/git', (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const integrations = getProjectIntegrations(projectId);
    res.json(integrations);
  } catch (error) {
    console.error('Error listing git integrations:', error);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

/**
 * POST /api/integrations/git/test
 * Test git connection
 */
ecosystemIntegrationsRouter.post('/git/test', async (req: Request, res: Response) => {
  try {
    const { provider, repoUrl, accessToken } = req.body;

    const parseResult = GitProviderSchema.safeParse(provider);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    if (!repoUrl || !accessToken) {
      return res.status(400).json({ error: 'repoUrl and accessToken are required' });
    }

    const result = await testConnection(parseResult.data, repoUrl, accessToken);
    res.json(result);
  } catch (error: any) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      error: error.message ?? 'Connection test failed',
    });
  }
});

/**
 * POST /api/integrations/git
 * Create a new git integration
 */
ecosystemIntegrationsRouter.post('/git', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const {
      projectId,
      provider,
      repoUrl,
      accessToken,
      defaultBranch,
      pathPrefix,
      autoSync,
      syncOnPublish,
    } = req.body;

    if (!projectId || !provider || !repoUrl || !accessToken) {
      return res.status(400).json({
        error: 'Missing required fields: projectId, provider, repoUrl, accessToken',
      });
    }

    const integration = createIntegration({
      projectId,
      tenantId,
      provider,
      repoUrl,
      accessToken,
      defaultBranch,
      pathPrefix,
      autoSync,
      syncOnPublish,
    });

    res.status(201).json(integration);
  } catch (error: any) {
    console.error('Error creating integration:', error);
    res.status(400).json({ error: error.message ?? 'Failed to create integration' });
  }
});

/**
 * GET /api/integrations/git/:id
 * Get a git integration
 */
ecosystemIntegrationsRouter.get('/git/:id', (req: Request, res: Response) => {
  try {
    const integration = getIntegration(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json(integration);
  } catch (error) {
    console.error('Error getting integration:', error);
    res.status(500).json({ error: 'Failed to get integration' });
  }
});

/**
 * PATCH /api/integrations/git/:id
 * Update a git integration
 */
ecosystemIntegrationsRouter.patch('/git/:id', (req: Request, res: Response) => {
  try {
    const { defaultBranch, pathPrefix, autoSync, syncOnPublish } = req.body;

    const integration = updateIntegration(req.params.id, {
      defaultBranch,
      pathPrefix,
      autoSync,
      syncOnPublish,
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json(integration);
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

/**
 * DELETE /api/integrations/git/:id
 * Delete a git integration
 */
ecosystemIntegrationsRouter.delete('/git/:id', (req: Request, res: Response) => {
  try {
    const success = deleteIntegration(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

/**
 * POST /api/integrations/git/:id/sync
 * Trigger a sync to git repository
 */
ecosystemIntegrationsRouter.post('/git/:id/sync', async (req: Request, res: Response) => {
  try {
    const { branch, commitMessage, artifacts } = req.body;

    const integration = getIntegration(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Prepare files for sync
    const files = artifacts ? prepareArtifactsForSync(
      artifacts,
      integration.pathPrefix
    ) : [];

    const result = await syncToRepository(req.params.id, files, {
      branch,
      commitMessage: commitMessage ?? 'Sync from ResearchFlow',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error syncing to git:', error);
    res.status(500).json({ error: error.message ?? 'Sync failed' });
  }
});

/**
 * GET /api/integrations/git/:id/history
 * Get sync history
 */
ecosystemIntegrationsRouter.get('/git/:id/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = getSyncHistory(req.params.id, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting sync history:', error);
    res.status(500).json({ error: 'Failed to get sync history' });
  }
});

// ─────────────────────────────────────────────────────────────
// Data Import (Task 144)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/integrations/import/sources
 * List available import source types
 */
ecosystemIntegrationsRouter.get('/import/sources', (_req: Request, res: Response) => {
  res.json([
    { id: 'CSV', name: 'CSV File', description: 'Import from comma-separated values file' },
    { id: 'EXCEL', name: 'Excel', description: 'Import from Excel spreadsheet (.xlsx, .xls)' },
    { id: 'JSON', name: 'JSON', description: 'Import from JSON file' },
    { id: 'REDCAP', name: 'REDCap', description: 'Import from REDCap via API' },
    { id: 'S3', name: 'Amazon S3', description: 'Import from S3 bucket' },
    { id: 'DATABASE', name: 'Database', description: 'Import from SQL database query' },
  ]);
});

/**
 * POST /api/integrations/import/preview
 * Preview data source and detect schema
 */
ecosystemIntegrationsRouter.post('/import/preview', async (req: Request, res: Response) => {
  try {
    const { sourceType, sourceConfig, options } = req.body;

    const parseResult = ImportSourceTypeSchema.safeParse(sourceType);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid source type' });
    }

    const preview = await previewSource(parseResult.data, sourceConfig, options);
    res.json(preview);
  } catch (error: any) {
    console.error('Error previewing source:', error);
    res.status(400).json({ error: error.message ?? 'Preview failed' });
  }
});

/**
 * POST /api/integrations/import/jobs
 * Create a new import job
 */
ecosystemIntegrationsRouter.post('/import/jobs', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'system';
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({ error: 'Import config is required' });
    }

    const job = createImportJob(config, userId, tenantId);
    res.status(201).json(job);
  } catch (error: any) {
    console.error('Error creating import job:', error);
    res.status(400).json({ error: error.message ?? 'Failed to create job' });
  }
});

/**
 * GET /api/integrations/import/jobs
 * List import jobs
 */
ecosystemIntegrationsRouter.get('/import/jobs', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const userId = req.query.userId as string | undefined;
    const status = req.query.status as any;
    const limit = parseInt(req.query.limit as string) || 20;

    const jobs = listImportJobs(tenantId, { userId, status, limit });
    res.json(jobs);
  } catch (error) {
    console.error('Error listing import jobs:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * GET /api/integrations/import/jobs/:id
 * Get import job details
 */
ecosystemIntegrationsRouter.get('/import/jobs/:id', (req: Request, res: Response) => {
  try {
    const job = getImportJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Import job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Error getting import job:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/**
 * POST /api/integrations/import/jobs/:id/execute
 * Execute an import job
 */
ecosystemIntegrationsRouter.post('/import/jobs/:id/execute', async (req: Request, res: Response) => {
  try {
    const job = await executeImport(req.params.id);
    res.json(job);
  } catch (error: any) {
    console.error('Error executing import job:', error);
    res.status(400).json({ error: error.message ?? 'Execution failed' });
  }
});

/**
 * POST /api/integrations/import/jobs/:id/cancel
 * Cancel an import job
 */
ecosystemIntegrationsRouter.post('/import/jobs/:id/cancel', (req: Request, res: Response) => {
  try {
    const success = cancelImportJob(req.params.id);
    if (!success) {
      return res.status(400).json({ error: 'Cannot cancel job' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling import job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// ─────────────────────────────────────────────────────────────
// Integration Status Summary
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/integrations/status
 * Get overall integrations status for a project
 */
ecosystemIntegrationsRouter.get('/status', (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const gitIntegrations = getProjectIntegrations(projectId);

    res.json({
      projectId,
      git: {
        configured: gitIntegrations.length > 0,
        integrations: gitIntegrations.map(i => ({
          id: i.id,
          provider: i.provider,
          lastSyncStatus: i.lastSyncStatus,
          lastSyncAt: i.lastSyncAt,
        })),
      },
      overleaf: {
        available: true,
        description: 'Export manuscripts to Overleaf-compatible format',
      },
      import: {
        available: true,
        supportedSources: ['CSV', 'EXCEL', 'JSON', 'REDCAP', 'S3', 'DATABASE'],
      },
    });
  } catch (error) {
    console.error('Error getting integration status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default ecosystemIntegrationsRouter;
