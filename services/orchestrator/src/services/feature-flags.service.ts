/**
 * Feature Flags Service (v2 - DB-backed with governance mode support)
 *
 * Manages feature flags with:
 * - DB persistence in feature_flags table
 * - Required governance modes constraint
 * - Deterministic rollout percentage (hash-based)
 * - Environment variable overrides (FEATURE_<KEY>=true/false)
 * - Audit logging and event publishing
 *
 * @module services/feature-flags.service
 */

import { db } from '../../db';
import { featureFlags, type FeatureFlag, GOVERNANCE_MODES, type GovernanceMode } from '@researchflow/core/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { logAction } from './audit-service';
import { eventBus } from './event-bus';
import { getMode } from './governance-config.service';

// In-memory cache for fast flag lookups
interface FlagCache {
  flags: Map<string, FeatureFlag>;
  expiry: number;
}

let flagCache: FlagCache = {
  flags: new Map(),
  expiry: 0,
};

const CACHE_TTL = 30000; // 30 seconds

/**
 * Flag metadata for UI display
 */
export interface FlagMeta {
  key: string;
  enabled: boolean;
  description: string | null;
  scope: string;
  rolloutPercent: number;
  requiredModes: string[];
}

/**
 * Refresh the flag cache from database
 */
async function refreshCache(): Promise<void> {
  if (!db) return;

  try {
    const flags = await db.select().from(featureFlags);
    flagCache.flags.clear();

    for (const flag of flags) {
      flagCache.flags.set(flag.flagKey, flag);
    }

    flagCache.expiry = Date.now() + CACHE_TTL;
  } catch (error) {
    console.error('[FeatureFlags] Error refreshing cache:', error);
  }
}

/**
 * Get all flags from cache (refreshing if expired)
 */
async function getCachedFlags(): Promise<Map<string, FeatureFlag>> {
  if (Date.now() > flagCache.expiry) {
    await refreshCache();
  }
  return flagCache.flags;
}

/**
 * Deterministic hash for rollout percentage
 *
 * @param identifier - User ID or session ID
 * @param flagKey - The flag key
 * @returns Number 0-99
 */
function computeRolloutHash(identifier: string, flagKey: string): number {
  const hash = createHash('sha256')
    .update(`${flagKey}:${identifier}`)
    .digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 100;
}

/**
 * Evaluate a single flag for a given context
 *
 * @param flag - The feature flag record
 * @param context - Evaluation context (userId, sessionId, mode)
 * @returns boolean - Whether the flag is enabled for this context
 */
function evaluateFlag(
  flag: FeatureFlag,
  context: { userId?: string; sessionId?: string; mode: GovernanceMode }
): boolean {
  // 1. Check environment override first (highest priority)
  const envKey = `FEATURE_${flag.flagKey.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envKey] !== undefined) {
    return process.env[envKey] === 'true';
  }

  // 2. Check if flag is enabled at all
  if (!flag.enabled) {
    return false;
  }

  // 3. Check required modes
  const requiredModes = (flag.metadata as any)?.requiredModes || [];
  if (requiredModes.length > 0 && !requiredModes.includes(context.mode)) {
    return false;
  }

  // 4. Check rollout percentage
  const rolloutPercent = (flag.metadata as any)?.rolloutPercent || 100;
  if (rolloutPercent < 100) {
    const identifier = context.userId || context.sessionId || 'anonymous';
    const hash = computeRolloutHash(identifier, flag.flagKey);
    if (hash >= rolloutPercent) {
      return false;
    }
  }

  return true;
}

/**
 * Get evaluated flags for a given context
 *
 * @param context - Evaluation context
 * @returns Record<string, boolean> - Map of flag keys to evaluated values
 */
export async function getFlags(context: {
  userId?: string;
  sessionId?: string;
  mode?: GovernanceMode;
}): Promise<Record<string, boolean>> {
  const mode = context.mode || await getMode();
  const flags = await getCachedFlags();
  const result: Record<string, boolean> = {};

  for (const [key, flag] of flags) {
    result[key] = evaluateFlag(flag, { ...context, mode });
  }

  return result;
}

/**
 * Check if a specific flag is enabled
 *
 * @param flagKey - The flag key to check
 * @param context - Optional evaluation context
 * @returns boolean
 */
export async function isFlagEnabled(
  flagKey: string,
  context?: { userId?: string; sessionId?: string; mode?: GovernanceMode }
): Promise<boolean> {
  // Check environment override first
  const envKey = `FEATURE_${flagKey.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envKey] !== undefined) {
    return process.env[envKey] === 'true';
  }

  const flags = await getCachedFlags();
  const flag = flags.get(flagKey);

  if (!flag) {
    return false; // Fail closed
  }

  const mode = context?.mode || await getMode();
  return evaluateFlag(flag, { ...context, mode });
}

/**
 * List all flags with metadata for admin UI
 *
 * @returns Array of flag metadata
 */
export async function listFlags(): Promise<FlagMeta[]> {
  const flags = await getCachedFlags();

  return Array.from(flags.values()).map(flag => ({
    key: flag.flagKey,
    enabled: flag.enabled,
    description: flag.description,
    scope: (flag.metadata as any)?.scope || 'product',
    rolloutPercent: (flag.metadata as any)?.rolloutPercent || 100,
    requiredModes: (flag.metadata as any)?.requiredModes || [],
  }));
}

/**
 * Set or update a flag
 *
 * @param key - Flag key
 * @param data - Flag data to update
 * @param actorUserId - ID of the user making the change
 */
export async function setFlag(
  key: string,
  data: {
    enabled?: boolean;
    description?: string;
    scope?: string;
    rolloutPercent?: number;
    requiredModes?: string[];
  },
  actorUserId: string
): Promise<void> {
  if (!db) {
    throw new Error('Database not available');
  }

  // Get existing flag for comparison
  const existingFlags = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1);

  const previousState = existingFlags.length > 0 ? existingFlags[0] : null;

  // Validate required modes if provided
  if (data.requiredModes) {
    for (const mode of data.requiredModes) {
      if (!GOVERNANCE_MODES.includes(mode as GovernanceMode)) {
        throw new Error(`Invalid mode: ${mode}. Must be one of: ${GOVERNANCE_MODES.join(', ')}`);
      }
    }
  }

  // Validate rollout percent
  if (data.rolloutPercent !== undefined) {
    if (data.rolloutPercent < 0 || data.rolloutPercent > 100) {
      throw new Error('rolloutPercent must be between 0 and 100');
    }
  }

  // Upsert the flag
  await db
    .insert(featureFlags)
    .values({
      key,
      enabled: data.enabled ?? false,
      description: data.description ?? null,
      scope: data.scope ?? 'product',
      rolloutPercent: data.rolloutPercent ?? 100,
      requiredModes: data.requiredModes ?? [],
      updatedBy: actorUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.rolloutPercent !== undefined && { rolloutPercent: data.rolloutPercent }),
        ...(data.requiredModes !== undefined && { requiredModes: data.requiredModes }),
        updatedBy: actorUserId,
        updatedAt: new Date(),
      },
    });

  // Clear cache to pick up changes immediately
  clearFlagCache();

  // Write audit log
  await logAction({
    action: 'FEATURE_FLAG_CHANGED',
    userId: actorUserId,
    resourceId: key,
    resourceType: 'feature_flag',
    details: {
      previousState: previousState ? {
        enabled: previousState.enabled,
        rolloutPercent: previousState.rolloutPercent,
        requiredModes: previousState.requiredModes,
      } : null,
      newState: data,
    },
    severity: 'INFO',
    category: 'GOVERNANCE',
  });

  // Publish event-bus event
  eventBus.publishGovernanceEvent('governance.flag_changed', {
    flagKey: key,
    enabled: data.enabled,
    rolloutPercent: data.rolloutPercent,
    changedBy: actorUserId,
  });

  console.log(`[FeatureFlags] Flag ${key} updated by ${actorUserId}`);
}

/**
 * Delete a flag
 *
 * @param key - Flag key to delete
 * @param actorUserId - ID of the user making the change
 */
export async function deleteFlag(key: string, actorUserId: string): Promise<void> {
  if (!db) {
    throw new Error('Database not available');
  }

  await db.delete(featureFlags).where(eq(featureFlags.key, key));

  clearFlagCache();

  // Write audit log
  await logAction({
    action: 'FEATURE_FLAG_DELETED',
    userId: actorUserId,
    resourceId: key,
    resourceType: 'feature_flag',
    severity: 'WARN',
    category: 'GOVERNANCE',
  });

  console.log(`[FeatureFlags] Flag ${key} deleted by ${actorUserId}`);
}

/**
 * Clear the flag cache
 */
export function clearFlagCache(): void {
  flagCache.flags.clear();
  flagCache.expiry = 0;
}

// Export as a service object
export const featureFlagsService = {
  getFlags,
  isFlagEnabled,
  listFlags,
  setFlag,
  deleteFlag,
  clearFlagCache,
};
