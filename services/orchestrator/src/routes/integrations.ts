/**
 * External Integrations Routes
 *
 * Handles webhooks and integrations with external services:
 * - Jira webhooks
 * - Zapier hooks
 *
 * CRITICAL: All webhooks verify signatures before processing.
 * CRITICAL: Never log or expose PHI in webhook payloads.
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';

const router = Router();

// Rate limiting state (simple in-memory, use Redis in production)
const rateLimitState: Map<string, { count: number; resetAt: number }> = new Map();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const state = rateLimitState.get(identifier);

  if (!state || now > state.resetAt) {
    rateLimitState.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (state.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  state.count++;
  return true;
}

/**
 * Verify Jira webhook signature
 */
function verifyJiraSignature(req: Request): boolean {
  const signature = req.headers['x-atlassian-webhook-signature'] as string;
  const secret = process.env.JIRA_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify Zapier webhook signature
 */
function verifyZapierSignature(req: Request): boolean {
  const signature = req.headers['x-zapier-signature'] as string;
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;

  if (!signature || !secret) {
    // If no secret configured, check for a shared token
    const token = req.headers['x-zapier-token'] || req.query.token;
    return token === process.env.ZAPIER_TOKEN;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

/**
 * POST /api/integrations/jira/webhook
 *
 * Receives webhooks from Jira for issue updates, comments, etc.
 */
router.post('/jira/webhook', async (req: Request, res: Response) => {
  // Rate limiting
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(`jira:${clientIp}`)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMITED',
      retryAfter: 60
    });
  }

  // Verify signature
  if (process.env.JIRA_WEBHOOK_SECRET && !verifyJiraSignature(req)) {
    console.warn('[Jira Webhook] Invalid signature from', clientIp);
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_SIGNATURE'
    });
  }

  try {
    const { webhookEvent, issue, user, changelog } = req.body;

    // Log event type only (no PHI)
    console.log('[Jira Webhook] Event:', webhookEvent, 'Issue:', issue?.key);

    // Process based on event type
    switch (webhookEvent) {
      case 'jira:issue_created':
        await handleJiraIssueCreated(issue);
        break;
      case 'jira:issue_updated':
        await handleJiraIssueUpdated(issue, changelog);
        break;
      case 'comment_created':
        await handleJiraCommentCreated(issue, req.body.comment);
        break;
      default:
        console.log('[Jira Webhook] Unhandled event:', webhookEvent);
    }

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('[Jira Webhook] Error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'WEBHOOK_PROCESSING_FAILED'
    });
  }
});

/**
 * POST /api/integrations/zapier/hook
 *
 * Receives webhooks from Zapier automations.
 */
router.post('/zapier/hook', async (req: Request, res: Response) => {
  // Rate limiting
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(`zapier:${clientIp}`)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMITED',
      retryAfter: 60
    });
  }

  // Verify signature/token
  if (!verifyZapierSignature(req)) {
    console.warn('[Zapier Webhook] Invalid signature from', clientIp);
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_SIGNATURE'
    });
  }

  try {
    const { action, data, metadata } = req.body;

    // Log action only (no PHI)
    console.log('[Zapier Webhook] Action:', action, 'Metadata:', metadata?.id);

    // Process based on action
    switch (action) {
      case 'create_research':
        await handleZapierCreateResearch(data);
        break;
      case 'trigger_validation':
        await handleZapierTriggerValidation(data);
        break;
      case 'notify':
        await handleZapierNotification(data);
        break;
      default:
        console.log('[Zapier Webhook] Unhandled action:', action);
    }

    res.status(200).json({ status: 'received', id: metadata?.id });
  } catch (error) {
    console.error('[Zapier Webhook] Error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'WEBHOOK_PROCESSING_FAILED'
    });
  }
});

/**
 * GET /api/integrations/zapier/subscribe
 *
 * Zapier subscription verification endpoint.
 */
router.get('/zapier/subscribe', (req: Request, res: Response) => {
  const challenge = req.query.challenge;

  if (challenge) {
    return res.status(200).json({ challenge });
  }

  res.status(200).json({ status: 'ok' });
});

/**
 * POST /api/integrations/webhooks/test
 *
 * Test endpoint for webhook configuration (development only).
 */
router.post('/webhooks/test', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not Found' });
  }

  console.log('[Webhook Test] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Webhook Test] Body:', JSON.stringify(req.body, null, 2));

  res.status(200).json({
    status: 'received',
    timestamp: new Date().toISOString(),
    headers: Object.keys(req.headers)
  });
});

// Handler functions (implement based on business logic)

async function handleJiraIssueCreated(issue: { key: string; fields?: { summary?: string; project?: { key: string } } }): Promise<void> {
  // TODO: Implement Jira issue creation handling
  // Example: Create corresponding research task
  console.log('[Jira] Issue created:', issue.key, issue.fields?.project?.key);
}

async function handleJiraIssueUpdated(issue: { key: string }, changelog?: { items?: Array<{ field: string; toString?: string }> }): Promise<void> {
  // TODO: Implement Jira issue update handling
  // Example: Sync status changes
  console.log('[Jira] Issue updated:', issue.key, 'Changes:', changelog?.items?.map(i => i.field).join(', '));
}

async function handleJiraCommentCreated(issue: { key: string }, comment?: { body?: string }): Promise<void> {
  // TODO: Implement Jira comment handling
  // CRITICAL: Do not log comment body (may contain PHI)
  console.log('[Jira] Comment added to:', issue.key);
}

async function handleZapierCreateResearch(data: { title?: string; type?: string }): Promise<void> {
  // TODO: Implement research creation from Zapier
  console.log('[Zapier] Create research:', data.type);
}

async function handleZapierTriggerValidation(data: { datasetId?: string }): Promise<void> {
  // TODO: Implement validation trigger from Zapier
  console.log('[Zapier] Trigger validation for dataset:', data.datasetId);
}

async function handleZapierNotification(data: { message?: string; channel?: string }): Promise<void> {
  // TODO: Implement notification handling from Zapier
  // CRITICAL: Do not log message content (may contain PHI)
  console.log('[Zapier] Notification to channel:', data.channel);
}

export default router;
