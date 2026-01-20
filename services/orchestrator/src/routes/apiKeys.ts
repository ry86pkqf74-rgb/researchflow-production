/**
 * API Key Routes
 * Task 138 - API key rotation reminders in profiles
 */

import { Router, Request, Response } from 'express';
import {
  createApiKey,
  getApiKey,
  listUserApiKeys,
  rotateApiKey,
  revokeApiKey,
  updateKeyScopes,
  getRotationReminders,
  getKeyRotationSummary,
  getKeyHistory,
  getUserKeyHistory,
  ApiKeyScopeSchema,
} from '../services/apiKeyRotationService';

export const apiKeysRouter = Router();

// ─────────────────────────────────────────────────────────────
// Key Management
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/profile/api-keys
 * List all API keys for current user
 */
apiKeysRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const keys = listUserApiKeys(userId);

    // Never expose the key hash
    const safeKeys = keys.map(k => ({
      id: k.id,
      label: k.label,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      status: k.status,
      rotationIntervalDays: k.rotationIntervalDays,
      createdAt: k.createdAt,
      lastRotatedAt: k.lastRotatedAt,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      daysUntilExpiry: Math.ceil(
        (new Date(k.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      ),
    }));

    res.json(safeKeys);
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * GET /api/profile/api-keys/summary
 * Get rotation summary for current user
 */
apiKeysRouter.get('/summary', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const summary = getKeyRotationSummary(userId);
    res.json(summary);
  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

/**
 * GET /api/profile/api-keys/reminders
 * Get rotation reminders
 */
apiKeysRouter.get('/reminders', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const daysThreshold = parseInt(req.query.days as string) || 14;

    const reminders = getRotationReminders({ userId, daysThreshold });
    res.json(reminders);
  } catch (error) {
    console.error('Error getting reminders:', error);
    res.status(500).json({ error: 'Failed to get reminders' });
  }
});

/**
 * POST /api/profile/api-keys
 * Create a new API key
 */
apiKeysRouter.post('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const tenantId = (req as any).tenantId ?? 'default-tenant';
    const { label, scopes, rotationIntervalDays, expiresInDays } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'Label is required' });
    }

    // Validate scopes
    const validScopes = scopes?.filter((s: string) =>
      ApiKeyScopeSchema.safeParse(s).success
    ) ?? ['READ'];

    const result = createApiKey({
      userId,
      tenantId,
      label,
      scopes: validScopes,
      rotationIntervalDays,
      expiresInDays,
    });

    // Return the secret key only once
    res.status(201).json({
      id: result.key.id,
      label: result.key.label,
      keyPrefix: result.key.keyPrefix,
      scopes: result.key.scopes,
      expiresAt: result.key.expiresAt,
      secretKey: result.secretKey, // Only shown once!
      warning: 'Save this key securely. It will not be shown again.',
    });
  } catch (error: any) {
    console.error('Error creating API key:', error);
    res.status(400).json({ error: error.message ?? 'Failed to create API key' });
  }
});

/**
 * GET /api/profile/api-keys/:id
 * Get API key details
 */
apiKeysRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const key = getApiKey(req.params.id);
    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Verify ownership
    const userId = (req as any).userId ?? 'demo-user';
    if (key.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: key.id,
      label: key.label,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      status: key.status,
      rotationIntervalDays: key.rotationIntervalDays,
      createdAt: key.createdAt,
      lastRotatedAt: key.lastRotatedAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      revokedReason: key.revokedReason,
    });
  } catch (error) {
    console.error('Error getting API key:', error);
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

/**
 * POST /api/profile/api-keys/:id/rotate
 * Rotate an API key
 */
apiKeysRouter.post('/:id/rotate', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const key = getApiKey(req.params.id);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (key.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = rotateApiKey(req.params.id, userId);
    if (!result) {
      return res.status(400).json({ error: 'Failed to rotate key' });
    }

    res.json({
      id: result.key.id,
      label: result.key.label,
      keyPrefix: result.key.keyPrefix,
      expiresAt: result.key.expiresAt,
      secretKey: result.secretKey,
      warning: 'Save this new key securely. The old key is now invalid.',
    });
  } catch (error: any) {
    console.error('Error rotating API key:', error);
    res.status(400).json({ error: error.message ?? 'Failed to rotate key' });
  }
});

/**
 * POST /api/profile/api-keys/:id/revoke
 * Revoke an API key
 */
apiKeysRouter.post('/:id/revoke', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const key = getApiKey(req.params.id);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (key.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { reason } = req.body;
    const success = revokeApiKey(req.params.id, userId, reason);

    if (!success) {
      return res.status(400).json({ error: 'Failed to revoke key' });
    }

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke key' });
  }
});

/**
 * PUT /api/profile/api-keys/:id/scopes
 * Update API key scopes
 */
apiKeysRouter.put('/:id/scopes', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const key = getApiKey(req.params.id);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (key.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { scopes } = req.body;
    if (!scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ error: 'Scopes array required' });
    }

    const validScopes = scopes.filter(s =>
      ApiKeyScopeSchema.safeParse(s).success
    );

    const updated = updateKeyScopes(req.params.id, validScopes, userId);
    if (!updated) {
      return res.status(400).json({ error: 'Failed to update scopes' });
    }

    res.json({
      id: updated.id,
      scopes: updated.scopes,
    });
  } catch (error) {
    console.error('Error updating scopes:', error);
    res.status(500).json({ error: 'Failed to update scopes' });
  }
});

/**
 * GET /api/profile/api-keys/:id/history
 * Get API key history
 */
apiKeysRouter.get('/:id/history', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const key = getApiKey(req.params.id);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (key.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const history = getKeyHistory(req.params.id, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * GET /api/profile/api-keys/history/all
 * Get all API key history for user
 */
apiKeysRouter.get('/history/all', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const limit = parseInt(req.query.limit as string) || 100;
    const history = getUserKeyHistory(userId, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * GET /api/profile/api-keys/scopes
 * List available API key scopes
 */
apiKeysRouter.get('/scopes/available', (_req: Request, res: Response) => {
  res.json([
    { scope: 'READ', description: 'Read-only access to all resources' },
    { scope: 'WRITE', description: 'Create and modify resources' },
    { scope: 'ADMIN', description: 'Administrative access' },
    { scope: 'RESEARCH_READ', description: 'Read research projects' },
    { scope: 'RESEARCH_WRITE', description: 'Create/modify research projects' },
    { scope: 'ARTIFACT_READ', description: 'Read artifacts' },
    { scope: 'ARTIFACT_WRITE', description: 'Create/modify artifacts' },
    { scope: 'WORKFLOW_EXECUTE', description: 'Execute workflows' },
    { scope: 'EXPORT', description: 'Export data' },
  ]);
});

export default apiKeysRouter;
