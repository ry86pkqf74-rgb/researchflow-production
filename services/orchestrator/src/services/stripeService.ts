/**
 * Stripe Service (Task 84)
 *
 * Handles Stripe integration for subscription billing.
 * In development mode, provides stubbed functionality.
 *
 * Production requires:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - STRIPE_PUBLISHABLE_KEY
 */

import crypto from "crypto";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { orgSubscriptions, organizations } from "@researchflow/core/schema";
import {
  SubscriptionTier,
  TIER_LIMITS,
} from "@researchflow/core/types/organization";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const NODE_ENV = process.env.NODE_ENV || "development";

// Stripe price IDs per tier (configure in production)
const STRIPE_PRICE_IDS: Record<SubscriptionTier, string> = {
  FREE: "price_free", // Free tier has no Stripe price
  PRO: process.env.STRIPE_PRO_PRICE_ID || "price_pro_stub",
  TEAM: process.env.STRIPE_TEAM_PRICE_ID || "price_team_stub",
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise_stub",
};

export interface SubscriptionData {
  id: string;
  orgId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tier: SubscriptionTier;
  status: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIALING" | "INCOMPLETE";
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

/**
 * Check if Stripe is configured for production
 */
export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.startsWith("sk_");
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeSignature(
  payload: string,
  signature: string
): boolean {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn("[stripeService] STRIPE_WEBHOOK_SECRET not configured");
    return false;
  }

  const timestamp = signature.split(",")[0]?.split("=")[1];
  const sigHash = signature.split(",")[1]?.split("=")[1];

  if (!timestamp || !sigHash) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(sigHash),
    Buffer.from(expectedSignature)
  );
}

/**
 * Get or create Stripe customer for organization
 */
export async function getOrCreateStripeCustomer(
  orgId: string,
  email: string,
  name: string
): Promise<string> {
  if (!db) {
    throw new Error("Database not available");
  }

  // Check if org already has a Stripe customer
  const [subscription] = await db
    .select()
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, orgId))
    .limit(1);

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  // In development, return a stub customer ID
  if (!isStripeConfigured()) {
    const stubCustomerId = `cus_stub_${orgId.substring(0, 8)}`;
    console.log(`[stripeService] DEV: Created stub customer ${stubCustomerId}`);
    return stubCustomerId;
  }

  // Production: Create Stripe customer
  // const stripe = require('stripe')(STRIPE_SECRET_KEY);
  // const customer = await stripe.customers.create({
  //   email,
  //   name,
  //   metadata: { orgId },
  // });
  // return customer.id;

  throw new Error("Stripe not configured for production");
}

/**
 * Create a checkout session for subscription upgrade
 */
export async function createCheckoutSession(
  orgId: string,
  tier: SubscriptionTier,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSession> {
  if (tier === "FREE") {
    throw new Error("Cannot checkout for FREE tier");
  }

  // In development, return a stub session
  if (!isStripeConfigured()) {
    const stubSessionId = `cs_stub_${Date.now()}`;
    console.log(`[stripeService] DEV: Created stub checkout session ${stubSessionId}`);
    return {
      id: stubSessionId,
      url: `${successUrl}?stub=true&tier=${tier}`,
    };
  }

  // Production: Create Stripe checkout session
  // const stripe = require('stripe')(STRIPE_SECRET_KEY);
  // const session = await stripe.checkout.sessions.create({
  //   mode: 'subscription',
  //   payment_method_types: ['card'],
  //   line_items: [{
  //     price: STRIPE_PRICE_IDS[tier],
  //     quantity: 1,
  //   }],
  //   success_url: successUrl,
  //   cancel_url: cancelUrl,
  //   metadata: { orgId, tier },
  // });
  // return { id: session.id, url: session.url };

  throw new Error("Stripe not configured for production");
}

/**
 * Create a billing portal session for subscription management
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<{ url: string }> {
  // In development, return a stub URL
  if (!isStripeConfigured()) {
    console.log(`[stripeService] DEV: Created stub billing portal session`);
    return { url: `${returnUrl}?portal=stub` };
  }

  // Production: Create Stripe billing portal session
  // const stripe = require('stripe')(STRIPE_SECRET_KEY);
  // const session = await stripe.billingPortal.sessions.create({
  //   customer: customerId,
  //   return_url: returnUrl,
  // });
  // return { url: session.url };

  throw new Error("Stripe not configured for production");
}

/**
 * Update organization subscription from Stripe webhook
 */
export async function updateSubscriptionFromWebhook(
  stripeSubscriptionId: string,
  status: string,
  customerId: string,
  currentPeriodStart: number,
  currentPeriodEnd: number,
  cancelAtPeriodEnd: boolean
): Promise<void> {
  if (!db) {
    throw new Error("Database not available");
  }

  const [subscription] = await db
    .select()
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subscription) {
    console.warn(`[stripeService] No subscription found for ${stripeSubscriptionId}`);
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, SubscriptionData["status"]> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELLED",
    trialing: "TRIALING",
    incomplete: "INCOMPLETE",
  };

  await db
    .update(orgSubscriptions)
    .set({
      status: statusMap[status] || "INCOMPLETE",
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      cancelAtPeriodEnd,
      updatedAt: new Date(),
    } as any)
    .where(eq(orgSubscriptions.id, subscription.id));
}

/**
 * Get subscription for organization
 */
export async function getOrgSubscription(
  orgId: string
): Promise<SubscriptionData | null> {
  if (!db) {
    throw new Error("Database not available");
  }

  const [subscription] = await db
    .select()
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, orgId))
    .limit(1);

  if (!subscription) {
    // Return default FREE subscription if none exists
    return {
      id: "default",
      orgId,
      tier: "FREE",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    };
  }

  return {
    id: subscription.id,
    orgId: subscription.orgId,
    stripeCustomerId: subscription.stripeCustomerId || undefined,
    stripeSubscriptionId: subscription.stripeSubscriptionId || undefined,
    tier: (subscription.tier as SubscriptionTier) || "FREE",
    status: (subscription.status as SubscriptionData["status"]) || "ACTIVE",
    currentPeriodStart: subscription.currentPeriodStart || undefined,
    currentPeriodEnd: subscription.currentPeriodEnd || undefined,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
  };
}

/**
 * Create or update subscription record
 */
export async function createOrUpdateSubscription(
  orgId: string,
  tier: SubscriptionTier,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<SubscriptionData> {
  if (!db) {
    throw new Error("Database not available");
  }

  const [existing] = await db
    .select()
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, orgId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(orgSubscriptions)
      .set({
        tier,
        stripeCustomerId,
        stripeSubscriptionId,
        status: "ACTIVE",
        updatedAt: new Date(),
      } as any)
      .where(eq(orgSubscriptions.id, existing.id))
      .returning();

    return {
      id: updated.id,
      orgId: updated.orgId,
      stripeCustomerId: updated.stripeCustomerId || undefined,
      stripeSubscriptionId: updated.stripeSubscriptionId || undefined,
      tier: updated.tier as SubscriptionTier,
      status: updated.status as SubscriptionData["status"],
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd || false,
    };
  }

  const [created] = await db
    .insert(orgSubscriptions)
    .values({
      orgId,
      tier,
      stripeCustomerId,
      stripeSubscriptionId,
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    } as any)
    .returning();

  // Also update the organization's subscription tier
  await db
    .update(organizations)
    .set({ subscriptionTier: tier } as any)
    .where(eq(organizations.id, orgId));

  return {
    id: created.id,
    orgId: created.orgId,
    stripeCustomerId: created.stripeCustomerId || undefined,
    stripeSubscriptionId: created.stripeSubscriptionId || undefined,
    tier: created.tier as SubscriptionTier,
    status: created.status as SubscriptionData["status"],
    cancelAtPeriodEnd: created.cancelAtPeriodEnd || false,
  };
}

/**
 * Get tier limits
 */
export function getTierLimits(tier: SubscriptionTier) {
  return TIER_LIMITS[tier];
}

/**
 * Check if organization is within tier limits
 */
export async function checkTierLimits(
  orgId: string,
  resource: "members" | "projects" | "aiCalls" | "storage",
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const subscription = await getOrgSubscription(orgId);
  const limits = getTierLimits(subscription?.tier || "FREE");

  let limit: number;
  switch (resource) {
    case "members":
      limit = limits.maxMembers;
      break;
    case "projects":
      limit = limits.maxProjects;
      break;
    case "aiCalls":
      limit = limits.aiCallsPerMonth;
      break;
    case "storage":
      limit = limits.storageGb;
      break;
  }

  // -1 means unlimited
  const allowed = limit === -1 || currentCount < limit;

  return { allowed, limit, current: currentCount };
}
