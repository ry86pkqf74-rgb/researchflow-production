/**
 * Plugin Marketplace Routes
 * Task 137 - Plugin marketplace for third-party stage extensions
 */

import { Router, Request, Response } from 'express';
import {
  listPlugins,
  getPlugin,
  getPluginCategories,
  getFeaturedPlugins,
  installPlugin,
  uninstallPlugin,
  enablePlugin,
  disablePlugin,
  configurePlugin,
  listInstalledPlugins,
  getInstallation,
  getPluginAuditLog,
  listStageExtensions,
} from '../services/pluginMarketplaceService';

export const pluginsRouter = Router();

// ─────────────────────────────────────────────────────────────
// Marketplace Discovery
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/plugins
 * List available plugins in the marketplace
 */
pluginsRouter.get('/', (req: Request, res: Response) => {
  try {
    const result = listPlugins({
      category: req.query.category as any,
      search: req.query.search as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      verified: req.query.verified === 'true' ? true : undefined,
      featured: req.query.featured === 'true' ? true : undefined,
      sortBy: req.query.sortBy as any,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing plugins:', error);
    res.status(500).json({ error: 'Failed to list plugins' });
  }
});

/**
 * GET /api/plugins/categories
 * List plugin categories with counts
 */
pluginsRouter.get('/categories', (_req: Request, res: Response) => {
  try {
    const categories = getPluginCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error listing categories:', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

/**
 * GET /api/plugins/featured
 * Get featured plugins
 */
pluginsRouter.get('/featured', (_req: Request, res: Response) => {
  try {
    const featured = getFeaturedPlugins();
    res.json(featured);
  } catch (error) {
    console.error('Error getting featured plugins:', error);
    res.status(500).json({ error: 'Failed to get featured plugins' });
  }
});

/**
 * GET /api/plugins/extensions
 * List loaded stage extensions
 */
pluginsRouter.get('/extensions', (_req: Request, res: Response) => {
  try {
    const extensions = listStageExtensions();
    res.json(extensions.map(e => ({ id: e.id, name: e.name })));
  } catch (error) {
    console.error('Error listing extensions:', error);
    res.status(500).json({ error: 'Failed to list extensions' });
  }
});

/**
 * GET /api/plugins/:id
 * Get plugin details
 */
pluginsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const plugin = getPlugin(req.params.id);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    res.json(plugin);
  } catch (error) {
    console.error('Error getting plugin:', error);
    res.status(500).json({ error: 'Failed to get plugin' });
  }
});

// ─────────────────────────────────────────────────────────────
// Tenant Installation Management
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/plugins/installed
 * List installed plugins for the current tenant
 */
pluginsRouter.get('/tenant/installed', (req: Request, res: Response) => {
  try {
    // In production, get tenantId from auth context
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const installed = listInstalledPlugins(tenantId);
    res.json(installed);
  } catch (error) {
    console.error('Error listing installed plugins:', error);
    res.status(500).json({ error: 'Failed to list installed plugins' });
  }
});

/**
 * GET /api/plugins/:id/installation
 * Get installation details for a plugin
 */
pluginsRouter.get('/:id/installation', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const installation = getInstallation(req.params.id, tenantId);

    if (!installation) {
      return res.status(404).json({ error: 'Plugin not installed' });
    }

    res.json(installation);
  } catch (error) {
    console.error('Error getting installation:', error);
    res.status(500).json({ error: 'Failed to get installation' });
  }
});

/**
 * POST /api/plugins/:id/install
 * Install a plugin for the current tenant
 */
pluginsRouter.post('/:id/install', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const userId = (req as any).userId ?? 'system';
    const { config } = req.body;

    const installation = installPlugin(req.params.id, tenantId, userId, config);
    res.status(201).json(installation);
  } catch (error: any) {
    console.error('Error installing plugin:', error);
    res.status(400).json({ error: error.message ?? 'Failed to install plugin' });
  }
});

/**
 * POST /api/plugins/:id/uninstall
 * Uninstall a plugin
 */
pluginsRouter.post('/:id/uninstall', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const userId = (req as any).userId ?? 'system';

    const success = uninstallPlugin(req.params.id, tenantId, userId);
    if (!success) {
      return res.status(404).json({ error: 'Plugin not installed' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error uninstalling plugin:', error);
    res.status(500).json({ error: 'Failed to uninstall plugin' });
  }
});

/**
 * POST /api/plugins/:id/enable
 * Enable an installed plugin
 */
pluginsRouter.post('/:id/enable', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const userId = (req as any).userId ?? 'system';

    const installation = enablePlugin(req.params.id, tenantId, userId);
    if (!installation) {
      return res.status(404).json({ error: 'Plugin not installed' });
    }

    res.json(installation);
  } catch (error) {
    console.error('Error enabling plugin:', error);
    res.status(500).json({ error: 'Failed to enable plugin' });
  }
});

/**
 * POST /api/plugins/:id/disable
 * Disable an installed plugin
 */
pluginsRouter.post('/:id/disable', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const userId = (req as any).userId ?? 'system';

    const installation = disablePlugin(req.params.id, tenantId, userId);
    if (!installation) {
      return res.status(404).json({ error: 'Plugin not installed' });
    }

    res.json(installation);
  } catch (error) {
    console.error('Error disabling plugin:', error);
    res.status(500).json({ error: 'Failed to disable plugin' });
  }
});

/**
 * PUT /api/plugins/:id/config
 * Update plugin configuration
 */
pluginsRouter.put('/:id/config', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const userId = (req as any).userId ?? 'system';
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid config object' });
    }

    const installation = configurePlugin(req.params.id, tenantId, userId, config);
    if (!installation) {
      return res.status(404).json({ error: 'Plugin not installed' });
    }

    res.json(installation);
  } catch (error: any) {
    console.error('Error configuring plugin:', error);
    res.status(400).json({ error: error.message ?? 'Failed to configure plugin' });
  }
});

// ─────────────────────────────────────────────────────────────
// Audit Log
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/plugins/:id/audit
 * Get audit log for a plugin
 */
pluginsRouter.get('/:id/audit', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const limit = parseInt(req.query.limit as string) || 50;

    const events = getPluginAuditLog({
      pluginId: req.params.id,
      tenantId,
      limit,
    });

    res.json(events);
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

/**
 * GET /api/plugins/tenant/audit
 * Get all plugin audit events for tenant
 */
pluginsRouter.get('/tenant/audit', (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const limit = parseInt(req.query.limit as string) || 100;
    const action = req.query.action as any;

    const events = getPluginAuditLog({
      tenantId,
      action,
      limit,
    });

    res.json(events);
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

export default pluginsRouter;
