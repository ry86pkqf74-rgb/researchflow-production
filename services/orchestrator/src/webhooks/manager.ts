/**
 * Webhook Manager
 * Task 179: Webhook system for external integrations
 */

import crypto from 'crypto';

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
  metadata?: Record<string, unknown>;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed';
  responseCode?: number;
  responseBody?: string;
  attempts: number;
  createdAt: Date;
  deliveredAt?: Date;
}

// In-memory stores
const webhookStore = new Map<string, WebhookConfig>();
const deliveryStore = new Map<string, WebhookDelivery>();

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // ms

/**
 * Register a new webhook
 */
export function registerWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'failureCount'>): WebhookConfig {
  const webhook: WebhookConfig = {
    ...config,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    failureCount: 0,
  };
  webhookStore.set(webhook.id, webhook);
  return webhook;
}

/**
 * Update a webhook
 */
export function updateWebhook(
  id: string,
  updates: Partial<Omit<WebhookConfig, 'id' | 'createdAt'>>
): WebhookConfig | undefined {
  const existing = webhookStore.get(id);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  webhookStore.set(id, updated);
  return updated;
}

/**
 * Delete a webhook
 */
export function deleteWebhook(id: string): boolean {
  return webhookStore.delete(id);
}

/**
 * Get a webhook by ID
 */
export function getWebhook(id: string): WebhookConfig | undefined {
  return webhookStore.get(id);
}

/**
 * List all webhooks
 */
export function listWebhooks(): WebhookConfig[] {
  return Array.from(webhookStore.values());
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(
  event: string,
  data: Record<string, unknown>
): Promise<WebhookDelivery[]> {
  const deliveries: WebhookDelivery[] = [];

  for (const webhook of webhookStore.values()) {
    if (!webhook.enabled) continue;
    if (!webhook.events.includes(event) && !webhook.events.includes('*')) continue;

    const delivery = await deliverWebhook(webhook, event, data);
    deliveries.push(delivery);
  }

  return deliveries;
}

/**
 * Deliver a webhook
 */
async function deliverWebhook(
  webhook: WebhookConfig,
  event: string,
  data: Record<string, unknown>
): Promise<WebhookDelivery> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const delivery: WebhookDelivery = {
    id: crypto.randomUUID(),
    webhookId: webhook.id,
    event,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
  };

  deliveryStore.set(delivery.id, delivery);

  // Attempt delivery with retries
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    delivery.attempts = attempt + 1;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Delivery': delivery.id,
        'X-Webhook-Timestamp': payload.timestamp,
      };

      if (webhook.secret) {
        const signature = signPayload(JSON.stringify(payload), webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      delivery.responseCode = response.status;
      delivery.responseBody = await response.text();

      if (response.ok) {
        delivery.status = 'success';
        delivery.deliveredAt = new Date();

        // Update webhook stats
        webhook.lastTriggeredAt = new Date();
        webhook.failureCount = 0;
        webhookStore.set(webhook.id, webhook);

        break;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      delivery.status = 'failed';

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAYS[attempt]);
      } else {
        // Update failure count
        webhook.failureCount++;
        if (webhook.failureCount >= 10) {
          webhook.enabled = false; // Disable after too many failures
        }
        webhookStore.set(webhook.id, webhook);
      }
    }
  }

  deliveryStore.set(delivery.id, delivery);
  return delivery;
}

/**
 * Sign a payload for verification
 */
function signPayload(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

/**
 * Verify a webhook signature
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signPayload(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Get webhook deliveries
 */
export function getDeliveries(webhookId?: string): WebhookDelivery[] {
  const deliveries = Array.from(deliveryStore.values());
  if (webhookId) {
    return deliveries.filter((d) => d.webhookId === webhookId);
  }
  return deliveries;
}

/**
 * Retry a failed delivery
 */
export async function retryDelivery(deliveryId: string): Promise<WebhookDelivery | undefined> {
  const delivery = deliveryStore.get(deliveryId);
  if (!delivery || delivery.status !== 'failed') return undefined;

  const webhook = webhookStore.get(delivery.webhookId);
  if (!webhook) return undefined;

  return deliverWebhook(webhook, delivery.event, delivery.payload.data);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Event types
export const WebhookEvents = {
  RESEARCH_CREATED: 'research.created',
  RESEARCH_UPDATED: 'research.updated',
  RESEARCH_COMPLETED: 'research.completed',
  RESEARCH_FAILED: 'research.failed',
  JOB_STARTED: 'job.started',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
  ARTIFACT_CREATED: 'artifact.created',
  USER_CREATED: 'user.created',
  INTEGRATION_CONNECTED: 'integration.connected',
  INTEGRATION_DISCONNECTED: 'integration.disconnected',
} as const;

export type { WebhookConfig, WebhookPayload, WebhookDelivery };
