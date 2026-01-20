/**
 * Zoom Service (Task 87)
 *
 * Handles Zoom webhook signature verification and meeting data parsing.
 * Verifies webhooks using Zoom's verification token.
 */

import crypto from "crypto";

const ZOOM_WEBHOOK_SECRET_TOKEN = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "";
const ZOOM_VERIFICATION_TOKEN = process.env.ZOOM_VERIFICATION_TOKEN || "";

export interface ZoomMeetingEvent {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      participant?: {
        id: string;
        user_id: string;
        user_name: string;
        email: string;
        join_time: string;
        leave_time?: string;
      };
    };
  };
}

export interface ZoomEndpointValidationEvent {
  event: "endpoint.url_validation";
  payload: {
    plainToken: string;
  };
}

/**
 * Verify Zoom webhook signature
 * https://marketplace.zoom.us/docs/api-reference/webhook-reference/#verify-webhook-events
 */
export function verifyZoomSignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  if (!ZOOM_WEBHOOK_SECRET_TOKEN) {
    console.warn("[zoomService] ZOOM_WEBHOOK_SECRET_TOKEN not configured");
    return false;
  }

  const message = `v0:${timestamp}:${payload}`;
  const hashForVerify = crypto
    .createHmac("sha256", ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(message)
    .digest("hex");

  const expectedSignature = `v0=${hashForVerify}`;
  return signature === expectedSignature;
}

/**
 * Generate response for Zoom endpoint validation challenge
 * https://marketplace.zoom.us/docs/api-reference/webhook-reference/#verify-webhook-events
 */
export function generateValidationResponse(plainToken: string): {
  plainToken: string;
  encryptedToken: string;
} {
  if (!ZOOM_WEBHOOK_SECRET_TOKEN) {
    throw new Error("ZOOM_WEBHOOK_SECRET_TOKEN not configured");
  }

  const encryptedToken = crypto
    .createHmac("sha256", ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(plainToken)
    .digest("hex");

  return {
    plainToken,
    encryptedToken,
  };
}

/**
 * Verify using legacy verification token (for backwards compatibility)
 */
export function verifyLegacyToken(token: string): boolean {
  if (!ZOOM_VERIFICATION_TOKEN) {
    return false;
  }
  return token === ZOOM_VERIFICATION_TOKEN;
}

/**
 * Parse participant list from meeting ended event
 */
export function parseParticipants(
  participants: Array<{
    id?: string;
    user_id?: string;
    user_name?: string;
    email?: string;
  }>
): Array<{ id: string; name: string; email?: string }> {
  return participants.map((p) => ({
    id: p.user_id || p.id || "unknown",
    name: p.user_name || "Unknown",
    email: p.email,
  }));
}

/**
 * Extract meeting duration in minutes from start and end times
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Supported Zoom webhook event types
 */
export const ZOOM_EVENTS = {
  MEETING_STARTED: "meeting.started",
  MEETING_ENDED: "meeting.ended",
  PARTICIPANT_JOINED: "meeting.participant_joined",
  PARTICIPANT_LEFT: "meeting.participant_left",
  ENDPOINT_VALIDATION: "endpoint.url_validation",
} as const;

export type ZoomEventType = (typeof ZOOM_EVENTS)[keyof typeof ZOOM_EVENTS];

/**
 * Check if Zoom integration is configured
 */
export function isZoomConfigured(): boolean {
  return !!ZOOM_WEBHOOK_SECRET_TOKEN || !!ZOOM_VERIFICATION_TOKEN;
}
