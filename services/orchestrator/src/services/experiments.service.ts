/**
 * Experiments Service (A/B Testing)
 *
 * Manages A/B testing experiments with:
 * - Deterministic variant assignment (hash-based)
 * - Persistent assignment tracking
 * - Mode-based constraints
 * - Analytics integration
 *
 * @module services/experiments.service
 */

import { db } from '../../db';
import {
  experiments,
  experimentAssignments,
  type Experiment,
  type GovernanceMode,
  GOVERNANCE_MODES,
} from '@researchflow/core/schema';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import { eventBus } from './event-bus';
import { getMode } from './governance-config.service';
import { analyticsService } from './analytics.service';

/**
 * Variant assignment result
 */
export interface VariantResult {
  variant: string;
  config: Record<string, unknown>;
}

/**
 * Experiment metadata for admin UI
 */
export interface ExperimentMeta {
  key: string;
  enabled: boolean;
  description: string | null;
  variants: Record<string, unknown>;
  allocation: Record<string, number>;
  requiredModes: string[];
}

// In-memory cache for experiments
interface ExperimentCache {
  experiments: Map<string, Experiment>;
  expiry: number;
}

let experimentCache: ExperimentCache = {
  experiments: new Map(),
  expiry: 0,
};

const CACHE_TTL = 60000; // 1 minute

/**
 * Refresh experiment cache from database
 */
async function refreshCache(): Promise<void> {
  if (!db) return;

  try {
    const exps = await db.select().from(experiments);
    experimentCache.experiments.clear();

    for (const exp of exps) {
      experimentCache.experiments.set(exp.key, exp);
    }

    experimentCache.expiry = Date.now() + CACHE_TTL;
  } catch (error) {
    console.error('[Experiments] Error refreshing cache:', error);
  }
}

/**
 * Get experiments from cache
 */
async function getCachedExperiments(): Promise<Map<string, Experiment>> {
  if (Date.now() > experimentCache.expiry) {
    await refreshCache();
  }
  return experimentCache.experiments;
}

/**
 * Compute deterministic variant assignment based on hash
 *
 * @param identifier - User ID or session ID
 * @param experimentKey - The experiment key
 * @param allocation - Variant allocation percentages (e.g., { "A": 50, "B": 50 })
 * @returns string - The assigned variant key
 */
function computeVariantAssignment(
  identifier: string,
  experimentKey: string,
  allocation: Record<string, number>
): string {
  const hash = createHash('sha256')
    .update(`${experimentKey}:${identifier}`)
    .digest('hex');
  const hashValue = parseInt(hash.substring(0, 8), 16) % 100;

  // Sort variants for deterministic ordering
  const sortedVariants = Object.entries(allocation).sort((a, b) => a[0].localeCompare(b[0]));

  let cumulative = 0;
  for (const [variant, percentage] of sortedVariants) {
    cumulative += percentage;
    if (hashValue < cumulative) {
      return variant;
    }
  }

  // Fallback to first variant if allocation doesn't sum to 100
  return sortedVariants[0]?.[0] || 'control';
}

/**
 * Get variant for a user/session in an experiment
 *
 * @param experimentKey - The experiment key
 * @param context - Context with userId and/or sessionId and optional mode
 * @returns VariantResult with variant key and config
 */
export async function getVariant(
  experimentKey: string,
  context: { userId?: string; sessionId?: string; mode?: GovernanceMode }
): Promise<VariantResult> {
  const defaultResult: VariantResult = { variant: 'control', config: {} };

  // Get current mode
  const mode = context.mode || await getMode();

  // Get experiment from cache
  const exps = await getCachedExperiments();
  const experiment = exps.get(experimentKey);

  if (!experiment) {
    return defaultResult;
  }

  // Check if experiment is enabled
  if (!experiment.enabled) {
    return defaultResult;
  }

  // Check required modes
  const requiredModes = (experiment.requiredModes as string[]) || [];
  if (requiredModes.length > 0 && !requiredModes.includes(mode)) {
    return defaultResult;
  }

  // Determine identifier (prefer userId over sessionId)
  const identifier = context.userId || context.sessionId;
  if (!identifier) {
    return defaultResult;
  }

  // Check for existing assignment in database
  if (db) {
    try {
      const existingAssignments = await db
        .select()
        .from(experimentAssignments)
        .where(
          and(
            eq(experimentAssignments.experimentKey, experimentKey),
            context.userId
              ? eq(experimentAssignments.userId, context.userId)
              : eq(experimentAssignments.sessionId, context.sessionId!)
          )
        )
        .limit(1);

      if (existingAssignments.length > 0) {
        const existingVariant = existingAssignments[0].variant;
        const variants = experiment.variants as Record<string, unknown>;
        return {
          variant: existingVariant,
          config: (variants[existingVariant] as Record<string, unknown>) || {},
        };
      }
    } catch (error) {
      console.error('[Experiments] Error checking existing assignment:', error);
    }
  }

  // Compute deterministic assignment
  const allocation = experiment.allocation as Record<string, number>;
  const variant = computeVariantAssignment(identifier, experimentKey, allocation);
  const variants = experiment.variants as Record<string, unknown>;
  const config = (variants[variant] as Record<string, unknown>) || {};

  // Persist assignment (best effort)
  if (db) {
    try {
      await db.insert(experimentAssignments).values({
        experimentKey,
        userId: context.userId || null,
        sessionId: context.sessionId || null,
        variant,
      }).onConflictDoNothing();
    } catch (error) {
      console.error('[Experiments] Error persisting assignment:', error);
    }
  }

  // Track analytics event (if analytics service is available)
  try {
    await analyticsService.trackEvent({
      eventName: 'experiment.assigned',
      userId: context.userId,
      sessionId: context.sessionId,
      mode,
      properties: {
        experimentKey,
        variant,
      },
    });
  } catch {
    // Analytics is optional, don't fail if unavailable
  }

  // Publish event
  eventBus.publish({
    type: 'experiment.assigned',
    ts: new Date().toISOString(),
    topic: 'all',
    payload: {
      experimentKey,
      variant,
      userId: context.userId,
      sessionId: context.sessionId,
    },
  });

  return { variant, config };
}

/**
 * List all experiments for admin UI
 */
export async function listExperiments(): Promise<ExperimentMeta[]> {
  const exps = await getCachedExperiments();

  return Array.from(exps.values()).map(exp => ({
    key: exp.key,
    enabled: exp.enabled,
    description: exp.description,
    variants: (exp.variants as Record<string, unknown>) || {},
    allocation: (exp.allocation as Record<string, number>) || {},
    requiredModes: (exp.requiredModes as string[]) || [],
  }));
}

/**
 * Get a specific experiment
 */
export async function getExperiment(experimentKey: string): Promise<Experiment | null> {
  const exps = await getCachedExperiments();
  return exps.get(experimentKey) || null;
}

/**
 * Create or update an experiment
 */
export async function setExperiment(
  key: string,
  data: {
    enabled?: boolean;
    description?: string;
    variants?: Record<string, unknown>;
    allocation?: Record<string, number>;
    requiredModes?: string[];
  },
  actorUserId: string
): Promise<void> {
  if (!db) {
    throw new Error('Database not available');
  }

  // Validate required modes
  if (data.requiredModes) {
    for (const mode of data.requiredModes) {
      if (!GOVERNANCE_MODES.includes(mode as GovernanceMode)) {
        throw new Error(`Invalid mode: ${mode}`);
      }
    }
  }

  // Validate allocation sums to 100 if provided
  if (data.allocation) {
    const total = Object.values(data.allocation).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
      throw new Error(`Allocation must sum to 100, got ${total}`);
    }
  }

  // Upsert experiment
  await db
    .insert(experiments)
    .values({
      key,
      enabled: data.enabled ?? false,
      description: data.description ?? null,
      variants: data.variants ?? {},
      allocation: data.allocation ?? {},
      requiredModes: data.requiredModes ?? [],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: experiments.key,
      set: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.variants !== undefined && { variants: data.variants }),
        ...(data.allocation !== undefined && { allocation: data.allocation }),
        ...(data.requiredModes !== undefined && { requiredModes: data.requiredModes }),
        updatedAt: new Date(),
      },
    });

  // Clear cache
  clearExperimentCache();

  console.log(`[Experiments] Experiment ${key} updated by ${actorUserId}`);
}

/**
 * Clear experiment cache
 */
export function clearExperimentCache(): void {
  experimentCache.experiments.clear();
  experimentCache.expiry = 0;
}

// Export as service object
export const experimentsService = {
  getVariant,
  listExperiments,
  getExperiment,
  setExperiment,
  clearExperimentCache,
};
