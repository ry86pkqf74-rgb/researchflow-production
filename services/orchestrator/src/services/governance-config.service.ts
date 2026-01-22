/**
 * GovernanceConfigService
 *
 * Manages DB-backed governance mode configuration.
 * Replaces the old process.env.GOVERNANCE_MODE approach with persistent,
 * auditable configuration that syncs to in-process state.
 *
 * @module services/governance-config.service
 */

import { db } from '../../db';
import { governanceConfig, type GovernanceMode, GOVERNANCE_MODES } from '@researchflow/core/schema';
import { eq } from 'drizzle-orm';
import { logAction } from './audit-service';
import { eventBus } from './event-bus';

// Default mode when no DB config exists
const DEFAULT_MODE: GovernanceMode = 'DEMO';

// In-memory cache of current mode for fast access
let cachedMode: GovernanceMode | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get the current governance mode
 *
 * Priority:
 * 1. In-memory cache (if valid)
 * 2. Database governance_config['mode']
 * 3. Environment variable GOVERNANCE_MODE
 * 4. Default: 'DEMO'
 */
export async function getMode(): Promise<GovernanceMode> {
  // Check cache first
  if (cachedMode && Date.now() < cacheExpiry) {
    return cachedMode;
  }

  // Try database
  if (db) {
    try {
      const config = await db
        .select()
        .from(governanceConfig)
        .where(eq(governanceConfig.key, 'mode'))
        .limit(1);

      if (config.length > 0) {
        const value = config[0].value as { mode?: string };
        const mode = value.mode as GovernanceMode;

        if (GOVERNANCE_MODES.includes(mode)) {
          cachedMode = mode;
          cacheExpiry = Date.now() + CACHE_TTL;

          // Sync to process.env for mode-guard middleware compatibility
          process.env.GOVERNANCE_MODE = mode;

          return mode;
        }
      }
    } catch (error) {
      console.error('[GovernanceConfig] DB error reading mode:', error);
    }
  }

  // Fall back to env var or default
  const envMode = process.env.GOVERNANCE_MODE as GovernanceMode;
  if (envMode && GOVERNANCE_MODES.includes(envMode)) {
    cachedMode = envMode;
    cacheExpiry = Date.now() + CACHE_TTL;
    return envMode;
  }

  return DEFAULT_MODE;
}

/**
 * Set the governance mode
 *
 * This will:
 * 1. Persist to database
 * 2. Update process.env.GOVERNANCE_MODE for in-process consistency
 * 3. Write an audit log entry
 * 4. Publish an event-bus event
 *
 * @param mode - The new mode to set
 * @param actorUserId - The ID of the user making the change
 */
export async function setMode(mode: GovernanceMode, actorUserId: string): Promise<void> {
  // Validate mode
  if (!GOVERNANCE_MODES.includes(mode)) {
    throw new Error(`Invalid governance mode: ${mode}. Must be one of: ${GOVERNANCE_MODES.join(', ')}`);
  }

  const previousMode = await getMode();

  if (!db) {
    throw new Error('Database not available');
  }

  // Upsert the mode config
  await db
    .insert(governanceConfig)
    .values({
      key: 'mode',
      value: { mode },
      updatedBy: actorUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: governanceConfig.key,
      set: {
        value: { mode },
        updatedBy: actorUserId,
        updatedAt: new Date(),
      },
    });

  // Update in-process state
  process.env.GOVERNANCE_MODE = mode;
  cachedMode = mode;
  cacheExpiry = Date.now() + CACHE_TTL;

  // Write audit log
  await logAction({
    eventType: 'GOVERNANCE_MODE_CHANGED',
    action: 'MODE_CHANGE',
    userId: actorUserId,
    resourceType: 'GOVERNANCE_CONFIG',
    resourceId: 'mode',
    details: {
      previousMode,
      newMode: mode,
      severity: 'INFO',
      category: 'GOVERNANCE',
    },
  });

  // Publish event-bus event
  eventBus.publishGovernanceEvent('governance.mode_changed', {
    previousMode,
    newMode: mode,
    changedBy: actorUserId,
  });

  console.log(`[GovernanceConfig] Mode changed from ${previousMode} to ${mode} by ${actorUserId}`);
}

/**
 * Get a specific governance config value
 *
 * @param key - The config key to retrieve
 * @returns The config value or null if not found
 */
export async function getConfig(key: string): Promise<unknown> {
  if (!db) return null;

  try {
    const config = await db
      .select()
      .from(governanceConfig)
      .where(eq(governanceConfig.key, key))
      .limit(1);

    return config.length > 0 ? config[0].value : null;
  } catch (error) {
    console.error(`[GovernanceConfig] Error reading config ${key}:`, error);
    return null;
  }
}

/**
 * Set a governance config value
 *
 * @param key - The config key to set
 * @param value - The config value
 * @param actorUserId - The ID of the user making the change
 */
export async function setConfig(key: string, value: unknown, actorUserId: string): Promise<void> {
  if (!db) {
    throw new Error('Database not available');
  }

  await db
    .insert(governanceConfig)
    .values({
      key,
      value: value as Record<string, unknown>,
      updatedBy: actorUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: governanceConfig.key,
      set: {
        value: value as Record<string, unknown>,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      },
    });
}

/**
 * Initialize governance mode from database on startup
 *
 * Call this during application startup to ensure process.env.GOVERNANCE_MODE
 * is synced with the database value.
 */
export async function initializeMode(): Promise<GovernanceMode> {
  const mode = await getMode();
  console.log(`[GovernanceConfig] Initialized with mode: ${mode}`);
  return mode;
}

/**
 * Clear the mode cache
 *
 * Useful after direct database updates.
 */
export function clearModeCache(): void {
  cachedMode = null;
  cacheExpiry = 0;
}

// Export as a service object for consistency with other services
export const governanceConfigService = {
  getMode,
  setMode,
  getConfig,
  setConfig,
  initializeMode,
  clearModeCache,
};
