/**
 * Future-Proofing Routes
 * Task 150 - Create future-proofing checklists for updates
 */

import { Router, Request, Response } from 'express';
import {
  createUpgradeChecklist,
  getChecklist,
  listChecklists,
  updateChecklistItem,
  approveChecklist,
  getChecklistProgress,
  runAutomatedChecks,
  createDeprecationNotice,
  listDeprecations,
  getActiveDeprecations,
  registerApiVersion,
  deprecateApiVersion,
  listApiVersions,
  getCurrentApiVersion,
} from '../services/futureProofingService';

export const futureProofingRouter = Router();

// ─────────────────────────────────────────────────────────────
// Upgrade Checklists
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/upgrades/checklists
 * List upgrade checklists
 */
futureProofingRouter.get('/checklists', (req: Request, res: Response) => {
  try {
    const status = req.query.status as any;
    const limit = parseInt(req.query.limit as string) || 20;

    const checklists = listChecklists({ status, limit });
    res.json(checklists);
  } catch (error) {
    console.error('Error listing checklists:', error);
    res.status(500).json({ error: 'Failed to list checklists' });
  }
});

/**
 * POST /api/admin/upgrades/checklists
 * Create a new upgrade checklist
 */
futureProofingRouter.post('/checklists', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'admin';
    const { fromVersion, toVersion } = req.body;

    if (!fromVersion || !toVersion) {
      return res.status(400).json({ error: 'fromVersion and toVersion are required' });
    }

    const checklist = createUpgradeChecklist(fromVersion, toVersion, userId);
    res.status(201).json(checklist);
  } catch (error) {
    console.error('Error creating checklist:', error);
    res.status(500).json({ error: 'Failed to create checklist' });
  }
});

/**
 * GET /api/admin/upgrades/checklists/:id
 * Get checklist details
 */
futureProofingRouter.get('/checklists/:id', (req: Request, res: Response) => {
  try {
    const checklist = getChecklist(req.params.id);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }
    res.json(checklist);
  } catch (error) {
    console.error('Error getting checklist:', error);
    res.status(500).json({ error: 'Failed to get checklist' });
  }
});

/**
 * GET /api/admin/upgrades/checklists/:id/progress
 * Get checklist progress
 */
futureProofingRouter.get('/checklists/:id/progress', (req: Request, res: Response) => {
  try {
    const progress = getChecklistProgress(req.params.id);
    res.json(progress);
  } catch (error: any) {
    console.error('Error getting progress:', error);
    res.status(404).json({ error: error.message ?? 'Failed to get progress' });
  }
});

/**
 * PUT /api/admin/upgrades/checklists/:id/items/:itemId
 * Update a checklist item
 */
futureProofingRouter.put('/checklists/:id/items/:itemId', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'admin';
    const { status, result } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const checklist = updateChecklistItem(req.params.id, req.params.itemId, {
      status,
      result,
      checkedBy: userId,
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist or item not found' });
    }

    res.json(checklist);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/**
 * POST /api/admin/upgrades/checklists/:id/run-automated
 * Run automated checks
 */
futureProofingRouter.post('/checklists/:id/run-automated', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'admin';
    const result = await runAutomatedChecks(req.params.id, userId);
    res.json(result);
  } catch (error: any) {
    console.error('Error running checks:', error);
    res.status(400).json({ error: error.message ?? 'Failed to run checks' });
  }
});

/**
 * POST /api/admin/upgrades/checklists/:id/approve
 * Approve a checklist
 */
futureProofingRouter.post('/checklists/:id/approve', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'admin';
    const checklist = approveChecklist(req.params.id, userId);

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    res.json(checklist);
  } catch (error: any) {
    console.error('Error approving checklist:', error);
    res.status(400).json({ error: error.message ?? 'Failed to approve' });
  }
});

// ─────────────────────────────────────────────────────────────
// Deprecation Notices
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/upgrades/deprecations
 * List deprecation notices
 */
futureProofingRouter.get('/deprecations', (req: Request, res: Response) => {
  try {
    const includeRemoved = req.query.includeRemoved === 'true';
    const deprecations = listDeprecations({ includeRemoved });
    res.json(deprecations);
  } catch (error) {
    console.error('Error listing deprecations:', error);
    res.status(500).json({ error: 'Failed to list deprecations' });
  }
});

/**
 * GET /api/admin/upgrades/deprecations/active
 * Get active deprecations for current version
 */
futureProofingRouter.get('/deprecations/active', (req: Request, res: Response) => {
  try {
    const currentVersion = req.query.version as string ?? '1.0.0';
    const active = getActiveDeprecations(currentVersion);
    res.json(active);
  } catch (error) {
    console.error('Error getting active deprecations:', error);
    res.status(500).json({ error: 'Failed to get deprecations' });
  }
});

/**
 * POST /api/admin/upgrades/deprecations
 * Create a deprecation notice
 */
futureProofingRouter.post('/deprecations', (req: Request, res: Response) => {
  try {
    const { feature, deprecatedIn, removedIn, reason, migration, documentationUrl } = req.body;

    if (!feature || !deprecatedIn || !reason || !migration) {
      return res.status(400).json({
        error: 'Required: feature, deprecatedIn, reason, migration',
      });
    }

    const notice = createDeprecationNotice({
      feature,
      deprecatedIn,
      removedIn,
      reason,
      migration,
      documentationUrl,
    });

    res.status(201).json(notice);
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({ error: 'Failed to create notice' });
  }
});

// ─────────────────────────────────────────────────────────────
// API Versions
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/upgrades/api-versions
 * List API versions
 */
futureProofingRouter.get('/api-versions', (_req: Request, res: Response) => {
  try {
    const versions = listApiVersions();
    res.json(versions);
  } catch (error) {
    console.error('Error listing versions:', error);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

/**
 * GET /api/admin/upgrades/api-versions/current
 * Get current API version
 */
futureProofingRouter.get('/api-versions/current', (_req: Request, res: Response) => {
  try {
    const current = getCurrentApiVersion();
    if (!current) {
      return res.status(404).json({ error: 'No current version registered' });
    }
    res.json(current);
  } catch (error) {
    console.error('Error getting current version:', error);
    res.status(500).json({ error: 'Failed to get current version' });
  }
});

/**
 * POST /api/admin/upgrades/api-versions
 * Register a new API version
 */
futureProofingRouter.post('/api-versions', (req: Request, res: Response) => {
  try {
    const { version, releasedAt, changelog, breakingChanges } = req.body;

    if (!version) {
      return res.status(400).json({ error: 'Version is required' });
    }

    const apiVersion = registerApiVersion({
      version,
      releasedAt: releasedAt ?? new Date().toISOString(),
      changelog,
      breakingChanges: breakingChanges ?? [],
    });

    res.status(201).json(apiVersion);
  } catch (error) {
    console.error('Error registering version:', error);
    res.status(500).json({ error: 'Failed to register version' });
  }
});

/**
 * POST /api/admin/upgrades/api-versions/:version/deprecate
 * Deprecate an API version
 */
futureProofingRouter.post('/api-versions/:version/deprecate', (req: Request, res: Response) => {
  try {
    const { sunsetDate } = req.body;

    if (!sunsetDate) {
      return res.status(400).json({ error: 'sunsetDate is required' });
    }

    const version = deprecateApiVersion(req.params.version, sunsetDate);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error deprecating version:', error);
    res.status(500).json({ error: 'Failed to deprecate version' });
  }
});

export default futureProofingRouter;
