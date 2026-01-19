/**
 * Webhook Service with HMAC Signatures
 *
 * Manages webhook subscriptions and delivers events:
 * - HMAC-SHA256 signed payloads
 * - Retry logic with exponential backoff
 * - Event filtering
 * - Delivery logging
 */

import crypto from 'crypto';

// Types
export type WebhookEvent =
  | 'job.completed'
  | 'job.failed'
  | 'artifact.created'
  | 'artifact.updated'
  | 'artifact.deleted'
  | 'schema.registered'
  | 'schema.deprecated';

interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  userId: string;
  createdAt: Date;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: 'success' | 'failed';
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  timestamp: Date;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  error?: string;
}

interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: any;
}

const MAX_RETRIES = 5;
const RETRY_DELAYS = [60, 300, 900, 3600, 7200]; // seconds: 1m, 5m, 15m, 1h, 2h

export class WebhookService {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private retryQueue: WebhookDelivery[] = [];
  private retryInterval?: NodeJS.Timer;

  constructor() {
    // Start retry processor
    this.startRetryProcessor();
  }

  /**
   * Register a new webhook
   */
  async register(
    url: string,
    events: WebhookEvent[],
    userId: string,
    secret?: string
  ): Promise<WebhookConfig> {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    // Validate events
    const validEvents: WebhookEvent[] = [
      'job.completed', 'job.failed', 'artifact.created',
      'artifact.updated', 'artifact.deleted', 'schema.registered', 'schema.deprecated'
    ];

    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw new Error(`Invalid event: ${event}`);
      }
    }

    // Generate ID and secret
    const id = this.generateId();
    const webhookSecret = secret || this.generateSecret();

    const config: WebhookConfig = {
      id,
      url,
      secret: webhookSecret,
      events,
      active: true,
      userId,
      createdAt: new Date()
    };

    this.webhooks.set(id, config);

    return config;
  }

  /**
   * Update webhook active status
   */
  async update(id: string, active: boolean): Promise<WebhookConfig> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }

    webhook.active = active;
    return webhook;
  }

  /**
   * Delete webhook
   */
  async delete(id: string): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  /**
   * Get webhook by ID
   */
  async get(id: string): Promise<WebhookConfig | undefined> {
    return this.webhooks.get(id);
  }

  /**
   * List webhooks for user
   */
  async listForUser(userId: string): Promise<WebhookConfig[]> {
    return Array.from(this.webhooks.values())
      .filter(w => w.userId === userId);
  }

  /**
   * Trigger webhook event
   */
  async trigger(event: WebhookEvent, data: any): Promise<void> {
    // Find matching webhooks
    const matchingWebhooks = Array.from(this.webhooks.values())
      .filter(w => w.active && w.events.includes(event));

    console.log(`Triggering ${event} to ${matchingWebhooks.length} webhooks`);

    // Deliver to each webhook
    for (const webhook of matchingWebhooks) {
      await this.deliver(webhook, event, data);
    }
  }

  /**
   * Deliver webhook
   */
  private async deliver(
    webhook: WebhookConfig,
    event: WebhookEvent,
    data: any
  ): Promise<void> {
    const deliveryId = this.generateId();
    const timestamp = new Date().toISOString();

    const payload: WebhookPayload = {
      id: deliveryId,
      event,
      timestamp,
      data
    };

    // Create delivery record
    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      event,
      payload,
      timestamp: new Date(),
      status: 'pending',
      attempts: 0
    };

    this.deliveries.set(deliveryId, delivery);

    // Attempt delivery
    await this.attemptDelivery(webhook, delivery);
  }

  /**
   * Attempt to deliver webhook
   */
  private async attemptDelivery(
    webhook: WebhookConfig,
    delivery: WebhookDelivery
  ): Promise<boolean> {
    delivery.attempts++;
    delivery.lastAttemptAt = new Date();

    const payloadString = JSON.stringify(delivery.payload);

    // Generate HMAC signature
    const signature = this.generateSignature(payloadString, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Event': delivery.event,
          'X-Webhook-Timestamp': delivery.payload.timestamp,
          'X-Webhook-Signature': signature,
          'User-Agent': 'ResearchFlow-Webhook/1.0'
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      delivery.statusCode = response.status;

      if (response.ok) {
        delivery.status = 'success';
        webhook.lastDeliveryAt = new Date();
        webhook.lastDeliveryStatus = 'success';
        console.log(`Webhook delivered: ${delivery.id} to ${webhook.url}`);
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      delivery.error = error.message;
      webhook.lastDeliveryStatus = 'failed';

      // Schedule retry if attempts remaining
      if (delivery.attempts < MAX_RETRIES) {
        const retryDelay = RETRY_DELAYS[delivery.attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        delivery.nextRetryAt = new Date(Date.now() + retryDelay * 1000);
        this.retryQueue.push(delivery);
        console.log(`Webhook delivery failed, retry scheduled: ${delivery.id}`);
      } else {
        delivery.status = 'failed';
        console.error(`Webhook delivery permanently failed: ${delivery.id}`);
      }

      return false;
    }
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(payload, secret);

    // Timing-safe comparison
    if (signature.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  /**
   * Test webhook delivery
   */
  async test(id: string): Promise<boolean> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }

    const testPayload: WebhookPayload = {
      id: this.generateId(),
      event: 'job.completed',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery'
      }
    };

    const delivery: WebhookDelivery = {
      id: testPayload.id,
      webhookId: webhook.id,
      event: 'job.completed',
      payload: testPayload,
      timestamp: new Date(),
      status: 'pending',
      attempts: 0
    };

    const success = await this.attemptDelivery(webhook, delivery);
    return success;
  }

  /**
   * Get delivery history for webhook
   */
  getDeliveryHistory(webhookId: string, limit: number = 20): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    this.retryInterval = setInterval(() => {
      this.processRetries();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    const toRetry = this.retryQueue.filter(
      d => d.nextRetryAt && d.nextRetryAt <= now
    );

    // Remove from queue
    this.retryQueue = this.retryQueue.filter(
      d => !toRetry.includes(d)
    );

    // Process retries
    for (const delivery of toRetry) {
      const webhook = this.webhooks.get(delivery.webhookId);
      if (webhook && webhook.active) {
        await this.attemptDelivery(webhook, delivery);
      }
    }
  }

  /**
   * Stop retry processor
   */
  stop(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }

  // Utilities

  private generateId(): string {
    return `whk_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  }

  private generateSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }
}

// Middleware for verifying incoming webhooks
export function webhookVerificationMiddleware(secret: string) {
  const service = new WebhookService();

  return (req: any, res: any, next: any) => {
    const signature = req.headers['x-webhook-signature'];

    if (!signature) {
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    const payload = JSON.stringify(req.body);
    const valid = service.verifySignature(payload, signature, secret);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    next();
  };
}

export default WebhookService;
