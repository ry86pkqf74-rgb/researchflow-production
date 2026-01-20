/**
 * Scheduler Simulator Service
 *
 * Phase G - Task 133: Container Orchestration Simulator
 *
 * Provides Kubernetes scheduling simulation:
 * - Pod placement visualization
 * - Resource allocation preview
 * - Scheduling constraint validation
 * - What-if scenarios for cluster changes
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const NodeResourcesSchema = z.object({
  cpuCapacity: z.number().describe('CPU capacity in millicores'),
  cpuAllocatable: z.number().describe('Allocatable CPU in millicores'),
  cpuUsed: z.number().describe('Used CPU in millicores'),
  memoryCapacity: z.number().describe('Memory capacity in bytes'),
  memoryAllocatable: z.number().describe('Allocatable memory in bytes'),
  memoryUsed: z.number().describe('Used memory in bytes'),
  podsCapacity: z.number().describe('Maximum pods'),
  podsUsed: z.number().describe('Current pod count'),
});

export const SimulatedNodeSchema = z.object({
  name: z.string(),
  labels: z.record(z.string(), z.string()),
  taints: z.array(z.object({
    key: z.string(),
    value: z.string().optional(),
    effect: z.enum(['NoSchedule', 'PreferNoSchedule', 'NoExecute']),
  })),
  resources: NodeResourcesSchema,
  conditions: z.array(z.object({
    type: z.string(),
    status: z.enum(['True', 'False', 'Unknown']),
  })),
  zone: z.string().optional(),
  region: z.string().optional(),
});

export const PodSpecSchema = z.object({
  name: z.string(),
  namespace: z.string().default('researchflow'),
  labels: z.record(z.string(), z.string()).optional(),
  resources: z.object({
    requests: z.object({
      cpu: z.number().describe('CPU request in millicores'),
      memory: z.number().describe('Memory request in bytes'),
    }),
    limits: z.object({
      cpu: z.number().describe('CPU limit in millicores'),
      memory: z.number().describe('Memory limit in bytes'),
    }).optional(),
  }),
  nodeSelector: z.record(z.string(), z.string()).optional(),
  affinity: z.object({
    nodeAffinity: z.object({
      requiredDuringSchedulingIgnoredDuringExecution: z.array(z.object({
        key: z.string(),
        operator: z.enum(['In', 'NotIn', 'Exists', 'DoesNotExist', 'Gt', 'Lt']),
        values: z.array(z.string()).optional(),
      })).optional(),
      preferredDuringSchedulingIgnoredDuringExecution: z.array(z.object({
        weight: z.number(),
        preference: z.object({
          key: z.string(),
          operator: z.enum(['In', 'NotIn', 'Exists', 'DoesNotExist', 'Gt', 'Lt']),
          values: z.array(z.string()).optional(),
        }),
      })).optional(),
    }).optional(),
    podAntiAffinity: z.object({
      requiredDuringSchedulingIgnoredDuringExecution: z.array(z.object({
        labelSelector: z.object({
          matchLabels: z.record(z.string(), z.string()),
        }),
        topologyKey: z.string(),
      })).optional(),
    }).optional(),
  }).optional(),
  tolerations: z.array(z.object({
    key: z.string().optional(),
    operator: z.enum(['Equal', 'Exists']).optional(),
    value: z.string().optional(),
    effect: z.enum(['NoSchedule', 'PreferNoSchedule', 'NoExecute']).optional(),
  })).optional(),
  priority: z.number().optional(),
});

export const SchedulingResultSchema = z.object({
  podName: z.string(),
  schedulable: z.boolean(),
  selectedNode: z.string().optional(),
  score: z.number().optional(),
  reason: z.string(),
  nodeScores: z.array(z.object({
    nodeName: z.string(),
    score: z.number(),
    feasible: z.boolean(),
    failReasons: z.array(z.string()),
  })),
  warnings: z.array(z.string()),
});

export const ClusterSimulationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(SimulatedNodeSchema),
  existingPods: z.array(z.object({
    name: z.string(),
    namespace: z.string(),
    nodeName: z.string(),
    resources: z.object({
      cpu: z.number(),
      memory: z.number(),
    }),
  })),
  createdAt: z.string().datetime(),
});

export const WhatIfScenarioSchema = z.object({
  type: z.enum(['add_node', 'remove_node', 'scale_deployment', 'node_failure']),
  parameters: z.record(z.string(), z.unknown()),
});

export type NodeResources = z.infer<typeof NodeResourcesSchema>;
export type SimulatedNode = z.infer<typeof SimulatedNodeSchema>;
export type PodSpec = z.infer<typeof PodSpecSchema>;
export type SchedulingResult = z.infer<typeof SchedulingResultSchema>;
export type ClusterSimulation = z.infer<typeof ClusterSimulationSchema>;
export type WhatIfScenario = z.infer<typeof WhatIfScenarioSchema>;

// ============================================================================
// Scheduler Simulator Service
// ============================================================================

class SchedulerSimulatorService {
  private simulations: Map<string, ClusterSimulation> = new Map();
  private defaultCluster: ClusterSimulation;

  constructor() {
    this.defaultCluster = this.createDefaultCluster();
  }

  /**
   * Create default cluster simulation
   */
  private createDefaultCluster(): ClusterSimulation {
    const nodes: SimulatedNode[] = [
      {
        name: 'node-1',
        labels: {
          'kubernetes.io/hostname': 'node-1',
          'node.kubernetes.io/instance-type': 'm5.large',
          'topology.kubernetes.io/zone': 'us-west-2a',
          'node-role.kubernetes.io/worker': 'true',
        },
        taints: [],
        resources: {
          cpuCapacity: 2000,
          cpuAllocatable: 1900,
          cpuUsed: 800,
          memoryCapacity: 8 * 1024 * 1024 * 1024,
          memoryAllocatable: 7.5 * 1024 * 1024 * 1024,
          memoryUsed: 3 * 1024 * 1024 * 1024,
          podsCapacity: 110,
          podsUsed: 25,
        },
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'MemoryPressure', status: 'False' },
          { type: 'DiskPressure', status: 'False' },
        ],
        zone: 'us-west-2a',
        region: 'us-west-2',
      },
      {
        name: 'node-2',
        labels: {
          'kubernetes.io/hostname': 'node-2',
          'node.kubernetes.io/instance-type': 'm5.large',
          'topology.kubernetes.io/zone': 'us-west-2b',
          'node-role.kubernetes.io/worker': 'true',
        },
        taints: [],
        resources: {
          cpuCapacity: 2000,
          cpuAllocatable: 1900,
          cpuUsed: 1200,
          memoryCapacity: 8 * 1024 * 1024 * 1024,
          memoryAllocatable: 7.5 * 1024 * 1024 * 1024,
          memoryUsed: 5 * 1024 * 1024 * 1024,
          podsCapacity: 110,
          podsUsed: 35,
        },
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'MemoryPressure', status: 'False' },
          { type: 'DiskPressure', status: 'False' },
        ],
        zone: 'us-west-2b',
        region: 'us-west-2',
      },
      {
        name: 'node-3',
        labels: {
          'kubernetes.io/hostname': 'node-3',
          'node.kubernetes.io/instance-type': 'm5.xlarge',
          'topology.kubernetes.io/zone': 'us-west-2c',
          'node-role.kubernetes.io/worker': 'true',
          'workload-type': 'compute-intensive',
        },
        taints: [
          { key: 'workload', value: 'compute', effect: 'NoSchedule' },
        ],
        resources: {
          cpuCapacity: 4000,
          cpuAllocatable: 3800,
          cpuUsed: 2000,
          memoryCapacity: 16 * 1024 * 1024 * 1024,
          memoryAllocatable: 15 * 1024 * 1024 * 1024,
          memoryUsed: 8 * 1024 * 1024 * 1024,
          podsCapacity: 110,
          podsUsed: 20,
        },
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'MemoryPressure', status: 'False' },
          { type: 'DiskPressure', status: 'False' },
        ],
        zone: 'us-west-2c',
        region: 'us-west-2',
      },
    ];

    const existingPods = [
      { name: 'orchestrator-7d8f9b', namespace: 'researchflow', nodeName: 'node-1', resources: { cpu: 250, memory: 512 * 1024 * 1024 } },
      { name: 'worker-1-abc123', namespace: 'researchflow', nodeName: 'node-1', resources: { cpu: 500, memory: 1024 * 1024 * 1024 } },
      { name: 'worker-2-def456', namespace: 'researchflow', nodeName: 'node-2', resources: { cpu: 500, memory: 1024 * 1024 * 1024 } },
      { name: 'worker-3-ghi789', namespace: 'researchflow', nodeName: 'node-2', resources: { cpu: 500, memory: 1024 * 1024 * 1024 } },
      { name: 'web-frontend-jkl012', namespace: 'researchflow', nodeName: 'node-1', resources: { cpu: 100, memory: 256 * 1024 * 1024 } },
      { name: 'redis-master-mno345', namespace: 'researchflow', nodeName: 'node-2', resources: { cpu: 200, memory: 512 * 1024 * 1024 } },
      { name: 'compute-job-pqr678', namespace: 'researchflow', nodeName: 'node-3', resources: { cpu: 2000, memory: 8 * 1024 * 1024 * 1024 } },
    ];

    return {
      id: 'default',
      name: 'Default Cluster',
      description: 'Default cluster simulation based on current environment',
      nodes,
      existingPods,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get the default cluster simulation
   */
  getDefaultCluster(): ClusterSimulation {
    return this.defaultCluster;
  }

  /**
   * Create a custom cluster simulation
   */
  createSimulation(
    name: string,
    nodes: SimulatedNode[],
    existingPods?: ClusterSimulation['existingPods'],
    description?: string
  ): ClusterSimulation {
    const simulation: ClusterSimulation = {
      id: crypto.randomUUID(),
      name,
      description,
      nodes,
      existingPods: existingPods || [],
      createdAt: new Date().toISOString(),
    };

    this.simulations.set(simulation.id, simulation);
    return simulation;
  }

  /**
   * Simulate pod scheduling
   */
  simulateScheduling(
    podSpec: PodSpec,
    simulationId?: string
  ): SchedulingResult {
    const cluster = simulationId
      ? this.simulations.get(simulationId) || this.defaultCluster
      : this.defaultCluster;

    const nodeScores: SchedulingResult['nodeScores'] = [];
    const warnings: string[] = [];

    // Evaluate each node
    for (const node of cluster.nodes) {
      const evaluation = this.evaluateNode(node, podSpec, cluster);
      nodeScores.push(evaluation);
    }

    // Sort by score (highest first) among feasible nodes
    const feasibleNodes = nodeScores.filter(n => n.feasible).sort((a, b) => b.score - a.score);

    if (feasibleNodes.length === 0) {
      const allReasons = nodeScores.flatMap(n => n.failReasons);
      return {
        podName: podSpec.name,
        schedulable: false,
        reason: `No feasible nodes. Reasons: ${[...new Set(allReasons)].join(', ')}`,
        nodeScores,
        warnings,
      };
    }

    // Select the best node
    const selectedNode = feasibleNodes[0];

    // Generate warnings
    if (selectedNode.score < 50) {
      warnings.push('Selected node has low score, consider adding more resources');
    }

    if (feasibleNodes.length === 1) {
      warnings.push('Only one feasible node available, cluster may lack redundancy');
    }

    const availableCpu = this.getNodeAvailableCpu(
      cluster.nodes.find(n => n.name === selectedNode.nodeName)!,
      cluster
    );
    if (podSpec.resources.requests.cpu > availableCpu * 0.5) {
      warnings.push('Pod will use >50% of available CPU on selected node');
    }

    return {
      podName: podSpec.name,
      schedulable: true,
      selectedNode: selectedNode.nodeName,
      score: selectedNode.score,
      reason: `Scheduled to ${selectedNode.nodeName} with score ${selectedNode.score}`,
      nodeScores,
      warnings,
    };
  }

  /**
   * Evaluate a node for pod scheduling
   */
  private evaluateNode(
    node: SimulatedNode,
    podSpec: PodSpec,
    cluster: ClusterSimulation
  ): SchedulingResult['nodeScores'][0] {
    const failReasons: string[] = [];
    let score = 100;

    // Check node conditions
    const readyCondition = node.conditions.find(c => c.type === 'Ready');
    if (!readyCondition || readyCondition.status !== 'True') {
      failReasons.push('Node not ready');
    }

    // Check resource availability
    const availableCpu = this.getNodeAvailableCpu(node, cluster);
    const availableMemory = this.getNodeAvailableMemory(node, cluster);

    if (podSpec.resources.requests.cpu > availableCpu) {
      failReasons.push(`Insufficient CPU: need ${podSpec.resources.requests.cpu}m, have ${availableCpu}m`);
    }

    if (podSpec.resources.requests.memory > availableMemory) {
      failReasons.push(`Insufficient memory: need ${this.formatMemory(podSpec.resources.requests.memory)}, have ${this.formatMemory(availableMemory)}`);
    }

    // Check pod capacity
    if (node.resources.podsUsed >= node.resources.podsCapacity) {
      failReasons.push('Node at pod capacity');
    }

    // Check node selector
    if (podSpec.nodeSelector) {
      for (const [key, value] of Object.entries(podSpec.nodeSelector)) {
        if (node.labels[key] !== value) {
          failReasons.push(`Node selector mismatch: ${key}=${value}`);
        }
      }
    }

    // Check taints and tolerations
    for (const taint of node.taints) {
      const tolerated = podSpec.tolerations?.some(t =>
        (t.key === taint.key || t.operator === 'Exists') &&
        (t.effect === taint.effect || !t.effect) &&
        (t.value === taint.value || t.operator === 'Exists')
      );

      if (!tolerated && taint.effect === 'NoSchedule') {
        failReasons.push(`Taint not tolerated: ${taint.key}=${taint.value}:${taint.effect}`);
      }
    }

    // Check node affinity
    if (podSpec.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution) {
      const requirements = podSpec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution;
      for (const req of requirements) {
        const nodeValue = node.labels[req.key];
        let matches = false;

        switch (req.operator) {
          case 'In':
            matches = req.values?.includes(nodeValue) || false;
            break;
          case 'NotIn':
            matches = !req.values?.includes(nodeValue);
            break;
          case 'Exists':
            matches = req.key in node.labels;
            break;
          case 'DoesNotExist':
            matches = !(req.key in node.labels);
            break;
        }

        if (!matches) {
          failReasons.push(`Node affinity not matched: ${req.key} ${req.operator}`);
        }
      }
    }

    // Check pod anti-affinity
    if (podSpec.affinity?.podAntiAffinity?.requiredDuringSchedulingIgnoredDuringExecution) {
      const antiAffinityRules = podSpec.affinity.podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution;
      for (const rule of antiAffinityRules) {
        const matchingPods = cluster.existingPods.filter(p => {
          if (p.nodeName !== node.name) return false;
          // Simplified label matching
          return Object.entries(rule.labelSelector.matchLabels).every(
            ([k, v]) => podSpec.labels?.[k] === v
          );
        });

        if (matchingPods.length > 0) {
          failReasons.push(`Pod anti-affinity violated on ${rule.topologyKey}`);
        }
      }
    }

    // Calculate score if feasible
    if (failReasons.length === 0) {
      // Resource balance score (prefer nodes with more available resources)
      const cpuUtilization = (node.resources.cpuUsed + podSpec.resources.requests.cpu) / node.resources.cpuAllocatable;
      const memoryUtilization = (node.resources.memoryUsed + podSpec.resources.requests.memory) / node.resources.memoryAllocatable;

      // Prefer balanced utilization around 50-70%
      const idealUtilization = 0.6;
      const cpuScore = 100 - Math.abs(cpuUtilization - idealUtilization) * 100;
      const memoryScore = 100 - Math.abs(memoryUtilization - idealUtilization) * 100;

      score = Math.round((cpuScore + memoryScore) / 2);

      // Apply preferred node affinity weights
      if (podSpec.affinity?.nodeAffinity?.preferredDuringSchedulingIgnoredDuringExecution) {
        for (const pref of podSpec.affinity.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution) {
          const nodeValue = node.labels[pref.preference.key];
          let matches = false;

          switch (pref.preference.operator) {
            case 'In':
              matches = pref.preference.values?.includes(nodeValue) || false;
              break;
            case 'Exists':
              matches = pref.preference.key in node.labels;
              break;
          }

          if (matches) {
            score += pref.weight;
          }
        }
      }

      // Prefer nodes in different zones for HA
      score = Math.min(100, Math.max(0, score));
    }

    return {
      nodeName: node.name,
      score: failReasons.length > 0 ? 0 : score,
      feasible: failReasons.length === 0,
      failReasons,
    };
  }

  /**
   * Get available CPU for a node
   */
  private getNodeAvailableCpu(node: SimulatedNode, cluster: ClusterSimulation): number {
    const usedByPods = cluster.existingPods
      .filter(p => p.nodeName === node.name)
      .reduce((sum, p) => sum + p.resources.cpu, 0);

    return node.resources.cpuAllocatable - usedByPods;
  }

  /**
   * Get available memory for a node
   */
  private getNodeAvailableMemory(node: SimulatedNode, cluster: ClusterSimulation): number {
    const usedByPods = cluster.existingPods
      .filter(p => p.nodeName === node.name)
      .reduce((sum, p) => sum + p.resources.memory, 0);

    return node.resources.memoryAllocatable - usedByPods;
  }

  /**
   * Format memory for display
   */
  private formatMemory(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}Gi`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)}Mi`;
    }
    return `${bytes}B`;
  }

  /**
   * Simulate what-if scenario
   */
  simulateWhatIf(
    scenario: WhatIfScenario,
    simulationId?: string
  ): {
    originalState: { schedulable: number; unschedulable: string[] };
    newState: { schedulable: number; unschedulable: string[] };
    impact: string;
  } {
    const cluster = simulationId
      ? this.simulations.get(simulationId) || this.defaultCluster
      : this.defaultCluster;

    // Create a copy of the cluster for modification
    const modifiedCluster: ClusterSimulation = JSON.parse(JSON.stringify(cluster));
    modifiedCluster.id = crypto.randomUUID();

    // Apply scenario
    switch (scenario.type) {
      case 'add_node': {
        const nodeSpec = scenario.parameters as Partial<SimulatedNode>;
        const newNode: SimulatedNode = {
          name: nodeSpec.name || `node-${modifiedCluster.nodes.length + 1}`,
          labels: nodeSpec.labels || { 'node-role.kubernetes.io/worker': 'true' },
          taints: nodeSpec.taints || [],
          resources: nodeSpec.resources || {
            cpuCapacity: 2000,
            cpuAllocatable: 1900,
            cpuUsed: 0,
            memoryCapacity: 8 * 1024 * 1024 * 1024,
            memoryAllocatable: 7.5 * 1024 * 1024 * 1024,
            memoryUsed: 0,
            podsCapacity: 110,
            podsUsed: 0,
          },
          conditions: [{ type: 'Ready', status: 'True' }],
        };
        modifiedCluster.nodes.push(newNode);
        break;
      }

      case 'remove_node': {
        const nodeName = scenario.parameters.nodeName as string;
        const nodeIndex = modifiedCluster.nodes.findIndex(n => n.name === nodeName);
        if (nodeIndex >= 0) {
          modifiedCluster.nodes.splice(nodeIndex, 1);
          // Pods on removed node become unscheduled
          modifiedCluster.existingPods = modifiedCluster.existingPods.filter(
            p => p.nodeName !== nodeName
          );
        }
        break;
      }

      case 'scale_deployment': {
        const { deployment, replicas } = scenario.parameters as { deployment: string; replicas: number };
        const deploymentPods = modifiedCluster.existingPods.filter(
          p => p.name.startsWith(deployment)
        );
        const currentReplicas = deploymentPods.length;
        const diff = replicas - currentReplicas;

        if (diff > 0) {
          // Add pods
          for (let i = 0; i < diff; i++) {
            modifiedCluster.existingPods.push({
              name: `${deployment}-new-${i}`,
              namespace: 'researchflow',
              nodeName: '', // Unscheduled
              resources: deploymentPods[0]?.resources || { cpu: 250, memory: 512 * 1024 * 1024 },
            });
          }
        } else if (diff < 0) {
          // Remove pods
          for (let i = 0; i < Math.abs(diff); i++) {
            const idx = modifiedCluster.existingPods.findIndex(
              p => p.name.startsWith(deployment)
            );
            if (idx >= 0) {
              modifiedCluster.existingPods.splice(idx, 1);
            }
          }
        }
        break;
      }

      case 'node_failure': {
        const nodeName = scenario.parameters.nodeName as string;
        const node = modifiedCluster.nodes.find(n => n.name === nodeName);
        if (node) {
          node.conditions = [{ type: 'Ready', status: 'False' }];
        }
        break;
      }
    }

    // Evaluate schedulability
    const evaluateSchedulability = (c: ClusterSimulation) => {
      const unschedulable: string[] = [];
      let schedulable = 0;

      for (const pod of c.existingPods) {
        if (!pod.nodeName) {
          // Try to schedule
          const result = this.simulateScheduling(
            {
              name: pod.name,
              namespace: pod.namespace,
              resources: {
                requests: pod.resources,
              },
            },
            c.id
          );

          if (result.schedulable) {
            schedulable++;
          } else {
            unschedulable.push(pod.name);
          }
        } else {
          // Already scheduled
          const node = c.nodes.find(n => n.name === pod.nodeName);
          if (node && node.conditions.find(c => c.type === 'Ready')?.status === 'True') {
            schedulable++;
          } else {
            unschedulable.push(pod.name);
          }
        }
      }

      return { schedulable, unschedulable };
    };

    const originalState = evaluateSchedulability(cluster);
    const newState = evaluateSchedulability(modifiedCluster);

    // Generate impact summary
    let impact = '';
    if (newState.schedulable > originalState.schedulable) {
      impact = `Improvement: ${newState.schedulable - originalState.schedulable} more pods schedulable`;
    } else if (newState.schedulable < originalState.schedulable) {
      impact = `Degradation: ${originalState.schedulable - newState.schedulable} pods would become unschedulable`;
    } else {
      impact = 'No change in schedulability';
    }

    return { originalState, newState, impact };
  }

  /**
   * Get cluster resource summary
   */
  getClusterSummary(simulationId?: string): {
    totalNodes: number;
    readyNodes: number;
    totalCpu: number;
    usedCpu: number;
    totalMemory: number;
    usedMemory: number;
    totalPods: number;
    runningPods: number;
    nodeUtilization: Array<{
      name: string;
      cpuPercent: number;
      memoryPercent: number;
      podsPercent: number;
    }>;
  } {
    const cluster = simulationId
      ? this.simulations.get(simulationId) || this.defaultCluster
      : this.defaultCluster;

    let totalCpu = 0;
    let usedCpu = 0;
    let totalMemory = 0;
    let usedMemory = 0;
    let totalPodCapacity = 0;
    let readyNodes = 0;

    const nodeUtilization = cluster.nodes.map(node => {
      totalCpu += node.resources.cpuAllocatable;
      totalMemory += node.resources.memoryAllocatable;
      totalPodCapacity += node.resources.podsCapacity;

      const nodeCpuUsed = cluster.existingPods
        .filter(p => p.nodeName === node.name)
        .reduce((sum, p) => sum + p.resources.cpu, 0);

      const nodeMemoryUsed = cluster.existingPods
        .filter(p => p.nodeName === node.name)
        .reduce((sum, p) => sum + p.resources.memory, 0);

      const nodePods = cluster.existingPods.filter(p => p.nodeName === node.name).length;

      usedCpu += nodeCpuUsed;
      usedMemory += nodeMemoryUsed;

      if (node.conditions.find(c => c.type === 'Ready')?.status === 'True') {
        readyNodes++;
      }

      return {
        name: node.name,
        cpuPercent: Math.round((nodeCpuUsed / node.resources.cpuAllocatable) * 100),
        memoryPercent: Math.round((nodeMemoryUsed / node.resources.memoryAllocatable) * 100),
        podsPercent: Math.round((nodePods / node.resources.podsCapacity) * 100),
      };
    });

    return {
      totalNodes: cluster.nodes.length,
      readyNodes,
      totalCpu,
      usedCpu,
      totalMemory,
      usedMemory,
      totalPods: totalPodCapacity,
      runningPods: cluster.existingPods.length,
      nodeUtilization,
    };
  }

  /**
   * Get all simulations
   */
  getSimulations(): ClusterSimulation[] {
    return [this.defaultCluster, ...Array.from(this.simulations.values())];
  }

  /**
   * Delete a simulation
   */
  deleteSimulation(id: string): boolean {
    return this.simulations.delete(id);
  }
}

// Export singleton instance
export const schedulerSimulatorService = new SchedulerSimulatorService();

export default schedulerSimulatorService;
