/**
 * Analytics Service
 *
 * Internal analytics ingestion with strict PHI safety.
 * All events are:
 * - Opt-in only (requires explicit user consent)
 * - PHI-safe by design (allowlisted event names, validated properties)
 * - Auto-redacted if PHI is detected
 *
 * @module services/analytics.service
 */

import { db } from '../../db';
import {
  analyticsEvents,
  ANALYTICS_EVENT_NAMES,
  type AnalyticsEventName,
  type GovernanceMode,
} from '@researchflow/core/schema';
import { sql, desc, count, gte, lte, and, eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { logAction } from './audit-service';

// Import PHI scanning if available
let scanPhi: ((text: string) => { hasPhi: boolean; findings?: unknown[] }) | null = null;
try {
  const phiEngine = require('@researchflow/phi-engine');
  scanPhi = phiEngine.scan;
} catch {
  console.warn('[Analytics] PHI engine not available, using basic validation');
}

// Max properties size (8KB)
const MAX_PROPERTIES_SIZE = 8 * 1024;

// IP salt for hashing (must be set in environment)
const ANALYTICS_IP_SALT = process.env.ANALYTICS_IP_SALT || 'default-analytics-salt-change-me';

/**
 * Analytics event input
 */
export interface AnalyticsEventInput {
  eventName: string;
  userId?: string;
  sessionId?: string;
  researchId?: string;
  mode?: GovernanceMode;
  properties?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Batch ingestion result
 */
export interface IngestResult {
  accepted: number;
  rejected: number;
  errors: string[];
}

/**
 * Analytics summary for admin
 */
export interface AnalyticsSummary {
  totalEvents: number;
  eventsByName: Record<string, number>;
  eventsByDay: Array<{ date: string; count: number }>;
  eventsByMode: Record<string, number>;
}

/**
 * Hash IP address for privacy
 */
function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`${ip}${ANALYTICS_IP_SALT}`)
    .digest('hex');
}

/**
 * Validate event name is in allowlist
 */
function isValidEventName(name: string): name is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(name);
}

/**
 * Check properties for potential PHI
 *
 * @param properties - Event properties to check
 * @returns { hasPhi: boolean; sanitized: Record<string, unknown> }
 */
function validateProperties(properties: Record<string, unknown>): {
  hasPhi: boolean;
  sanitized: Record<string, unknown>;
} {
  const json = JSON.stringify(properties);

  // Check size limit
  if (json.length > MAX_PROPERTIES_SIZE) {
    return { hasPhi: true, sanitized: { phi_redacted: true, reason: 'size_exceeded' } };
  }

  // Use PHI engine if available
  if (scanPhi) {
    const result = scanPhi(json);
    if (result.hasPhi) {
      return { hasPhi: true, sanitized: { phi_redacted: true, reason: 'phi_detected' } };
    }
  }

  // Basic validation: check for suspicious patterns
  const suspiciousPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{9}\b/, // 9-digit number
    /patient.*name/i,
    /date.*of.*birth/i,
    /\bssn\b/i,
    /\bmrn\b/i, // Medical record number
    /medical.*record/i,
    /email.*@.*\./i, // Email pattern
    /\b[A-Z]{2}\d{6,10}\b/, // ID patterns
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(json)) {
      return { hasPhi: true, sanitized: { phi_redacted: true, reason: 'pattern_match' } };
    }
  }

  // Check for suspiciously long strings (free text)
  const checkValues = (obj: unknown, depth = 0): boolean => {
    if (depth > 5) return false; // Max depth
    if (typeof obj === 'string' && obj.length > 200) return true;
    if (Array.isArray(obj)) return obj.some(item => checkValues(item, depth + 1));
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(val => checkValues(val, depth + 1));
    }
    return false;
  };

  if (checkValues(properties)) {
    return { hasPhi: true, sanitized: { phi_redacted: true, reason: 'long_text' } };
  }

  return { hasPhi: false, sanitized: properties };
}

/**
 * Track a single analytics event
 *
 * @param event - Event to track
 * @returns boolean - Whether event was accepted
 */
export async function trackEvent(event: AnalyticsEventInput): Promise<boolean> {
  if (!db) {
    console.warn('[Analytics] Database not available');
    return false;
  }

  // Validate event name
  if (!isValidEventName(event.eventName)) {
    console.warn(`[Analytics] Rejected unknown event name: ${event.eventName}`);
    return false;
  }

  // Validate and sanitize properties
  const { hasPhi, sanitized } = validateProperties(event.properties || {});

  if (hasPhi) {
    // Log PHI detection (without the actual values)
    await logAction({
      action: 'ANALYTICS_PHI_REDACTED',
      userId: event.userId,
      details: {
        eventName: event.eventName,
        reason: (sanitized as { reason?: string }).reason,
      },
      severity: 'WARN',
      category: 'GOVERNANCE',
    });
  }

  try {
    await db.insert(analyticsEvents).values({
      eventName: event.eventName,
      userId: event.userId || null,
      sessionId: event.sessionId || null,
      researchId: event.researchId || null,
      mode: event.mode || process.env.GOVERNANCE_MODE || 'DEMO',
      properties: sanitized,
      ipHash: event.ip ? hashIp(event.ip) : null,
      userAgent: event.userAgent || null,
    });

    return true;
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
    return false;
  }
}

/**
 * Ingest a batch of analytics events
 *
 * @param events - Array of events to ingest
 * @param context - Request context (consent verification already done by route)
 * @returns IngestResult
 */
export async function ingestBatch(
  events: AnalyticsEventInput[],
  context: { userId?: string; sessionId?: string; ip?: string; userAgent?: string }
): Promise<IngestResult> {
  const result: IngestResult = {
    accepted: 0,
    rejected: 0,
    errors: [],
  };

  for (const event of events) {
    // Merge context into event
    const fullEvent: AnalyticsEventInput = {
      ...event,
      userId: event.userId || context.userId,
      sessionId: event.sessionId || context.sessionId,
      ip: context.ip,
      userAgent: context.userAgent,
    };

    const success = await trackEvent(fullEvent);
    if (success) {
      result.accepted++;
    } else {
      result.rejected++;
      result.errors.push(`Failed to track event: ${event.eventName}`);
    }
  }

  return result;
}

/**
 * Get analytics summary for admin dashboard
 *
 * @param options - Query options (dateFrom, dateTo, limit)
 * @returns AnalyticsSummary
 */
export async function getSummary(options?: {
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}): Promise<AnalyticsSummary> {
  if (!db) {
    return {
      totalEvents: 0,
      eventsByName: {},
      eventsByDay: [],
      eventsByMode: {},
    };
  }

  const dateFrom = options?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
  const dateTo = options?.dateTo || new Date();

  try {
    // Total events count
    const totalResult = await db
      .select({ count: count() })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.createdAt, dateFrom),
          lte(analyticsEvents.createdAt, dateTo)
        )
      );
    const totalEvents = totalResult[0]?.count || 0;

    // Events by name
    const byNameResult = await db
      .select({
        eventName: analyticsEvents.eventName,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.createdAt, dateFrom),
          lte(analyticsEvents.createdAt, dateTo)
        )
      )
      .groupBy(analyticsEvents.eventName);

    const eventsByName: Record<string, number> = {};
    for (const row of byNameResult) {
      eventsByName[row.eventName] = row.count;
    }

    // Events by day (last 14 days)
    const byDayResult = await db
      .select({
        date: sql<string>`DATE(${analyticsEvents.createdAt})`,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.createdAt, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)),
          lte(analyticsEvents.createdAt, dateTo)
        )
      )
      .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
      .orderBy(sql`DATE(${analyticsEvents.createdAt})`);

    const eventsByDay = byDayResult.map(row => ({
      date: row.date,
      count: row.count,
    }));

    // Events by mode
    const byModeResult = await db
      .select({
        mode: analyticsEvents.mode,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.createdAt, dateFrom),
          lte(analyticsEvents.createdAt, dateTo)
        )
      )
      .groupBy(analyticsEvents.mode);

    const eventsByMode: Record<string, number> = {};
    for (const row of byModeResult) {
      eventsByMode[row.mode] = row.count;
    }

    return {
      totalEvents,
      eventsByName,
      eventsByDay,
      eventsByMode,
    };
  } catch (error) {
    console.error('[Analytics] Error getting summary:', error);
    return {
      totalEvents: 0,
      eventsByName: {},
      eventsByDay: [],
      eventsByMode: {},
    };
  }
}

// Export as service object
export const analyticsService = {
  trackEvent,
  ingestBatch,
  getSummary,
};
