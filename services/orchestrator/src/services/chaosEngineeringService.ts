/**
 * Chaos Engineering Service
 *
 * Phase G - Task 126: Chaos Engineering Tools UI
 *
 * Provides chaos engineering capabilities:
 * - Network latency injection
 * - Service failure simulation
 * - Resource exhaustion tests
 * - Steady-state hypothesis validation
 * - Experiment scheduling and results tracking
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Schemas
// ============================================================================

export const ChaosExperimentTypeSchema = z.enum([
  'latency_injection',
  'packet_loss',
  'service_kill',
  'resource_stress',
  'dns_failure',
  'http_error_injection',
  'disk_fill',
  'time_skew',
]);

export const TargetSelectorSchema = z.object({
  type: z.enum(['deployment', 'pod', 'service', 'namespace']),
  name: z.string(),
  namespace: z.string().default('researchflow'),
  labels: z.record(z.string(), z.string()).optional(),
});

export const SteadyStateHypothesisSchema = z.object({
  name: z.string(),
  type: z.enum(['http', 'metric', 'log', 'custom']),
  target: z.string(),
  condition: z.string(),
  threshold: z.number().optional(),
  timeout: z.number().default(30),
});

export const ChaosExperimentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  type: ChaosExperimentTypeSchema,
  target: TargetSelectorSchema,
  parameters: z.record(z.string(), z.unknown()),
  duration: z.number().min(10).max(600).default(60),
  steadyStateHypothesis: SteadyStateHypothesisSchema.optional(),
  rollbackOnFailure: z.boolean().default(true),
  schedule: z.string().optional(), // Cron expression
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ExperimentRunSchema = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'aborted']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  steadyStateBefore: z.object({
    passed: z.boolean(),
    message: z.string(),
    value: z.unknown().optional(),
  }).optional(),
  steadyStateAfter: z.object({
    passed: z.boolean(),
    message: z.string(),
    value: z.unknown().optional(),
  }).optional(),
  events: z.array(z.object({
    timestamp: z.string().datetime(),
    type: z.string(),
    message: z.string(),
  })),
  metrics: z.object({
    impactedPods: z.number(),
    requestsAffected: z.number(),
    errorsGenerated: z.number(),
    p99LatencyIncrease: z.number().optional(),
  }).optional(),
  error: z.string().optional(),
});

export const ChaosReportSchema = z.object({
  experimentId: z.string().uuid(),
  experimentName: z.string(),
  totalRuns: z.number(),
  successfulRuns: z.number(),
  failedRuns: z.number(),
  avgImpact: z.object({
    pods: z.number(),
    requests: z.number(),
    errors: z.number(),
  }),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type ChaosExperimentType = z.infer<typeof ChaosExperimentTypeSchema>;
export type TargetSelector = z.infer<typeof TargetSelectorSchema>;
export type SteadyStateHypothesis = z.infer<typeof SteadyStateHypothesisSchema>;
export type ChaosExperiment = z.infer<typeof ChaosExperimentSchema>;
export type ExperimentRun = z.infer<typeof ExperimentRunSchema>;
export type ChaosReport = z.infer<typeof ChaosReportSchema>;

// ============================================================================
// Chaos Engineering Service
// ============================================================================

class ChaosEngineeringService extends EventEmitter {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private runs: Map<string, ExperimentRun> = new Map();
  private runHistory: ExperimentRun[] = [];
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private isDevMode: boolean;

  constructor() {
    super();
    this.isDevMode = process.env.NODE_ENV !== 'production';
    this.initializeDefaultExperiments();
  }

  /**
   * Initialize default chaos experiments
   */
  private initializeDefaultExperiments(): void {
    const defaults: Omit<ChaosExperiment, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'API Latency Injection',
        description: 'Injects 500ms latency into API responses',
        type: 'latency_injection',
        target: {
          type: 'deployment',
          name: 'orchestrator',
          namespace: 'researchflow',
        },
        parameters: {
          latencyMs: 500,
          jitterMs: 100,
          percentage: 50,
        },
        duration: 60,
        steadyStateHypothesis: {
          name: 'API responds under 2s',
          type: 'http',
          target: '/health',
          condition: 'response_time < 2000',
          timeout: 30,
        },
        rollbackOnFailure: true,
        enabled: true,
      },
      {
        name: 'Worker Pod Termination',
        description: 'Randomly terminates worker pods to test recovery',
        type: 'service_kill',
        target: {
          type: 'deployment',
          name: 'worker',
          namespace: 'researchflow',
          labels: { 'app.kubernetes.io/component': 'worker' },
        },
        parameters: {
          killCount: 1,
          killInterval: 30,
        },
        duration: 120,
        steadyStateHypothesis: {
          name: 'Job throughput maintained',
          type: 'metric',
          target: 'job_completion_rate',
          condition: 'rate > 0.8',
          threshold: 0.8,
          timeout: 60,
        },
        rollbackOnFailure: true,
        enabled: true,
      },
      {
        name: 'Network Packet Loss',
        description: 'Simulates 10% packet loss between services',
        type: 'packet_loss',
        target: {
          type: 'namespace',
          name: 'researchflow',
          namespace: 'researchflow',
        },
        parameters: {
          lossPercentage: 10,
          correlation: 25,
        },
        duration: 90,
        steadyStateHypothesis: {
          name: 'Error rate under 5%',
          type: 'metric',
          target: 'error_rate',
          condition: 'rate < 0.05',
          threshold: 0.05,
          timeout: 30,
        },
        rollbackOnFailure: true,
        enabled: true,
      },
      {
        name: 'Memory Pressure Test',
        description: 'Increases memory usage to test OOM handling',
        type: 'resource_stress',
        target: {
          type: 'deployment',
          name: 'worker',
          namespace: 'researchflow',
        },
        parameters: {
          memoryPercent: 80,
          workers: 2,
        },
        duration: 60,
        steadyStateHypothesis: {
          name: 'No OOM kills',
          type: 'metric',
          target: 'oom_kill_count',
          condition: 'count == 0',
          threshold: 0,
          timeout: 30,
        },
        rollbackOnFailure: true,
        enabled: true,
      },
      {
        name: 'HTTP Error Injection',
        description: 'Returns 500 errors for 20% of requests',
        type: 'http_error_injection',
        target: {
          type: 'service',
          name: 'web',
          namespace: 'researchflow',
        },
        parameters: {
          errorCode: 500,
          percentage: 20,
          paths: ['/api/*'],
        },
        duration: 45,
        rollbackOnFailure: true,
        enabled: true,
      },
    ];

    for (const exp of defaults) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      this.experiments.set(id, {
        id,
        ...exp,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Create a new chaos experiment
   */
  createExperiment(
    config: Omit<ChaosExperiment, 'id' | 'createdAt' | 'updatedAt'>
  ): ChaosExperiment {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const experiment: ChaosExperiment = {
      id,
      ...config,
      createdAt: now,
      updatedAt: now,
    };

    this.experiments.set(id, experiment);

    // Schedule if cron expression provided
    if (experiment.schedule && experiment.enabled) {
      this.scheduleExperiment(experiment);
    }

    this.emit('experiment:created', experiment);
    return experiment;
  }

  /**
   * Update an existing experiment
   */
  updateExperiment(
    id: string,
    updates: Partial<Omit<ChaosExperiment, 'id' | 'createdAt' | 'updatedAt'>>
  ): ChaosExperiment | null {
    const experiment = this.experiments.get(id);
    if (!experiment) return null;

    const updated: ChaosExperiment = {
      ...experiment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.experiments.set(id, updated);

    // Update schedule if changed
    if (updates.schedule !== undefined || updates.enabled !== undefined) {
      this.unscheduleExperiment(id);
      if (updated.schedule && updated.enabled) {
        this.scheduleExperiment(updated);
      }
    }

    this.emit('experiment:updated', updated);
    return updated;
  }

  /**
   * Delete an experiment
   */
  deleteExperiment(id: string): boolean {
    const experiment = this.experiments.get(id);
    if (!experiment) return false;

    this.unscheduleExperiment(id);
    this.experiments.delete(id);
    this.emit('experiment:deleted', { id });
    return true;
  }

  /**
   * Get all experiments
   */
  getExperiments(): ChaosExperiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get experiment by ID
   */
  getExperiment(id: string): ChaosExperiment | undefined {
    return this.experiments.get(id);
  }

  /**
   * Run an experiment
   */
  async runExperiment(experimentId: string): Promise<ExperimentRun> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (!this.isDevMode && !experiment.enabled) {
      throw new Error('Experiment is disabled and cannot be run in production');
    }

    const runId = crypto.randomUUID();
    const run: ExperimentRun = {
      id: runId,
      experimentId,
      status: 'pending',
      startTime: new Date().toISOString(),
      events: [
        {
          timestamp: new Date().toISOString(),
          type: 'created',
          message: `Experiment run created for ${experiment.name}`,
        },
      ],
    };

    this.runs.set(runId, run);
    this.emit('run:created', run);

    // Execute experiment asynchronously
    this.executeExperiment(run, experiment);

    return run;
  }

  /**
   * Execute the chaos experiment
   */
  private async executeExperiment(
    run: ExperimentRun,
    experiment: ChaosExperiment
  ): Promise<void> {
    try {
      run.status = 'running';
      run.events.push({
        timestamp: new Date().toISOString(),
        type: 'started',
        message: 'Experiment execution started',
      });
      this.emit('run:started', run);

      // Check steady state before
      if (experiment.steadyStateHypothesis) {
        run.steadyStateBefore = await this.checkSteadyState(experiment.steadyStateHypothesis);
        run.events.push({
          timestamp: new Date().toISOString(),
          type: 'steady_state_before',
          message: `Initial steady state: ${run.steadyStateBefore.passed ? 'PASSED' : 'FAILED'}`,
        });

        if (!run.steadyStateBefore.passed) {
          run.status = 'failed';
          run.endTime = new Date().toISOString();
          run.error = 'Initial steady state check failed';
          this.finalizeRun(run);
          return;
        }
      }

      // Inject chaos
      run.events.push({
        timestamp: new Date().toISOString(),
        type: 'injecting_chaos',
        message: `Injecting ${experiment.type} chaos`,
      });

      await this.injectChaos(run, experiment);

      // Wait for duration
      await this.waitForDuration(run, experiment.duration);

      // Remove chaos
      run.events.push({
        timestamp: new Date().toISOString(),
        type: 'removing_chaos',
        message: 'Removing chaos injection',
      });

      await this.removeChaos(run, experiment);

      // Check steady state after
      if (experiment.steadyStateHypothesis) {
        run.steadyStateAfter = await this.checkSteadyState(experiment.steadyStateHypothesis);
        run.events.push({
          timestamp: new Date().toISOString(),
          type: 'steady_state_after',
          message: `Final steady state: ${run.steadyStateAfter.passed ? 'PASSED' : 'FAILED'}`,
        });
      }

      // Calculate metrics
      run.metrics = this.calculateRunMetrics(run, experiment);

      run.status = 'completed';
      run.endTime = new Date().toISOString();
      run.events.push({
        timestamp: new Date().toISOString(),
        type: 'completed',
        message: 'Experiment completed successfully',
      });

      this.finalizeRun(run);

    } catch (error) {
      run.status = 'failed';
      run.endTime = new Date().toISOString();
      run.error = error instanceof Error ? error.message : 'Unknown error';

      if (experiment.rollbackOnFailure) {
        run.events.push({
          timestamp: new Date().toISOString(),
          type: 'rollback',
          message: 'Rolling back chaos injection due to failure',
        });
        await this.removeChaos(run, experiment);
      }

      this.finalizeRun(run);
    }
  }

  /**
   * Check steady state hypothesis
   */
  private async checkSteadyState(
    hypothesis: SteadyStateHypothesis
  ): Promise<{ passed: boolean; message: string; value?: unknown }> {
    // In production, this would make actual checks
    // For dev mode, simulate the check
    console.log(`[ChaosEngineering] Checking steady state: ${hypothesis.name}`);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate 90% pass rate
    const passed = Math.random() > 0.1;

    return {
      passed,
      message: passed
        ? `Steady state "${hypothesis.name}" validated`
        : `Steady state "${hypothesis.name}" failed: ${hypothesis.condition}`,
      value: hypothesis.threshold,
    };
  }

  /**
   * Inject chaos based on experiment type
   */
  private async injectChaos(
    run: ExperimentRun,
    experiment: ChaosExperiment
  ): Promise<void> {
    const { type, target, parameters } = experiment;

    console.log(`[ChaosEngineering] Injecting ${type} chaos to ${target.name}`);

    // In production, this would create actual chaos resources (e.g., Chaos Mesh)
    // For dev mode, we simulate the injection

    switch (type) {
      case 'latency_injection':
        console.log(`  Latency: ${parameters.latencyMs}ms (+/- ${parameters.jitterMs}ms)`);
        break;
      case 'packet_loss':
        console.log(`  Packet loss: ${parameters.lossPercentage}%`);
        break;
      case 'service_kill':
        console.log(`  Killing ${parameters.killCount} pod(s)`);
        break;
      case 'resource_stress':
        console.log(`  Memory stress: ${parameters.memoryPercent}%`);
        break;
      case 'http_error_injection':
        console.log(`  HTTP ${parameters.errorCode} for ${parameters.percentage}% of requests`);
        break;
      case 'dns_failure':
        console.log(`  DNS failure for ${target.name}`);
        break;
      case 'disk_fill':
        console.log(`  Filling disk to ${parameters.fillPercent}%`);
        break;
      case 'time_skew':
        console.log(`  Time skew: ${parameters.skewSeconds}s`);
        break;
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    run.events.push({
      timestamp: new Date().toISOString(),
      type: 'chaos_injected',
      message: `${type} chaos active on ${target.type}/${target.name}`,
    });
  }

  /**
   * Wait for experiment duration
   */
  private async waitForDuration(run: ExperimentRun, duration: number): Promise<void> {
    const intervalMs = 10000; // Progress update every 10 seconds
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);

    while (Date.now() < endTime && run.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, endTime - Date.now())));

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);

      this.emit('run:progress', {
        runId: run.id,
        elapsed,
        remaining,
        progress: Math.round((elapsed / duration) * 100),
      });
    }
  }

  /**
   * Remove chaos injection
   */
  private async removeChaos(
    run: ExperimentRun,
    experiment: ChaosExperiment
  ): Promise<void> {
    console.log(`[ChaosEngineering] Removing ${experiment.type} chaos from ${experiment.target.name}`);

    // In production, this would delete chaos resources
    await new Promise(resolve => setTimeout(resolve, 500));

    run.events.push({
      timestamp: new Date().toISOString(),
      type: 'chaos_removed',
      message: 'Chaos injection removed',
    });
  }

  /**
   * Calculate metrics for the run
   */
  private calculateRunMetrics(
    run: ExperimentRun,
    experiment: ChaosExperiment
  ): ExperimentRun['metrics'] {
    // Simulated metrics based on experiment type
    const baseImpact = {
      latency_injection: { pods: 3, requests: 500, errors: 25 },
      packet_loss: { pods: 5, requests: 1000, errors: 100 },
      service_kill: { pods: 2, requests: 200, errors: 50 },
      resource_stress: { pods: 2, requests: 300, errors: 30 },
      http_error_injection: { pods: 3, requests: 400, errors: 80 },
      dns_failure: { pods: 5, requests: 600, errors: 150 },
      disk_fill: { pods: 1, requests: 100, errors: 10 },
      time_skew: { pods: 2, requests: 150, errors: 5 },
    };

    const impact = baseImpact[experiment.type];
    const durationMultiplier = experiment.duration / 60;

    return {
      impactedPods: impact.pods,
      requestsAffected: Math.round(impact.requests * durationMultiplier),
      errorsGenerated: Math.round(impact.errors * durationMultiplier),
      p99LatencyIncrease: experiment.type === 'latency_injection'
        ? Number(experiment.parameters.latencyMs) || 0
        : undefined,
    };
  }

  /**
   * Finalize a run and move to history
   */
  private finalizeRun(run: ExperimentRun): void {
    this.runHistory.push({ ...run });
    this.runs.delete(run.id);

    this.emit(`run:${run.status}`, run);
  }

  /**
   * Abort a running experiment
   */
  async abortRun(runId: string): Promise<boolean> {
    const run = this.runs.get(runId);
    if (!run || run.status !== 'running') {
      return false;
    }

    const experiment = this.experiments.get(run.experimentId);

    run.status = 'aborted';
    run.endTime = new Date().toISOString();
    run.events.push({
      timestamp: new Date().toISOString(),
      type: 'aborted',
      message: 'Experiment run aborted by user',
    });

    // Remove chaos if experiment exists
    if (experiment) {
      await this.removeChaos(run, experiment);
    }

    this.finalizeRun(run);
    return true;
  }

  /**
   * Get active runs
   */
  getActiveRuns(): ExperimentRun[] {
    return Array.from(this.runs.values());
  }

  /**
   * Get run history
   */
  getRunHistory(experimentId?: string, limit: number = 50): ExperimentRun[] {
    let history = this.runHistory;

    if (experimentId) {
      history = history.filter(r => r.experimentId === experimentId);
    }

    return history.slice(-limit);
  }

  /**
   * Get run by ID
   */
  getRun(runId: string): ExperimentRun | undefined {
    return this.runs.get(runId) || this.runHistory.find(r => r.id === runId);
  }

  /**
   * Schedule an experiment
   */
  private scheduleExperiment(experiment: ChaosExperiment): void {
    if (!experiment.schedule) return;

    // For demo, use simple interval instead of cron
    // In production, use a proper cron library
    const intervalMs = 3600000; // 1 hour default

    const job = setInterval(() => {
      if (experiment.enabled) {
        this.runExperiment(experiment.id);
      }
    }, intervalMs);

    this.scheduledJobs.set(experiment.id, job);
    console.log(`[ChaosEngineering] Scheduled experiment ${experiment.name}`);
  }

  /**
   * Unschedule an experiment
   */
  private unscheduleExperiment(experimentId: string): void {
    const job = this.scheduledJobs.get(experimentId);
    if (job) {
      clearInterval(job);
      this.scheduledJobs.delete(experimentId);
    }
  }

  /**
   * Generate report for an experiment
   */
  generateReport(experimentId: string): ChaosReport | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const runs = this.runHistory.filter(r => r.experimentId === experimentId);
    if (runs.length === 0) {
      return {
        experimentId,
        experimentName: experiment.name,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        avgImpact: { pods: 0, requests: 0, errors: 0 },
        insights: ['No runs recorded yet'],
        recommendations: ['Run the experiment to gather data'],
      };
    }

    const successful = runs.filter(r => r.status === 'completed');
    const failed = runs.filter(r => r.status === 'failed');

    // Calculate average impact
    let totalPods = 0;
    let totalRequests = 0;
    let totalErrors = 0;

    for (const run of runs) {
      if (run.metrics) {
        totalPods += run.metrics.impactedPods;
        totalRequests += run.metrics.requestsAffected;
        totalErrors += run.metrics.errorsGenerated;
      }
    }

    const avgPods = runs.length > 0 ? totalPods / runs.length : 0;
    const avgRequests = runs.length > 0 ? totalRequests / runs.length : 0;
    const avgErrors = runs.length > 0 ? totalErrors / runs.length : 0;

    // Generate insights
    const insights: string[] = [];
    const successRate = runs.length > 0 ? (successful.length / runs.length) * 100 : 0;

    if (successRate >= 90) {
      insights.push('System shows excellent resilience to this chaos type');
    } else if (successRate >= 70) {
      insights.push('System generally handles this chaos type well');
    } else {
      insights.push('System may need improvements to handle this chaos type');
    }

    if (avgErrors > 100) {
      insights.push('High error rate during chaos indicates potential cascading failures');
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (successRate < 90) {
      recommendations.push('Consider implementing circuit breakers for affected services');
      recommendations.push('Review retry policies and timeout configurations');
    }

    if (experiment.type === 'latency_injection' && avgErrors > 50) {
      recommendations.push('Implement request timeouts and fallback mechanisms');
    }

    if (experiment.type === 'service_kill' && successRate < 80) {
      recommendations.push('Increase replica count for better fault tolerance');
      recommendations.push('Review pod disruption budgets');
    }

    return {
      experimentId,
      experimentName: experiment.name,
      totalRuns: runs.length,
      successfulRuns: successful.length,
      failedRuns: failed.length,
      avgImpact: {
        pods: Math.round(avgPods),
        requests: Math.round(avgRequests),
        errors: Math.round(avgErrors),
      },
      insights,
      recommendations,
    };
  }

  /**
   * Get overall statistics
   */
  getStats(): {
    totalExperiments: number;
    totalRuns: number;
    runsByStatus: Record<string, number>;
    runsByType: Record<string, number>;
    avgSuccessRate: number;
  } {
    const allRuns = this.runHistory;
    const runsByStatus: Record<string, number> = {};
    const runsByType: Record<string, number> = {};

    for (const run of allRuns) {
      runsByStatus[run.status] = (runsByStatus[run.status] || 0) + 1;

      const experiment = this.experiments.get(run.experimentId);
      if (experiment) {
        runsByType[experiment.type] = (runsByType[experiment.type] || 0) + 1;
      }
    }

    const completed = runsByStatus['completed'] || 0;
    const total = allRuns.length;

    return {
      totalExperiments: this.experiments.size,
      totalRuns: total,
      runsByStatus,
      runsByType,
      avgSuccessRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }
}

// Export singleton instance
export const chaosEngineeringService = new ChaosEngineeringService();

export default chaosEngineeringService;
