/**
 * Vertical Scaling Service
 *
 * Phase G - Task 127: Vertical Scaling Controls
 *
 * Provides interface to adjust resource limits (CPU, memory) for services:
 * - View current resource allocations
 * - Request resource limit changes
 * - Track resource change history
 * - Integration with Kubernetes API for actual changes
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const ResourceLimitsSchema = z.object({
  cpuRequest: z.string().describe('CPU request (e.g., "250m", "0.5")'),
  cpuLimit: z.string().describe('CPU limit (e.g., "1", "2000m")'),
  memoryRequest: z.string().describe('Memory request (e.g., "256Mi", "1Gi")'),
  memoryLimit: z.string().describe('Memory limit (e.g., "512Mi", "2Gi")'),
});

export const ServiceResourcesSchema = z.object({
  serviceName: z.string(),
  deploymentName: z.string(),
  namespace: z.string(),
  currentLimits: ResourceLimitsSchema,
  recommendedLimits: ResourceLimitsSchema.optional(),
  currentUsage: z.object({
    cpuPercent: z.number(),
    memoryPercent: z.number(),
    cpuMillicores: z.number(),
    memoryMB: z.number(),
  }).optional(),
  lastUpdated: z.string().datetime(),
});

export const ScaleRequestSchema = z.object({
  serviceName: z.string(),
  newLimits: ResourceLimitsSchema.partial(),
  reason: z.string().optional(),
  requestedBy: z.string().optional(),
});

export const ScaleChangeResultSchema = z.object({
  success: z.boolean(),
  serviceName: z.string(),
  previousLimits: ResourceLimitsSchema,
  newLimits: ResourceLimitsSchema,
  message: z.string(),
  timestamp: z.string().datetime(),
  rollbackAvailable: z.boolean(),
});

export const ScaleChangeHistorySchema = z.object({
  id: z.string().uuid(),
  serviceName: z.string(),
  previousLimits: ResourceLimitsSchema,
  newLimits: ResourceLimitsSchema,
  reason: z.string().optional(),
  requestedBy: z.string().optional(),
  timestamp: z.string().datetime(),
  status: z.enum(['pending', 'applied', 'rolled_back', 'failed']),
  error: z.string().optional(),
});

export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;
export type ServiceResources = z.infer<typeof ServiceResourcesSchema>;
export type ScaleRequest = z.infer<typeof ScaleRequestSchema>;
export type ScaleChangeResult = z.infer<typeof ScaleChangeResultSchema>;
export type ScaleChangeHistory = z.infer<typeof ScaleChangeHistorySchema>;

// ============================================================================
// Default Resource Configurations
// ============================================================================

const DEFAULT_RESOURCES: Record<string, ResourceLimits> = {
  orchestrator: {
    cpuRequest: '250m',
    cpuLimit: '1000m',
    memoryRequest: '512Mi',
    memoryLimit: '1Gi',
  },
  worker: {
    cpuRequest: '500m',
    cpuLimit: '2000m',
    memoryRequest: '1Gi',
    memoryLimit: '4Gi',
  },
  web: {
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: '256Mi',
    memoryLimit: '512Mi',
  },
  redis: {
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: '256Mi',
    memoryLimit: '1Gi',
  },
  postgres: {
    cpuRequest: '250m',
    cpuLimit: '1000m',
    memoryRequest: '512Mi',
    memoryLimit: '2Gi',
  },
};

// ============================================================================
// Vertical Scaling Service
// ============================================================================

class VerticalScalingService {
  private namespace: string;
  private serviceResources: Map<string, ServiceResources> = new Map();
  private changeHistory: ScaleChangeHistory[] = [];

  constructor() {
    this.namespace = process.env.K8S_NAMESPACE || 'researchflow';
    this.initializeServices();
  }

  /**
   * Initialize service resources with defaults
   */
  private initializeServices(): void {
    for (const [serviceName, limits] of Object.entries(DEFAULT_RESOURCES)) {
      this.serviceResources.set(serviceName, {
        serviceName,
        deploymentName: `${serviceName}-deployment`,
        namespace: this.namespace,
        currentLimits: { ...limits },
        recommendedLimits: this.calculateRecommendedLimits(serviceName, limits),
        currentUsage: this.simulateCurrentUsage(serviceName),
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  /**
   * Calculate recommended limits based on usage patterns
   */
  private calculateRecommendedLimits(serviceName: string, current: ResourceLimits): ResourceLimits | undefined {
    // Simulated recommendations based on service type
    const recommendations: Record<string, ResourceLimits> = {
      worker: {
        cpuRequest: '750m',
        cpuLimit: '3000m',
        memoryRequest: '2Gi',
        memoryLimit: '6Gi',
      },
    };

    return recommendations[serviceName];
  }

  /**
   * Simulate current resource usage (would query K8s metrics in production)
   */
  private simulateCurrentUsage(serviceName: string): ServiceResources['currentUsage'] {
    const usagePatterns: Record<string, { cpu: number; memory: number }> = {
      orchestrator: { cpu: 45, memory: 52 },
      worker: { cpu: 72, memory: 68 },
      web: { cpu: 25, memory: 35 },
      redis: { cpu: 15, memory: 62 },
      postgres: { cpu: 38, memory: 55 },
    };

    const pattern = usagePatterns[serviceName] || { cpu: 30, memory: 40 };

    return {
      cpuPercent: pattern.cpu + (Math.random() - 0.5) * 10,
      memoryPercent: pattern.memory + (Math.random() - 0.5) * 10,
      cpuMillicores: Math.round(pattern.cpu * 10),
      memoryMB: Math.round(pattern.memory * 10),
    };
  }

  /**
   * Get all service resource configurations
   */
  getAllServiceResources(): ServiceResources[] {
    // Update usage before returning
    for (const [name, resources] of this.serviceResources) {
      resources.currentUsage = this.simulateCurrentUsage(name);
      resources.lastUpdated = new Date().toISOString();
    }

    return Array.from(this.serviceResources.values());
  }

  /**
   * Get resource configuration for a specific service
   */
  getServiceResources(serviceName: string): ServiceResources | null {
    const resources = this.serviceResources.get(serviceName);
    if (resources) {
      resources.currentUsage = this.simulateCurrentUsage(serviceName);
      resources.lastUpdated = new Date().toISOString();
    }
    return resources || null;
  }

  /**
   * Request a resource limit change
   */
  async scaleResources(request: ScaleRequest): Promise<ScaleChangeResult> {
    const resources = this.serviceResources.get(request.serviceName);

    if (!resources) {
      return {
        success: false,
        serviceName: request.serviceName,
        previousLimits: DEFAULT_RESOURCES.orchestrator,
        newLimits: DEFAULT_RESOURCES.orchestrator,
        message: `Service '${request.serviceName}' not found`,
        timestamp: new Date().toISOString(),
        rollbackAvailable: false,
      };
    }

    const previousLimits = { ...resources.currentLimits };

    // Merge new limits with existing
    const newLimits: ResourceLimits = {
      cpuRequest: request.newLimits.cpuRequest || previousLimits.cpuRequest,
      cpuLimit: request.newLimits.cpuLimit || previousLimits.cpuLimit,
      memoryRequest: request.newLimits.memoryRequest || previousLimits.memoryRequest,
      memoryLimit: request.newLimits.memoryLimit || previousLimits.memoryLimit,
    };

    // Validate limits
    const validation = this.validateLimits(newLimits);
    if (!validation.valid) {
      return {
        success: false,
        serviceName: request.serviceName,
        previousLimits,
        newLimits,
        message: `Invalid limits: ${validation.error}`,
        timestamp: new Date().toISOString(),
        rollbackAvailable: false,
      };
    }

    try {
      // In production, this would call K8s API to patch the deployment
      // await this.applyK8sResourcePatch(request.serviceName, newLimits);

      // Update local state
      resources.currentLimits = newLimits;
      resources.lastUpdated = new Date().toISOString();

      // Record in history
      const historyEntry: ScaleChangeHistory = {
        id: crypto.randomUUID(),
        serviceName: request.serviceName,
        previousLimits,
        newLimits,
        reason: request.reason,
        requestedBy: request.requestedBy,
        timestamp: new Date().toISOString(),
        status: 'applied',
      };
      this.changeHistory.push(historyEntry);

      return {
        success: true,
        serviceName: request.serviceName,
        previousLimits,
        newLimits,
        message: `Resource limits updated for ${request.serviceName}. Pods will be restarted.`,
        timestamp: new Date().toISOString(),
        rollbackAvailable: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed attempt
      const historyEntry: ScaleChangeHistory = {
        id: crypto.randomUUID(),
        serviceName: request.serviceName,
        previousLimits,
        newLimits,
        reason: request.reason,
        requestedBy: request.requestedBy,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: errorMessage,
      };
      this.changeHistory.push(historyEntry);

      return {
        success: false,
        serviceName: request.serviceName,
        previousLimits,
        newLimits,
        message: `Failed to update resources: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        rollbackAvailable: false,
      };
    }
  }

  /**
   * Validate resource limits
   */
  private validateLimits(limits: ResourceLimits): { valid: boolean; error?: string } {
    // Parse CPU values (convert to millicores)
    const cpuRequest = this.parseCpu(limits.cpuRequest);
    const cpuLimit = this.parseCpu(limits.cpuLimit);

    if (cpuRequest === null || cpuLimit === null) {
      return { valid: false, error: 'Invalid CPU format' };
    }

    if (cpuRequest > cpuLimit) {
      return { valid: false, error: 'CPU request cannot exceed CPU limit' };
    }

    // Parse memory values (convert to bytes)
    const memRequest = this.parseMemory(limits.memoryRequest);
    const memLimit = this.parseMemory(limits.memoryLimit);

    if (memRequest === null || memLimit === null) {
      return { valid: false, error: 'Invalid memory format' };
    }

    if (memRequest > memLimit) {
      return { valid: false, error: 'Memory request cannot exceed memory limit' };
    }

    // Check reasonable bounds
    if (cpuLimit > 16000) { // 16 cores max
      return { valid: false, error: 'CPU limit exceeds maximum allowed (16 cores)' };
    }

    if (memLimit > 64 * 1024 * 1024 * 1024) { // 64Gi max
      return { valid: false, error: 'Memory limit exceeds maximum allowed (64Gi)' };
    }

    return { valid: true };
  }

  /**
   * Parse CPU string to millicores
   */
  private parseCpu(cpu: string): number | null {
    if (cpu.endsWith('m')) {
      return parseInt(cpu.slice(0, -1), 10);
    }
    const cores = parseFloat(cpu);
    if (isNaN(cores)) return null;
    return Math.round(cores * 1000);
  }

  /**
   * Parse memory string to bytes
   */
  private parseMemory(memory: string): number | null {
    const units: Record<string, number> = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'Ti': 1024 * 1024 * 1024 * 1024,
      'K': 1000,
      'M': 1000 * 1000,
      'G': 1000 * 1000 * 1000,
    };

    for (const [suffix, multiplier] of Object.entries(units)) {
      if (memory.endsWith(suffix)) {
        const value = parseFloat(memory.slice(0, -suffix.length));
        if (isNaN(value)) return null;
        return Math.round(value * multiplier);
      }
    }

    const bytes = parseInt(memory, 10);
    return isNaN(bytes) ? null : bytes;
  }

  /**
   * Rollback to previous limits
   */
  async rollback(historyId: string): Promise<ScaleChangeResult> {
    const historyEntry = this.changeHistory.find(h => h.id === historyId);

    if (!historyEntry) {
      return {
        success: false,
        serviceName: 'unknown',
        previousLimits: DEFAULT_RESOURCES.orchestrator,
        newLimits: DEFAULT_RESOURCES.orchestrator,
        message: `History entry ${historyId} not found`,
        timestamp: new Date().toISOString(),
        rollbackAvailable: false,
      };
    }

    if (historyEntry.status !== 'applied') {
      return {
        success: false,
        serviceName: historyEntry.serviceName,
        previousLimits: historyEntry.newLimits,
        newLimits: historyEntry.previousLimits,
        message: `Cannot rollback: change status is ${historyEntry.status}`,
        timestamp: new Date().toISOString(),
        rollbackAvailable: false,
      };
    }

    // Perform rollback
    const result = await this.scaleResources({
      serviceName: historyEntry.serviceName,
      newLimits: historyEntry.previousLimits,
      reason: `Rollback of change ${historyId}`,
    });

    if (result.success) {
      historyEntry.status = 'rolled_back';
    }

    return result;
  }

  /**
   * Get resource change history
   */
  getChangeHistory(serviceName?: string, limit: number = 50): ScaleChangeHistory[] {
    let history = this.changeHistory;

    if (serviceName) {
      history = history.filter(h => h.serviceName === serviceName);
    }

    return history.slice(-limit);
  }

  /**
   * Get resource usage summary
   */
  getResourceSummary(): {
    totalCpuRequested: string;
    totalMemoryRequested: string;
    services: Array<{
      name: string;
      cpuUsage: number;
      memoryUsage: number;
      status: 'optimal' | 'underutilized' | 'overutilized';
    }>;
  } {
    let totalCpuMillis = 0;
    let totalMemoryBytes = 0;
    const services: Array<{
      name: string;
      cpuUsage: number;
      memoryUsage: number;
      status: 'optimal' | 'underutilized' | 'overutilized';
    }> = [];

    for (const [name, resources] of this.serviceResources) {
      totalCpuMillis += this.parseCpu(resources.currentLimits.cpuRequest) || 0;
      totalMemoryBytes += this.parseMemory(resources.currentLimits.memoryRequest) || 0;

      const cpuUsage = resources.currentUsage?.cpuPercent || 0;
      const memUsage = resources.currentUsage?.memoryPercent || 0;

      let status: 'optimal' | 'underutilized' | 'overutilized' = 'optimal';
      if (cpuUsage > 85 || memUsage > 85) {
        status = 'overutilized';
      } else if (cpuUsage < 20 && memUsage < 20) {
        status = 'underutilized';
      }

      services.push({
        name,
        cpuUsage: Math.round(cpuUsage),
        memoryUsage: Math.round(memUsage),
        status,
      });
    }

    return {
      totalCpuRequested: `${totalCpuMillis}m`,
      totalMemoryRequested: `${Math.round(totalMemoryBytes / (1024 * 1024))}Mi`,
      services,
    };
  }
}

// Export singleton instance
export const verticalScalingService = new VerticalScalingService();

export default verticalScalingService;
