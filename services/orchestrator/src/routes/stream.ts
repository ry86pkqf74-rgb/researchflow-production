/**
 * Stream API Routes (Server-Sent Events)
 *
 * Provides SSE endpoint for realtime updates:
 * - GET /api/stream - SSE stream for governance and job events
 *
 * @module routes/stream
 */

import { Router, type Request, type Response } from 'express';
import { eventBus, type AppEvent, type EventTopic } from '../services/event-bus';
import { featureFlagsService } from '../services/feature-flags.service';
import { governanceConfigService } from '../services/governance-config.service';

const router = Router();

// Keepalive interval (25 seconds - within typical 30s timeout)
const KEEPALIVE_INTERVAL = 25000;

/**
 * GET /api/stream
 *
 * Server-Sent Events stream for realtime updates.
 *
 * Query params:
 * - topic: 'governance' | 'jobs' | 'all' (default: 'all')
 *
 * Events:
 * - hello: Initial state with current mode and flags
 * - governance.mode_changed: Mode changed
 * - governance.flag_changed: Flag changed
 * - job.started: Job started
 * - job.progress: Job progress update
 * - job.completed: Job completed
 * - job.failed: Job failed
 * - ping: Keepalive
 */
router.get('/', async (req: Request, res: Response) => {
  // Parse topic from query
  const topicParam = req.query.topic as string | undefined;
  const validTopics: EventTopic[] = ['governance', 'jobs', 'all'];
  const topic: EventTopic = topicParam && validTopics.includes(topicParam as EventTopic)
    ? (topicParam as EventTopic)
    : 'all';

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Disable response compression for SSE
  res.setHeader('Content-Encoding', 'identity');

  // Flush headers to establish connection
  res.flushHeaders();

  /**
   * Send an SSE event
   */
  const sendEvent = (event: AppEvent | { type: string; payload: Record<string, unknown> }) => {
    const data = JSON.stringify({
      type: event.type,
      ts: 'ts' in event ? event.ts : new Date().toISOString(),
      payload: event.payload,
    });
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${data}\n\n`);
  };

  /**
   * Send keepalive ping
   */
  const sendPing = () => {
    res.write(`:ping\n\n`);
  };

  // Send initial hello event with current state
  try {
    const mode = await governanceConfigService.getMode();
    const flags = await featureFlagsService.getFlags({ mode });
    const flagsMeta = await featureFlagsService.listFlags();

    sendEvent({
      type: 'hello',
      payload: {
        mode,
        flags,
        flagsMeta,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Stream] Error sending hello event:', error);
    sendEvent({
      type: 'hello',
      payload: {
        mode: process.env.GOVERNANCE_MODE || 'DEMO',
        flags: {},
        flagsMeta: [],
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Subscribe to event bus
  const unsubscribe = eventBus.subscribe(topic, (event: AppEvent) => {
    try {
      sendEvent(event);
    } catch (error) {
      // Connection may be closed
      console.warn('[Stream] Error sending event:', error);
    }
  });

  // Set up keepalive interval
  const keepaliveTimer = setInterval(() => {
    try {
      sendPing();
    } catch {
      // Connection closed, will be cleaned up by close handler
    }
  }, KEEPALIVE_INTERVAL);

  // Cleanup on connection close
  const cleanup = () => {
    clearInterval(keepaliveTimer);
    unsubscribe();
    console.log(`[Stream] Client disconnected (topic: ${topic})`);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);

  console.log(`[Stream] Client connected (topic: ${topic})`);
});

export default router;
