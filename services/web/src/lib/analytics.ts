/**
 * Analytics Client
 *
 * Client-side analytics utility for tracking PHI-safe events.
 * Events are only sent when user has granted analytics consent.
 *
 * @module lib/analytics
 */

import { useConsentStore } from '@/stores/consent-store';

/**
 * Allowed event names (must match server allowlist)
 */
export const ALLOWED_EVENT_NAMES = [
  'ui.page_view',
  'ui.button_click',
  'governance.console_view',
  'governance.mode_changed',
  'governance.flag_changed',
  'job.started',
  'job.progress',
  'job.completed',
  'job.failed',
  'experiment.assigned',
] as const;

export type AllowedEventName = (typeof ALLOWED_EVENT_NAMES)[number];

/**
 * Allowed property keys (PHI-safe only)
 * Only these keys are allowed in event properties
 */
const ALLOWED_PROPERTY_KEYS = new Set([
  // IDs
  'researchId',
  'sessionId',
  'jobId',
  'stageId',
  'artifactId',
  'experimentKey',
  'variant',
  // UI
  'page',
  'component',
  'action',
  'buttonName',
  // Counts and metrics
  'count',
  'progress',
  'duration',
  'latency',
  // Enums
  'mode',
  'status',
  'type',
  'category',
  // Booleans
  'success',
  'isDemo',
  'isRetry',
]);

/**
 * Event queue for batching
 */
interface QueuedEvent {
  eventName: AllowedEventName;
  ts: string;
  properties: Record<string, unknown>;
  researchId?: string;
}

let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Flush settings
const FLUSH_INTERVAL_MS = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 20;

/**
 * Filter properties to only allowed keys
 */
function filterProperties(
  properties?: Record<string, unknown>
): Record<string, unknown> {
  if (!properties) return {};

  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    // Only include allowed keys
    if (!ALLOWED_PROPERTY_KEYS.has(key)) {
      console.debug(`[Analytics] Filtered out property key: ${key}`);
      continue;
    }

    // Only include primitive values and short strings
    if (
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      (typeof value === 'string' && value.length <= 100)
    ) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Flush queued events to server
 */
async function flushQueue(): Promise<void> {
  if (eventQueue.length === 0) return;

  // Get current consent state
  const { analyticsGranted } = useConsentStore.getState();

  if (!analyticsGranted) {
    // Clear queue if consent not granted
    eventQueue = [];
    return;
  }

  // Take current queue and clear it
  const events = eventQueue;
  eventQueue = [];

  try {
    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Analytics-Consent': 'true',
      },
      credentials: 'include',
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      // Log but don't throw - analytics failures shouldn't break the app
      console.warn('[Analytics] Failed to send events:', response.status);
    }
  } catch (error) {
    console.warn('[Analytics] Failed to send events:', error);
  }
}

/**
 * Schedule a flush
 */
function scheduleFlush(): void {
  if (flushTimer) return;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Track an analytics event
 *
 * This function will no-op if:
 * - Analytics consent has not been granted
 * - The event name is not in the allowlist
 *
 * @param eventName - The event name (must be in ALLOWED_EVENT_NAMES)
 * @param properties - PHI-safe properties (only whitelisted keys allowed)
 * @param researchId - Optional research ID context
 */
export function trackEvent(
  eventName: AllowedEventName,
  properties?: Record<string, unknown>,
  researchId?: string
): void {
  // Check consent
  const { analyticsGranted, loaded } = useConsentStore.getState();

  // If consent not loaded yet, queue for later (will be dropped if no consent)
  // If consent not granted, no-op
  if (loaded && !analyticsGranted) {
    return;
  }

  // Validate event name
  if (!ALLOWED_EVENT_NAMES.includes(eventName)) {
    console.warn(`[Analytics] Unknown event name: ${eventName}`);
    return;
  }

  // Filter properties
  const filteredProperties = filterProperties(properties);

  // Add to queue
  eventQueue.push({
    eventName,
    ts: new Date().toISOString(),
    properties: filteredProperties,
    researchId,
  });

  // Flush if queue is full
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
  } else {
    scheduleFlush();
  }
}

/**
 * Track a page view
 *
 * @param page - Page identifier
 * @param properties - Additional PHI-safe properties
 */
export function trackPageView(
  page: string,
  properties?: Record<string, unknown>
): void {
  trackEvent('ui.page_view', {
    ...properties,
    page,
  });
}

/**
 * Track a button click
 *
 * @param buttonName - Button identifier
 * @param properties - Additional PHI-safe properties
 */
export function trackButtonClick(
  buttonName: string,
  properties?: Record<string, unknown>
): void {
  trackEvent('ui.button_click', {
    ...properties,
    buttonName,
  });
}

/**
 * Flush any pending events immediately
 * Call this on page unload or when user logs out
 */
export function flushAnalytics(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushQueue();
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushAnalytics);
}
