import { db } from '../lib/db';
import { featureFlags, experiments, experimentAssignments } from '@researchflow/core/types/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Feature Flags Service
 *
 * Manages feature flags and A/B experiments with:
 * - Environment variable overrides
 * - In-memory caching with TTL
 * - Deterministic A/B test assignments
 * - Tier-based feature access
 */
export class FeatureFlagsService {
  private flagCache = new Map<string, boolean>();
  private cacheExpiry = Date.now() + 60000; // 1 minute TTL

  /**
   * Check if a feature flag is enabled
   *
   * Priority:
   * 1. Environment variable (FEATURE_*)
   * 2. In-memory cache (if not expired)
   * 3. Database value
   *
   * @param flagKey - The feature flag key (e.g., 'custom_fields')
   * @returns boolean - Whether the flag is enabled
   */
  async isFlagEnabled(flagKey: string): Promise<boolean> {
    // Check env override first (highest priority)
    const envKey = `FEATURE_${flagKey.toUpperCase()}`;
    if (process.env[envKey] !== undefined) {
      return process.env[envKey] === 'true';
    }

    // Check cache (if not expired)
    if (Date.now() < this.cacheExpiry && this.flagCache.has(flagKey)) {
      return this.flagCache.get(flagKey)!;
    }

    // Query DB
    try {
      const flags = await db.select()
        .from(featureFlags)
        .where(eq(featureFlags.flagKey, flagKey))
        .limit(1);

      const enabled = flags.length > 0 ? flags[0].enabled : false;

      // Update cache
      this.flagCache.set(flagKey, enabled);

      return enabled;
    } catch (error) {
      console.error(`[FeatureFlags] Error checking flag ${flagKey}:`, error);
      return false; // Fail closed
    }
  }

  /**
   * Get experiment variant for a user
   *
   * Uses deterministic hash-based assignment to ensure:
   * - Same user always gets same variant
   * - Variants distributed according to weights
   * - Assignments persist across sessions
   *
   * @param experimentKey - The experiment key
   * @param userId - The user ID
   * @returns string - Variant key ('control' if experiment not found/not running)
   */
  async getExperimentVariant(experimentKey: string, userId: string): Promise<string> {
    try {
      // Check if experiment exists and is running
      const experimentRows = await db.select()
        .from(experiments)
        .where(eq(experiments.experimentKey, experimentKey))
        .limit(1);

      if (experimentRows.length === 0 || experimentRows[0].status !== 'RUNNING') {
        return 'control';
      }

      const experiment = experimentRows[0];

      // Check if user already has an assignment
      const existingAssignments = await db.select()
        .from(experimentAssignments)
        .where(
          and(
            eq(experimentAssignments.experimentId, experiment.id),
            eq(experimentAssignments.userId, userId)
          )
        )
        .limit(1);

      if (existingAssignments.length > 0) {
        return existingAssignments[0].variantKey;
      }

      // Deterministic assignment based on hash
      const variants = experiment.variants as { key: string; weight: number }[];
      const hash = crypto.createHash('md5').update(`${experimentKey}:${userId}`).digest('hex');
      const hashValue = parseInt(hash.substring(0, 8), 16) % 100;

      let cumulativeWeight = 0;
      let selectedVariant = 'control';

      for (const variant of variants) {
        cumulativeWeight += variant.weight;
        if (hashValue < cumulativeWeight) {
          selectedVariant = variant.key;
          break;
        }
      }

      // Store assignment for future consistency
      await db.insert(experimentAssignments).values({
        experimentId: experiment.id,
        userId,
        variantKey: selectedVariant,
      });

      return selectedVariant;
    } catch (error) {
      console.error(`[Experiments] Error getting variant for ${experimentKey}:`, error);
      return 'control'; // Fail safe to control group
    }
  }

  /**
   * Check if a user is eligible for a feature based on tier
   *
   * @param flagKey - The feature flag key
   * @param userTier - The user's subscription tier
   * @returns boolean - Whether the user is eligible
   */
  async isUserEligible(flagKey: string, userTier: string): Promise<boolean> {
    try {
      const flags = await db.select()
        .from(featureFlags)
        .where(eq(featureFlags.flagKey, flagKey))
        .limit(1);

      if (flags.length === 0) {
        return false;
      }

      const flag = flags[0];

      // If no tier required, feature is available to all
      if (!flag.tierRequired) {
        return flag.enabled;
      }

      // Check tier hierarchy: FREE < PRO < TEAM < ENTERPRISE
      const tierHierarchy = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];
      const requiredIndex = tierHierarchy.indexOf(flag.tierRequired);
      const userIndex = tierHierarchy.indexOf(userTier);

      return flag.enabled && userIndex >= requiredIndex;
    } catch (error) {
      console.error(`[FeatureFlags] Error checking eligibility for ${flagKey}:`, error);
      return false; // Fail closed
    }
  }

  /**
   * Clear the in-memory flag cache
   *
   * Call this after updating flags in the database to ensure
   * changes are reflected immediately.
   */
  clearCache() {
    this.flagCache.clear();
    this.cacheExpiry = Date.now();
  }

  /**
   * Get all enabled feature flags
   *
   * @returns Promise<FeatureFlag[]> - Array of enabled flags
   */
  async getAllEnabled() {
    try {
      return await db.select()
        .from(featureFlags)
        .where(eq(featureFlags.enabled, true));
    } catch (error) {
      console.error('[FeatureFlags] Error fetching all enabled flags:', error);
      return [];
    }
  }

  /**
   * Get experiment status and metadata
   *
   * @param experimentKey - The experiment key
   * @returns Experiment record or null if not found
   */
  async getExperiment(experimentKey: string) {
    try {
      const experimentRows = await db.select()
        .from(experiments)
        .where(eq(experiments.experimentKey, experimentKey))
        .limit(1);

      return experimentRows.length > 0 ? experimentRows[0] : null;
    } catch (error) {
      console.error(`[Experiments] Error fetching experiment ${experimentKey}:`, error);
      return null;
    }
  }

  /**
   * Get feature flags available for a subscription tier (Task 102)
   *
   * Returns a map of feature flag keys to boolean values, filtered
   * by the organization's subscription tier.
   *
   * @param tier - Subscription tier (FREE, PRO, TEAM, ENTERPRISE)
   * @returns Record<string, boolean> - Map of flag keys to enabled status
   */
  async getFlagsForTier(tier: string): Promise<Record<string, boolean>> {
    try {
      const allFlags = await db.select()
        .from(featureFlags)
        .where(eq(featureFlags.enabled, true));

      const tierHierarchy = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];
      const tierIndex = tierHierarchy.indexOf(tier);

      const result: Record<string, boolean> = {};

      for (const flag of allFlags) {
        // If no tier required, feature is available to all
        if (!flag.tierRequired) {
          result[flag.flagKey] = true;
          continue;
        }

        // Check tier hierarchy
        const requiredIndex = tierHierarchy.indexOf(flag.tierRequired);
        result[flag.flagKey] = tierIndex >= requiredIndex;
      }

      return result;
    } catch (error) {
      console.error(`[FeatureFlags] Error fetching flags for tier ${tier}:`, error);
      return {};
    }
  }
}

export const featureFlagsService = new FeatureFlagsService();
