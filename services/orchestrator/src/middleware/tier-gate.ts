/**
 * Tier Gate Middleware (Task 84)
 *
 * Enforces subscription tier limits on API operations.
 * Blocks operations that exceed tier limits.
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { eq, and, count } from "drizzle-orm";
import { db } from "../../db";
import { orgMemberships, researchProjects } from "@researchflow/core/schema";
import {
  SubscriptionTier,
  TIER_LIMITS,
} from "@researchflow/core/types/organization";
import { getOrgSubscription } from "../services/stripeService";
import { logAction } from "../services/audit-service";

type ResourceType = "members" | "projects" | "aiCalls" | "storage";

/**
 * Check if adding one more of a resource would exceed tier limits
 */
async function wouldExceedLimit(
  orgId: string,
  resource: ResourceType
): Promise<{ exceeded: boolean; current: number; limit: number; tier: SubscriptionTier }> {
  const subscription = await getOrgSubscription(orgId);
  const tier = subscription?.tier || "FREE";
  const limits = TIER_LIMITS[tier];

  let currentCount = 0;
  let limit = 0;

  if (!db) {
    throw new Error("Database not available");
  }

  switch (resource) {
    case "members": {
      const result = await db
        .select({ count: count() })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, orgId),
            eq(orgMemberships.isActive, true)
          )
        );
      currentCount = Number(result[0]?.count || 0);
      limit = limits.maxMembers;
      break;
    }
    case "projects": {
      const result = await db
        .select({ count: count() })
        .from(researchProjects)
        .where(eq(researchProjects.orgId, orgId));
      currentCount = Number(result[0]?.count || 0);
      limit = limits.maxProjects;
      break;
    }
    case "aiCalls": {
      // TODO: Implement AI call tracking
      currentCount = 0;
      limit = limits.aiCallsPerMonth;
      break;
    }
    case "storage": {
      // TODO: Implement storage tracking
      currentCount = 0;
      limit = limits.storageGb;
      break;
    }
  }

  // -1 means unlimited
  if (limit === -1) {
    return { exceeded: false, current: currentCount, limit, tier };
  }

  return {
    exceeded: currentCount >= limit,
    current: currentCount,
    limit,
    tier,
  };
}

/**
 * Middleware to enforce tier limits on member additions
 */
export function requireMemberLimit(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.org?.org.id || req.params.orgId;

      if (!orgId) {
        return res.status(400).json({
          error: "Organization context required",
          code: "ORG_CONTEXT_REQUIRED",
        });
      }

      const { exceeded, current, limit, tier } = await wouldExceedLimit(orgId, "members");

      if (exceeded) {
        await logAction({
          eventType: "TIER_LIMIT_EXCEEDED",
          userId: req.org?.membership.userId,
          resourceType: "organization",
          resourceId: orgId,
          action: "member_limit_exceeded",
          details: { current, limit, tier },
        });

        return res.status(403).json({
          error: "Member limit reached for your subscription tier",
          code: "MEMBER_LIMIT_EXCEEDED",
          current,
          limit,
          tier,
          upgradeUrl: `/org/${orgId}/settings?tab=billing`,
        });
      }

      next();
    } catch (error) {
      console.error("[tier-gate] Error checking member limit:", error);
      next(); // Allow on error to avoid blocking legitimate requests
    }
  };
}

/**
 * Middleware to enforce tier limits on project creation
 */
export function requireProjectLimit(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.org?.org.id || req.body?.orgId || req.params.orgId;

      if (!orgId) {
        return res.status(400).json({
          error: "Organization context required",
          code: "ORG_CONTEXT_REQUIRED",
        });
      }

      const { exceeded, current, limit, tier } = await wouldExceedLimit(orgId, "projects");

      if (exceeded) {
        await logAction({
          eventType: "TIER_LIMIT_EXCEEDED",
          userId: req.org?.membership.userId,
          resourceType: "organization",
          resourceId: orgId,
          action: "project_limit_exceeded",
          details: { current, limit, tier },
        });

        return res.status(403).json({
          error: "Project limit reached for your subscription tier",
          code: "PROJECT_LIMIT_EXCEEDED",
          current,
          limit,
          tier,
          upgradeUrl: `/org/${orgId}/settings?tab=billing`,
        });
      }

      next();
    } catch (error) {
      console.error("[tier-gate] Error checking project limit:", error);
      next();
    }
  };
}

/**
 * Middleware to enforce AI call limits
 */
export function requireAICallLimit(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.org?.org.id || req.params.orgId;

      if (!orgId) {
        // Allow if no org context (might be personal/demo usage)
        return next();
      }

      const { exceeded, current, limit, tier } = await wouldExceedLimit(orgId, "aiCalls");

      if (exceeded) {
        await logAction({
          eventType: "TIER_LIMIT_EXCEEDED",
          userId: req.org?.membership.userId,
          resourceType: "organization",
          resourceId: orgId,
          action: "ai_call_limit_exceeded",
          details: { current, limit, tier },
        });

        return res.status(429).json({
          error: "AI call limit reached for your subscription tier",
          code: "AI_CALL_LIMIT_EXCEEDED",
          current,
          limit,
          tier,
          upgradeUrl: `/org/${orgId}/settings?tab=billing`,
        });
      }

      next();
    } catch (error) {
      console.error("[tier-gate] Error checking AI call limit:", error);
      next();
    }
  };
}

/**
 * Middleware to check if a specific tier feature is available
 */
export function requireTierFeature(
  feature: string,
  minTier: SubscriptionTier
): RequestHandler {
  const tierOrder: Record<SubscriptionTier, number> = {
    FREE: 0,
    PRO: 1,
    TEAM: 2,
    ENTERPRISE: 3,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.org?.org.id || req.params.orgId;

      if (!orgId) {
        return next(); // Allow if no org context
      }

      const subscription = await getOrgSubscription(orgId);
      const currentTier = subscription?.tier || "FREE";

      if (tierOrder[currentTier] < tierOrder[minTier]) {
        await logAction({
          eventType: "TIER_FEATURE_BLOCKED",
          userId: req.org?.membership.userId,
          resourceType: "organization",
          resourceId: orgId,
          action: "feature_blocked",
          details: { feature, requiredTier: minTier, currentTier },
        });

        return res.status(403).json({
          error: `This feature requires ${minTier} tier or higher`,
          code: "TIER_FEATURE_BLOCKED",
          feature,
          currentTier,
          requiredTier: minTier,
          upgradeUrl: `/org/${orgId}/settings?tab=billing`,
        });
      }

      next();
    } catch (error) {
      console.error("[tier-gate] Error checking tier feature:", error);
      next();
    }
  };
}
