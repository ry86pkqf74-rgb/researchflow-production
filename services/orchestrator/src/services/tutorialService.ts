/**
 * Tutorial Service (Task 108: Inline Tutorials)
 *
 * Manages tutorial definitions, progress tracking, and org override resolution.
 * PHI-SAFE: Tutorials contain only UI guidance, no sensitive data.
 */

import { db } from '../db';
import { tutorialAssets, userOnboarding } from '@researchflow/core/schema';
import { eq, and, or, isNull, desc } from 'drizzle-orm';
import { featureFlagsService } from './featureFlagsService';

export type SubscriptionTier = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';

export interface TutorialStep {
  title: string;
  content: string;
  targetSelector?: string; // DOM selector for tooltip mode
  videoUrl?: string;
}

export interface TutorialProgress {
  started?: string; // ISO date
  completed?: boolean;
  currentStep?: number;
  totalSteps?: number;
  dismissedPermanently?: boolean;
  viewCount?: number;
}

export interface TutorialAsset {
  id: string;
  tutorialKey: string;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  steps: TutorialStep[];
  enabled: boolean;
  orgId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TutorialService {
  /**
   * Get tutorials available to user (checks feature flag + tier + org)
   */
  async getAvailableTutorials(
    orgId: string | null
  ): Promise<TutorialAsset[]> {
    // Check feature flag
    const flagEnabled = await featureFlagsService.isFlagEnabled('inline_tutorials', orgId);
    if (!flagEnabled) {
      return [];
    }

    // Query tutorials: org-specific + global
    const tutorials = await db
      .select()
      .from(tutorialAssets)
      .where(
        and(
          eq(tutorialAssets.enabled, true),
          or(
            eq(tutorialAssets.orgId, orgId!),
            isNull(tutorialAssets.orgId) // Global tutorials
          )
        )
      );

    return tutorials as TutorialAsset[];
  }

  /**
   * Get tutorial with org override resolution
   * Precedence: org-specific (orgId matches) > global (orgId = NULL)
   */
  async getTutorial(
    tutorialKey: string,
    orgId: string | null
  ): Promise<TutorialAsset | null> {
    const results = await db
      .select()
      .from(tutorialAssets)
      .where(
        and(
          eq(tutorialAssets.tutorialKey, tutorialKey),
          or(
            eq(tutorialAssets.orgId, orgId!),
            isNull(tutorialAssets.orgId)
          )
        )
      )
      .orderBy(desc(tutorialAssets.orgId)); // Org-specific first, then NULL

    if (results.length === 0) {
      return null;
    }

    return results[0] as TutorialAsset;
  }

  /**
   * Get user's progress for tutorial
   */
  async getTutorialProgress(
    userId: string,
    tutorialKey: string
  ): Promise<TutorialProgress | null> {
    const onboarding = await db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, userId),
    });

    if (!onboarding || !onboarding.stepsCompleted) {
      return null;
    }

    const tutorials = (onboarding.stepsCompleted as any)?.tutorials || {};
    return tutorials[tutorialKey] || null;
  }

  /**
   * Update user progress
   */
  async updateProgress(
    userId: string,
    tutorialKey: string,
    progress: Partial<TutorialProgress>
  ): Promise<void> {
    // Fetch current onboarding record
    const existing = await db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, userId),
    });

    const currentSteps = (existing?.stepsCompleted as any) || { tutorials: {} };
    const tutorialProgress = currentSteps.tutorials?.[tutorialKey] || {};

    // Merge progress
    const updated = {
      ...currentSteps,
      tutorials: {
        ...(currentSteps.tutorials || {}),
        [tutorialKey]: { ...tutorialProgress, ...progress },
      },
    };

    if (existing) {
      // Update existing record
      await db
        .update(userOnboarding)
        .set({
          stepsCompleted: updated,
          updatedAt: new Date(),
        })
        .where(eq(userOnboarding.userId, userId));
    } else {
      // Create new record
      await db.insert(userOnboarding).values({
        userId,
        stepsCompleted: updated,
        currentStep: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Check if tutorial should be shown to user
   */
  async shouldShowTutorial(
    userId: string,
    tutorialKey: string
  ): Promise<boolean> {
    const progress = await this.getTutorialProgress(userId, tutorialKey);

    // Don't show if completed or permanently dismissed
    if (progress?.completed || progress?.dismissedPermanently) {
      return false;
    }

    return true;
  }

  /**
   * Create tutorial (ADMIN only - called from API)
   */
  async createTutorial(data: {
    tutorialKey: string;
    title: string;
    description?: string;
    videoUrl?: string;
    steps: TutorialStep[];
    enabled?: boolean;
    orgId?: string | null;
  }): Promise<TutorialAsset> {
    const result = await db
      .insert(tutorialAssets)
      .values({
        tutorialKey: data.tutorialKey,
        title: data.title,
        description: data.description,
        videoUrl: data.videoUrl,
        steps: data.steps as any,
        enabled: data.enabled ?? true,
        orgId: data.orgId ?? null,
      })
      .returning();

    return result[0] as TutorialAsset;
  }

  /**
   * Update tutorial (ADMIN only - called from API)
   */
  async updateTutorial(
    tutorialKey: string,
    data: Partial<{
      title: string;
      description: string;
      videoUrl: string;
      steps: TutorialStep[];
      enabled: boolean;
    }>
  ): Promise<TutorialAsset | null> {
    const result = await db
      .update(tutorialAssets)
      .set({
        ...data,
        steps: data.steps as any,
        updatedAt: new Date(),
      })
      .where(eq(tutorialAssets.tutorialKey, tutorialKey))
      .returning();

    if (result.length === 0) {
      return null;
    }

    return result[0] as TutorialAsset;
  }

  /**
   * Delete tutorial (ADMIN only - called from API)
   */
  async deleteTutorial(tutorialKey: string): Promise<boolean> {
    const result = await db
      .delete(tutorialAssets)
      .where(eq(tutorialAssets.tutorialKey, tutorialKey))
      .returning();

    return result.length > 0;
  }
}

export const tutorialService = new TutorialService();
