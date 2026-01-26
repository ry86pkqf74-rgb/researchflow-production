/**
 * Zoom Webhook Handler (Task 87)
 *
 * Handles Zoom webhook events for review sessions:
 * - POST /api/webhooks/zoom - Receive Zoom events
 *
 * Events handled:
 * - meeting.started - Create review session record
 * - meeting.ended - Update session with end time and participants
 * - meeting.participant_joined/left - Track participant activity
 * - endpoint.url_validation - Respond to Zoom's validation challenge
 */

import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { reviewSessions } from "@researchflow/core/schema";
import { logAction } from "../../services/audit-service";
import {
  verifyZoomSignature,
  generateValidationResponse,
  verifyLegacyToken,
  ZOOM_EVENTS,
  ZoomMeetingEvent,
  ZoomEndpointValidationEvent,
  parseParticipants,
  isZoomConfigured,
} from "../../services/zoomService";

const router = Router();

// Middleware to verify Zoom webhook signature
function verifyZoomWebhook(req: Request, res: Response, next: Function) {
  // Skip verification if not configured (development mode)
  if (!isZoomConfigured()) {
    console.warn("[zoom-webhook] Zoom not configured, skipping verification");
    return next();
  }

  const signature = req.headers["x-zm-signature"] as string;
  const timestamp = req.headers["x-zm-request-timestamp"] as string;
  const legacyToken = req.headers["authorization"] as string;

  // Try signature verification first
  if (signature && timestamp) {
    const rawBody = JSON.stringify(req.body);
    if (verifyZoomSignature(rawBody, signature, timestamp)) {
      return next();
    }
    console.warn("[zoom-webhook] Signature verification failed");
  }

  // Fall back to legacy token verification
  if (legacyToken && verifyLegacyToken(legacyToken)) {
    return next();
  }

  console.warn("[zoom-webhook] All verification methods failed");
  return res.status(401).json({ error: "Invalid webhook signature" });
}

/**
 * Zoom webhook endpoint
 */
router.post("/", verifyZoomWebhook, async (req: Request, res: Response) => {
  const event = req.body;

  // Handle endpoint URL validation challenge
  if (event.event === ZOOM_EVENTS.ENDPOINT_VALIDATION) {
    const validationEvent = event as ZoomEndpointValidationEvent;
    try {
      const response = generateValidationResponse(validationEvent.payload.plainToken);
      return res.json(response);
    } catch (error) {
      console.error("[zoom-webhook] Validation response error:", error);
      return res.status(500).json({ error: "Validation failed" });
    }
  }

  // Log all events for debugging
  console.log(`[zoom-webhook] Received event: ${event.event}`);

  if (!db) {
    console.error("[zoom-webhook] Database not available");
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const meetingEvent = event as ZoomMeetingEvent;
    const meeting = meetingEvent.payload?.object;

    if (!meeting) {
      return res.status(400).json({ error: "Invalid event payload" });
    }

    switch (event.event) {
      case ZOOM_EVENTS.MEETING_STARTED: {
        // Create or update review session record
        const [existing] = await db
          .select()
          .from(reviewSessions)
          .where(eq(reviewSessions.zoomMeetingId, meeting.id))
          .limit(1);

        if (!existing) {
          // Create new session - orgId and researchId will be null until linked
          await db.insert(reviewSessions).values({
            zoomMeetingId: meeting.id,
            zoomMeetingUuid: meeting.uuid,
            topic: meeting.topic,
            hostUserId: meeting.host_id,
            startTime: new Date(meeting.start_time),
            status: "STARTED",
            metadata: {
              type: meeting.type,
              timezone: meeting.timezone,
            },
          } as any);
        } else {
          // Update existing session
          await db
            .update(reviewSessions)
            .set({
              startTime: new Date(meeting.start_time),
              status: "STARTED",
            } as any)
            .where(eq(reviewSessions.id, existing.id));
        }

        await logAction({
          eventType: "ZOOM_MEETING_STARTED",
          resourceType: "review_session",
          resourceId: meeting.id,
          action: "meeting_started",
          details: { topic: meeting.topic, hostId: meeting.host_id },
        });
        break;
      }

      case ZOOM_EVENTS.MEETING_ENDED: {
        // Update session with end time
        const [session] = await db
          .select()
          .from(reviewSessions)
          .where(eq(reviewSessions.zoomMeetingId, meeting.id))
          .limit(1);

        if (session) {
          await db
            .update(reviewSessions)
            .set({
              endTime: new Date(),
              status: "ENDED",
              durationMinutes: meeting.duration,
            } as any)
            .where(eq(reviewSessions.id, session.id));

          await logAction({
            eventType: "ZOOM_MEETING_ENDED",
            resourceType: "review_session",
            resourceId: session.id,
            action: "meeting_ended",
            details: { duration: meeting.duration },
          });
        }
        break;
      }

      case ZOOM_EVENTS.PARTICIPANT_JOINED: {
        if (meeting.participant) {
          const [session] = await db
            .select()
            .from(reviewSessions)
            .where(eq(reviewSessions.zoomMeetingId, meeting.id))
            .limit(1);

          if (session) {
            const currentParticipants = (session.participants as any[]) || [];
            const newParticipant = {
              id: meeting.participant.user_id,
              name: meeting.participant.user_name,
              email: meeting.participant.email,
              joinTime: meeting.participant.join_time,
            };

            // Add if not already in list
            if (!currentParticipants.some((p: any) => p.id === newParticipant.id)) {
              await db
                .update(reviewSessions)
                .set({
                  participants: [...currentParticipants, newParticipant],
                } as any)
                .where(eq(reviewSessions.id, session.id));
            }
          }
        }
        break;
      }

      case ZOOM_EVENTS.PARTICIPANT_LEFT: {
        if (meeting.participant) {
          const [session] = await db
            .select()
            .from(reviewSessions)
            .where(eq(reviewSessions.zoomMeetingId, meeting.id))
            .limit(1);

          if (session) {
            const currentParticipants = (session.participants as any[]) || [];
            const updatedParticipants = currentParticipants.map((p: any) => {
              if (p.id === meeting.participant!.user_id) {
                return { ...p, leaveTime: meeting.participant!.leave_time };
              }
              return p;
            });

            await db
              .update(reviewSessions)
              .set({
                participants: updatedParticipants,
              } as any)
              .where(eq(reviewSessions.id, session.id));
          }
        }
        break;
      }

      default:
        console.log(`[zoom-webhook] Unhandled event type: ${event.event}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[zoom-webhook] Error processing event:", error);
    // Return 200 to prevent Zoom from retrying
    res.status(200).json({ received: true, error: "Processing error" });
  }
});

/**
 * Get review sessions for an organization
 */
router.get("/sessions", async (req: Request, res: Response) => {
  const { orgId, researchId } = req.query;

  if (!db) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    let query = db.select().from(reviewSessions);

    if (orgId) {
      query = query.where(eq(reviewSessions.orgId, orgId as string)) as any;
    }
    if (researchId) {
      query = query.where(eq(reviewSessions.researchId, researchId as string)) as any;
    }

    const sessions = await query;
    res.json({ sessions });
  } catch (error) {
    console.error("[zoom-webhook] Error fetching sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

/**
 * Link a review session to an organization and research project
 */
router.patch("/sessions/:sessionId/link", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { orgId, researchId } = req.body;

  if (!db) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const [updated] = await db
      .update(reviewSessions)
      .set({ orgId, researchId } as any)
      .where(eq(reviewSessions.id, sessionId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Session not found" });
    }

    await logAction({
      eventType: "REVIEW_SESSION_LINKED",
      resourceType: "review_session",
      resourceId: sessionId,
      action: "link",
      details: { orgId, researchId },
    });

    res.json(updated);
  } catch (error) {
    console.error("[zoom-webhook] Error linking session:", error);
    res.status(500).json({ error: "Failed to link session" });
  }
});

export default router;
