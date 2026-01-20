/**
 * EventBus Service
 *
 * Provides in-process pub/sub + optional Redis pub/sub bridge for realtime events.
 * Events are PHI-safe by design - never include raw dataset values, manuscript text,
 * or request bodies.
 *
 * @module services/event-bus
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import net from 'net';

// Event topics
export type EventTopic = 'governance' | 'jobs' | 'all';

// PHI-safe event shape
export interface AppEvent {
  type: string;
  ts: string;
  topic: EventTopic;
  payload: Record<string, unknown>;
}

// Redis pub/sub channel name
const REDIS_CHANNEL = 'researchflow:events';

/**
 * EventBus class for pub/sub messaging
 *
 * Features:
 * - In-process event emitter for local subscribers
 * - Optional Redis pub/sub bridge for distributed systems
 * - PHI-safe by design (validates event payloads)
 * - TypeScript-first with type-safe events
 */
class EventBus {
  private emitter: EventEmitter;
  private redisPublisher: net.Socket | null = null;
  private redisSubscriber: net.Socket | null = null;
  private redisConnected = false;
  private isShuttingDown = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Allow many SSE connections

    // Initialize Redis if REDIS_URL is set
    if (process.env.REDIS_URL) {
      this.initializeRedis();
    }
  }

  /**
   * Initialize Redis pub/sub connection
   */
  private async initializeRedis(): Promise<void> {
    if (this.isShuttingDown) return;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;

    try {
      const url = new URL(redisUrl);
      const host = url.hostname;
      const port = parseInt(url.port || '6379', 10);

      // Create publisher socket
      this.redisPublisher = new net.Socket();
      this.redisPublisher.connect(port, host, () => {
        console.log('[EventBus] Redis publisher connected');
        this.redisConnected = true;
        this.reconnectAttempts = 0;
      });

      this.redisPublisher.on('error', (err) => {
        console.error('[EventBus] Redis publisher error:', err.message);
        this.redisConnected = false;
      });

      this.redisPublisher.on('close', () => {
        this.redisConnected = false;
        if (!this.isShuttingDown) {
          this.scheduleReconnect();
        }
      });

      // Create subscriber socket
      this.redisSubscriber = new net.Socket();
      this.redisSubscriber.connect(port, host, () => {
        console.log('[EventBus] Redis subscriber connected');
        // Subscribe to the channel using RESP protocol
        const subscribeCmd = `*2\r\n$9\r\nSUBSCRIBE\r\n$${REDIS_CHANNEL.length}\r\n${REDIS_CHANNEL}\r\n`;
        this.redisSubscriber?.write(subscribeCmd);
      });

      let buffer = '';
      this.redisSubscriber.on('data', (data) => {
        buffer += data.toString();
        this.processRedisMessages(buffer);
        buffer = ''; // Simple approach - in production, use proper RESP parser
      });

      this.redisSubscriber.on('error', (err) => {
        console.error('[EventBus] Redis subscriber error:', err.message);
      });

      this.redisSubscriber.on('close', () => {
        if (!this.isShuttingDown) {
          this.scheduleReconnect();
        }
      });

    } catch (error) {
      console.error('[EventBus] Failed to initialize Redis:', error);
    }
  }

  /**
   * Schedule Redis reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[EventBus] Max Redis reconnect attempts reached, running in local-only mode');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`[EventBus] Attempting Redis reconnection (attempt ${this.reconnectAttempts})`);
      this.initializeRedis();
    }, delay);
  }

  /**
   * Process incoming Redis messages (simplified RESP parser)
   */
  private processRedisMessages(data: string): void {
    // Look for message data in RESP format
    // Format: *3\r\n$7\r\nmessage\r\n$<channel-len>\r\n<channel>\r\n$<msg-len>\r\n<msg>\r\n
    try {
      const lines = data.split('\r\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Try to parse as JSON (the actual message payload)
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const event = JSON.parse(line) as AppEvent;
            // Re-emit received event locally
            this.emitLocal(event);
          } catch {
            // Not JSON, skip
          }
        }
      }
    } catch (error) {
      // Ignore parse errors
    }
  }

  /**
   * Emit event locally without publishing to Redis
   */
  private emitLocal(event: AppEvent): void {
    // Emit to specific topic subscribers
    this.emitter.emit(event.topic, event);
    // Also emit to 'all' topic subscribers
    if (event.topic !== 'all') {
      this.emitter.emit('all', event);
    }
  }

  /**
   * Publish an event to the bus
   *
   * @param event - The event to publish (must be PHI-safe)
   */
  publish(event: AppEvent): void {
    // Validate event is PHI-safe (basic check)
    if (this.containsPotentialPHI(event.payload)) {
      console.warn('[EventBus] Blocked event with potential PHI:', event.type);
      return;
    }

    // Always emit locally first
    this.emitLocal(event);

    // Publish to Redis if connected
    if (this.redisConnected && this.redisPublisher) {
      const message = JSON.stringify(event);
      // PUBLISH command in RESP protocol
      const publishCmd = `*3\r\n$7\r\nPUBLISH\r\n$${REDIS_CHANNEL.length}\r\n${REDIS_CHANNEL}\r\n$${message.length}\r\n${message}\r\n`;
      this.redisPublisher.write(publishCmd);
    }
  }

  /**
   * Basic PHI detection in payload
   * This is a simple heuristic - not a replacement for proper PHI scanning
   */
  private containsPotentialPHI(payload: Record<string, unknown>): boolean {
    const json = JSON.stringify(payload).toLowerCase();

    // Check for common PHI patterns
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      /\b\d{9}\b/, // 9-digit number (could be SSN)
      /patient.*name/i,
      /date.*of.*birth/i,
      /mrn/i, // Medical record number
      /medical.*record/i,
    ];

    for (const pattern of phiPatterns) {
      if (pattern.test(json)) {
        return true;
      }
    }

    // Check for suspiciously long strings (might be manuscript content)
    const stringValues = Object.values(payload).filter(v => typeof v === 'string') as string[];
    for (const str of stringValues) {
      if (str.length > 500) {
        return true; // Likely free text content
      }
    }

    return false;
  }

  /**
   * Subscribe to events on a specific topic
   *
   * @param topic - The topic to subscribe to
   * @param callback - Callback function for received events
   * @returns Unsubscribe function
   */
  subscribe(topic: EventTopic, callback: (event: AppEvent) => void): () => void {
    this.emitter.on(topic, callback);

    // Return unsubscribe function
    return () => {
      this.emitter.off(topic, callback);
    };
  }

  /**
   * Helper to create and publish a governance event
   */
  publishGovernanceEvent(type: string, payload: Record<string, unknown>): void {
    this.publish({
      type,
      ts: new Date().toISOString(),
      topic: 'governance',
      payload,
    });
  }

  /**
   * Helper to create and publish a jobs event
   */
  publishJobEvent(type: string, payload: Record<string, unknown>): void {
    this.publish({
      type,
      ts: new Date().toISOString(),
      topic: 'jobs',
      payload,
    });
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    this.isShuttingDown = true;

    if (this.redisPublisher) {
      this.redisPublisher.destroy();
      this.redisPublisher = null;
    }

    if (this.redisSubscriber) {
      this.redisSubscriber.destroy();
      this.redisSubscriber = null;
    }

    this.emitter.removeAllListeners();
    console.log('[EventBus] Shutdown complete');
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Graceful shutdown on process exit
process.on('SIGTERM', () => eventBus.shutdown());
process.on('SIGINT', () => eventBus.shutdown());
