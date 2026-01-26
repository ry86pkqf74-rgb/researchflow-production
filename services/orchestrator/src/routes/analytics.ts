/**
 * Analytics API Routes
 *
 * Endpoints for PHI-safe internal analytics:
 * - POST /api/analytics/events - Ingest analytics events (requires consent)
 * - GET /api/analytics/summary - Get admin-only aggregates
 *
 * @module routes/analytics
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../../db';
import { userConsents } from '@researchflow/core/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { analyticsService, type AnalyticsEventInput } from '../services/analytics.service';

const router = Router();

/**
 * Check if user has granted analytics consent
 */
async function hasAnalyticsConsent(userId: string): Promise<boolean> {
  if (!db) return false;

  try {
    const consents = await db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.consentType, 'analytics'),
          eq(userConsents.granted, true),
          isNull(userConsents.revokedAt)
        )
      )
      .limit(1);

    return consents.length > 0;
  } catch (error) {
    console.error('[Analytics] Error checking consent:', error);
    return false;
  }
}

/**
 * POST /api/analytics/events
 *
 * Ingest a batch of analytics events.
 * Requires:
 * - User role: RESEARCHER or higher
 * - Analytics consent granted via user_consents table
 * - X-Analytics-Consent: true header (defense-in-depth)
 *
 * Body: { events: Array<{ eventName: string; ts?: string; properties?: object; researchId?: string }> }
 */
router.post(
  '/events',
  requireRole('RESEARCHER'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    // Defense-in-depth: require consent header
    const consentHeader = req.headers['x-analytics-consent'];
    if (consentHeader !== 'true') {
      return res.status(403).json({
        error: 'CONSENT_REQUIRED',
        message: 'Analytics consent header missing. Set X-Analytics-Consent: true',
        code: 'MISSING_CONSENT_HEADER',
      });
    }

    // Check database consent record
    const hasConsent = await hasAnalyticsConsent(user.id);
    if (!hasConsent) {
      return res.status(403).json({
        error: 'CONSENT_REQUIRED',
        message: 'Analytics consent not granted. Please opt-in to analytics.',
        code: 'NO_CONSENT_RECORD',
      });
    }

    // Validate request body
    const { events } = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request body must contain an "events" array',
      });
    }

    if (events.length === 0) {
      return res.json({ accepted: 0, rejected: 0 });
    }

    if (events.length > 100) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Maximum 100 events per batch',
      });
    }

    // Validate each event has required fields
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.eventName || typeof event.eventName !== 'string') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Event at index ${i} missing required "eventName" string field`,
        });
      }
    }

    // Convert to AnalyticsEventInput array
    const analyticsEvents: AnalyticsEventInput[] = events.map(event => ({
      eventName: event.eventName,
      userId: user.id,
      sessionId: event.sessionId,
      researchId: event.researchId,
      properties: event.properties || {},
    }));

    // Ingest batch
    const result = await analyticsService.ingestBatch(analyticsEvents, {
      userId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  })
);

/**
 * GET /api/analytics/summary
 *
 * Get aggregated analytics summary.
 * Requires: ADMIN role (or STEWARD+)
 *
 * Query params:
 * - dateFrom: ISO date string (default: 30 days ago)
 * - dateTo: ISO date string (default: now)
 */
router.get(
  '/summary',
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = req.query;

    const options: { dateFrom?: Date; dateTo?: Date } = {};

    if (typeof dateFrom === 'string') {
      const parsed = new Date(dateFrom);
      if (!isNaN(parsed.getTime())) {
        options.dateFrom = parsed;
      }
    }

    if (typeof dateTo === 'string') {
      const parsed = new Date(dateTo);
      if (!isNaN(parsed.getTime())) {
        options.dateTo = parsed;
      }
    }

    const summary = await analyticsService.getSummary(options);

    res.json(summary);
  })
);

export default router;
