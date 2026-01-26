/**
 * Predictive Scaling Service
 *
 * Phase G - Task 117: Predictive Load-Balancing Previews
 *
 * Provides "what-if" simulation for scaling decisions:
 * - Predicts required pods based on load increase scenarios
 * - Estimates load distribution after scaling
 * - Uses current metrics and HPA configuration for predictions
 */

import { z } from 'zod';
import { clusterStatusService } from './clusterStatusService';

// ============================================================================
// Types & Schemas
// ============================================================================

export const ScalingScenarioSchema = z.object({
  loadIncrease: z.number().min(0).max(10).describe('Load increase factor (e.g., 0.5 = 50% increase, 2 = 200% increase)'),
  concurrentUsers: z.number().optional().describe('Specific number of concurrent users to simulate'),
  duration: z.enum(['peak', 'sustained', 'burst']).optional().default('sustained'),
});

export const ServicePredictionSchema = z.object({
  serviceName: z.string(),
  currentReplicas: z.number(),
  currentCPU: z.number(),
  currentMemory: z.number(),
  predictedCPU: z.number(),
  predictedMemory: z.number(),
  predictedReplicas: z.number(),
  replicaChange: z.number(),
  willScale: z.boolean(),
  scaleReason: z.string().optional(),
  estimatedLoadPerPod: z.number().optional(),
  hpaConfig: z.object({
    targetCPU: z.number(),
    minReplicas: z.number(),
    maxReplicas: z.number(),
  }).optional(),
});

export const ScalingPredictionSchema = z.object({
  timestamp: z.string().datetime(),
  scenario: ScalingScenarioSchema,
  predictions: z.array(ServicePredictionSchema),
  summary: z.object({
    totalCurrentPods: z.number(),
    totalPredictedPods: z.number(),
    totalPodsChange: z.number(),
    estimatedScalingTime: z.string(), // e.g., "2-5 minutes"
    costImpact: z.enum(['low', 'medium', 'high']),
    recommendations: z.array(z.string()),
  }),
  loadDistribution: z.array(z.object({
    podId: z.string(),
    loadPercentage: z.number(),
    requestsPerSecond: z.number().optional(),
  })).optional(),
});

export type ScalingScenario = z.infer<typeof ScalingScenarioSchema>;
export type ServicePrediction = z.infer<typeof ServicePredictionSchema>;
export type ScalingPrediction = z.infer<typeof ScalingPredictionSchema>;

// ============================================================================
// HPA Configuration (would be fetched from K8s in production)
// ============================================================================

interface HPAConfig {
  targetCPU: number;
  targetMemory?: number;
  minReplicas: number;
  maxReplicas: number;
}

const HPA_CONFIGS: Record<string, HPAConfig> = {
  orchestrator: { targetCPU: 80, targetMemory: 80, minReplicas: 2, maxReplicas: 10 },
  worker: { targetCPU: 70, targetMemory: 75, minReplicas: 2, maxReplicas: 20 },
  web: { targetCPU: 70, minReplicas: 2, maxReplicas: 8 },
};

// ============================================================================
// Predictive Scaling Service
// ============================================================================

class PredictiveScalingService {
  /**
   * Predict scaling needs based on a scenario
   */
  async predictScaling(scenario: ScalingScenario): Promise<ScalingPrediction> {
    const clusterStatus = await clusterStatusService.getClusterStatus();
    const predictions: ServicePrediction[] = [];

    for (const [serviceName, serviceStatus] of Object.entries(clusterStatus.services)) {
      const hpaConfig = HPA_CONFIGS[serviceName];

      if (!hpaConfig) continue;

      const prediction = this.predictServiceScaling(
        serviceName,
        serviceStatus.cpuUsage || 50,
        serviceStatus.memoryUsage || 50,
        serviceStatus.replicas,
        scenario,
        hpaConfig
      );

      predictions.push(prediction);
    }

    // Calculate summary
    const totalCurrentPods = predictions.reduce((sum, p) => sum + p.currentReplicas, 0);
    const totalPredictedPods = predictions.reduce((sum, p) => sum + p.predictedReplicas, 0);
    const totalPodsChange = totalPredictedPods - totalCurrentPods;

    // Generate recommendations
    const recommendations = this.generateRecommendations(predictions, scenario);

    // Estimate cost impact
    const costImpact = this.estimateCostImpact(totalPodsChange, totalCurrentPods);

    // Generate load distribution preview
    const loadDistribution = this.generateLoadDistribution(predictions, scenario);

    return {
      timestamp: new Date().toISOString(),
      scenario,
      predictions,
      summary: {
        totalCurrentPods,
        totalPredictedPods,
        totalPodsChange,
        estimatedScalingTime: this.estimateScalingTime(totalPodsChange),
        costImpact,
        recommendations,
      },
      loadDistribution,
    };
  }

  /**
   * Predict scaling for a single service
   */
  private predictServiceScaling(
    serviceName: string,
    currentCPU: number,
    currentMemory: number,
    currentReplicas: number,
    scenario: ScalingScenario,
    hpaConfig: HPAConfig
  ): ServicePrediction {
    const loadMultiplier = 1 + scenario.loadIncrease;

    // Predict CPU usage after load increase
    const predictedCPU = Math.min(100, currentCPU * loadMultiplier);
    const predictedMemory = Math.min(100, currentMemory * loadMultiplier);

    // Calculate required replicas based on HPA algorithm
    // HPA formula: desiredReplicas = ceil(currentReplicas * (currentMetric / targetMetric))
    let predictedReplicas = currentReplicas;

    if (predictedCPU > hpaConfig.targetCPU) {
      const scaleFactor = predictedCPU / hpaConfig.targetCPU;
      predictedReplicas = Math.ceil(currentReplicas * scaleFactor);
    }

    // Apply HPA bounds
    predictedReplicas = Math.max(hpaConfig.minReplicas, Math.min(hpaConfig.maxReplicas, predictedReplicas));

    const willScale = predictedReplicas !== currentReplicas;
    const replicaChange = predictedReplicas - currentReplicas;

    let scaleReason: string | undefined;
    if (willScale) {
      if (replicaChange > 0) {
        scaleReason = `CPU usage (${predictedCPU.toFixed(1)}%) would exceed target (${hpaConfig.targetCPU}%)`;
      } else {
        scaleReason = `CPU usage (${predictedCPU.toFixed(1)}%) would be below scale-down threshold`;
      }
    }

    // Estimate load per pod after scaling
    const estimatedLoadPerPod = predictedReplicas > 0
      ? (predictedCPU * currentReplicas) / predictedReplicas
      : 0;

    return {
      serviceName,
      currentReplicas,
      currentCPU,
      currentMemory,
      predictedCPU,
      predictedMemory,
      predictedReplicas,
      replicaChange,
      willScale,
      scaleReason,
      estimatedLoadPerPod,
      hpaConfig: {
        targetCPU: hpaConfig.targetCPU,
        minReplicas: hpaConfig.minReplicas,
        maxReplicas: hpaConfig.maxReplicas,
      },
    };
  }

  /**
   * Generate scaling recommendations
   */
  private generateRecommendations(
    predictions: ServicePrediction[],
    scenario: ScalingScenario
  ): string[] {
    const recommendations: string[] = [];

    for (const prediction of predictions) {
      if (prediction.willScale && prediction.replicaChange > 0) {
        if (prediction.predictedReplicas === prediction.hpaConfig?.maxReplicas) {
          recommendations.push(
            `${prediction.serviceName}: Would hit max replicas (${prediction.hpaConfig.maxReplicas}). ` +
            `Consider increasing maxReplicas or optimizing resource usage.`
          );
        }
      }

      if (prediction.predictedCPU > 90) {
        recommendations.push(
          `${prediction.serviceName}: High CPU predicted (${prediction.predictedCPU.toFixed(1)}%). ` +
          `Consider pre-scaling before expected load increase.`
        );
      }
    }

    if (scenario.loadIncrease > 1) {
      recommendations.push(
        `A ${((scenario.loadIncrease) * 100).toFixed(0)}% load increase is significant. ` +
        `Consider gradual rollout and monitoring.`
      );
    }

    if (scenario.duration === 'burst') {
      recommendations.push(
        `Burst traffic may not trigger HPA fast enough. ` +
        `Consider pre-scaling or using PodDisruptionBudgets.`
      );
    }

    return recommendations;
  }

  /**
   * Estimate cost impact of scaling
   */
  private estimateCostImpact(podsChange: number, currentPods: number): 'low' | 'medium' | 'high' {
    const percentChange = currentPods > 0 ? (podsChange / currentPods) * 100 : 0;

    if (percentChange <= 20) return 'low';
    if (percentChange <= 50) return 'medium';
    return 'high';
  }

  /**
   * Estimate scaling time based on pod changes
   */
  private estimateScalingTime(podsChange: number): string {
    const absChange = Math.abs(podsChange);

    if (absChange === 0) return 'No scaling needed';
    if (absChange <= 2) return '30 seconds - 2 minutes';
    if (absChange <= 5) return '2-5 minutes';
    return '5-10 minutes';
  }

  /**
   * Generate load distribution preview after scaling
   */
  private generateLoadDistribution(
    predictions: ServicePrediction[],
    scenario: ScalingScenario
  ): ScalingPrediction['loadDistribution'] {
    const distribution: ScalingPrediction['loadDistribution'] = [];

    // Focus on worker service for detailed distribution
    const workerPrediction = predictions.find(p => p.serviceName === 'worker');

    if (workerPrediction) {
      const totalLoad = workerPrediction.predictedCPU * workerPrediction.currentReplicas;
      const loadPerPod = totalLoad / workerPrediction.predictedReplicas;

      for (let i = 0; i < workerPrediction.predictedReplicas; i++) {
        distribution.push({
          podId: `worker-${i + 1}`,
          loadPercentage: loadPerPod,
          requestsPerSecond: Math.round((1000 * (1 + scenario.loadIncrease)) / workerPrediction.predictedReplicas),
        });
      }
    }

    return distribution;
  }

  /**
   * Run multiple scenarios for comparison
   */
  async compareScenarios(scenarios: ScalingScenario[]): Promise<ScalingPrediction[]> {
    return Promise.all(scenarios.map(s => this.predictScaling(s)));
  }

  /**
   * Preset scenarios for common use cases
   */
  getPresetScenarios(): Record<string, ScalingScenario> {
    return {
      '25% increase': { loadIncrease: 0.25 },
      '50% increase': { loadIncrease: 0.5 },
      'Double load': { loadIncrease: 1.0 },
      'Triple load': { loadIncrease: 2.0 },
      'Peak burst': { loadIncrease: 1.5, duration: 'burst' },
    };
  }
}

// Export singleton instance
export const predictiveScalingService = new PredictiveScalingService();

export default predictiveScalingService;
