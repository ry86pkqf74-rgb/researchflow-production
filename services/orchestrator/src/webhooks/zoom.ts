/**
 * Zoom Webhook Handler
 *
 * Handles incoming Zoom webhooks with signature verification and audit logging.
 * Used for meeting recordings, transcripts, and collaboration events.
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';
import { createAuditEntry } from '../services/auditService.js';

const ZOOM_WEBHOOK_SECRET_TOKEN = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
const ZOOM_VERIFICATION_TOKEN = process.env.ZOOM_VERIFICATION_TOKEN;

/**
 * Verify Zoom webhook signature
 * Zoom uses HMAC-SHA256 with secret token
 */
export function verifyZoomSignature(
  message: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  const payload = `v0:${timestamp}:${message}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Zoom webhook event types we handle
 */
type ZoomEventType =
  | 'endpoint.url_validation'
  | 'meeting.started'
  | 'meeting.ended'
  | 'recording.completed'
  | 'recording.transcript_completed'
  | 'meeting.participant_joined'
  | 'meeting.participant_left';

interface ZoomEvent {
  event: ZoomEventType | string;
  event_ts: number;
  payload: {
    account_id: string;
    object: Record<string, unknown>;
    plainToken?: string; // For URL validation
  };
}

interface ZoomValidationResponse {
  plainToken: string;
  encryptedToken: string;
}

/**
 * Handle Zoom URL validation challenge
 * Zoom sends this when registering a webhook endpoint
 */
function handleUrlValidation(plainToken: string, secret: string): ZoomValidationResponse {
  const encryptedToken = crypto
    .createHmac('sha256', secret)
    .update(plainToken)
    .digest('hex');

  return { plainToken, encryptedToken };
}

/**
 * Process Zoom webhook event
 * Routes to appropriate handler based on event type
 */
async function processZoomEvent(event: ZoomEvent): Promise<void> {
  const { event: eventType, payload } = event;

  switch (eventType) {
    case 'meeting.started':
      await handleMeetingStarted(payload.object);
      break;

    case 'meeting.ended':
      await handleMeetingEnded(payload.object);
      break;

    case 'recording.completed':
      await handleRecordingCompleted(payload.object);
      break;

    case 'recording.transcript_completed':
      await handleTranscriptCompleted(payload.object);
      break;

    case 'meeting.participant_joined':
    case 'meeting.participant_left':
      await handleParticipantEvent(payload.object, eventType);
      break;

    default:
      console.log(`[Zoom] Unhandled event type: ${eventType}`);
  }
}

// Event handler stubs - implement based on your collaboration features
async function handleMeetingStarted(meeting: Record<string, unknown>): Promise<void> {
  console.log('[Zoom] Meeting started:', meeting.id);
  // TODO: Create session record, notify team members, etc.
}

async function handleMeetingEnded(meeting: Record<string, unknown>): Promise<void> {
  console.log('[Zoom] Meeting ended:', meeting.id);
  // TODO: Update session record, calculate duration, etc.
}

async function handleRecordingCompleted(recording: Record<string, unknown>): Promise<void> {
  console.log('[Zoom] Recording completed:', recording.uuid);
  // TODO: Download recording, process for PHI, store reference, etc.
  // IMPORTANT: PHI scan any recording transcripts before storing
}

async function handleTranscriptCompleted(transcript: Record<string, unknown>): Promise<void> {
  console.log('[Zoom] Transcript completed:', transcript.meeting_uuid);
  // TODO: Download transcript, PHI scan, store for research notes
  // IMPORTANT: Must PHI scan transcripts - they may contain sensitive data
}

async function handleParticipantEvent(
  participant: Record<string, unknown>,
  eventType: string
): Promise<void> {
  console.log(`[Zoom] Participant ${eventType}:`, participant.user_name);
  // TODO: Track attendance, collaboration metrics, etc.
}

/**
 * Express route handler for Zoom webhooks
 */
export async function zoomWebhookHandler(req: Request, res: Response): Promise<void> {
  // Check secrets are configured
  if (!ZOOM_WEBHOOK_SECRET_TOKEN) {
    console.error('[Zoom] ZOOM_WEBHOOK_SECRET_TOKEN not configured');
    res.status(500).json({ ok: false, error: 'Webhook secret not configured' });
    return;
  }

  // Handle URL validation challenge
  const body = req.body as ZoomEvent;
  if (body.event === 'endpoint.url_validation' && body.payload?.plainToken) {
    const validation = handleUrlValidation(
      body.payload.plainToken,
      ZOOM_WEBHOOK_SECRET_TOKEN
    );
    res.json(validation);
    return;
  }

  // Get signature headers
  const signature = req.headers['x-zm-signature'] as string | undefined;
  const timestamp = req.headers['x-zm-request-timestamp'] as string | undefined;

  if (!signature || !timestamp) {
    res.status(400).json({ ok: false, error: 'Missing signature headers' });
    return;
  }

  // Get raw body for signature verification
  const rawBody = JSON.stringify(req.body);

  // Verify signature
  if (!verifyZoomSignature(rawBody, signature, timestamp, ZOOM_WEBHOOK_SECRET_TOKEN)) {
    console.warn('[Zoom] Invalid webhook signature');
    await createAuditEntry({
      action: 'webhook.zoom.invalid_signature',
      resource: 'webhook',
      status: 'FAILURE',
      details: { reason: 'Invalid signature' },
    });
    res.status(400).json({ ok: false, error: 'Invalid signature' });
    return;
  }

  // Audit log the webhook
  await createAuditEntry({
    action: `webhook.zoom.${body.event}`,
    resource: 'webhook',
    resourceId: String(body.payload?.object?.id || body.event_ts),
    status: 'SUCCESS',
    details: {
      eventType: body.event,
      accountId: body.payload?.account_id,
      timestamp: body.event_ts,
    },
  });

  // Process event
  try {
    await processZoomEvent(body);
    res.json({ ok: true, received: true });
  } catch (error) {
    console.error('[Zoom] Error processing webhook:', error);
    await createAuditEntry({
      action: `webhook.zoom.${body.event}.error`,
      resource: 'webhook',
      resourceId: String(body.event_ts),
      status: 'FAILURE',
      details: { error: String(error) },
    });
    res.json({ ok: false, error: 'Processing error' });
  }
}
