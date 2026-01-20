/**
 * Webhook Routes
 *
 * API endpoints for external webhook integrations.
 * Each webhook has signature verification and audit logging.
 *
 * IMPORTANT: These routes require special middleware configuration:
 * - Stripe: Needs raw body preserved for signature verification
 * - Zoom: Standard JSON body is fine
 */

import { Router, raw } from 'express';
import { stripeWebhookHandler } from '../webhooks/stripe.js';
import { zoomWebhookHandler } from '../webhooks/zoom.js';

const router = Router();

/**
 * Stripe webhook endpoint
 * POST /api/webhooks/stripe
 *
 * Requires express.raw() middleware to preserve raw body for signature verification.
 * Configure in server.ts with a specific route for this endpoint.
 */
router.post(
  '/stripe',
  raw({ type: 'application/json' }),
  (req, res, next) => {
    // Store raw body for signature verification
    (req as any).rawBody = req.body;
    // Parse body for handler
    try {
      req.body = JSON.parse(req.body.toString());
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }
    next();
  },
  stripeWebhookHandler
);

/**
 * Zoom webhook endpoint
 * POST /api/webhooks/zoom
 *
 * Standard JSON body parsing is sufficient.
 */
router.post('/zoom', zoomWebhookHandler);

/**
 * Health check for webhook endpoints
 * GET /api/webhooks/health
 */
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    webhooks: {
      stripe: !!process.env.STRIPE_WEBHOOK_SECRET,
      zoom: !!process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
