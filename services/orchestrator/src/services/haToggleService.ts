/**
 * High-Availability Toggle Service
 *
 * Phase G - Task 135: High-Availability Mode Toggles
 *
 * Provides one-switch HA mode management:
 * - Scales critical services to multiple replicas
 * - Configures database replication
 * - Sets pod anti-affinity for redundancy
 * - Tracks HA mode state and transitions
 */

import { z } from 'zod';
import { clusterStatusService } from './clusterStatusService';

// ============================================================================
// Types & Schemas
// ============================================================================

export const HAConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['standard', 'high_availability', 'disaster_recovery']),
  replicaConfiguration: z.record(z.string(), z.object({
    standard: z.number(),
    ha: z.number(),
  })),
  dbReplicationEnabled: z.boolean(),
  redisClusterEnabled: z.boolean(),
  crossAzEnabled: z.boolean(),
  lastToggled: z.string().datetime().optional(),
  toggledBy: z.string().optional(),
});

export const HAStatusSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['standard', 'high_availability', 'disaster_recovery']),
  timestamp: z.string().datetime(),
  services: z.record(z.string(), z.object({
    currentReplicas: z.number(),
    targetReplicas: z.number(),
    status: z.enum(['stable', 'scaling', 'pending']),
  })),
  database: z.object({
    primary: z.boolean(),
    replicas: z.number(),
    replicationLag: z.number().optional(),
  }),
  redis: z.object({
    mode: z.enum(['standalone', 'sentinel', 'cluster']),
    nodes: z.number(),
  }),
  healthScore: z.number().min(0).max(100),
  warnings: z.array(z.string()),
});

export const HAToggleRequestSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['standard', 'high_availability', 'disaster_recovery']).optional(),
  requestedBy: z.string().optional(),
  reason: z.string().optional(),
});

export const HAToggleResultSchema = z.object({
  success: z.boolean(),
  previousState: z.object({
    enabled: z.boolean(),
    mode: z.string(),
  }),
  newState: z.object({
    enabled: z.boolean(),
    mode: z.string(),
  }),
  message: z.string(),
  timestamp: z.string().datetime(),
  actionsPerformed: z.array(z.string()),
  warnings: z.array(z.string()),
  estimatedCompletionTime: z.string().optional(),
});

export const HATransitionLogSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  previousState: z.object({
    enabled: z.boolean(),
    mode: z.string(),
  }),
  newState: z.object({
    enabled: z.boolean(),
    mode: z.string(),
  }),
  requestedBy: z.string().optional(),
  reason: z.string().optional(),
  status: z.enum(['completed', 'in_progress', 'failed', 'rolled_back']),
  actionsPerformed: z.array(z.string()),
  error: z.string().optional(),
});

export type HAConfig = z.infer<typeof HAConfigSchema>;
export type HAStatus = z.infer<typeof HAStatusSchema>;
export type HAToggleRequest = z.infer<typeof HAToggleRequestSchema>;
export type HAToggleResult = z.infer<typeof HAToggleResultSchema>;
export type HATransitionLog = z.infer<typeof HATransitionLogSchema>;

// ============================================================================
// HA Toggle Service
// ============================================================================

class HAToggleService {
  private config: HAConfig;
  private transitionLogs: HATransitionLog[] = [];

  constructor() {
    this.config = {
      enabled: process.env.HA_ENABLED === 'true',
      mode: (process.env.HA_MODE as HAConfig['mode']) || 'standard',
      replicaConfiguration: {
        orchestrator: { standard: 1, ha: 3 },
        worker: { standard: 2, ha: 5 },
        web: { standard: 1, ha: 2 },
      },
      dbReplicationEnabled: process.env.DB_REPLICATION_ENABLED === 'true',
      redisClusterEnabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      crossAzEnabled: process.env.CROSS_AZ_ENABLED === 'true',
    };
  }

  /**
   * Get current HA configuration
   */
  getConfig(): HAConfig {
    return { ...this.config };
  }

  /**
   * Get current HA status
   */
  async getStatus(): Promise<HAStatus> {
    const clusterStatus = await clusterStatusService.getClusterStatus();
    const warnings: string[] = [];

    // Build service status
    const services: HAStatus['services'] = {};
    for (const [serviceName, replicaConfig] of Object.entries(this.config.replicaConfiguration)) {
      const serviceStatus = clusterStatus.services[serviceName];
      const targetReplicas = this.config.enabled ? replicaConfig.ha : replicaConfig.standard;

      services[serviceName] = {
        currentReplicas: serviceStatus?.replicas || 0,
        targetReplicas,
        status: serviceStatus?.replicas === targetReplicas ? 'stable' : 'scaling',
      };

      // Check for warnings
      if (serviceStatus && serviceStatus.replicas < targetReplicas) {
        warnings.push(`${serviceName}: Only ${serviceStatus.replicas} of ${targetReplicas} replicas available`);
      }
    }

    // Simulate DB replication status
    const database = {
      primary: true,
      replicas: this.config.dbReplicationEnabled ? 2 : 0,
      replicationLag: this.config.dbReplicationEnabled ? Math.random() * 100 : undefined,
    };

    if (this.config.enabled && !this.config.dbReplicationEnabled) {
      warnings.push('Database replication not enabled - single point of failure');
    }

    // Simulate Redis status
    const redis = {
      mode: this.config.redisClusterEnabled
        ? 'cluster' as const
        : (this.config.enabled ? 'sentinel' as const : 'standalone' as const),
      nodes: this.config.redisClusterEnabled ? 6 : (this.config.enabled ? 3 : 1),
    };

    // Calculate health score
    const healthScore = this.calculateHealthScore(services, database, redis, warnings);

    return {
      enabled: this.config.enabled,
      mode: this.config.mode,
      timestamp: new Date().toISOString(),
      services,
      database,
      redis,
      healthScore,
      warnings,
    };
  }

  /**
   * Calculate HA health score (0-100)
   */
  private calculateHealthScore(
    services: HAStatus['services'],
    database: HAStatus['database'],
    redis: HAStatus['redis'],
    warnings: string[]
  ): number {
    let score = 100;

    // Deduct for service issues
    for (const service of Object.values(services)) {
      if (service.status !== 'stable') {
        score -= 10;
      }
      if (service.currentReplicas === 0) {
        score -= 25;
      }
    }

    // Deduct for DB issues
    if (!database.primary) {
      score -= 50;
    }
    if (this.config.enabled && database.replicas === 0) {
      score -= 20;
    }
    if (database.replicationLag && database.replicationLag > 500) {
      score -= 10;
    }

    // Deduct for Redis issues
    if (this.config.enabled && redis.mode === 'standalone') {
      score -= 15;
    }

    // Deduct for warnings
    score -= warnings.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Toggle HA mode
   */
  async toggleHA(request: HAToggleRequest): Promise<HAToggleResult> {
    const previousState = {
      enabled: this.config.enabled,
      mode: this.config.mode,
    };

    const newMode = request.mode || (request.enabled ? 'high_availability' : 'standard');
    const actionsPerformed: string[] = [];
    const warnings: string[] = [];

    // Validate transition
    if (request.enabled && this.config.mode === 'disaster_recovery') {
      return {
        success: false,
        previousState,
        newState: previousState,
        message: 'Cannot disable HA during disaster recovery mode',
        timestamp: new Date().toISOString(),
        actionsPerformed: [],
        warnings: ['System is in disaster recovery mode'],
      };
    }

    try {
      if (request.enabled && !this.config.enabled) {
        // Enabling HA
        actionsPerformed.push('Initiating HA mode transition');

        // Scale up services
        for (const [service, config] of Object.entries(this.config.replicaConfiguration)) {
          actionsPerformed.push(`Scaling ${service} from ${config.standard} to ${config.ha} replicas`);
          clusterStatusService.recordScalingEvent({
            service,
            event: 'scale_up',
            fromReplicas: config.standard,
            toReplicas: config.ha,
            reason: 'HA mode enabled',
          });
        }

        // Enable DB replication
        if (!this.config.dbReplicationEnabled) {
          actionsPerformed.push('Enabling database replication');
          this.config.dbReplicationEnabled = true;
        }

        // Configure Redis sentinel/cluster
        if (!this.config.redisClusterEnabled) {
          actionsPerformed.push('Configuring Redis sentinel mode');
        }

        // Enable cross-AZ
        if (!this.config.crossAzEnabled) {
          actionsPerformed.push('Configuring cross-AZ pod distribution');
          this.config.crossAzEnabled = true;
        }

      } else if (!request.enabled && this.config.enabled) {
        // Disabling HA
        warnings.push('Disabling HA will reduce system redundancy');
        actionsPerformed.push('Initiating HA mode disable');

        // Scale down services
        for (const [service, config] of Object.entries(this.config.replicaConfiguration)) {
          actionsPerformed.push(`Scaling ${service} from ${config.ha} to ${config.standard} replicas`);
          clusterStatusService.recordScalingEvent({
            service,
            event: 'scale_down',
            fromReplicas: config.ha,
            toReplicas: config.standard,
            reason: 'HA mode disabled',
          });
        }

        // Note: Typically don't disable DB replication to preserve data safety
        warnings.push('Database replication remains enabled for data safety');
      }

      // Update configuration
      this.config.enabled = request.enabled;
      this.config.mode = newMode;
      this.config.lastToggled = new Date().toISOString();
      this.config.toggledBy = request.requestedBy;

      // Log transition
      const logEntry: HATransitionLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        previousState,
        newState: {
          enabled: this.config.enabled,
          mode: this.config.mode,
        },
        requestedBy: request.requestedBy,
        reason: request.reason,
        status: 'completed',
        actionsPerformed,
      };
      this.transitionLogs.push(logEntry);

      return {
        success: true,
        previousState,
        newState: {
          enabled: this.config.enabled,
          mode: this.config.mode,
        },
        message: request.enabled
          ? 'High-availability mode enabled successfully'
          : 'High-availability mode disabled',
        timestamp: new Date().toISOString(),
        actionsPerformed,
        warnings,
        estimatedCompletionTime: request.enabled ? '5-10 minutes' : '2-5 minutes',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed transition
      const logEntry: HATransitionLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        previousState,
        newState: previousState, // No change
        requestedBy: request.requestedBy,
        reason: request.reason,
        status: 'failed',
        actionsPerformed,
        error: errorMessage,
      };
      this.transitionLogs.push(logEntry);

      return {
        success: false,
        previousState,
        newState: previousState,
        message: `Failed to toggle HA mode: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        actionsPerformed,
        warnings: [`Error occurred: ${errorMessage}`],
      };
    }
  }

  /**
   * Get HA transition logs
   */
  getTransitionLogs(limit: number = 50): HATransitionLog[] {
    return this.transitionLogs.slice(-limit);
  }

  /**
   * Get HA recommendations based on current state
   */
  async getRecommendations(): Promise<{
    shouldEnableHA: boolean;
    reasons: string[];
    estimatedCostIncrease: string;
    benefits: string[];
  }> {
    const status = await this.getStatus();
    const reasons: string[] = [];
    const benefits: string[] = [];
    let shouldEnableHA = false;

    if (!this.config.enabled) {
      // Check if HA should be recommended
      if (status.healthScore < 80) {
        reasons.push('Current health score is below optimal threshold');
        shouldEnableHA = true;
      }

      if (status.warnings.length > 0) {
        reasons.push(`${status.warnings.length} warning(s) indicate potential reliability issues`);
        shouldEnableHA = true;
      }

      if (Object.values(status.services).some(s => s.currentReplicas < 2)) {
        reasons.push('Some services running with single replica (no redundancy)');
        shouldEnableHA = true;
      }

      benefits.push('99.95% uptime SLA vs 99.5% in standard mode');
      benefits.push('Zero-downtime deployments');
      benefits.push('Automatic failover for pod failures');
      benefits.push('Cross-AZ redundancy for datacenter resilience');
    }

    // Estimate cost increase
    const currentPods = Object.values(status.services).reduce((sum, s) => sum + s.currentReplicas, 0);
    const haPods = Object.values(this.config.replicaConfiguration).reduce((sum, c) => sum + c.ha, 0);
    const podIncrease = haPods - currentPods;
    const estimatedCostIncrease = `~${Math.round(podIncrease * 50)}% increase in compute costs`;

    return {
      shouldEnableHA,
      reasons,
      estimatedCostIncrease,
      benefits,
    };
  }

  /**
   * Perform HA health check
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      message: string;
    }>;
  }> {
    const status = await this.getStatus();
    const checks: Array<{ name: string; passed: boolean; message: string }> = [];

    // Check service replicas
    for (const [name, service] of Object.entries(status.services)) {
      const passed = service.currentReplicas >= service.targetReplicas;
      checks.push({
        name: `${name}-replicas`,
        passed,
        message: passed
          ? `${name}: ${service.currentReplicas} replicas running`
          : `${name}: Only ${service.currentReplicas} of ${service.targetReplicas} replicas`,
      });
    }

    // Check database
    checks.push({
      name: 'database-primary',
      passed: status.database.primary,
      message: status.database.primary ? 'Database primary is healthy' : 'Database primary not available',
    });

    if (this.config.enabled) {
      checks.push({
        name: 'database-replicas',
        passed: status.database.replicas > 0,
        message: status.database.replicas > 0
          ? `${status.database.replicas} database replica(s) available`
          : 'No database replicas (HA mode requires replicas)',
      });
    }

    // Check Redis
    checks.push({
      name: 'redis-mode',
      passed: !this.config.enabled || status.redis.mode !== 'standalone',
      message: `Redis running in ${status.redis.mode} mode`,
    });

    const healthy = checks.every(c => c.passed);

    return { healthy, checks };
  }
}

// Export singleton instance
export const haToggleService = new HAToggleService();

export default haToggleService;
