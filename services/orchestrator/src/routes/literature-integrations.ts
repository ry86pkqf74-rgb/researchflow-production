/**
 * Literature Integrations Routes
 * Routes for Zotero reference manager sync and other literature integrations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ZoteroService, zoteroService } from '@researchflow/manuscript-engine/services';
import { db } from '../../db';
import { orgIntegrations } from '@researchflow/core/types/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/governance';
import { resolveOrgContext, requireOrgMember } from '../middleware/org-context';

export const literatureIntegrationsRouter = Router();

// Authentication required for all routes
literatureIntegrationsRouter.use(requireAuth);
literatureIntegrationsRouter.use(resolveOrgContext);
literatureIntegrationsRouter.use(requireOrgMember);

// Zotero Integration Routes

const ZoteroConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  userId: z.string().min(1, 'User ID is required'),
  libraryType: z.enum(['user', 'group']).default('user'),
  libraryId: z.string().optional(),
});

/**
 * POST /api/literature/zotero/configure
 * Configure Zotero API credentials for the organization
 */
literatureIntegrationsRouter.post('/zotero/configure', async (req: Request, res: Response) => {
  try {
    const parseResult = ZoteroConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid Zotero configuration',
        details: parseResult.error.issues,
      });
    }

    const orgId = (req as any).orgId;
    const config = parseResult.data;

    // Check if Zotero integration exists
    const [existing] = await db
      .select()
      .from(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, 'zotero')
      ))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(orgIntegrations)
        .set({
          config: {
            apiKey: config.apiKey,
            userId: config.userId,
            libraryType: config.libraryType,
            libraryId: config.libraryId,
          },
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(orgIntegrations.id, existing.id));
    } else {
      // Create new
      await db.insert(orgIntegrations).values({
        orgId,
        integrationType: 'zotero',
        isActive: true,
        config: {
          apiKey: config.apiKey,
          userId: config.userId,
          libraryType: config.libraryType,
          libraryId: config.libraryId,
        },
      });
    }

    // Configure the ZoteroService instance
    zoteroService.configure(config);

    res.json({ success: true, message: 'Zotero configured successfully' });
  } catch (error: any) {
    console.error('[Zotero] Error configuring:', error);
    res.status(500).json({ error: 'Failed to configure Zotero' });
  }
});

/**
 * GET /api/literature/zotero/status
 * Get Zotero integration status
 */
literatureIntegrationsRouter.get('/zotero/status', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;

    const [integration] = await db
      .select()
      .from(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, 'zotero')
      ))
      .limit(1);

    if (!integration || !integration.isActive) {
      return res.json({
        configured: false,
        active: false,
      });
    }

    res.json({
      configured: true,
      active: integration.isActive,
      lastSyncedAt: integration.updatedAt,
    });
  } catch (error: any) {
    console.error('[Zotero] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get Zotero status' });
  }
});

/**
 * GET /api/literature/zotero/collections
 * List available Zotero collections
 */
literatureIntegrationsRouter.get('/zotero/collections', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;

    // Ensure Zotero is configured
    const configured = await ensureZoteroConfigured(orgId);
    if (!configured) {
      return res.status(400).json({ error: 'Zotero not configured' });
    }

    const collections = await zoteroService.listCollections();
    res.json({ collections });
  } catch (error: any) {
    console.error('[Zotero] Error listing collections:', error);
    res.status(500).json({ error: 'Failed to list collections: ' + error.message });
  }
});

/**
 * GET /api/literature/zotero/collections/:collectionKey/items
 * Get items from a specific Zotero collection
 */
literatureIntegrationsRouter.get('/zotero/collections/:collectionKey/items', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const { collectionKey } = req.params;

    const configured = await ensureZoteroConfigured(orgId);
    if (!configured) {
      return res.status(400).json({ error: 'Zotero not configured' });
    }

    const items = await zoteroService.fetchCollectionItems(collectionKey);
    res.json({ items, count: items.length });
  } catch (error: any) {
    console.error('[Zotero] Error fetching collection items:', error);
    res.status(500).json({ error: 'Failed to fetch items: ' + error.message });
  }
});

/**
 * POST /api/literature/zotero/import
 * Import citations from a Zotero collection into a manuscript
 */
literatureIntegrationsRouter.post('/zotero/import', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const { manuscriptId, collectionKey } = req.body;

    if (!manuscriptId || !collectionKey) {
      return res.status(400).json({ error: 'manuscriptId and collectionKey are required' });
    }

    const configured = await ensureZoteroConfigured(orgId);
    if (!configured) {
      return res.status(400).json({ error: 'Zotero not configured' });
    }

    const result = await zoteroService.importFromCollection(collectionKey, manuscriptId);

    res.json({
      success: true,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('[Zotero] Import failed:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

/**
 * POST /api/literature/zotero/export
 * Export citations from manuscript to Zotero
 */
literatureIntegrationsRouter.post('/zotero/export', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const { citationIds, targetCollection } = req.body;

    if (!citationIds || !Array.isArray(citationIds) || citationIds.length === 0) {
      return res.status(400).json({ error: 'citationIds array is required' });
    }

    const configured = await ensureZoteroConfigured(orgId);
    if (!configured) {
      return res.status(400).json({ error: 'Zotero not configured' });
    }

    const result = await zoteroService.exportToZotero(citationIds, targetCollection);

    res.json({
      success: true,
      exported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('[Zotero] Export failed:', error);
    res.status(500).json({ error: 'Export failed: ' + error.message });
  }
});

/**
 * POST /api/literature/zotero/sync
 * Bidirectional sync between manuscript and Zotero collection
 */
literatureIntegrationsRouter.post('/zotero/sync', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const { manuscriptId, collectionKey } = req.body;

    if (!manuscriptId || !collectionKey) {
      return res.status(400).json({ error: 'manuscriptId and collectionKey are required' });
    }

    const configured = await ensureZoteroConfigured(orgId);
    if (!configured) {
      return res.status(400).json({ error: 'Zotero not configured' });
    }

    const result = await zoteroService.bidirectionalSync(manuscriptId, collectionKey);

    res.json({
      success: true,
      fromZotero: result.fromZotero,
      toZotero: result.toZotero,
    });
  } catch (error: any) {
    console.error('[Zotero] Sync failed:', error);
    res.status(500).json({ error: 'Sync failed: ' + error.message });
  }
});

/**
 * GET /api/literature/zotero/search
 * Search Zotero library
 */
literatureIntegrationsRouter.get('/zotero/search', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const configured = await ensureZoteroConfigured(orgId);
    if (!configured) {
      return res.status(400).json({ error: 'Zotero not configured' });
    }

    const items = await zoteroService.search(query);
    res.json({ items, count: items.length });
  } catch (error: any) {
    console.error('[Zotero] Search failed:', error);
    res.status(500).json({ error: 'Search failed: ' + error.message });
  }
});

// Helper Functions

/**
 * Ensure Zotero is configured and the service is initialized
 */
async function ensureZoteroConfigured(orgId: string): Promise<boolean> {
  try {
    const [integration] = await db
      .select()
      .from(orgIntegrations)
      .where(and(
        eq(orgIntegrations.orgId, orgId),
        eq(orgIntegrations.integrationType, 'zotero')
      ))
      .limit(1);

    if (!integration || !integration.isActive) {
      return false;
    }

    const config = integration.config as {
      apiKey: string;
      userId: string;
      libraryType: 'user' | 'group';
      libraryId?: string;
    };

    // Configure the service if not already
    zoteroService.configure(config);
    return true;
  } catch (error) {
    console.error('[Zotero] Error checking configuration:', error);
    return false;
  }
}

export default literatureIntegrationsRouter;
