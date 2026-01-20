/**
 * Simulated Security Breach Testing Framework (Task 80)
 *
 * Provides controlled security breach simulations for:
 * - Testing incident response procedures
 * - Validating detection mechanisms
 * - Training security teams
 * - Compliance testing
 *
 * SAFETY:
 * - ONLY runs when SECURITY_TESTING_MODE=true
 * - ONLY runs in non-production environments
 * - All breaches are simulated (no actual damage)
 * - Comprehensive audit logging
 *
 * Breach Types:
 * - Credential stuffing attacks
 * - PHI access anomalies
 * - Privilege escalation attempts
 * - Rate limit floods
 * - SQL injection attempts
 * - XSS attempts
 * - Data exfiltration patterns
 */

import { EventEmitter } from 'events';

// Safety check
const SECURITY_TESTING_MODE = process.env.SECURITY_TESTING_MODE === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

if (IS_PRODUCTION && SECURITY_TESTING_MODE) {
  throw new Error('CRITICAL: Security testing mode cannot be enabled in production!');
}

/**
 * Breach simulation types
 */
export type BreachType =
  | 'credential_stuffing'
  | 'brute_force'
  | 'phi_access_anomaly'
  | 'privilege_escalation'
  | 'rate_limit_flood'
  | 'sql_injection'
  | 'xss_attempt'
  | 'data_exfiltration'
  | 'session_hijacking'
  | 'api_key_leak';

/**
 * Breach severity levels
 */
export type BreachSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Breach simulation configuration
 */
export interface BreachSimulationConfig {
  type: BreachType;
  severity: BreachSeverity;
  duration: number; // milliseconds
  intensity: number; // 1-10 scale
  targetEndpoints?: string[];
  targetUsers?: string[];
  customPayloads?: string[];
}

/**
 * Breach simulation result
 */
export interface BreachSimulationResult {
  id: string;
  type: BreachType;
  severity: BreachSeverity;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  eventsGenerated: number;
  detectionResults: {
    detected: boolean;
    detectedAt?: Date;
    detectionLatencyMs?: number;
    alertsTriggered: number;
    falsePositives: number;
  };
  recommendations: string[];
}

/**
 * Simulated attack event
 */
interface AttackEvent {
  timestamp: Date;
  type: BreachType;
  sourceIp: string;
  targetEndpoint: string;
  userId?: string;
  payload?: string;
  httpMethod: string;
  statusCode: number;
  blocked: boolean;
}

/**
 * Breach Simulation Engine
 */
export class BreachSimulator extends EventEmitter {
  private running = false;
  private currentSimulation: string | null = null;
  private events: AttackEvent[] = [];

  constructor() {
    super();

    if (!SECURITY_TESTING_MODE) {
      console.warn('[BreachSimulator] Security testing mode is disabled');
    }
  }

  /**
   * Check if simulations are allowed
   */
  isEnabled(): boolean {
    return SECURITY_TESTING_MODE && !IS_PRODUCTION;
  }

  /**
   * Run a breach simulation
   */
  async simulate(config: BreachSimulationConfig): Promise<BreachSimulationResult> {
    if (!this.isEnabled()) {
      throw new Error('Security testing mode is not enabled');
    }

    if (this.running) {
      throw new Error('A simulation is already running');
    }

    this.running = true;
    this.currentSimulation = `sim-${Date.now()}`;
    this.events = [];

    const startedAt = new Date();

    console.log(`[BreachSimulator] Starting ${config.type} simulation (${config.severity})`);
    this.emit('simulation:start', { id: this.currentSimulation, config });

    try {
      // Run the appropriate simulation
      switch (config.type) {
        case 'credential_stuffing':
          await this.simulateCredentialStuffing(config);
          break;
        case 'brute_force':
          await this.simulateBruteForce(config);
          break;
        case 'phi_access_anomaly':
          await this.simulatePhiAccessAnomaly(config);
          break;
        case 'privilege_escalation':
          await this.simulatePrivilegeEscalation(config);
          break;
        case 'rate_limit_flood':
          await this.simulateRateLimitFlood(config);
          break;
        case 'sql_injection':
          await this.simulateSqlInjection(config);
          break;
        case 'xss_attempt':
          await this.simulateXssAttempt(config);
          break;
        case 'data_exfiltration':
          await this.simulateDataExfiltration(config);
          break;
        case 'session_hijacking':
          await this.simulateSessionHijacking(config);
          break;
        case 'api_key_leak':
          await this.simulateApiKeyLeak(config);
          break;
      }

      const completedAt = new Date();

      // Analyze detection effectiveness
      const detectionResults = this.analyzeDetection();

      const result: BreachSimulationResult = {
        id: this.currentSimulation!,
        type: config.type,
        severity: config.severity,
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        eventsGenerated: this.events.length,
        detectionResults,
        recommendations: this.generateRecommendations(config, detectionResults),
      };

      console.log(`[BreachSimulator] Simulation complete: ${this.events.length} events generated`);
      this.emit('simulation:complete', result);

      return result;
    } finally {
      this.running = false;
      this.currentSimulation = null;
    }
  }

  /**
   * Simulate credential stuffing attack
   */
  private async simulateCredentialStuffing(config: BreachSimulationConfig): Promise<void> {
    const usernames = [
      'admin',
      'user',
      'test',
      'guest',
      'root',
      'administrator',
      'support',
      'info',
    ];
    const eventsPerSecond = config.intensity * 10;

    for (let elapsed = 0; elapsed < config.duration; elapsed += 1000 / eventsPerSecond) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'credential_stuffing',
        sourceIp: this.generateRandomIp(),
        targetEndpoint: '/api/auth/login',
        userId: usernames[Math.floor(Math.random() * usernames.length)],
        httpMethod: 'POST',
        statusCode: 401,
        blocked: Math.random() > 0.7, // 30% blocked
      };

      this.recordEvent(event);
      await this.delay(1000 / eventsPerSecond);
    }
  }

  /**
   * Simulate brute force attack
   */
  private async simulateBruteForce(config: BreachSimulationConfig): Promise<void> {
    const targetUser = config.targetUsers?.[0] || 'admin@example.com';
    const singleIp = this.generateRandomIp();
    const eventsPerSecond = config.intensity * 5;

    for (let elapsed = 0; elapsed < config.duration; elapsed += 1000 / eventsPerSecond) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'brute_force',
        sourceIp: singleIp, // Same IP for brute force
        targetEndpoint: '/api/auth/login',
        userId: targetUser,
        httpMethod: 'POST',
        statusCode: elapsed > config.duration * 0.8 ? 429 : 401, // Eventually rate limited
        blocked: elapsed > config.duration * 0.6,
      };

      this.recordEvent(event);
      await this.delay(1000 / eventsPerSecond);
    }
  }

  /**
   * Simulate PHI access anomaly
   */
  private async simulatePhiAccessAnomaly(config: BreachSimulationConfig): Promise<void> {
    const phiEndpoints = ['/api/patients', '/api/records', '/api/phi', '/api/export'];
    const userId = config.targetUsers?.[0] || 'suspicious-user';
    const eventsPerSecond = config.intensity * 2;

    for (let elapsed = 0; elapsed < config.duration; elapsed += 1000 / eventsPerSecond) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'phi_access_anomaly',
        sourceIp: this.generateRandomIp(),
        targetEndpoint: phiEndpoints[Math.floor(Math.random() * phiEndpoints.length)],
        userId,
        httpMethod: 'GET',
        statusCode: 200,
        blocked: false,
      };

      this.recordEvent(event);
      await this.delay(1000 / eventsPerSecond);
    }
  }

  /**
   * Simulate privilege escalation attempt
   */
  private async simulatePrivilegeEscalation(config: BreachSimulationConfig): Promise<void> {
    const adminEndpoints = ['/api/admin/users', '/api/admin/settings', '/api/admin/audit'];

    for (let elapsed = 0; elapsed < config.duration; elapsed += 2000) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'privilege_escalation',
        sourceIp: this.generateRandomIp(),
        targetEndpoint: adminEndpoints[Math.floor(Math.random() * adminEndpoints.length)],
        userId: 'viewer-user', // Low-privilege user
        httpMethod: ['POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 3)],
        statusCode: 403,
        blocked: true,
      };

      this.recordEvent(event);
      await this.delay(2000);
    }
  }

  /**
   * Simulate rate limit flood
   */
  private async simulateRateLimitFlood(config: BreachSimulationConfig): Promise<void> {
    const endpoints = config.targetEndpoints || ['/api/search', '/api/ai/summarize'];
    const eventsPerSecond = config.intensity * 100;

    for (let elapsed = 0; elapsed < config.duration; elapsed += 1000 / eventsPerSecond) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const isBlocked = elapsed > config.duration * 0.2;

      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'rate_limit_flood',
        sourceIp: this.generateRandomIp(),
        targetEndpoint: endpoint,
        httpMethod: 'GET',
        statusCode: isBlocked ? 429 : 200,
        blocked: isBlocked,
      };

      this.recordEvent(event);
      await this.delay(1000 / eventsPerSecond);
    }
  }

  /**
   * Simulate SQL injection attempts
   */
  private async simulateSqlInjection(config: BreachSimulationConfig): Promise<void> {
    const payloads =
      config.customPayloads ||
      [
        "' OR '1'='1",
        "'; DROP TABLE users;--",
        "' UNION SELECT * FROM users--",
        "1; SELECT * FROM passwords",
        "admin'--",
      ];

    for (let elapsed = 0; elapsed < config.duration; elapsed += 1000) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'sql_injection',
        sourceIp: this.generateRandomIp(),
        targetEndpoint: '/api/search',
        payload: payloads[Math.floor(Math.random() * payloads.length)],
        httpMethod: 'GET',
        statusCode: 400,
        blocked: true,
      };

      this.recordEvent(event);
      await this.delay(1000);
    }
  }

  /**
   * Simulate XSS attempts
   */
  private async simulateXssAttempt(config: BreachSimulationConfig): Promise<void> {
    const payloads =
      config.customPayloads ||
      [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
      ];

    for (let elapsed = 0; elapsed < config.duration; elapsed += 1000) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'xss_attempt',
        sourceIp: this.generateRandomIp(),
        targetEndpoint: '/api/comments',
        payload: payloads[Math.floor(Math.random() * payloads.length)],
        httpMethod: 'POST',
        statusCode: 400,
        blocked: true,
      };

      this.recordEvent(event);
      await this.delay(1000);
    }
  }

  /**
   * Simulate data exfiltration pattern
   */
  private async simulateDataExfiltration(config: BreachSimulationConfig): Promise<void> {
    const userId = config.targetUsers?.[0] || 'compromised-user';
    const dataEndpoints = ['/api/export', '/api/download', '/api/bulk'];

    for (let elapsed = 0; elapsed < config.duration; elapsed += 500) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'data_exfiltration',
        sourceIp: this.generateRandomIp(),
        targetEndpoint: dataEndpoints[Math.floor(Math.random() * dataEndpoints.length)],
        userId,
        httpMethod: 'GET',
        statusCode: 200,
        blocked: false,
      };

      this.recordEvent(event);
      await this.delay(500);
    }
  }

  /**
   * Simulate session hijacking
   */
  private async simulateSessionHijacking(config: BreachSimulationConfig): Promise<void> {
    const legitimateIp = '192.168.1.100';
    const attackerIp = this.generateRandomIp();
    const userId = config.targetUsers?.[0] || 'victim-user';

    // First, legitimate access
    for (let i = 0; i < 5; i++) {
      this.recordEvent({
        timestamp: new Date(),
        type: 'session_hijacking',
        sourceIp: legitimateIp,
        targetEndpoint: '/api/profile',
        userId,
        httpMethod: 'GET',
        statusCode: 200,
        blocked: false,
      });
      await this.delay(1000);
    }

    // Then, suspicious access from different IP
    for (let elapsed = 0; elapsed < config.duration - 5000; elapsed += 500) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'session_hijacking',
        sourceIp: attackerIp,
        targetEndpoint: '/api/profile',
        userId,
        httpMethod: 'GET',
        statusCode: elapsed > config.duration * 0.5 ? 401 : 200, // Eventually blocked
        blocked: elapsed > config.duration * 0.5,
      };

      this.recordEvent(event);
      await this.delay(500);
    }
  }

  /**
   * Simulate API key leak
   */
  private async simulateApiKeyLeak(config: BreachSimulationConfig): Promise<void> {
    const leakedKey = 'rf_test_key_' + Math.random().toString(36).substring(7);

    // Multiple IPs using same API key
    for (let elapsed = 0; elapsed < config.duration; elapsed += 300) {
      const event: AttackEvent = {
        timestamp: new Date(),
        type: 'api_key_leak',
        sourceIp: this.generateRandomIp(), // Different IP each time
        targetEndpoint: '/api/data',
        payload: `API-Key: ${leakedKey}`,
        httpMethod: 'GET',
        statusCode: elapsed > config.duration * 0.6 ? 401 : 200,
        blocked: elapsed > config.duration * 0.6,
      };

      this.recordEvent(event);
      await this.delay(300);
    }
  }

  /**
   * Record an attack event
   */
  private recordEvent(event: AttackEvent): void {
    this.events.push(event);
    this.emit('attack:event', event);
  }

  /**
   * Analyze detection effectiveness
   */
  private analyzeDetection(): BreachSimulationResult['detectionResults'] {
    const blockedEvents = this.events.filter((e) => e.blocked);
    const firstBlocked = blockedEvents[0];
    const firstEvent = this.events[0];

    return {
      detected: blockedEvents.length > 0,
      detectedAt: firstBlocked?.timestamp,
      detectionLatencyMs: firstBlocked
        ? firstBlocked.timestamp.getTime() - firstEvent.timestamp.getTime()
        : undefined,
      alertsTriggered: Math.floor(blockedEvents.length / 10), // Simulate alert grouping
      falsePositives: 0, // Would need actual comparison in real implementation
    };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(
    config: BreachSimulationConfig,
    results: BreachSimulationResult['detectionResults']
  ): string[] {
    const recommendations: string[] = [];

    if (!results.detected) {
      recommendations.push(`CRITICAL: ${config.type} attack was not detected. Review detection rules.`);
    }

    if (results.detectionLatencyMs && results.detectionLatencyMs > 10000) {
      recommendations.push(
        `Detection latency (${results.detectionLatencyMs}ms) exceeds 10s threshold. Tune alert sensitivity.`
      );
    }

    if (results.alertsTriggered === 0 && results.detected) {
      recommendations.push('Attacks were blocked but no alerts triggered. Configure alerting rules.');
    }

    // Type-specific recommendations
    switch (config.type) {
      case 'credential_stuffing':
        recommendations.push('Implement account lockout after failed attempts');
        recommendations.push('Consider CAPTCHA for repeated login failures');
        break;
      case 'brute_force':
        recommendations.push('Ensure rate limiting is configured for auth endpoints');
        recommendations.push('Implement progressive delays for failed attempts');
        break;
      case 'phi_access_anomaly':
        recommendations.push('Review PHI access patterns for unusual volumes');
        recommendations.push('Implement time-of-day access restrictions');
        break;
      case 'data_exfiltration':
        recommendations.push('Set up DLP (Data Loss Prevention) policies');
        recommendations.push('Monitor export endpoint usage patterns');
        break;
    }

    return recommendations;
  }

  /**
   * Generate a random IP address
   */
  private generateRandomIp(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(
      Math.random() * 255
    )}.${Math.floor(Math.random() * 255)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get simulation status
   */
  getStatus(): { running: boolean; currentSimulation: string | null; eventsGenerated: number } {
    return {
      running: this.running,
      currentSimulation: this.currentSimulation,
      eventsGenerated: this.events.length,
    };
  }

  /**
   * Get all events from current/last simulation
   */
  getEvents(): AttackEvent[] {
    return [...this.events];
  }

  /**
   * Cancel running simulation
   */
  cancel(): void {
    if (this.running) {
      this.running = false;
      this.emit('simulation:cancelled', { id: this.currentSimulation });
    }
  }
}

/**
 * Pre-defined breach scenarios for common testing
 */
export const BREACH_SCENARIOS: Record<string, BreachSimulationConfig> = {
  // Quick smoke test
  quick_credential_check: {
    type: 'credential_stuffing',
    severity: 'LOW',
    duration: 5000,
    intensity: 3,
  },

  // Full credential stuffing simulation
  full_credential_stuffing: {
    type: 'credential_stuffing',
    severity: 'HIGH',
    duration: 60000,
    intensity: 8,
  },

  // PHI exfiltration test
  phi_exfiltration: {
    type: 'phi_access_anomaly',
    severity: 'CRITICAL',
    duration: 30000,
    intensity: 5,
    targetEndpoints: ['/api/patients', '/api/export/phi'],
  },

  // Rate limit stress test
  rate_limit_stress: {
    type: 'rate_limit_flood',
    severity: 'MEDIUM',
    duration: 30000,
    intensity: 10,
  },

  // Injection attack suite
  injection_suite: {
    type: 'sql_injection',
    severity: 'HIGH',
    duration: 20000,
    intensity: 3,
  },

  // Data exfiltration pattern
  data_theft_pattern: {
    type: 'data_exfiltration',
    severity: 'CRITICAL',
    duration: 60000,
    intensity: 7,
  },
};

// Export singleton for convenience
export const breachSimulator = new BreachSimulator();
export default BreachSimulator;
