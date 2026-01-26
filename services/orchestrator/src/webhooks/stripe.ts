/**
 * Stripe Webhook Handler
 *
 * Handles incoming Stripe webhooks with signature verification and audit logging.
 * PHI-safe: No PHI should ever be in payment data, but we scan defensively.
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';
import { createAuditEntry } from '../services/auditService.js';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes

interface StripeEventHeader {
  timestamp: number;
  signatures: string[];
}

/**
 * Parse Stripe signature header
 * Format: t=timestamp,v1=signature1,v1=signature2...
 */
function parseStripeSignature(header: string): StripeEventHeader | null {
  const parts = header.split(',');
  let timestamp = 0;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

/**
 * Verify Stripe webhook signature
 * Uses HMAC-SHA256 with the webhook secret
 */
export function verifyStripeSignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string
): boolean {
  const parsed = parseStripeSignature(signature);
  if (!parsed) {
    return false;
  }

  // Check timestamp tolerance (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  // Compute expected signature
  const payload = `${parsed.timestamp}.${rawBody.toString()}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Compare using timing-safe comparison
  return parsed.signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  });
}

/**
 * Stripe webhook event types we handle
 */
type StripeEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed';

interface StripeEvent {
  id: string;
  type: StripeEventType | string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
}

/**
 * Process Stripe webhook event
 * Routes to appropriate handler based on event type
 */
async function processStripeEvent(event: StripeEvent): Promise<void> {
  const { type, data, id: eventId } = event;

  switch (type) {
    case 'checkout.session.completed':
      // Handle successful checkout
      await handleCheckoutCompleted(data.object);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      // Handle subscription changes
      await handleSubscriptionChange(data.object, type);
      break;

    case 'customer.subscription.deleted':
      // Handle subscription cancellation
      await handleSubscriptionDeleted(data.object);
      break;

    case 'invoice.paid':
      // Handle successful payment
      await handleInvoicePaid(data.object);
      break;

    case 'invoice.payment_failed':
      // Handle failed payment
      await handlePaymentFailed(data.object);
      break;

    default:
      // Log unhandled event types for monitoring
      console.log(`[Stripe] Unhandled event type: ${type} (${eventId})`);
  }
}

// Event handler stubs - implement based on your billing model
async function handleCheckoutCompleted(session: Record<string, unknown>): Promise<void> {
  console.log('[Stripe] Checkout completed:', session.id);
  // TODO: Provision access, update user subscription status, etc.
}

async function handleSubscriptionChange(
  subscription: Record<string, unknown>,
  eventType: string
): Promise<void> {
  console.log(`[Stripe] Subscription ${eventType}:`, subscription.id);
  // TODO: Update user subscription tier, features, etc.
}

async function handleSubscriptionDeleted(subscription: Record<string, unknown>): Promise<void> {
  console.log('[Stripe] Subscription deleted:', subscription.id);
  // TODO: Revoke access, archive data, send retention email, etc.
}

async function handleInvoicePaid(invoice: Record<string, unknown>): Promise<void> {
  console.log('[Stripe] Invoice paid:', invoice.id);
  // TODO: Update billing records, send receipt, etc.
}

async function handlePaymentFailed(invoice: Record<string, unknown>): Promise<void> {
  console.log('[Stripe] Payment failed:', invoice.id);
  // TODO: Notify user, retry logic, grace period, etc.
}

/**
 * Express route handler for Stripe webhooks
 * Requires raw body middleware to be configured
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  // Check secret is configured
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured');
    res.status(500).json({ ok: false, error: 'Webhook secret not configured' });
    return;
  }

  // Get signature header
  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ ok: false, error: 'Missing stripe-signature header' });
    return;
  }

  // Get raw body (requires express.raw() middleware on this route)
  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) {
    res.status(400).json({ ok: false, error: 'Raw body not available' });
    return;
  }

  // Verify signature
  if (!verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET)) {
    console.warn('[Stripe] Invalid webhook signature');
    await createAuditEntry({
      action: 'webhook.stripe.invalid_signature',
      resource: 'webhook',
      status: 'FAILURE',
      details: { reason: 'Invalid signature' },
    });
    res.status(400).json({ ok: false, error: 'Invalid signature' });
    return;
  }

  // Parse event
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody.toString()) as StripeEvent;
  } catch (e) {
    res.status(400).json({ ok: false, error: 'Invalid JSON' });
    return;
  }

  // Audit log the webhook
  await createAuditEntry({
    action: `webhook.stripe.${event.type}`,
    resource: 'webhook',
    resourceId: event.id,
    status: 'SUCCESS',
    details: {
      eventType: event.type,
      livemode: event.livemode,
      created: event.created,
    },
  });

  // Process event
  try {
    await processStripeEvent(event);
    res.json({ ok: true, received: true });
  } catch (error) {
    console.error('[Stripe] Error processing webhook:', error);
    await createAuditEntry({
      action: `webhook.stripe.${event.type}.error`,
      resource: 'webhook',
      resourceId: event.id,
      status: 'FAILURE',
      details: { error: String(error) },
    });
    // Still return 200 to prevent Stripe retries for processing errors
    res.json({ ok: false, error: 'Processing error' });
  }
}
