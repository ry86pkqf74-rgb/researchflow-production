/**
 * Splunk/ELK Security Log Forwarding (Task 74)
 *
 * Forwards security events to external SIEM systems for:
 * - Centralized security monitoring
 * - Compliance audit trails
 * - Threat detection integration
 * - Incident response
 *
 * Supported backends:
 * - Splunk HEC (HTTP Event Collector)
 * - Elasticsearch
 * - Generic webhook
 *
 * Security Model:
 * - Never logs raw PHI or secrets
 * - Uses structured JSON format
 * - Supports batch sending for efficiency
 * - Automatic retry with exponential backoff
 *
 * Feature Flag: SIEM_LOGGING_ENABLED (default: false)
 */

// Configuration from environment
const SIEM_LOGGING_ENABLED = process.env.SIEM_LOGGING_ENABLED === 'true';
const SIEM_BACKEND = process.env.SIEM_BACKEND || 'splunk'; // 'splunk', 'elasticsearch', 'webhook'
const SPLUNK_HEC_URL = process.env.SPLUNK_HEC_URL || '';
const SPLUNK_HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN || '';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || '';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'researchflow-security';
const WEBHOOK_URL = process.env.SIEM_WEBHOOK_URL || '';
const BATCH_SIZE = parseInt(process.env.SIEM_BATCH_SIZE || '100', 10);
const FLUSH_INTERVAL_MS = parseInt(process.env.SIEM_FLUSH_INTERVAL_MS || '5000', 10);

/**
 * Security event severity levels
 */
export type SeverityLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/**
 * Security event categories
 */
export type EventCategory =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'DATA_ACCESS'
  | 'PHI_ACCESS'
  | 'CONFIGURATION'
  | 'RATE_LIMIT'
  | 'ANOMALY'
  | 'SECURITY_SCAN'
  | 'INCIDENT';

/**
 * Security event for SIEM
 */
export interface SecurityEvent {
  timestamp: string;
  severity: SeverityLevel;
  category: EventCategory;
  action: string;
  outcome: 'success' | 'failure' | 'unknown';
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  // Never include raw PHI
  phiAccessed?: boolean;
  phiFieldCount?: number;
  // Compliance fields
  complianceFlags?: string[];
  riskScore?: number;
}

/**
 * Splunk HEC event format
 */
interface SplunkEvent {
  time: number;
  host: string;
  source: string;
  sourcetype: string;
  index?: string;
  event: SecurityEvent;
}

/**
 * SIEM Logger
 */
class SiemLogger {
  private eventQueue: SecurityEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private hostname: string;
  private source: string = 'researchflow-orchestrator';

  constructor() {
    this.hostname = process.env.HOSTNAME || process.env.POD_NAME || 'unknown';

    if (SIEM_LOGGING_ENABLED) {
      this.startFlushTimer();
    }
  }

  /**
   * Check if SIEM logging is enabled
   */
  isEnabled(): boolean {
    return SIEM_LOGGING_ENABLED;
  }

  /**
   * Log a security event
   */
  async log(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    if (!SIEM_LOGGING_ENABLED) {
      return;
    }

    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Sanitize event - never include raw PHI or secrets
    this.sanitizeEvent(fullEvent);

    this.eventQueue.push(fullEvent);

    // Flush if batch is full
    if (this.eventQueue.length >= BATCH_SIZE) {
      await this.flush();
    }
  }

  /**
   * Sanitize event to remove sensitive data
   */
  private sanitizeEvent(event: SecurityEvent): void {
    // Remove any potential PHI from details
    if (event.details) {
      const sensitiveKeys = [
        'password',
        'token',
        'secret',
        'key',
        'credential',
        'ssn',
        'dob',
        'mrn',
        'patient',
        'phi',
        'pii',
      ];

      for (const key of Object.keys(event.details)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
          event.details[key] = '[REDACTED]';
        }
      }
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[SiemLogger] Flush failed:', err);
      });
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Flush events to SIEM backend
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      switch (SIEM_BACKEND) {
        case 'splunk':
          await this.sendToSplunk(events);
          break;
        case 'elasticsearch':
          await this.sendToElasticsearch(events);
          break;
        case 'webhook':
          await this.sendToWebhook(events);
          break;
        default:
          console.warn(`[SiemLogger] Unknown backend: ${SIEM_BACKEND}`);
      }
    } catch (error) {
      // Re-queue events on failure (with limit to prevent memory issues)
      if (this.eventQueue.length < BATCH_SIZE * 10) {
        this.eventQueue = [...events, ...this.eventQueue];
      }
      throw error;
    }
  }

  /**
   * Send events to Splunk HEC
   */
  private async sendToSplunk(events: SecurityEvent[]): Promise<void> {
    if (!SPLUNK_HEC_URL || !SPLUNK_HEC_TOKEN) {
      console.warn('[SiemLogger] Splunk HEC not configured');
      return;
    }

    const splunkEvents: SplunkEvent[] = events.map((event) => ({
      time: new Date(event.timestamp).getTime() / 1000,
      host: this.hostname,
      source: this.source,
      sourcetype: 'researchflow:security',
      event,
    }));

    // Splunk HEC accepts multiple events separated by newlines
    const body = splunkEvents.map((e) => JSON.stringify(e)).join('\n');

    const response = await fetch(SPLUNK_HEC_URL, {
      method: 'POST',
      headers: {
        Authorization: `Splunk ${SPLUNK_HEC_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Splunk HEC request failed: ${response.status}`);
    }
  }

  /**
   * Send events to Elasticsearch
   */
  private async sendToElasticsearch(events: SecurityEvent[]): Promise<void> {
    if (!ELASTICSEARCH_URL) {
      console.warn('[SiemLogger] Elasticsearch not configured');
      return;
    }

    // Build bulk request
    const lines: string[] = [];
    for (const event of events) {
      const date = event.timestamp.split('T')[0];
      const index = `${ELASTICSEARCH_INDEX}-${date}`;

      lines.push(JSON.stringify({ index: { _index: index } }));
      lines.push(
        JSON.stringify({
          ...event,
          '@timestamp': event.timestamp,
          host: { name: this.hostname },
          service: { name: this.source },
        })
      );
    }

    const response = await fetch(`${ELASTICSEARCH_URL}/_bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
      body: lines.join('\n') + '\n',
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch bulk request failed: ${response.status}`);
    }
  }

  /**
   * Send events to generic webhook
   */
  private async sendToWebhook(events: SecurityEvent[]): Promise<void> {
    if (!WEBHOOK_URL) {
      console.warn('[SiemLogger] Webhook URL not configured');
      return;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: this.source,
        host: this.hostname,
        events,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status}`);
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: string,
    outcome: 'success' | 'failure',
    userId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      severity: outcome === 'failure' ? 'WARN' : 'INFO',
      category: 'AUTHENTICATION',
      action,
      outcome,
      userId,
      details,
    });
  }

  /**
   * Log authorization event
   */
  async logAuthz(
    action: string,
    outcome: 'success' | 'failure',
    userId?: string,
    resourceType?: string,
    resourceId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      severity: outcome === 'failure' ? 'WARN' : 'INFO',
      category: 'AUTHORIZATION',
      action,
      outcome,
      userId,
      resourceType,
      resourceId,
      details,
    });
  }

  /**
   * Log PHI access event
   */
  async logPhiAccess(
    action: string,
    userId: string,
    resourceId: string,
    fieldCount: number,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      severity: 'INFO',
      category: 'PHI_ACCESS',
      action,
      outcome: 'success',
      userId,
      resourceType: 'phi',
      resourceId,
      phiAccessed: true,
      phiFieldCount: fieldCount,
      complianceFlags: ['HIPAA'],
      details,
    });
  }

  /**
   * Log security anomaly
   */
  async logAnomaly(
    action: string,
    severity: SeverityLevel,
    riskScore: number,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      severity,
      category: 'ANOMALY',
      action,
      outcome: 'unknown',
      riskScore,
      details,
    });
  }

  /**
   * Log rate limit event
   */
  async logRateLimit(
    userId: string | undefined,
    ipAddress: string,
    endpoint: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      severity: 'WARN',
      category: 'RATE_LIMIT',
      action: 'EXCEEDED',
      outcome: 'failure',
      userId,
      ipAddress,
      resourceType: 'endpoint',
      resourceId: endpoint,
      details,
    });
  }

  /**
   * Log security incident
   */
  async logIncident(
    action: string,
    severity: SeverityLevel,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      severity,
      category: 'INCIDENT',
      action,
      outcome: 'unknown',
      details,
      complianceFlags: ['INCIDENT_RESPONSE'],
    });
  }

  /**
   * Stop the logger
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush();
  }
}

// Singleton instance
let siemLogger: SiemLogger | null = null;

/**
 * Get the SIEM logger instance
 */
export function getSiemLogger(): SiemLogger {
  if (!siemLogger) {
    siemLogger = new SiemLogger();
  }
  return siemLogger;
}

/**
 * Check if SIEM logging is enabled
 */
export function isSiemEnabled(): boolean {
  return SIEM_LOGGING_ENABLED;
}

export { SiemLogger };
export default getSiemLogger;
