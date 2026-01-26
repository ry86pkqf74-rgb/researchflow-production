/**
 * Stripe Webhook Handler (Task 84)
 *
 * Handles Stripe webhook events for subscription billing:
 * - POST /api/webhooks/stripe - Receive Stripe events
 *
 * Events handled:
 * - checkout.session.completed - Handle successful checkout
 * - customer.subscription.updated - Subscription changed
 * - customer.subscription.deleted - Subscription cancelled
 * - invoice.paid - Invoice successfully paid
 * - invoice.payment_failed - Payment failed
 */

import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { organizations, orgSubscriptions } from "@researchflow/core/schema";
import { SubscriptionTier } from "@researchflow/core/types/organization";
import { logAction } from "../../services/audit-service";
import {
  verifyStripeSignature,
  updateSubscriptionFromWebhook,
  createOrUpdateSubscription,
  isStripeConfigured,
} from "../../services/stripeService";

const router = Router();

/**
 * Stripe webhook endpoint
 * Note: Stripe sends raw body, but we need to verify signature before parsing
 */
router.post(
  "/",
  async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;

    // In development, skip signature verification
    if (isStripeConfigured() && signature) {
      const rawBody = JSON.stringify(req.body);
      if (!verifyStripeSignature(rawBody, signature)) {
        console.warn("[stripe-webhook] Signature verification failed");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    } else if (process.env.NODE_ENV === "production") {
      console.warn("[stripe-webhook] Stripe not configured in production");
      return res.status(401).json({ error: "Stripe not configured" });
    }

    const event = req.body;

    console.log(`[stripe-webhook] Received event: ${event.type}`);

    if (!db) {
      console.error("[stripe-webhook] Database not available");
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const { orgId, tier } = session.metadata || {};

          if (orgId && tier) {
            await createOrUpdateSubscription(
              orgId,
              tier as SubscriptionTier,
              session.customer,
              session.subscription
            );

            await logAction({
              eventType: "BILLING_SUBSCRIPTION_CREATED",
              resourceType: "organization",
              resourceId: orgId,
              action: "subscription_created",
              details: {
                tier,
                customerId: session.customer,
                subscriptionId: session.subscription,
              },
            });

            console.log(`[stripe-webhook] Subscription created for org ${orgId}: ${tier}`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object;

          await updateSubscriptionFromWebhook(
            subscription.id,
            subscription.status,
            subscription.customer,
            subscription.current_period_start,
            subscription.current_period_end,
            subscription.cancel_at_period_end
          );

          // Log the update
          const [existingSub] = await db
            .select()
            .from(orgSubscriptions)
            .where(eq(orgSubscriptions.stripeSubscriptionId, subscription.id))
            .limit(1);

          if (existingSub) {
            await logAction({
              eventType: "BILLING_SUBSCRIPTION_UPDATED",
              resourceType: "organization",
              resourceId: existingSub.orgId,
              action: "subscription_updated",
              details: {
                status: subscription.status,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              },
            });
          }

          console.log(`[stripe-webhook] Subscription updated: ${subscription.id}`);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;

          const [existingSub] = await db
            .select()
            .from(orgSubscriptions)
            .where(eq(orgSubscriptions.stripeSubscriptionId, subscription.id))
            .limit(1);

          if (existingSub) {
            // Downgrade to FREE tier
            await db
              .update(orgSubscriptions)
              .set({
                tier: "FREE",
                status: "CANCELLED",
                updatedAt: new Date(),
              } as any)
              .where(eq(orgSubscriptions.id, existingSub.id));

            await db
              .update(organizations)
              .set({ subscriptionTier: "FREE" } as any)
              .where(eq(organizations.id, existingSub.orgId));

            await logAction({
              eventType: "BILLING_SUBSCRIPTION_CANCELLED",
              resourceType: "organization",
              resourceId: existingSub.orgId,
              action: "subscription_cancelled",
              details: { previousTier: existingSub.tier },
            });

            console.log(`[stripe-webhook] Subscription cancelled for org ${existingSub.orgId}`);
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object;
          console.log(`[stripe-webhook] Invoice paid: ${invoice.id}`);

          // Update subscription status to ACTIVE if it was past_due
          if (invoice.subscription) {
            await db
              .update(orgSubscriptions)
              .set({ status: "ACTIVE", updatedAt: new Date() } as any)
              .where(eq(orgSubscriptions.stripeSubscriptionId, invoice.subscription));
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          console.log(`[stripe-webhook] Invoice payment failed: ${invoice.id}`);

          // Update subscription status to PAST_DUE
          if (invoice.subscription) {
            const [existingSub] = await db
              .select()
              .from(orgSubscriptions)
              .where(eq(orgSubscriptions.stripeSubscriptionId, invoice.subscription))
              .limit(1);

            if (existingSub) {
              await db
                .update(orgSubscriptions)
                .set({ status: "PAST_DUE", updatedAt: new Date() } as any)
                .where(eq(orgSubscriptions.id, existingSub.id));

              await logAction({
                eventType: "BILLING_PAYMENT_FAILED",
                resourceType: "organization",
                resourceId: existingSub.orgId,
                action: "payment_failed",
                details: { invoiceId: invoice.id },
              });
            }
          }
          break;
        }

        default:
          console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[stripe-webhook] Error processing event:", error);
      // Return 200 to prevent Stripe from retrying
      res.status(200).json({ received: true, error: "Processing error" });
    }
  }
);

export default router;
