/**
 * Edge Computing Service
 *
 * Phase G - Task 124: Edge Computing Toggles for Low-Latency
 *
 * Manages edge computing configuration:
 * - Routes jobs to edge or central workers based on configuration
 * - Supports multiple edge regions
 * - Tracks edge worker availability and latency
 * - Provides fallback to central when edge unavailable
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const EdgeRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  endpoint: z.string().url(),
  latencyMs: z.number().optional(),
  status: z.enum(['online', 'offline', 'degraded']),
  capabilities: z.array(z.string()),
  lastHealthCheck: z.string().datetime().optional(),
});

export const EdgeConfigSchema = z.object({
  enabled: z.boolean(),
  defaultToEdge: z.boolean(),
  fallbackToCentral: z.boolean(),
  regions: z.array(EdgeRegionSchema),
  eligibleJobTypes: z.array(z.string()),
  maxEdgeLatencyMs: z.number().default(100),
});

export const EdgeJobRoutingSchema = z.object({
  jobId: z.string(),
  jobType: z.string(),
  preferEdge: z.boolean(),
  targetRegion: z.string().optional(),
  routedTo: z.enum(['edge', 'central']),
  selectedRegion: z.string().optional(),
  reason: z.string(),
  latencyEstimateMs: z.number().optional(),
});

export const EdgeHealthCheckResultSchema = z.object({
  regionId: z.string(),
  status: z.enum(['online', 'offline', 'degraded']),
  latencyMs: z.number(),
  timestamp: z.string().datetime(),
  error: z.string().optional(),
});

export type EdgeRegion = z.infer<typeof EdgeRegionSchema>;
export type EdgeConfig = z.infer<typeof EdgeConfigSchema>;
export type EdgeJobRouting = z.infer<typeof EdgeJobRoutingSchema>;
export type EdgeHealthCheckResult = z.infer<typeof EdgeHealthCheckResultSchema>;

// ============================================================================
// Edge Computing Service
// ============================================================================

class EdgeComputingService {
  private config: EdgeConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private routingHistory: EdgeJobRouting[] = [];

  constructor() {
    this.config = {
      enabled: process.env.EDGE_MODE_ENABLED === 'true',
      defaultToEdge: process.env.EDGE_DEFAULT === 'true',
      fallbackToCentral: true,
      regions: this.initializeDefaultRegions(),
      eligibleJobTypes: ['analysis', 'preprocessing', 'validation', 'export'],
      maxEdgeLatencyMs: parseInt(process.env.EDGE_MAX_LATENCY_MS || '100', 10),
    };
  }

  /**
   * Initialize default edge regions from environment
   */
  private initializeDefaultRegions(): EdgeRegion[] {
    const regions: EdgeRegion[] = [];

    // Parse edge regions from environment
    const edgeUrls = process.env.WORKER_EDGE_URLS?.split(',') || [];

    for (let i = 0; i < edgeUrls.length; i++) {
      const url = edgeUrls[i].trim();
      if (!url) continue;

      regions.push({
        id: `edge-${i + 1}`,
        name: `Edge Region ${i + 1}`,
        location: `Region ${i + 1}`,
        endpoint: url,
        status: 'offline', // Will be updated by health check
        capabilities: ['analysis', 'validation'],
        latencyMs: undefined,
      });
    }

    // Add default mock regions for demo
    if (regions.length === 0) {
      regions.push(
        {
          id: 'edge-us-west',
          name: 'US West Edge',
          location: 'Oregon',
          endpoint: process.env.WORKER_EDGE_URL || 'http://edge-west.researchflow.local:8080',
          status: 'online',
          capabilities: ['analysis', 'preprocessing', 'validation'],
          latencyMs: 25,
        },
        {
          id: 'edge-us-east',
          name: 'US East Edge',
          location: 'Virginia',
          endpoint: 'http://edge-east.researchflow.local:8080',
          status: 'online',
          capabilities: ['analysis', 'validation', 'export'],
          latencyMs: 35,
        },
        {
          id: 'edge-eu',
          name: 'EU Edge',
          location: 'Frankfurt',
          endpoint: 'http://edge-eu.researchflow.local:8080',
          status: 'degraded',
          capabilities: ['analysis', 'validation'],
          latencyMs: 85,
        }
      );
    }

    return regions;
  }

  /**
   * Check if edge computing is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable edge computing
   */
  setEnabled(enabled: boolean): EdgeConfig {
    this.config.enabled = enabled;

    if (enabled) {
      this.startHealthChecks();
    } else {
      this.stopHealthChecks();
    }

    return this.getConfig();
  }

  /**
   * Get current edge configuration
   */
  getConfig(): EdgeConfig {
    return { ...this.config };
  }

  /**
   * Update edge configuration
   */
  updateConfig(updates: Partial<EdgeConfig>): EdgeConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  /**
   * Determine routing for a job
   */
  routeJob(jobId: string, jobType: string, preferEdge?: boolean): EdgeJobRouting {
    const shouldUseEdge = preferEdge ?? this.config.defaultToEdge;

    // Check if edge is enabled and job type is eligible
    if (!this.config.enabled || !this.config.eligibleJobTypes.includes(jobType)) {
      const routing: EdgeJobRouting = {
        jobId,
        jobType,
        preferEdge: shouldUseEdge,
        routedTo: 'central',
        reason: !this.config.enabled
          ? 'Edge computing disabled'
          : `Job type '${jobType}' not eligible for edge execution`,
      };
      this.recordRouting(routing);
      return routing;
    }

    // Find best available edge region
    const availableRegions = this.config.regions
      .filter(r => r.status !== 'offline')
      .filter(r => r.capabilities.includes(jobType) || r.capabilities.length === 0)
      .sort((a, b) => (a.latencyMs || 100) - (b.latencyMs || 100));

    if (availableRegions.length === 0) {
      if (this.config.fallbackToCentral) {
        const routing: EdgeJobRouting = {
          jobId,
          jobType,
          preferEdge: shouldUseEdge,
          routedTo: 'central',
          reason: 'No edge regions available, falling back to central',
        };
        this.recordRouting(routing);
        return routing;
      }

      throw new Error('No edge regions available and fallback disabled');
    }

    // Select best region
    const selectedRegion = availableRegions[0];

    const routing: EdgeJobRouting = {
      jobId,
      jobType,
      preferEdge: shouldUseEdge,
      targetRegion: selectedRegion.id,
      routedTo: 'edge',
      selectedRegion: selectedRegion.id,
      reason: `Routed to ${selectedRegion.name} (${selectedRegion.latencyMs}ms latency)`,
      latencyEstimateMs: selectedRegion.latencyMs,
    };

    this.recordRouting(routing);
    return routing;
  }

  /**
   * Get endpoint for a specific region
   */
  getRegionEndpoint(regionId: string): string | null {
    const region = this.config.regions.find(r => r.id === regionId);
    return region?.endpoint || null;
  }

  /**
   * Add a new edge region
   */
  addRegion(region: Omit<EdgeRegion, 'status' | 'latencyMs' | 'lastHealthCheck'>): EdgeRegion {
    const newRegion: EdgeRegion = {
      ...region,
      status: 'offline',
      latencyMs: undefined,
      lastHealthCheck: undefined,
    };

    this.config.regions.push(newRegion);

    // Perform initial health check
    this.checkRegionHealth(newRegion.id);

    return newRegion;
  }

  /**
   * Remove an edge region
   */
  removeRegion(regionId: string): boolean {
    const index = this.config.regions.findIndex(r => r.id === regionId);
    if (index === -1) return false;

    this.config.regions.splice(index, 1);
    return true;
  }

  /**
   * Get all edge regions
   */
  getRegions(): EdgeRegion[] {
    return [...this.config.regions];
  }

  /**
   * Check health of a specific region
   */
  async checkRegionHealth(regionId: string): Promise<EdgeHealthCheckResult> {
    const region = this.config.regions.find(r => r.id === regionId);
    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }

    const startTime = Date.now();

    try {
      // In production, this would make an actual HTTP request to the edge endpoint
      // For demo, simulate the health check
      await this.simulateHealthCheck(region);

      const latencyMs = Date.now() - startTime;

      // Update region status
      region.status = latencyMs < this.config.maxEdgeLatencyMs ? 'online' : 'degraded';
      region.latencyMs = latencyMs;
      region.lastHealthCheck = new Date().toISOString();

      return {
        regionId,
        status: region.status,
        latencyMs,
        timestamp: region.lastHealthCheck,
      };
    } catch (error) {
      region.status = 'offline';
      region.lastHealthCheck = new Date().toISOString();

      return {
        regionId,
        status: 'offline',
        latencyMs: -1,
        timestamp: region.lastHealthCheck,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Simulate health check (replace with real HTTP call in production)
   */
  private async simulateHealthCheck(region: EdgeRegion): Promise<void> {
    // Simulate network latency
    const simulatedLatency = region.latencyMs || Math.random() * 50 + 20;
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Connection timeout');
    }
  }

  /**
   * Check health of all regions
   */
  async checkAllRegionsHealth(): Promise<EdgeHealthCheckResult[]> {
    const results = await Promise.all(
      this.config.regions.map(r => this.checkRegionHealth(r.id))
    );
    return results;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllRegionsHealth();
    }, intervalMs);

    // Perform initial check
    this.checkAllRegionsHealth();

    console.log('[EdgeComputing] Started health checks');
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('[EdgeComputing] Stopped health checks');
  }

  /**
   * Record routing decision for analytics
   */
  private recordRouting(routing: EdgeJobRouting): void {
    this.routingHistory.push(routing);
    if (this.routingHistory.length > 1000) {
      this.routingHistory.shift();
    }
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalRouted: number;
    edgeRouted: number;
    centralRouted: number;
    edgePercentage: number;
    byRegion: Record<string, number>;
    byJobType: Record<string, { edge: number; central: number }>;
  } {
    const total = this.routingHistory.length;
    const edgeRouted = this.routingHistory.filter(r => r.routedTo === 'edge').length;
    const centralRouted = total - edgeRouted;

    const byRegion: Record<string, number> = {};
    const byJobType: Record<string, { edge: number; central: number }> = {};

    for (const routing of this.routingHistory) {
      // Count by region
      if (routing.selectedRegion) {
        byRegion[routing.selectedRegion] = (byRegion[routing.selectedRegion] || 0) + 1;
      }

      // Count by job type
      if (!byJobType[routing.jobType]) {
        byJobType[routing.jobType] = { edge: 0, central: 0 };
      }
      byJobType[routing.jobType][routing.routedTo]++;
    }

    return {
      totalRouted: total,
      edgeRouted,
      centralRouted,
      edgePercentage: total > 0 ? (edgeRouted / total) * 100 : 0,
      byRegion,
      byJobType,
    };
  }

  /**
   * Get recent routing decisions
   */
  getRecentRoutings(limit: number = 20): EdgeJobRouting[] {
    return this.routingHistory.slice(-limit);
  }
}

// Export singleton instance
export const edgeComputingService = new EdgeComputingService();

export default edgeComputingService;
