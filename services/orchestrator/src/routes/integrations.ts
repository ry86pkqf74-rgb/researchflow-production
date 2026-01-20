/**
 * Integrations Routes (Task 85-86, 92)
 *
 * Manages external integrations (Slack, Notion, GitHub, etc.)
 * for organizations.
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { orgIntegrations } from '@researchflow/core/types/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/governance';
import { resolveOrgContext, requireOrgMember, requireOrgCapability } from '../middleware/org-context';
import * as slackService from '../services/slackService';
import * as notionService from '../services/notionService';
import * as githubService from '../services/githubService';

const router = Router();

// All routes require authentication and org context
router.use(requireAuth);
router.use(resolveOrgContext);
router.use(requireOrgMember);

type IntegrationType = 'slack' | 'notion' | 'github' | 'zoom' | 'salesforce';

interface IntegrationConfig {
  enabled: boolean;
  webhookUrl?: string;
  apiKey?: string;
  channel?: string;
  databaseId?: string;
  repoUrl?: string;
  [key: string]: any;
}

/**
 * GET /integrations
 * List all integrations for the organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;

    const integrations = await db
      .select()
      .from(orgIntegrations)
      .where(eq(orgIntegrations.orgId, orgId));

    // Get status of each integration type
    const allTypes: IntegrationType[] = ['slack', 'notion', 'github', 'zoom', 'salesforce'];
    const result = allTypes.map(type => {
      const existing = integrations.find(i => i.integrationType === type);
      return {
        type,
        enabled: existing?.isActive ?? false,
        configured: !!existing,
        config: existing?.config || {},
        lastSyncedAt: existing?.updatedAt,
      };
    });

    res.json({ integrations: result });
  } catch (error: any) {
    console.error('[Integrations] Error listing integrations:', error);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

/**
 * GET /integrations/:type
 * Get specific integration details
 */
router.get('/:type', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const { type } = req.params;

    const [integration] = await db
      .select()
      .from(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, type)
      ))
      .limit(1);

    if (!integration) {
      return res.json({
        type,
        enabled: false,
        configured: false,
        config: {},
      });
    }

    // Add connectivity status based on type
    let status = 'unknown';
    if (integration.isActive) {
      switch (type) {
        case 'notion':
          status = notionService.isNotionConfigured() ? 'connected' : 'misconfigured';
          break;
        case 'github':
          status = githubService.isGitHubConfigured() ? 'connected' : 'misconfigured';
          break;
        default:
          status = 'connected';
      }
    }

    res.json({
      type,
      enabled: integration.isActive,
      configured: true,
      config: integration.config,
      status,
      lastSyncedAt: integration.updatedAt,
    });
  } catch (error: any) {
    console.error('[Integrations] Error getting integration:', error);
    res.status(500).json({ error: 'Failed to get integration' });
  }
});

/**
 * PUT /integrations/:type
 * Configure an integration
 */
router.put('/:type', requireOrgCapability('integrations'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const { type } = req.params;
    const { enabled, config } = req.body;

    const validTypes: IntegrationType[] = ['slack', 'notion', 'github', 'zoom', 'salesforce'];
    if (!validTypes.includes(type as IntegrationType)) {
      return res.status(400).json({ error: 'Invalid integration type' });
    }

    // Check if integration exists
    const [existing] = await db
      .select()
      .from(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, type)
      ))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(orgIntegrations)
        .set({
          isActive: enabled ?? existing.isActive,
          config: config ? { ...existing.config, ...config } : existing.config,
          updatedAt: new Date(),
        })
        .where(eq(orgIntegrations.id, existing.id));
    } else {
      // Create new
      await db.insert(orgIntegrations).values({
        orgId,
        integrationType: type,
        isActive: enabled ?? false,
        config: config || {},
      });
    }

    res.json({ success: true, message: `${type} integration updated` });
  } catch (error: any) {
    console.error('[Integrations] Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

/**
 * DELETE /integrations/:type
 * Disable and remove integration configuration
 */
router.delete('/:type', requireOrgCapability('integrations'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const { type } = req.params;

    await db
      .delete(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, type)
      ));

    res.json({ success: true, message: `${type} integration removed` });
  } catch (error: any) {
    console.error('[Integrations] Error removing integration:', error);
    res.status(500).json({ error: 'Failed to remove integration' });
  }
});

/**
 * POST /integrations/:type/test
 * Test integration connectivity
 */
router.post('/:type/test', requireOrgCapability('integrations'), async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    let result: { success: boolean; message: string } = {
      success: false,
      message: 'Unknown integration type',
    };

    switch (type) {
      case 'slack':
        const { webhookUrl } = req.body;
        if (!webhookUrl) {
          result = { success: false, message: 'Webhook URL required' };
        } else {
          const slackResult = await slackService.sendSlackMessage(
            { webhookUrl },
            { text: 'Test message from ResearchFlow Canvas' }
          );
          result = slackResult.success
            ? { success: true, message: 'Slack connection successful' }
            : { success: false, message: slackResult.error || 'Slack test failed' };
        }
        break;

      case 'notion':
        if (notionService.isNotionConfigured()) {
          const databases = await notionService.listDatabases();
          result = {
            success: true,
            message: `Connected! Found ${databases.length} databases`,
          };
        } else {
          result = { success: false, message: 'Notion API key not configured' };
        }
        break;

      case 'github':
        if (githubService.isGitHubConfigured()) {
          const user = await githubService.getAuthenticatedUser();
          if (user) {
            result = {
              success: true,
              message: `Connected as ${user.login}`,
            };
          } else {
            result = { success: false, message: 'Failed to get GitHub user' };
          }
        } else {
          result = { success: false, message: 'GitHub PAT not configured' };
        }
        break;

      default:
        result = { success: false, message: `Testing not supported for ${type}` };
    }

    res.json(result);
  } catch (error: any) {
    console.error('[Integrations] Error testing integration:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /integrations/github/repos
 * List GitHub repositories available for import
 */
router.get('/github/repos', async (req: Request, res: Response) => {
  try {
    if (!githubService.isGitHubConfigured()) {
      return res.status(400).json({ error: 'GitHub not configured' });
    }

    const repos = await githubService.listRepositories({
      visibility: 'all',
      sort: 'updated',
      perPage: 50,
    });

    res.json({ repos });
  } catch (error: any) {
    console.error('[Integrations] Error listing GitHub repos:', error);
    res.status(500).json({ error: 'Failed to list repositories' });
  }
});

/**
 * GET /integrations/github/repos/:owner/:repo/contents
 * List contents of a GitHub repository
 */
router.get('/github/repos/:owner/:repo/contents', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { path = '' } = req.query;

    if (!githubService.isGitHubConfigured()) {
      return res.status(400).json({ error: 'GitHub not configured' });
    }

    const contents = await githubService.getRepoContents(owner, repo, path as string);

    res.json({ contents });
  } catch (error: any) {
    console.error('[Integrations] Error listing repo contents:', error);
    res.status(500).json({ error: 'Failed to list contents' });
  }
});

/**
 * GET /integrations/notion/databases
 * List Notion databases available for sync
 */
router.get('/notion/databases', async (req: Request, res: Response) => {
  try {
    if (!notionService.isNotionConfigured()) {
      return res.status(400).json({ error: 'Notion not configured' });
    }

    const databases = await notionService.listDatabases();

    res.json({ databases });
  } catch (error: any) {
    console.error('[Integrations] Error listing Notion databases:', error);
    res.status(500).json({ error: 'Failed to list databases' });
  }
});

export default router;
