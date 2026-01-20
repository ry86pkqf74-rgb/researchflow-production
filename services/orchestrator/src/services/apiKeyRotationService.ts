/**
 * API Key Rotation Service
 * Task 138 - API key rotation reminders in profiles
 *
 * Provides:
 * - API key lifecycle management
 * - Rotation reminders and enforcement
 * - Key history and audit trail
 * - Secure key generation
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const ApiKeyScopeSchema = z.enum([
  'READ',
  'WRITE',
  'ADMIN',
  'RESEARCH_READ',
  'RESEARCH_WRITE',
  'ARTIFACT_READ',
  'ARTIFACT_WRITE',
  'WORKFLOW_EXECUTE',
  'EXPORT',
]);

export const ApiKeyStatusSchema = z.enum([
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'PENDING_ROTATION',
]);

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  tenantId: z.string(),
  label: z.string(),
  keyPrefix: z.string(), // First 8 chars for identification
  keyHash: z.string(), // SHA-256 hash of full key
  scopes: z.array(ApiKeyScopeSchema),
  status: ApiKeyStatusSchema,
  rotationIntervalDays: z.number().int().min(1).max(365).default(90),
  createdAt: z.string().datetime(),
  lastRotatedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
  revokedReason: z.string().optional(),
});

export const ApiKeyHistorySchema = z.object({
  id: z.string().uuid(),
  keyId: z.string().uuid(),
  action: z.enum(['CREATED', 'ROTATED', 'REVOKED', 'EXPIRED', 'USED', 'SCOPE_CHANGED']),
  timestamp: z.string().datetime(),
  actorId: z.string(),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
});

export const RotationReminderSchema = z.object({
  keyId: z.string(),
  userId: z.string(),
  keyLabel: z.string(),
  daysUntilExpiry: z.number(),
  expiresAt: z.string().datetime(),
  reminderLevel: z.enum(['INFO', 'WARNING', 'URGENT', 'OVERDUE']),
  sentAt: z.string().datetime().optional(),
});

export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type ApiKeyHistory = z.infer<typeof ApiKeyHistorySchema>;
export type RotationReminder = z.infer<typeof RotationReminderSchema>;

// ─────────────────────────────────────────────────────────────
// In-Memory Storage
// ─────────────────────────────────────────────────────────────

const apiKeys: Map<string, ApiKey> = new Map();
const keyHistory: ApiKeyHistory[] = [];

// ─────────────────────────────────────────────────────────────
// Key Generation
// ─────────────────────────────────────────────────────────────

const KEY_PREFIX = 'rf_'; // ResearchFlow prefix

function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Generate 32 bytes of random data
  const randomBytes = crypto.randomBytes(32);
  const key = KEY_PREFIX + randomBytes.toString('base64url');
  const prefix = key.substring(0, 11); // "rf_" + 8 chars
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  return { key, prefix, hash };
}

// ─────────────────────────────────────────────────────────────
// Key Management API
// ─────────────────────────────────────────────────────────────

export interface CreateApiKeyInput {
  userId: string;
  tenantId: string;
  label: string;
  scopes: ApiKeyScope[];
  rotationIntervalDays?: number;
  expiresInDays?: number;
}

export interface CreateApiKeyResult {
  key: ApiKey;
  secretKey: string; // Only returned once at creation
}

export function createApiKey(input: CreateApiKeyInput): CreateApiKeyResult {
  const { key, prefix, hash } = generateApiKey();
  const id = crypto.randomUUID();
  const now = new Date();

  const rotationInterval = input.rotationIntervalDays ?? 90;
  const expiresInDays = input.expiresInDays ?? rotationInterval;
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

  const apiKey: ApiKey = {
    id,
    userId: input.userId,
    tenantId: input.tenantId,
    label: input.label,
    keyPrefix: prefix,
    keyHash: hash,
    scopes: input.scopes,
    status: 'ACTIVE',
    rotationIntervalDays: rotationInterval,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  apiKeys.set(id, apiKey);

  // Log creation
  logKeyAction(id, 'CREATED', input.userId, {
    scopes: input.scopes,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    key: apiKey,
    secretKey: key, // Only time the full key is returned
  };
}

export function getApiKey(id: string): ApiKey | undefined {
  const key = apiKeys.get(id);
  if (key) {
    // Check if expired
    if (new Date(key.expiresAt) < new Date() && key.status === 'ACTIVE') {
      key.status = 'EXPIRED';
      apiKeys.set(id, key);
      logKeyAction(id, 'EXPIRED', 'system');
    }
  }
  return key;
}

export function listUserApiKeys(userId: string): ApiKey[] {
  const now = new Date();

  return Array.from(apiKeys.values())
    .filter(k => k.userId === userId)
    .map(k => {
      // Update expired status
      if (new Date(k.expiresAt) < now && k.status === 'ACTIVE') {
        k.status = 'EXPIRED';
        apiKeys.set(k.id, k);
      }
      return k;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function rotateApiKey(
  id: string,
  actorId: string
): CreateApiKeyResult | undefined {
  const existing = apiKeys.get(id);
  if (!existing) return undefined;

  if (existing.status === 'REVOKED') {
    throw new Error('Cannot rotate revoked key');
  }

  // Generate new key
  const { key, prefix, hash } = generateApiKey();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + existing.rotationIntervalDays * 24 * 60 * 60 * 1000
  );

  // Update key
  existing.keyPrefix = prefix;
  existing.keyHash = hash;
  existing.status = 'ACTIVE';
  existing.lastRotatedAt = now.toISOString();
  existing.expiresAt = expiresAt.toISOString();

  apiKeys.set(id, existing);

  // Log rotation
  logKeyAction(id, 'ROTATED', actorId, {
    newPrefix: prefix,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    key: existing,
    secretKey: key,
  };
}

export function revokeApiKey(
  id: string,
  actorId: string,
  reason?: string
): boolean {
  const existing = apiKeys.get(id);
  if (!existing) return false;

  if (existing.status === 'REVOKED') {
    return false;
  }

  existing.status = 'REVOKED';
  existing.revokedAt = new Date().toISOString();
  existing.revokedReason = reason;

  apiKeys.set(id, existing);

  // Log revocation
  logKeyAction(id, 'REVOKED', actorId, { reason });

  return true;
}

export function updateKeyScopes(
  id: string,
  scopes: ApiKeyScope[],
  actorId: string
): ApiKey | undefined {
  const existing = apiKeys.get(id);
  if (!existing || existing.status === 'REVOKED') return undefined;

  const oldScopes = existing.scopes;
  existing.scopes = scopes;
  apiKeys.set(id, existing);

  // Log scope change
  logKeyAction(id, 'SCOPE_CHANGED', actorId, {
    oldScopes,
    newScopes: scopes,
  });

  return existing;
}

// ─────────────────────────────────────────────────────────────
// Key Validation
// ─────────────────────────────────────────────────────────────

export function validateApiKey(key: string): {
  valid: boolean;
  keyId?: string;
  userId?: string;
  scopes?: ApiKeyScope[];
  error?: string;
} {
  if (!key.startsWith(KEY_PREFIX)) {
    return { valid: false, error: 'Invalid key format' };
  }

  const hash = crypto.createHash('sha256').update(key).digest('hex');

  // Find key by hash
  for (const apiKey of apiKeys.values()) {
    if (apiKey.keyHash === hash) {
      // Check status
      if (apiKey.status === 'REVOKED') {
        return { valid: false, error: 'Key has been revoked' };
      }

      if (apiKey.status === 'EXPIRED' || new Date(apiKey.expiresAt) < new Date()) {
        return { valid: false, error: 'Key has expired' };
      }

      // Update last used
      apiKey.lastUsedAt = new Date().toISOString();
      apiKeys.set(apiKey.id, apiKey);

      // Log usage (rate limited in production)
      // logKeyAction(apiKey.id, 'USED', 'system');

      return {
        valid: true,
        keyId: apiKey.id,
        userId: apiKey.userId,
        scopes: apiKey.scopes,
      };
    }
  }

  return { valid: false, error: 'Invalid key' };
}

// ─────────────────────────────────────────────────────────────
// Rotation Reminders
// ─────────────────────────────────────────────────────────────

export function getRotationReminders(options?: {
  userId?: string;
  daysThreshold?: number;
}): RotationReminder[] {
  const now = new Date();
  const threshold = options?.daysThreshold ?? 14;
  const reminders: RotationReminder[] = [];

  for (const key of apiKeys.values()) {
    if (key.status === 'REVOKED') continue;
    if (options?.userId && key.userId !== options.userId) continue;

    const expiresAt = new Date(key.expiresAt);
    const daysUntilExpiry = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Determine reminder level
    let reminderLevel: RotationReminder['reminderLevel'];
    if (daysUntilExpiry < 0) {
      reminderLevel = 'OVERDUE';
    } else if (daysUntilExpiry <= 3) {
      reminderLevel = 'URGENT';
    } else if (daysUntilExpiry <= 7) {
      reminderLevel = 'WARNING';
    } else if (daysUntilExpiry <= threshold) {
      reminderLevel = 'INFO';
    } else {
      continue; // No reminder needed
    }

    reminders.push({
      keyId: key.id,
      userId: key.userId,
      keyLabel: key.label,
      daysUntilExpiry,
      expiresAt: key.expiresAt,
      reminderLevel,
    });
  }

  // Sort by urgency
  const levelOrder = { OVERDUE: 0, URGENT: 1, WARNING: 2, INFO: 3 };
  reminders.sort((a, b) =>
    levelOrder[a.reminderLevel] - levelOrder[b.reminderLevel]
  );

  return reminders;
}

export function getKeyRotationSummary(userId: string): {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  revokedKeys: number;
  needsRotation: number;
  nextExpiration?: { keyId: string; label: string; daysRemaining: number };
} {
  const userKeys = listUserApiKeys(userId);
  const now = new Date();

  const summary = {
    totalKeys: userKeys.length,
    activeKeys: 0,
    expiredKeys: 0,
    revokedKeys: 0,
    needsRotation: 0,
    nextExpiration: undefined as { keyId: string; label: string; daysRemaining: number } | undefined,
  };

  let nextExpiry: { keyId: string; label: string; date: Date } | undefined;

  for (const key of userKeys) {
    switch (key.status) {
      case 'ACTIVE':
      case 'PENDING_ROTATION':
        summary.activeKeys++;
        const expiresAt = new Date(key.expiresAt);
        const daysRemaining = Math.ceil(
          (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        if (daysRemaining <= 14) {
          summary.needsRotation++;
        }

        if (!nextExpiry || expiresAt < nextExpiry.date) {
          nextExpiry = { keyId: key.id, label: key.label, date: expiresAt };
        }
        break;
      case 'EXPIRED':
        summary.expiredKeys++;
        break;
      case 'REVOKED':
        summary.revokedKeys++;
        break;
    }
  }

  if (nextExpiry) {
    summary.nextExpiration = {
      keyId: nextExpiry.keyId,
      label: nextExpiry.label,
      daysRemaining: Math.ceil(
        (nextExpiry.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      ),
    };
  }

  return summary;
}

// ─────────────────────────────────────────────────────────────
// History & Audit
// ─────────────────────────────────────────────────────────────

function logKeyAction(
  keyId: string,
  action: ApiKeyHistory['action'],
  actorId: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string
): void {
  keyHistory.push({
    id: crypto.randomUUID(),
    keyId,
    action,
    timestamp: new Date().toISOString(),
    actorId,
    metadata,
    ipAddress,
  });
}

export function getKeyHistory(
  keyId: string,
  limit = 50
): ApiKeyHistory[] {
  return keyHistory
    .filter(h => h.keyId === keyId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getUserKeyHistory(
  userId: string,
  limit = 100
): ApiKeyHistory[] {
  // Get all key IDs for user
  const userKeyIds = new Set(
    Array.from(apiKeys.values())
      .filter(k => k.userId === userId)
      .map(k => k.id)
  );

  return keyHistory
    .filter(h => userKeyIds.has(h.keyId))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Key Management
  createApiKey,
  getApiKey,
  listUserApiKeys,
  rotateApiKey,
  revokeApiKey,
  updateKeyScopes,

  // Validation
  validateApiKey,

  // Rotation Reminders
  getRotationReminders,
  getKeyRotationSummary,

  // History
  getKeyHistory,
  getUserKeyHistory,
};
