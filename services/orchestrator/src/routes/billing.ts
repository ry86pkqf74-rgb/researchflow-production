/**
 * Billing Router (Task 84)
 *
 * API endpoints for subscription and billing management:
 * - GET /api/billing/subscription - Get current subscription
 * - POST /api/billing/checkout - Create checkout session for upgrade
 * - POST /api/billing/portal - Create billing portal session
 * - GET /api/billing/usage - Get usage statistics
 */

import { Router, Request, Response } from "express";
import { eq, and, count } from "drizzle-orm";
import { db } from "../../db";
import { orgMemberships, researchProjects } from "@researchflow/core/schema";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  resolveOrgContext,
  requireOrgId,
  requireOrgCapability,
} from "../middleware/org-context";
import {
  SubscriptionTier,
  SUBSCRIPTION_TIERS,
  TIER_LIMITS,
} from "@researchflow/core/types/organization";
import { logAction } from "../services/audit-service";
import { isAuthenticated } from "../../replit_integrations/auth/replitAuth";
import {
  getOrgSubscription,
  createCheckoutSession,
  createBillingPortalSession,
  getOrCreateStripeCustomer,
  createOrUpdateSubscription,
  checkTierLimits,
  isStripeConfigured,
} from "../services/stripeService";

const router = Router();

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * Get current subscription for organization
 */
router.get(
  "/:orgId/subscription",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;

    const subscription = await getOrgSubscription(orgId);

    res.json({
      subscription,
      limits: TIER_LIMITS[subscription?.tier || "FREE"],
      tiers: SUBSCRIPTION_TIERS,
      allLimits: TIER_LIMITS,
      stripeConfigured: isStripeConfigured(),
    });
  })
);

/**
 * Get usage statistics for organization
 */
router.get(
  "/:orgId/usage",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Count active members
    const memberResult = await db
      .select({ count: count() })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.isActive, true)
        )
      );

    // Count projects
    const projectResult = await db
      .select({ count: count() })
      .from(researchProjects)
      .where(eq(researchProjects.orgId, orgId));

    const subscription = await getOrgSubscription(orgId);
    const limits = TIER_LIMITS[subscription?.tier || "FREE"];

    res.json({
      usage: {
        members: {
          current: Number(memberResult[0]?.count || 0),
          limit: limits.maxMembers,
          unlimited: limits.maxMembers === -1,
        },
        projects: {
          current: Number(projectResult[0]?.count || 0),
          limit: limits.maxProjects,
          unlimited: limits.maxProjects === -1,
        },
        aiCalls: {
          current: 0, // TODO: Track actual AI calls
          limit: limits.aiCallsPerMonth,
          unlimited: limits.aiCallsPerMonth === -1,
        },
        storage: {
          currentGb: 0, // TODO: Calculate actual storage
          limit: limits.storageGb,
          unlimited: limits.storageGb === -1,
        },
      },
      tier: subscription?.tier || "FREE",
    });
  })
);

/**
 * Create checkout session for subscription upgrade
 */
router.post(
  "/:orgId/checkout",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("billing"),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const userId = (req.user as any)?.id;
    const { tier } = req.body;

    // Validate tier
    if (!SUBSCRIPTION_TIERS.includes(tier) || tier === "FREE") {
      return res.status(400).json({
        error: "Invalid subscription tier",
        validTiers: SUBSCRIPTION_TIERS.filter((t) => t !== "FREE"),
      });
    }

    try {
      const org = req.org!.org;
      const successUrl = `${APP_URL}/org/${orgId}/settings?billing=success`;
      const cancelUrl = `${APP_URL}/org/${orgId}/settings?billing=cancelled`;

      const session = await createCheckoutSession(
        orgId,
        tier as SubscriptionTier,
        successUrl,
        cancelUrl
      );

      await logAction({
        eventType: "BILLING_CHECKOUT_CREATED",
        userId,
        resourceType: "organization",
        resourceId: orgId,
        action: "create_checkout",
        details: { tier, sessionId: session.id },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("[billing] Checkout error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout" });
    }
  })
);

/**
 * Create billing portal session for subscription management
 */
router.post(
  "/:orgId/portal",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("billing"),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const userId = (req.user as any)?.id;

    try {
      const subscription = await getOrgSubscription(orgId);

      if (!subscription?.stripeCustomerId) {
        return res.status(400).json({
          error: "No billing account found. Please upgrade your subscription first.",
        });
      }

      const returnUrl = `${APP_URL}/org/${orgId}/settings`;
      const session = await createBillingPortalSession(
        subscription.stripeCustomerId,
        returnUrl
      );

      await logAction({
        eventType: "BILLING_PORTAL_ACCESSED",
        userId,
        resourceType: "organization",
        resourceId: orgId,
        action: "access_portal",
        details: {},
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[billing] Portal error:", error);
      res.status(500).json({ error: error.message || "Failed to create portal session" });
    }
  })
);

/**
 * Simulate subscription upgrade (development only)
 */
router.post(
  "/:orgId/simulate-upgrade",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("billing"),
  asyncHandler(async (req: Request, res: Response) => {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Not available in production" });
    }

    const orgId = req.params.orgId;
    const userId = (req.user as any)?.id;
    const { tier } = req.body;

    if (!SUBSCRIPTION_TIERS.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier" });
    }

    const subscription = await createOrUpdateSubscription(
      orgId,
      tier as SubscriptionTier,
      `cus_stub_${orgId.substring(0, 8)}`,
      `sub_stub_${Date.now()}`
    );

    await logAction({
      eventType: "BILLING_TIER_CHANGED",
      userId,
      resourceType: "organization",
      resourceId: orgId,
      action: "simulate_upgrade",
      details: { tier },
    });

    res.json({
      success: true,
      subscription,
      message: `Simulated upgrade to ${tier}`,
    });
  })
);

/**
 * Check if action is within tier limits
 */
router.get(
  "/:orgId/check-limit/:resource",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const resource = req.params.resource as "members" | "projects" | "aiCalls" | "storage";

    const validResources = ["members", "projects", "aiCalls", "storage"];
    if (!validResources.includes(resource)) {
      return res.status(400).json({
        error: "Invalid resource type",
        validResources,
      });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    let currentCount = 0;

    // Get current count based on resource type
    switch (resource) {
      case "members": {
        const result = await db
          .select({ count: count() })
          .from(orgMemberships)
          .where(
            and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.isActive, true))
          );
        currentCount = Number(result[0]?.count || 0);
        break;
      }
      case "projects": {
        const result = await db
          .select({ count: count() })
          .from(researchProjects)
          .where(eq(researchProjects.orgId, orgId));
        currentCount = Number(result[0]?.count || 0);
        break;
      }
      // TODO: Implement aiCalls and storage tracking
      default:
        currentCount = 0;
    }

    const result = await checkTierLimits(orgId, resource, currentCount);

    res.json(result);
  })
);

export default router;
