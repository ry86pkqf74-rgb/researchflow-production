/**
 * Phase G Routes - Scalability, Performance, and Monitoring
 *
 * Tasks 116-135: Complete monitoring, scaling, and cloud integration
 *
 * SEC-003: RBAC MIDDLEWARE AUDIT
 * All endpoints require ADMIN role for infrastructure access
 */

import { Router, Request, Response } from 'express';
import { protectWithRole, auditAccess } from '../middleware/rbac';
import { requireAuth } from '../services/authService';
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

const router = Router();

// Apply authentication and audit logging to all Phase G endpoints
router.use(requireAuth, auditAccess);

// ============================================================================
// Section 1: Real-Time Monitoring Dashboard (Tasks 116, 117, 118, 122, 129, 130)
// ============================================================================

// Task 116, 122: Cluster Status & Auto-Scaling Indicators
// Read-only - requires STEWARD or ADMIN
router.get('/cluster/status', ...protectWithRole('STEWARD'), async (_req: Request, res: Response) => {
  try {
    const status = await clusterStatusService.getClusterStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/cluster/services', ...protectWithRole('STEWARD'), async (_req: Request, res: Response) => {
  try {
    const services = await clusterStatusService.getServicesStatus();
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/cluster/scaling-events', ...protectWithRole('STEWARD'), (_req: Request, res: Response) => {
  try {
    const limit = parseInt(_req.query.limit as string) || 50;
    const events = clusterStatusService.getScalingHistory(limit);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 117: Predictive Scaling
// Write operations - requires ADMIN
router.post('/scaling/predict', ...protectWithRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const prediction = await predictiveScalingService.predictScaling(req.body);
    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/scaling/scenarios', ...protectWithRole('STEWARD'), (_req: Request, res: Response) => {
  try {
    const scenarios = predictiveScalingService.getPresetScenarios();
    res.json({ success: true, data: scenarios });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/scaling/history', ...protectWithRole('STEWARD'), (_req: Request, res: Response) => {
  try {
    const limit = parseInt(_req.query.limit as string) || 20;
    const history = predictiveScalingService.getPredictionHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Tasks 118, 129, 130: Metrics, Cache, Latency
router.get('/metrics/heatmap/:type', (req: Request, res: Response) => {
  try {
    const type = req.params.type as 'cpu' | 'memory';
    const windowMinutes = parseInt(req.query.window as string) || 60;
    const data = metricsCollectorService.getHeatmapData(type, windowMinutes);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/metrics/cache', (_req: Request, res: Response) => {
  try {
    const stats = metricsCollectorService.getCacheStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/metrics/latency', (req: Request, res: Response) => {
  try {
    const windowMinutes = parseInt(req.query.window as string) || 60;
    const stats = metricsCollectorService.getLatencyStats(windowMinutes);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/metrics/latency/histogram', (req: Request, res: Response) => {
  try {
    const windowMinutes = parseInt(req.query.window as string) || 60;
    const histogram = metricsCollectorService.getLatencyHistogram(windowMinutes);
    res.json({ success: true, data: histogram });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// Section 2: Scalability & Deployment Controls (Tasks 123, 124, 127, 135)
// ============================================================================

// Task 123: Data Sharding
router.post('/sharding/upload', async (req: Request, res: Response) => {
  try {
    const { data, artifactId, options } = req.body;
    const result = await dataShardingService.shardData(
      Buffer.from(data, 'base64'),
      artifactId,
      options
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/sharding/artifacts/:artifactId', async (req: Request, res: Response) => {
  try {
    const manifest = dataShardingService.getManifest(req.params.artifactId);
    if (!manifest) {
      return res.status(404).json({ success: false, error: 'Artifact not found' });
    }
    res.json({ success: true, data: manifest });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/sharding/stats', (_req: Request, res: Response) => {
  try {
    const stats = dataShardingService.getStorageStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 124: Edge Computing
router.get('/edge/config', (_req: Request, res: Response) => {
  try {
    const config = edgeComputingService.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/edge/config', (req: Request, res: Response) => {
  try {
    const config = edgeComputingService.updateConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/edge/toggle', (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    const config = edgeComputingService.setEnabled(enabled);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/edge/regions', (_req: Request, res: Response) => {
  try {
    const regions = edgeComputingService.getRegions();
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/edge/route', (req: Request, res: Response) => {
  try {
    const { jobId, jobType, preferEdge } = req.body;
    const routing = edgeComputingService.routeJob(jobId, jobType, preferEdge);
    res.json({ success: true, data: routing });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/edge/stats', (_req: Request, res: Response) => {
  try {
    const stats = edgeComputingService.getRoutingStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 127: Vertical Scaling
router.get('/scaling/vertical/resources', (_req: Request, res: Response) => {
  try {
    const resources = verticalScalingService.getAllServiceResources();
    res.json({ success: true, data: resources });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/scaling/vertical/resources/:service', (req: Request, res: Response) => {
  try {
    const resources = verticalScalingService.getServiceResources(req.params.service);
    if (!resources) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    res.json({ success: true, data: resources });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/scaling/vertical/scale', async (req: Request, res: Response) => {
  try {
    const result = await verticalScalingService.scaleResources(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/scaling/vertical/rollback/:historyId', async (req: Request, res: Response) => {
  try {
    const result = await verticalScalingService.rollback(req.params.historyId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/scaling/vertical/summary', (_req: Request, res: Response) => {
  try {
    const summary = verticalScalingService.getResourceSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 135: HA Toggle
router.get('/cluster/ha', async (_req: Request, res: Response) => {
  try {
    const status = await haToggleService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/cluster/ha', async (req: Request, res: Response) => {
  try {
    const result = await haToggleService.toggleHA(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/cluster/ha/recommendations', async (_req: Request, res: Response) => {
  try {
    const recommendations = await haToggleService.getRecommendations();
    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/cluster/ha/health', async (_req: Request, res: Response) => {
  try {
    const health = await haToggleService.performHealthCheck();
    res.json({ success: true, data: health });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// Section 3: Performance Analysis & Optimization (Tasks 125, 131)
// ============================================================================

// Task 125: Performance Analyzer
router.get('/performance/analysis', async (req: Request, res: Response) => {
  try {
    const windowMinutes = parseInt(req.query.window as string) || 60;
    const report = await performanceAnalyzerService.analyzePerformance(windowMinutes);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/performance/bottlenecks', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 5;
    const bottlenecks = await performanceAnalyzerService.getTopBottlenecks(count);
    res.json({ success: true, data: bottlenecks });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/performance/critical-path', async (_req: Request, res: Response) => {
  try {
    const criticalPath = await performanceAnalyzerService.getCriticalPath();
    res.json({ success: true, data: criticalPath });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 131: Optimization Suggestions
router.get('/optimization/suggestions', async (_req: Request, res: Response) => {
  try {
    const report = await optimizationSuggestionService.getSuggestions();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/optimization/suggestions/actionable', async (_req: Request, res: Response) => {
  try {
    const suggestions = await optimizationSuggestionService.getActionableSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/optimization/suggestions/urgent', async (_req: Request, res: Response) => {
  try {
    const suggestions = await optimizationSuggestionService.getUrgentSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/optimization/suggestions/:id/execute', async (req: Request, res: Response) => {
  try {
    const report = await optimizationSuggestionService.getSuggestions();
    const suggestion = report.suggestions.find(s => s.id === req.params.id);
    if (!suggestion) {
      return res.status(404).json({ success: false, error: 'Suggestion not found' });
    }
    const result = await optimizationSuggestionService.executeSuggestion(suggestion);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// Section 4: Resilience Testing (Tasks 119, 121, 126, 133)
// ============================================================================

// Task 121: Dev Simulation / Failover
router.get('/simulation/allowed', (_req: Request, res: Response) => {
  try {
    const allowed = devSimulationService.isSimulationAllowed();
    res.json({ success: true, data: { allowed } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/simulation/start', async (req: Request, res: Response) => {
  try {
    const result = await devSimulationService.startSimulation(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/simulation/:id/cancel', async (req: Request, res: Response) => {
  try {
    const cancelled = await devSimulationService.cancelSimulation(req.params.id);
    res.json({ success: true, data: { cancelled } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/simulation/active', (_req: Request, res: Response) => {
  try {
    const simulations = devSimulationService.getActiveSimulations();
    res.json({ success: true, data: simulations });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/simulation/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = devSimulationService.getSimulationHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/simulation/scenarios', (_req: Request, res: Response) => {
  try {
    const scenarios = devSimulationService.getScenarios();
    res.json({ success: true, data: scenarios });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/simulation/scenarios/:id/run', async (req: Request, res: Response) => {
  try {
    const results = await devSimulationService.runScenario(req.params.id);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 126: Chaos Engineering
router.get('/chaos/experiments', (_req: Request, res: Response) => {
  try {
    const experiments = chaosEngineeringService.getExperiments();
    res.json({ success: true, data: experiments });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/chaos/experiments', (req: Request, res: Response) => {
  try {
    const experiment = chaosEngineeringService.createExperiment(req.body);
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/chaos/experiments/:id', (req: Request, res: Response) => {
  try {
    const experiment = chaosEngineeringService.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ success: false, error: 'Experiment not found' });
    }
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/chaos/experiments/:id', (req: Request, res: Response) => {
  try {
    const experiment = chaosEngineeringService.updateExperiment(req.params.id, req.body);
    if (!experiment) {
      return res.status(404).json({ success: false, error: 'Experiment not found' });
    }
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/chaos/experiments/:id', (req: Request, res: Response) => {
  try {
    const deleted = chaosEngineeringService.deleteExperiment(req.params.id);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/chaos/experiments/:id/run', async (req: Request, res: Response) => {
  try {
    const run = await chaosEngineeringService.runExperiment(req.params.id);
    res.json({ success: true, data: run });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/chaos/runs', (req: Request, res: Response) => {
  try {
    const experimentId = req.query.experimentId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const runs = chaosEngineeringService.getRunHistory(experimentId, limit);
    res.json({ success: true, data: runs });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/chaos/experiments/:id/report', (req: Request, res: Response) => {
  try {
    const report = chaosEngineeringService.generateReport(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Experiment not found' });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/chaos/stats', (_req: Request, res: Response) => {
  try {
    const stats = chaosEngineeringService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 133: Scheduler Simulator
router.get('/scheduler/cluster', (req: Request, res: Response) => {
  try {
    const simulationId = req.query.simulationId as string | undefined;
    const summary = schedulerSimulatorService.getClusterSummary(simulationId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/scheduler/simulate', (req: Request, res: Response) => {
  try {
    const { podSpec, simulationId } = req.body;
    const result = schedulerSimulatorService.simulateScheduling(podSpec, simulationId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/scheduler/what-if', (req: Request, res: Response) => {
  try {
    const { scenario, simulationId } = req.body;
    const result = schedulerSimulatorService.simulateWhatIf(scenario, simulationId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/scheduler/simulations', (_req: Request, res: Response) => {
  try {
    const simulations = schedulerSimulatorService.getSimulations();
    res.json({ success: true, data: simulations });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/scheduler/simulations', (req: Request, res: Response) => {
  try {
    const { name, nodes, existingPods, description } = req.body;
    const simulation = schedulerSimulatorService.createSimulation(name, nodes, existingPods, description);
    res.json({ success: true, data: simulation });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// Section 5: Cloud Integration & Cost Monitoring (Tasks 128, 132, 134)
// ============================================================================

// Task 128: Multi-Cloud
router.get('/cloud/config', (_req: Request, res: Response) => {
  try {
    const config = multiCloudService.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/cloud/config', (req: Request, res: Response) => {
  try {
    const config = multiCloudService.updateConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/cloud/regions', (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as string | undefined;
    const regions = multiCloudService.getRegions(provider as any);
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/cloud/targets', (_req: Request, res: Response) => {
  try {
    const targets = multiCloudService.getTargets();
    res.json({ success: true, data: targets });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/cloud/targets', (req: Request, res: Response) => {
  try {
    const target = multiCloudService.addTarget(req.body);
    res.json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/cloud/select-target', (req: Request, res: Response) => {
  try {
    const target = multiCloudService.selectTarget(req.body);
    res.json({ success: true, data: target });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/cloud/failover', async (req: Request, res: Response) => {
  try {
    const { fromTargetId, toTargetId } = req.body;
    const result = await multiCloudService.triggerFailover(fromTargetId, toTargetId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/cloud/health', async (_req: Request, res: Response) => {
  try {
    const health = await multiCloudService.getHealthStatus();
    res.json({ success: true, data: health });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/cloud/cost-comparison', (req: Request, res: Response) => {
  try {
    const comparison = multiCloudService.getCostComparison(req.body);
    res.json({ success: true, data: comparison });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 132: Serverless Triggers
router.get('/serverless/functions', (_req: Request, res: Response) => {
  try {
    const functions = serverlessTriggerService.getFunctions();
    res.json({ success: true, data: functions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/serverless/functions', (req: Request, res: Response) => {
  try {
    const func = serverlessTriggerService.createFunction(req.body);
    res.json({ success: true, data: func });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/serverless/functions/:id', (req: Request, res: Response) => {
  try {
    const func = serverlessTriggerService.getFunction(req.params.id);
    if (!func) {
      return res.status(404).json({ success: false, error: 'Function not found' });
    }
    res.json({ success: true, data: func });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/serverless/functions/:id', (req: Request, res: Response) => {
  try {
    const func = serverlessTriggerService.updateFunction(req.params.id, req.body);
    if (!func) {
      return res.status(404).json({ success: false, error: 'Function not found' });
    }
    res.json({ success: true, data: func });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/serverless/functions/:id', (req: Request, res: Response) => {
  try {
    const deleted = serverlessTriggerService.deleteFunction(req.params.id);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/serverless/functions/:id/invoke', async (req: Request, res: Response) => {
  try {
    const invocation = await serverlessTriggerService.invokeFunction(req.params.id, req.body.input);
    res.json({ success: true, data: invocation });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/serverless/functions/:id/metrics', (req: Request, res: Response) => {
  try {
    const periodMinutes = parseInt(req.query.period as string) || 60;
    const metrics = serverlessTriggerService.getMetrics(req.params.id, periodMinutes);
    if (!metrics) {
      return res.status(404).json({ success: false, error: 'Function not found' });
    }
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/serverless/invocations', (req: Request, res: Response) => {
  try {
    const functionId = req.query.functionId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const invocations = serverlessTriggerService.getInvocationHistory(functionId, limit);
    res.json({ success: true, data: invocations });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/serverless/stats', (_req: Request, res: Response) => {
  try {
    const stats = serverlessTriggerService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Task 134: Cost Monitoring
router.get('/costs/summary', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);
    const summary = costMonitoringService.getCostSummary(startDate, endDate);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/costs/daily', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const costs = costMonitoringService.getDailyCosts(days);
    res.json({ success: true, data: costs });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/costs/forecast', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const forecast = costMonitoringService.getForecast(days);
    res.json({ success: true, data: forecast });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/costs/budgets', (_req: Request, res: Response) => {
  try {
    const budgets = costMonitoringService.getBudgets();
    res.json({ success: true, data: budgets });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/costs/budgets', (req: Request, res: Response) => {
  try {
    const budget = costMonitoringService.createBudget(req.body);
    res.json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/costs/budgets/:id', (req: Request, res: Response) => {
  try {
    const budget = costMonitoringService.updateBudget(req.params.id, req.body);
    if (!budget) {
      return res.status(404).json({ success: false, error: 'Budget not found' });
    }
    res.json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/costs/budgets/:id', (req: Request, res: Response) => {
  try {
    const deleted = costMonitoringService.deleteBudget(req.params.id);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/costs/anomalies', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const anomalies = costMonitoringService.getAnomalies(status as any);
    res.json({ success: true, data: anomalies });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/costs/anomalies/:id', (req: Request, res: Response) => {
  try {
    const { status, resolution } = req.body;
    const anomaly = costMonitoringService.updateAnomalyStatus(req.params.id, status, resolution);
    if (!anomaly) {
      return res.status(404).json({ success: false, error: 'Anomaly not found' });
    }
    res.json({ success: true, data: anomaly });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/costs/optimizations', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const optimizations = costMonitoringService.getOptimizations(status as any);
    res.json({ success: true, data: optimizations });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/costs/optimizations/:id', (req: Request, res: Response) => {
  try {
    const { status, actualSavings } = req.body;
    const optimization = costMonitoringService.updateOptimizationStatus(req.params.id, status, actualSavings);
    if (!optimization) {
      return res.status(404).json({ success: false, error: 'Optimization not found' });
    }
    res.json({ success: true, data: optimization });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/costs/stats', (_req: Request, res: Response) => {
  try {
    const stats = costMonitoringService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
