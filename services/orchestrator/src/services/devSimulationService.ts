/**
 * Dev Simulation Service
 *
 * Phase G - Task 121: Failover Simulation in Dev Mode
 *
 * Provides failover simulation capabilities for testing:
 * - Simulate service failures
 * - Test recovery procedures
 * - Validate failover configurations
 * - Record simulation results for analysis
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Schemas
// ============================================================================

export const SimulationTypeSchema = z.enum([
  'service_failure',
  'database_failover',
  'cache_failure',
  'network_partition',
  'pod_eviction',
  'node_failure',
  'load_spike',
  'memory_pressure',
  'cpu_throttle',
]);

export const SimulationConfigSchema = z.object({
  type: SimulationTypeSchema,
  target: z.string(),
  duration: z.number().min(1).max(300).default(30),
  intensity: z.enum(['low', 'medium', 'high']).default('medium'),
  parameters: z.record(z.string(), z.unknown()).optional(),
  autoRecover: z.boolean().default(true),
  description: z.string().optional(),
});

export const SimulationResultSchema = z.object({
  id: z.string().uuid(),
  config: SimulationConfigSchema,
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  metrics: z.object({
    impactedRequests: z.number(),
    failedRequests: z.number(),
    recoveryTimeMs: z.number().optional(),
    affectedServices: z.array(z.string()),
  }).optional(),
  events: z.array(z.object({
    timestamp: z.string().datetime(),
    event: z.string(),
    details: z.string().optional(),
  })),
  error: z.string().optional(),
});

export const FailoverScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  simulations: z.array(SimulationConfigSchema),
  expectedBehavior: z.string(),
  validationChecks: z.array(z.object({
    name: z.string(),
    check: z.string(),
    expectedResult: z.string(),
  })),
});

export type SimulationType = z.infer<typeof SimulationTypeSchema>;
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
export type SimulationResult = z.infer<typeof SimulationResultSchema>;
export type FailoverScenario = z.infer<typeof FailoverScenarioSchema>;

// ============================================================================
// Dev Simulation Service
// ============================================================================

class DevSimulationService extends EventEmitter {
  private isDevMode: boolean;
  private activeSimulations: Map<string, SimulationResult> = new Map();
  private simulationHistory: SimulationResult[] = [];
  private scenarios: Map<string, FailoverScenario> = new Map();

  constructor() {
    super();
    this.isDevMode = process.env.NODE_ENV !== 'production';
    this.initializeScenarios();
  }

  /**
   * Initialize built-in failover scenarios
   */
  private initializeScenarios(): void {
    const builtInScenarios: FailoverScenario[] = [
      {
        id: 'primary-db-failover',
        name: 'Primary Database Failover',
        description: 'Simulates primary database failure and failover to replica',
        simulations: [
          {
            type: 'database_failover',
            target: 'postgres-primary',
            duration: 60,
            intensity: 'high',
            autoRecover: true,
          },
        ],
        expectedBehavior: 'System should failover to replica within 30 seconds',
        validationChecks: [
          {
            name: 'read-availability',
            check: 'SELECT 1',
            expectedResult: 'Query succeeds on replica',
          },
          {
            name: 'write-failover',
            check: 'INSERT test record',
            expectedResult: 'Writes redirected to new primary',
          },
        ],
      },
      {
        id: 'redis-cache-failure',
        name: 'Redis Cache Failure',
        description: 'Simulates Redis cache unavailability',
        simulations: [
          {
            type: 'cache_failure',
            target: 'redis-master',
            duration: 30,
            intensity: 'high',
            autoRecover: true,
          },
        ],
        expectedBehavior: 'System should degrade gracefully with increased latency',
        validationChecks: [
          {
            name: 'fallback-to-db',
            check: 'Cache miss handling',
            expectedResult: 'Requests served from database',
          },
          {
            name: 'no-data-loss',
            check: 'Data integrity check',
            expectedResult: 'All data accessible',
          },
        ],
      },
      {
        id: 'worker-pod-eviction',
        name: 'Worker Pod Eviction',
        description: 'Simulates worker pods being evicted due to resource pressure',
        simulations: [
          {
            type: 'pod_eviction',
            target: 'worker',
            duration: 45,
            intensity: 'medium',
            parameters: { podsToEvict: 2 },
            autoRecover: true,
          },
        ],
        expectedBehavior: 'Jobs should be rescheduled to remaining workers',
        validationChecks: [
          {
            name: 'job-continuity',
            check: 'Active job status',
            expectedResult: 'Jobs continue on remaining workers',
          },
          {
            name: 'auto-scaling',
            check: 'HPA trigger',
            expectedResult: 'New pods scheduled within 2 minutes',
          },
        ],
      },
      {
        id: 'network-partition',
        name: 'Network Partition Simulation',
        description: 'Simulates network partition between services',
        simulations: [
          {
            type: 'network_partition',
            target: 'orchestrator-to-worker',
            duration: 30,
            intensity: 'high',
            autoRecover: true,
          },
        ],
        expectedBehavior: 'Circuit breaker should activate, requests should queue',
        validationChecks: [
          {
            name: 'circuit-breaker',
            check: 'Circuit state',
            expectedResult: 'Circuit opens after threshold',
          },
          {
            name: 'queue-persistence',
            check: 'Message queue',
            expectedResult: 'Messages preserved in queue',
          },
        ],
      },
      {
        id: 'load-spike',
        name: 'Load Spike Test',
        description: 'Simulates sudden increase in traffic',
        simulations: [
          {
            type: 'load_spike',
            target: 'web',
            duration: 60,
            intensity: 'high',
            parameters: { multiplier: 5 },
            autoRecover: true,
          },
        ],
        expectedBehavior: 'Auto-scaler should respond, no request drops',
        validationChecks: [
          {
            name: 'scaling-response',
            check: 'Pod count',
            expectedResult: 'Pods scale up within 2 minutes',
          },
          {
            name: 'request-handling',
            check: 'Error rate',
            expectedResult: 'Error rate stays below 1%',
          },
        ],
      },
    ];

    for (const scenario of builtInScenarios) {
      this.scenarios.set(scenario.id, scenario);
    }
  }

  /**
   * Check if simulation is allowed
   */
  isSimulationAllowed(): boolean {
    return this.isDevMode;
  }

  /**
   * Start a simulation
   */
  async startSimulation(config: SimulationConfig): Promise<SimulationResult> {
    if (!this.isDevMode) {
      throw new Error('Simulations are only allowed in development mode');
    }

    const id = crypto.randomUUID();
    const result: SimulationResult = {
      id,
      config,
      status: 'pending',
      startTime: new Date().toISOString(),
      events: [
        {
          timestamp: new Date().toISOString(),
          event: 'simulation_created',
          details: `Simulation ${config.type} targeting ${config.target}`,
        },
      ],
    };

    this.activeSimulations.set(id, result);
    this.emit('simulation:created', result);

    // Start simulation asynchronously
    this.runSimulation(result);

    return result;
  }

  /**
   * Run the simulation
   */
  private async runSimulation(result: SimulationResult): Promise<void> {
    try {
      result.status = 'running';
      result.events.push({
        timestamp: new Date().toISOString(),
        event: 'simulation_started',
      });
      this.emit('simulation:started', result);

      // Simulate the failure based on type
      await this.simulateFailure(result);

      // Wait for duration
      await this.waitWithProgress(result);

      // Auto-recover if configured
      if (result.config.autoRecover) {
        await this.simulateRecovery(result);
      }

      result.status = 'completed';
      result.endTime = new Date().toISOString();
      result.events.push({
        timestamp: new Date().toISOString(),
        event: 'simulation_completed',
      });

      // Calculate metrics
      result.metrics = this.calculateSimulationMetrics(result);

      this.emit('simulation:completed', result);
    } catch (error) {
      result.status = 'failed';
      result.endTime = new Date().toISOString();
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.events.push({
        timestamp: new Date().toISOString(),
        event: 'simulation_failed',
        details: result.error,
      });
      this.emit('simulation:failed', result);
    } finally {
      // Move to history
      this.simulationHistory.push({ ...result });
      this.activeSimulations.delete(result.id);
    }
  }

  /**
   * Simulate the failure
   */
  private async simulateFailure(result: SimulationResult): Promise<void> {
    const { type, target, intensity } = result.config;

    result.events.push({
      timestamp: new Date().toISOString(),
      event: 'injecting_failure',
      details: `Type: ${type}, Target: ${target}, Intensity: ${intensity}`,
    });

    // In a real implementation, this would interact with the actual system
    // For dev mode, we simulate the effects
    switch (type) {
      case 'service_failure':
        console.log(`[DevSimulation] Simulating service failure: ${target}`);
        break;
      case 'database_failover':
        console.log(`[DevSimulation] Simulating database failover: ${target}`);
        break;
      case 'cache_failure':
        console.log(`[DevSimulation] Simulating cache failure: ${target}`);
        break;
      case 'network_partition':
        console.log(`[DevSimulation] Simulating network partition: ${target}`);
        break;
      case 'pod_eviction':
        console.log(`[DevSimulation] Simulating pod eviction: ${target}`);
        break;
      case 'node_failure':
        console.log(`[DevSimulation] Simulating node failure: ${target}`);
        break;
      case 'load_spike':
        console.log(`[DevSimulation] Simulating load spike: ${target}`);
        break;
      case 'memory_pressure':
        console.log(`[DevSimulation] Simulating memory pressure: ${target}`);
        break;
      case 'cpu_throttle':
        console.log(`[DevSimulation] Simulating CPU throttle: ${target}`);
        break;
    }

    // Simulate injection delay based on intensity
    const delayMs = intensity === 'high' ? 100 : intensity === 'medium' ? 500 : 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));

    result.events.push({
      timestamp: new Date().toISOString(),
      event: 'failure_injected',
    });
  }

  /**
   * Wait for simulation duration with progress updates
   */
  private async waitWithProgress(result: SimulationResult): Promise<void> {
    const duration = result.config.duration;
    const intervalMs = 5000; // Update every 5 seconds
    const totalIntervals = Math.ceil((duration * 1000) / intervalMs);

    for (let i = 0; i < totalIntervals; i++) {
      if (result.status === 'cancelled') {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, (duration * 1000) - (i * intervalMs))));

      const elapsed = Math.min((i + 1) * intervalMs / 1000, duration);
      const progress = Math.round((elapsed / duration) * 100);

      this.emit('simulation:progress', {
        id: result.id,
        progress,
        elapsed,
        remaining: duration - elapsed,
      });
    }
  }

  /**
   * Simulate recovery
   */
  private async simulateRecovery(result: SimulationResult): Promise<void> {
    result.events.push({
      timestamp: new Date().toISOString(),
      event: 'recovery_started',
    });

    // Simulate recovery time based on type
    const recoveryTimes: Record<SimulationType, number> = {
      service_failure: 5000,
      database_failover: 15000,
      cache_failure: 3000,
      network_partition: 2000,
      pod_eviction: 10000,
      node_failure: 30000,
      load_spike: 5000,
      memory_pressure: 8000,
      cpu_throttle: 3000,
    };

    const recoveryTime = recoveryTimes[result.config.type] || 5000;
    await new Promise(resolve => setTimeout(resolve, Math.min(recoveryTime, 5000))); // Cap at 5s for dev

    result.events.push({
      timestamp: new Date().toISOString(),
      event: 'recovery_completed',
      details: `System recovered after ${recoveryTime}ms`,
    });
  }

  /**
   * Calculate simulation metrics
   */
  private calculateSimulationMetrics(result: SimulationResult): SimulationResult['metrics'] {
    const duration = result.endTime
      ? new Date(result.endTime).getTime() - new Date(result.startTime).getTime()
      : result.config.duration * 1000;

    // Simulated metrics based on intensity
    const intensityMultiplier = result.config.intensity === 'high' ? 3 : result.config.intensity === 'medium' ? 2 : 1;
    const baseRequests = Math.round(duration / 100);

    return {
      impactedRequests: baseRequests * intensityMultiplier,
      failedRequests: Math.round(baseRequests * intensityMultiplier * 0.1),
      recoveryTimeMs: result.config.autoRecover ? Math.round(Math.random() * 5000 + 2000) : undefined,
      affectedServices: this.getAffectedServices(result.config),
    };
  }

  /**
   * Get services affected by the simulation
   */
  private getAffectedServices(config: SimulationConfig): string[] {
    const affectedMap: Record<SimulationType, string[]> = {
      service_failure: [config.target],
      database_failover: ['postgres', 'orchestrator', 'worker'],
      cache_failure: ['redis', 'web', 'orchestrator'],
      network_partition: config.target.split('-to-'),
      pod_eviction: [config.target],
      node_failure: ['all'],
      load_spike: [config.target, 'orchestrator'],
      memory_pressure: [config.target],
      cpu_throttle: [config.target],
    };

    return affectedMap[config.type] || [config.target];
  }

  /**
   * Cancel an active simulation
   */
  async cancelSimulation(id: string): Promise<boolean> {
    const simulation = this.activeSimulations.get(id);
    if (!simulation) {
      return false;
    }

    simulation.status = 'cancelled';
    simulation.endTime = new Date().toISOString();
    simulation.events.push({
      timestamp: new Date().toISOString(),
      event: 'simulation_cancelled',
    });

    this.emit('simulation:cancelled', simulation);
    return true;
  }

  /**
   * Get active simulations
   */
  getActiveSimulations(): SimulationResult[] {
    return Array.from(this.activeSimulations.values());
  }

  /**
   * Get simulation history
   */
  getSimulationHistory(limit: number = 50): SimulationResult[] {
    return this.simulationHistory.slice(-limit);
  }

  /**
   * Get a specific simulation by ID
   */
  getSimulation(id: string): SimulationResult | undefined {
    return this.activeSimulations.get(id) || this.simulationHistory.find(s => s.id === id);
  }

  /**
   * Get available scenarios
   */
  getScenarios(): FailoverScenario[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Get a specific scenario
   */
  getScenario(id: string): FailoverScenario | undefined {
    return this.scenarios.get(id);
  }

  /**
   * Run a predefined scenario
   */
  async runScenario(scenarioId: string): Promise<SimulationResult[]> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const results: SimulationResult[] = [];

    for (const config of scenario.simulations) {
      const result = await this.startSimulation({
        ...config,
        description: `Part of scenario: ${scenario.name}`,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Add a custom scenario
   */
  addScenario(scenario: FailoverScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  /**
   * Get simulation statistics
   */
  getStats(): {
    totalSimulations: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    avgDurationMs: number;
    avgRecoveryTimeMs: number;
  } {
    const allSimulations = [...this.simulationHistory];
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    let totalRecoveryTime = 0;
    let recoveryCount = 0;

    for (const sim of allSimulations) {
      byType[sim.config.type] = (byType[sim.config.type] || 0) + 1;
      byStatus[sim.status] = (byStatus[sim.status] || 0) + 1;

      if (sim.endTime) {
        totalDuration += new Date(sim.endTime).getTime() - new Date(sim.startTime).getTime();
      }

      if (sim.metrics?.recoveryTimeMs) {
        totalRecoveryTime += sim.metrics.recoveryTimeMs;
        recoveryCount++;
      }
    }

    return {
      totalSimulations: allSimulations.length,
      byType,
      byStatus,
      avgDurationMs: allSimulations.length > 0 ? totalDuration / allSimulations.length : 0,
      avgRecoveryTimeMs: recoveryCount > 0 ? totalRecoveryTime / recoveryCount : 0,
    };
  }
}

// Export singleton instance
export const devSimulationService = new DevSimulationService();

export default devSimulationService;
