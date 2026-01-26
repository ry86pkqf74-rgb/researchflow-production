/**
 * Phase G Tests - Scalability, Performance, and Monitoring
 *
 * Tests for Tasks 116-135
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import all Phase G services
import { clusterStatusService } from '../services/clusterStatusService';
import { predictiveScalingService } from '../services/predictiveScalingService';
import { metricsCollectorService } from '../services/metricsCollectorService';
import { dataShardingService } from '../services/dataShardingService';
import { edgeComputingService } from '../services/edgeComputingService';
import { verticalScalingService } from '../services/verticalScalingService';
import { haToggleService } from '../services/haToggleService';
import { performanceAnalyzerService } from '../services/performanceAnalyzerService';
import { optimizationSuggestionService } from '../services/optimizationSuggestionService';
import { devSimulationService } from '../services/devSimulationService';
import { chaosEngineeringService } from '../services/chaosEngineeringService';
import { schedulerSimulatorService } from '../services/schedulerSimulatorService';
import { multiCloudService } from '../services/multiCloudService';
import { serverlessTriggerService } from '../services/serverlessTriggerService';
import { costMonitoringService } from '../services/costMonitoringService';

// ============================================================================
// Section 1: Real-Time Monitoring Dashboard (Tasks 116, 117, 118, 122, 129, 130)
// ============================================================================

describe('ClusterStatusService (Task 116, 122)', () => {
  it('should return cluster status', async () => {
    const status = await clusterStatusService.getClusterStatus();

    expect(status).toBeDefined();
    expect(status.clusterName).toBeDefined();
    expect(status.overallStatus).toMatch(/^(healthy|degraded|critical|unknown)$/);
    expect(status.services).toBeDefined();
  });

  it('should return services status', async () => {
    const services = await clusterStatusService.getServicesStatus();

    expect(services).toBeInstanceOf(Object);
    expect(Object.keys(services).length).toBeGreaterThan(0);
  });

  it('should track scaling events', () => {
    clusterStatusService.recordScalingEvent({
      service: 'test-service',
      event: 'scale_up',
      fromReplicas: 1,
      toReplicas: 3,
      reason: 'High CPU usage',
    });

    const history = clusterStatusService.getScalingHistory(10);
    expect(history.length).toBeGreaterThan(0);
  });
});

describe('PredictiveScalingService (Task 117)', () => {
  it('should predict scaling needs', async () => {
    const prediction = await predictiveScalingService.predictScaling({
      loadIncrease: 50,
      affectedServices: ['web'],
    });

    expect(prediction).toBeDefined();
    expect(prediction.scenario).toBeDefined();
    expect(prediction.predictions).toBeInstanceOf(Array);
    expect(prediction.totalAdditionalCost).toBeDefined();
  });

  it('should provide preset scenarios', () => {
    const scenarios = predictiveScalingService.getPresetScenarios();

    expect(scenarios).toBeDefined();
    expect(Object.keys(scenarios).length).toBeGreaterThan(0);
    expect(scenarios['marketing-campaign']).toBeDefined();
  });

  it('should track prediction history', () => {
    const history = predictiveScalingService.getPredictionHistory(10);
    expect(history).toBeInstanceOf(Array);
  });
});

describe('MetricsCollectorService (Tasks 118, 129, 130)', () => {
  beforeEach(() => {
    // Record some test metrics
    for (let i = 0; i < 10; i++) {
      metricsCollectorService.recordLatency(Math.random() * 200);
      metricsCollectorService.recordCacheOperation(Math.random() > 0.3);
    }
  });

  it('should provide cache statistics', () => {
    const stats = metricsCollectorService.getCacheStats();

    expect(stats).toBeDefined();
    expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    expect(stats.hitRate).toBeLessThanOrEqual(1);
    expect(stats.hits).toBeDefined();
    expect(stats.misses).toBeDefined();
  });

  it('should provide latency statistics', () => {
    const stats = metricsCollectorService.getLatencyStats(60);

    expect(stats).toBeDefined();
    expect(stats.p50Ms).toBeDefined();
    expect(stats.p95Ms).toBeDefined();
    expect(stats.p99Ms).toBeDefined();
    expect(stats.avgMs).toBeDefined();
  });

  it('should generate heatmap data', () => {
    const heatmap = metricsCollectorService.getHeatmapData('cpu', 60);

    expect(heatmap).toBeDefined();
    expect(heatmap.services).toBeInstanceOf(Array);
    expect(heatmap.timeSlots).toBeInstanceOf(Array);
  });

  it('should provide latency histogram', () => {
    const histogram = metricsCollectorService.getLatencyHistogram(60);

    expect(histogram).toBeDefined();
    expect(histogram.buckets).toBeInstanceOf(Array);
    expect(histogram.totalRequests).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Section 2: Scalability & Deployment Controls (Tasks 123, 124, 127, 135)
// ============================================================================

describe('DataShardingService (Task 123)', () => {
  it('should shard data into chunks', async () => {
    const testData = Buffer.from('A'.repeat(100000)); // 100KB
    const result = await dataShardingService.shardData(testData, 'test-artifact-123');

    expect(result.success).toBe(true);
    expect(result.artifactId).toBe('test-artifact-123');
    expect(result.totalShards).toBeGreaterThan(0);
  });

  it('should retrieve manifest for sharded artifact', async () => {
    const testData = Buffer.from('B'.repeat(50000));
    await dataShardingService.shardData(testData, 'test-artifact-456');

    const manifest = dataShardingService.getManifest('test-artifact-456');

    expect(manifest).toBeDefined();
    expect(manifest?.artifactId).toBe('test-artifact-456');
    expect(manifest?.shards).toBeInstanceOf(Array);
  });

  it('should provide storage statistics', () => {
    const stats = dataShardingService.getStorageStats();

    expect(stats).toBeDefined();
    expect(stats.totalArtifacts).toBeGreaterThanOrEqual(0);
    expect(stats.totalSizeBytes).toBeGreaterThanOrEqual(0);
  });
});

describe('EdgeComputingService (Task 124)', () => {
  it('should return edge configuration', () => {
    const config = edgeComputingService.getConfig();

    expect(config).toBeDefined();
    expect(typeof config.enabled).toBe('boolean');
    expect(config.regions).toBeInstanceOf(Array);
  });

  it('should route jobs to edge or central', () => {
    const routing = edgeComputingService.routeJob('job-123', 'analysis');

    expect(routing).toBeDefined();
    expect(routing.jobId).toBe('job-123');
    expect(routing.routedTo).toMatch(/^(edge|central)$/);
    expect(routing.reason).toBeDefined();
  });

  it('should provide routing statistics', () => {
    // Route a few jobs first
    edgeComputingService.routeJob('job-1', 'analysis');
    edgeComputingService.routeJob('job-2', 'validation');

    const stats = edgeComputingService.getRoutingStats();

    expect(stats).toBeDefined();
    expect(stats.totalRouted).toBeGreaterThanOrEqual(0);
    expect(typeof stats.edgePercentage).toBe('number');
  });
});

describe('VerticalScalingService (Task 127)', () => {
  it('should return all service resources', () => {
    const resources = verticalScalingService.getAllServiceResources();

    expect(resources).toBeInstanceOf(Array);
    expect(resources.length).toBeGreaterThan(0);
    expect(resources[0].serviceName).toBeDefined();
    expect(resources[0].currentLimits).toBeDefined();
  });

  it('should scale resources for a service', async () => {
    const result = await verticalScalingService.scaleResources({
      serviceName: 'orchestrator',
      newLimits: { cpuLimit: '2000m' },
      reason: 'Test scaling',
    });

    expect(result).toBeDefined();
    expect(result.serviceName).toBe('orchestrator');
    expect(typeof result.success).toBe('boolean');
  });

  it('should provide resource summary', () => {
    const summary = verticalScalingService.getResourceSummary();

    expect(summary).toBeDefined();
    expect(summary.totalCpuRequested).toBeDefined();
    expect(summary.totalMemoryRequested).toBeDefined();
    expect(summary.services).toBeInstanceOf(Array);
  });
});

describe('HAToggleService (Task 135)', () => {
  it('should return HA status', async () => {
    const status = await haToggleService.getStatus();

    expect(status).toBeDefined();
    expect(typeof status.enabled).toBe('boolean');
    expect(status.mode).toMatch(/^(standard|high_availability|disaster_recovery)$/);
    expect(status.services).toBeDefined();
    expect(status.healthScore).toBeGreaterThanOrEqual(0);
    expect(status.healthScore).toBeLessThanOrEqual(100);
  });

  it('should provide HA recommendations', async () => {
    const recommendations = await haToggleService.getRecommendations();

    expect(recommendations).toBeDefined();
    expect(typeof recommendations.shouldEnableHA).toBe('boolean');
    expect(recommendations.benefits).toBeInstanceOf(Array);
    expect(recommendations.estimatedCostIncrease).toBeDefined();
  });

  it('should perform health check', async () => {
    const health = await haToggleService.performHealthCheck();

    expect(health).toBeDefined();
    expect(typeof health.healthy).toBe('boolean');
    expect(health.checks).toBeInstanceOf(Array);
  });
});

// ============================================================================
// Section 3: Performance Analysis & Optimization (Tasks 125, 131)
// ============================================================================

describe('PerformanceAnalyzerService (Task 125)', () => {
  beforeEach(() => {
    // Record some test timings
    performanceAnalyzerService.recordStageTiming('data-fetch', 150);
    performanceAnalyzerService.recordStageTiming('processing', 300);
    performanceAnalyzerService.recordStageTiming('analysis', 250);
  });

  it('should analyze performance', async () => {
    const report = await performanceAnalyzerService.analyzePerformance(60);

    expect(report).toBeDefined();
    expect(report.stageTimings).toBeInstanceOf(Array);
    expect(report.bottlenecks).toBeInstanceOf(Array);
    expect(report.overallHealthScore).toBeGreaterThanOrEqual(0);
  });

  it('should identify top bottlenecks', async () => {
    const bottlenecks = await performanceAnalyzerService.getTopBottlenecks(5);

    expect(bottlenecks).toBeInstanceOf(Array);
  });

  it('should provide critical path', async () => {
    const criticalPath = await performanceAnalyzerService.getCriticalPath();

    expect(criticalPath).toBeDefined();
    expect(criticalPath.stages).toBeInstanceOf(Array);
    expect(criticalPath.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('OptimizationSuggestionService (Task 131)', () => {
  it('should generate suggestions', async () => {
    const report = await optimizationSuggestionService.getSuggestions();

    expect(report).toBeDefined();
    expect(report.suggestions).toBeInstanceOf(Array);
    expect(report.summary).toBeDefined();
    expect(report.summary.totalSuggestions).toBeGreaterThanOrEqual(0);
  });

  it('should filter actionable suggestions', async () => {
    const suggestions = await optimizationSuggestionService.getActionableSuggestions();

    expect(suggestions).toBeInstanceOf(Array);
    suggestions.forEach(s => {
      expect(s.actionable).toBe(true);
    });
  });

  it('should filter urgent suggestions', async () => {
    const suggestions = await optimizationSuggestionService.getUrgentSuggestions();

    expect(suggestions).toBeInstanceOf(Array);
    suggestions.forEach(s => {
      expect(['critical', 'high']).toContain(s.priority);
    });
  });
});

// ============================================================================
// Section 4: Resilience Testing (Tasks 119, 121, 126, 133)
// ============================================================================

describe('DevSimulationService (Task 121)', () => {
  it('should check if simulation is allowed', () => {
    const allowed = devSimulationService.isSimulationAllowed();
    expect(typeof allowed).toBe('boolean');
  });

  it('should provide predefined scenarios', () => {
    const scenarios = devSimulationService.getScenarios();

    expect(scenarios).toBeInstanceOf(Array);
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios[0].name).toBeDefined();
  });

  it('should track simulation history', () => {
    const history = devSimulationService.getSimulationHistory(10);
    expect(history).toBeInstanceOf(Array);
  });

  it('should provide simulation statistics', () => {
    const stats = devSimulationService.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalSimulations).toBeGreaterThanOrEqual(0);
    expect(stats.byType).toBeDefined();
    expect(stats.byStatus).toBeDefined();
  });
});

describe('ChaosEngineeringService (Task 126)', () => {
  it('should list chaos experiments', () => {
    const experiments = chaosEngineeringService.getExperiments();

    expect(experiments).toBeInstanceOf(Array);
    expect(experiments.length).toBeGreaterThan(0);
    expect(experiments[0].name).toBeDefined();
    expect(experiments[0].type).toBeDefined();
  });

  it('should create a new experiment', () => {
    const experiment = chaosEngineeringService.createExperiment({
      name: 'Test Latency',
      type: 'latency_injection',
      target: {
        type: 'deployment',
        name: 'test-service',
        namespace: 'default',
      },
      parameters: { latencyMs: 100 },
      duration: 30,
      rollbackOnFailure: true,
      enabled: true,
    });

    expect(experiment).toBeDefined();
    expect(experiment.id).toBeDefined();
    expect(experiment.name).toBe('Test Latency');
  });

  it('should generate experiment report', () => {
    const experiments = chaosEngineeringService.getExperiments();
    if (experiments.length > 0) {
      const report = chaosEngineeringService.generateReport(experiments[0].id);

      expect(report).toBeDefined();
      expect(report?.experimentName).toBeDefined();
      expect(report?.totalRuns).toBeGreaterThanOrEqual(0);
    }
  });

  it('should provide overall statistics', () => {
    const stats = chaosEngineeringService.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalExperiments).toBeGreaterThan(0);
    expect(stats.runsByStatus).toBeDefined();
  });
});

describe('SchedulerSimulatorService (Task 133)', () => {
  it('should provide default cluster', () => {
    const cluster = schedulerSimulatorService.getDefaultCluster();

    expect(cluster).toBeDefined();
    expect(cluster.nodes).toBeInstanceOf(Array);
    expect(cluster.nodes.length).toBeGreaterThan(0);
  });

  it('should simulate pod scheduling', () => {
    const result = schedulerSimulatorService.simulateScheduling({
      name: 'test-pod',
      namespace: 'default',
      resources: {
        requests: { cpu: 500, memory: 512 * 1024 * 1024 },
      },
    });

    expect(result).toBeDefined();
    expect(result.podName).toBe('test-pod');
    expect(typeof result.schedulable).toBe('boolean');
    expect(result.nodeScores).toBeInstanceOf(Array);
  });

  it('should simulate what-if scenarios', () => {
    const result = schedulerSimulatorService.simulateWhatIf({
      type: 'add_node',
      parameters: { name: 'new-node' },
    });

    expect(result).toBeDefined();
    expect(result.originalState).toBeDefined();
    expect(result.newState).toBeDefined();
    expect(result.impact).toBeDefined();
  });

  it('should provide cluster summary', () => {
    const summary = schedulerSimulatorService.getClusterSummary();

    expect(summary).toBeDefined();
    expect(summary.totalNodes).toBeGreaterThan(0);
    expect(summary.nodeUtilization).toBeInstanceOf(Array);
  });
});

// ============================================================================
// Section 5: Cloud Integration & Cost Monitoring (Tasks 128, 132, 134)
// ============================================================================

describe('MultiCloudService (Task 128)', () => {
  it('should return cloud configuration', () => {
    const config = multiCloudService.getConfig();

    expect(config).toBeDefined();
    expect(config.primaryProvider).toBeDefined();
    expect(config.primaryRegion).toBeDefined();
    expect(typeof config.multiCloudEnabled).toBe('boolean');
  });

  it('should list cloud regions', () => {
    const regions = multiCloudService.getRegions();

    expect(regions).toBeInstanceOf(Array);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0].provider).toBeDefined();
    expect(regions[0].location).toBeDefined();
  });

  it('should list deployment targets', () => {
    const targets = multiCloudService.getTargets();

    expect(targets).toBeInstanceOf(Array);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].name).toBeDefined();
    expect(targets[0].provider).toBeDefined();
  });

  it('should select best target for workload', () => {
    const target = multiCloudService.selectTarget({
      jobType: 'analysis',
      cpuCores: 2,
      memoryGB: 4,
    });

    expect(target).toBeDefined();
    expect(target?.name).toBeDefined();
  });

  it('should provide health status', async () => {
    const health = await multiCloudService.getHealthStatus();

    expect(health).toBeDefined();
    expect(health.overall).toMatch(/^(healthy|degraded|critical)$/);
    expect(health.providers).toBeDefined();
    expect(health.recommendations).toBeInstanceOf(Array);
  });

  it('should compare costs across providers', () => {
    const comparison = multiCloudService.getCostComparison({
      cpuCores: 4,
      memoryGB: 16,
      storageGB: 100,
    });

    expect(comparison).toBeInstanceOf(Array);
    expect(comparison.length).toBeGreaterThan(0);
    expect(comparison[0].estimatedMonthlyCost).toBeGreaterThan(0);
  });
});

describe('ServerlessTriggerService (Task 132)', () => {
  it('should list serverless functions', () => {
    const functions = serverlessTriggerService.getFunctions();

    expect(functions).toBeInstanceOf(Array);
    expect(functions.length).toBeGreaterThan(0);
    expect(functions[0].name).toBeDefined();
    expect(functions[0].trigger.type).toBeDefined();
  });

  it('should create a new function', () => {
    const func = serverlessTriggerService.createFunction({
      name: 'test-function',
      runtime: 'nodejs20',
      handler: 'index.handler',
      codeLocation: 's3://test/function.zip',
      trigger: {
        type: 'http',
        config: { method: 'POST', path: '/test', cors: true, authRequired: false },
      },
      resources: { memoryMB: 256, timeoutSeconds: 30 },
      enabled: true,
    });

    expect(func).toBeDefined();
    expect(func.id).toBeDefined();
    expect(func.name).toBe('test-function');
  });

  it('should provide function metrics', () => {
    const functions = serverlessTriggerService.getFunctions();
    if (functions.length > 0) {
      const metrics = serverlessTriggerService.getMetrics(functions[0].id, 60);

      expect(metrics).toBeDefined();
      expect(metrics?.functionName).toBeDefined();
      expect(metrics?.invocations).toBeGreaterThanOrEqual(0);
    }
  });

  it('should provide overall statistics', () => {
    const stats = serverlessTriggerService.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalFunctions).toBeGreaterThan(0);
    expect(stats.byTriggerType).toBeDefined();
    expect(stats.byRuntime).toBeDefined();
  });
});

describe('CostMonitoringService (Task 134)', () => {
  it('should provide cost summary', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const summary = costMonitoringService.getCostSummary(thirtyDaysAgo, now);

    expect(summary).toBeDefined();
    expect(summary.totalCost).toBeGreaterThanOrEqual(0);
    expect(summary.byCategory).toBeDefined();
    expect(summary.byService).toBeDefined();
    expect(summary.trend).toMatch(/^(increasing|decreasing|stable)$/);
  });

  it('should provide daily costs', () => {
    const dailyCosts = costMonitoringService.getDailyCosts(7);

    expect(dailyCosts).toBeInstanceOf(Array);
    expect(dailyCosts.length).toBe(7);
    expect(dailyCosts[0].date).toBeDefined();
    expect(dailyCosts[0].total).toBeGreaterThanOrEqual(0);
  });

  it('should provide cost forecast', () => {
    const forecast = costMonitoringService.getForecast(30);

    expect(forecast).toBeDefined();
    expect(forecast.forecastedCost).toBeGreaterThan(0);
    expect(forecast.confidenceInterval).toBeDefined();
    expect(forecast.byService).toBeDefined();
  });

  it('should manage budgets', () => {
    const budget = costMonitoringService.createBudget({
      name: 'Test Budget',
      amount: 1000,
      currency: 'USD',
      period: 'monthly',
      alertThresholds: [50, 75, 100],
    });

    expect(budget).toBeDefined();
    expect(budget.id).toBeDefined();
    expect(budget.name).toBe('Test Budget');
    expect(budget.status).toMatch(/^(on_track|warning|exceeded)$/);
  });

  it('should list budgets', () => {
    const budgets = costMonitoringService.getBudgets();

    expect(budgets).toBeInstanceOf(Array);
    expect(budgets.length).toBeGreaterThan(0);
  });

  it('should provide optimization recommendations', () => {
    const optimizations = costMonitoringService.getOptimizations();

    expect(optimizations).toBeInstanceOf(Array);
    expect(optimizations.length).toBeGreaterThan(0);
    expect(optimizations[0].title).toBeDefined();
    expect(optimizations[0].estimatedSavings).toBeGreaterThan(0);
  });

  it('should provide overall statistics', () => {
    const stats = costMonitoringService.getStats();

    expect(stats).toBeDefined();
    expect(stats.totalSpendThisMonth).toBeGreaterThanOrEqual(0);
    expect(stats.budgetUtilization).toBeGreaterThanOrEqual(0);
    expect(stats.topSpendingServices).toBeInstanceOf(Array);
  });
});
