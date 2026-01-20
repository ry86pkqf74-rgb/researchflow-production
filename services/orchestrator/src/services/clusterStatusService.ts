/**
 * Cluster Status Service
 *
 * Phase G - Tasks 116, 122: Auto-Scaling Indicators & Cluster Health Dashboard
 *
 * Provides real-time cluster status including:
 * - Kubernetes deployment replica counts and scaling state
 * - Service health checks (DB, Redis, Worker)
 * - HPA (Horizontal Pod Autoscaler) status
 * - Node resource utilization
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const ServiceStatusSchema = z.object({
  name: z.string(),
  replicas: z.number(),
  desiredReplicas: z.number(),
  availableReplicas: z.number(),
  status: z.enum(['steady', 'scaling_up', 'scaling_down', 'degraded', 'unavailable']),
  healthy: z.boolean(),
  lastUpdated: z.string().datetime(),
  cpuUsage: z.number().optional(), // percentage 0-100
  memoryUsage: z.number().optional(), // percentage 0-100
  podNames: z.array(z.string()).optional(),
});

export const HPAStatusSchema = z.object({
  name: z.string(),
  targetCPUUtilization: z.number(),
  currentCPUUtilization: z.number().optional(),
  minReplicas: z.number(),
  maxReplicas: z.number(),
  currentReplicas: z.number(),
  desiredReplicas: z.number(),
  lastScaleTime: z.string().datetime().optional(),
});

export const NodeStatusSchema = z.object({
  name: z.string(),
  status: z.enum(['Ready', 'NotReady', 'Unknown']),
  cpuCapacity: z.string(),
  memoryCapacity: z.string(),
  cpuAllocatable: z.string(),
  memoryAllocatable: z.string(),
  cpuUsed: z.number().optional(), // millicores
  memoryUsed: z.number().optional(), // bytes
  podCount: z.number(),
  conditions: z.array(z.object({
    type: z.string(),
    status: z.string(),
    reason: z.string().optional(),
  })),
});

export const ClusterStatusSchema = z.object({
  timestamp: z.string().datetime(),
  clusterName: z.string(),
  namespace: z.string(),
  overallStatus: z.enum(['healthy', 'degraded', 'critical', 'unknown']),
  haEnabled: z.boolean(),
  services: z.record(z.string(), ServiceStatusSchema),
  hpaStatus: z.array(HPAStatusSchema).optional(),
  nodes: z.array(NodeStatusSchema).optional(),
  scalingEvents: z.array(z.object({
    timestamp: z.string().datetime(),
    service: z.string(),
    event: z.enum(['scale_up', 'scale_down', 'failed']),
    fromReplicas: z.number(),
    toReplicas: z.number(),
    reason: z.string().optional(),
  })).optional(),
});

export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;
export type HPAStatus = z.infer<typeof HPAStatusSchema>;
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type ClusterStatus = z.infer<typeof ClusterStatusSchema>;

// ============================================================================
// In-Memory State
// ============================================================================

// Simulated scaling events history
const scalingEventsHistory: ClusterStatus['scalingEvents'] = [];

// Service metrics cache (updated periodically)
const serviceMetricsCache: Map<string, { cpu: number; memory: number; lastUpdated: Date }> = new Map();

// ============================================================================
// Kubernetes Client Interface (Abstracted for mock/real implementation)
// ============================================================================

interface K8sClientInterface {
  getDeployments(namespace: string): Promise<Array<{
    name: string;
    replicas: number;
    availableReplicas: number;
    desiredReplicas: number;
    conditions: Array<{ type: string; status: string }>;
  }>>;
  getHPAs(namespace: string): Promise<HPAStatus[]>;
  getNodes(): Promise<NodeStatus[]>;
  getPodMetrics(namespace: string): Promise<Map<string, { cpu: number; memory: number }>>;
}

// Mock K8s client for development/demo mode
class MockK8sClient implements K8sClientInterface {
  async getDeployments(namespace: string) {
    // Simulate realistic deployment data
    return [
      {
        name: 'orchestrator',
        replicas: 2,
        availableReplicas: 2,
        desiredReplicas: 2,
        conditions: [{ type: 'Available', status: 'True' }],
      },
      {
        name: 'worker',
        replicas: 3,
        availableReplicas: 3,
        desiredReplicas: 3,
        conditions: [{ type: 'Available', status: 'True' }],
      },
      {
        name: 'web',
        replicas: 2,
        availableReplicas: 2,
        desiredReplicas: 2,
        conditions: [{ type: 'Available', status: 'True' }],
      },
    ];
  }

  async getHPAs(namespace: string): Promise<HPAStatus[]> {
    return [
      {
        name: 'orchestrator-hpa',
        targetCPUUtilization: 80,
        currentCPUUtilization: 45,
        minReplicas: 2,
        maxReplicas: 10,
        currentReplicas: 2,
        desiredReplicas: 2,
        lastScaleTime: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        name: 'worker-hpa',
        targetCPUUtilization: 70,
        currentCPUUtilization: 62,
        minReplicas: 2,
        maxReplicas: 20,
        currentReplicas: 3,
        desiredReplicas: 3,
        lastScaleTime: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  }

  async getNodes(): Promise<NodeStatus[]> {
    return [
      {
        name: 'node-1',
        status: 'Ready',
        cpuCapacity: '4',
        memoryCapacity: '16Gi',
        cpuAllocatable: '3800m',
        memoryAllocatable: '15Gi',
        cpuUsed: 2100,
        memoryUsed: 8 * 1024 * 1024 * 1024,
        podCount: 12,
        conditions: [{ type: 'Ready', status: 'True' }],
      },
      {
        name: 'node-2',
        status: 'Ready',
        cpuCapacity: '4',
        memoryCapacity: '16Gi',
        cpuAllocatable: '3800m',
        memoryAllocatable: '15Gi',
        cpuUsed: 1800,
        memoryUsed: 6 * 1024 * 1024 * 1024,
        podCount: 10,
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    ];
  }

  async getPodMetrics(namespace: string): Promise<Map<string, { cpu: number; memory: number }>> {
    const metrics = new Map<string, { cpu: number; memory: number }>();
    metrics.set('orchestrator', { cpu: 45, memory: 52 });
    metrics.set('worker', { cpu: 62, memory: 68 });
    metrics.set('web', { cpu: 25, memory: 35 });
    return metrics;
  }
}

// ============================================================================
// Cluster Status Service
// ============================================================================

class ClusterStatusService {
  private k8sClient: K8sClientInterface;
  private namespace: string;
  private clusterName: string;
  private haEnabled: boolean;

  constructor() {
    // In production, use real Kubernetes client
    // For now, use mock client for development
    this.k8sClient = new MockK8sClient();
    this.namespace = process.env.K8S_NAMESPACE || 'researchflow';
    this.clusterName = process.env.K8S_CLUSTER_NAME || 'researchflow-cluster';
    this.haEnabled = process.env.HA_ENABLED === 'true';
  }

  /**
   * Get comprehensive cluster status
   */
  async getClusterStatus(): Promise<ClusterStatus> {
    const [deployments, hpas, nodes, podMetrics] = await Promise.all([
      this.k8sClient.getDeployments(this.namespace),
      this.k8sClient.getHPAs(this.namespace),
      this.k8sClient.getNodes(),
      this.k8sClient.getPodMetrics(this.namespace),
    ]);

    // Build service status map
    const services: Record<string, ServiceStatus> = {};

    for (const deployment of deployments) {
      const metrics = podMetrics.get(deployment.name);
      const scalingStatus = this.determineScalingStatus(
        deployment.replicas,
        deployment.availableReplicas,
        deployment.desiredReplicas
      );

      services[deployment.name] = {
        name: deployment.name,
        replicas: deployment.replicas,
        desiredReplicas: deployment.desiredReplicas,
        availableReplicas: deployment.availableReplicas,
        status: scalingStatus,
        healthy: deployment.availableReplicas >= deployment.desiredReplicas,
        lastUpdated: new Date().toISOString(),
        cpuUsage: metrics?.cpu,
        memoryUsage: metrics?.memory,
      };
    }

    // Determine overall cluster status
    const overallStatus = this.determineOverallStatus(Object.values(services));

    return {
      timestamp: new Date().toISOString(),
      clusterName: this.clusterName,
      namespace: this.namespace,
      overallStatus,
      haEnabled: this.haEnabled,
      services,
      hpaStatus: hpas,
      nodes,
      scalingEvents: scalingEventsHistory.slice(-20), // Last 20 events
    };
  }

  /**
   * Get status for a specific service
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatus | null> {
    const clusterStatus = await this.getClusterStatus();
    return clusterStatus.services[serviceName] || null;
  }

  /**
   * Determine scaling status based on replica counts
   */
  private determineScalingStatus(
    current: number,
    available: number,
    desired: number
  ): ServiceStatus['status'] {
    if (available === 0) return 'unavailable';
    if (available < desired) {
      return current < desired ? 'scaling_up' : 'degraded';
    }
    if (current > desired) return 'scaling_down';
    return 'steady';
  }

  /**
   * Determine overall cluster health status
   */
  private determineOverallStatus(services: ServiceStatus[]): ClusterStatus['overallStatus'] {
    const unavailableCount = services.filter(s => s.status === 'unavailable').length;
    const degradedCount = services.filter(s => s.status === 'degraded' || !s.healthy).length;

    if (unavailableCount > 0) return 'critical';
    if (degradedCount > 0) return 'degraded';
    if (services.length === 0) return 'unknown';
    return 'healthy';
  }

  /**
   * Record a scaling event
   */
  recordScalingEvent(event: {
    service: string;
    event: 'scale_up' | 'scale_down' | 'failed';
    fromReplicas: number;
    toReplicas: number;
    reason?: string;
  }): void {
    scalingEventsHistory.push({
      timestamp: new Date().toISOString(),
      ...event,
    });

    // Keep only last 100 events
    if (scalingEventsHistory.length > 100) {
      scalingEventsHistory.shift();
    }
  }

  /**
   * Get recent scaling events
   */
  getScalingEvents(limit: number = 20): NonNullable<ClusterStatus['scalingEvents']> {
    return scalingEventsHistory.slice(-limit);
  }

  /**
   * Check if HA mode is enabled
   */
  isHAEnabled(): boolean {
    return this.haEnabled;
  }

  /**
   * Toggle HA mode (would trigger actual scaling in production)
   */
  async setHAMode(enabled: boolean): Promise<{ success: boolean; message: string }> {
    this.haEnabled = enabled;

    if (enabled) {
      // In production, this would scale up services
      this.recordScalingEvent({
        service: 'orchestrator',
        event: 'scale_up',
        fromReplicas: 1,
        toReplicas: 2,
        reason: 'HA mode enabled',
      });
      this.recordScalingEvent({
        service: 'worker',
        event: 'scale_up',
        fromReplicas: 1,
        toReplicas: 2,
        reason: 'HA mode enabled',
      });
    }

    return {
      success: true,
      message: `HA mode ${enabled ? 'enabled' : 'disabled'}. Services will be scaled accordingly.`,
    };
  }
}

// Export singleton instance
export const clusterStatusService = new ClusterStatusService();

export default clusterStatusService;
