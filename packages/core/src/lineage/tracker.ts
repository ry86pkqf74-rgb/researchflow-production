/**
 * Data Lineage Tracking System
 *
 * Tracks the complete provenance of data artifacts through transformations,
 * validations, and dependencies. Provides full data lineage graphs for
 * reproducibility and compliance.
 *
 * Features:
 * - Input/output tracking
 * - Transformation logging
 * - Dependency graphs
 * - Backward/forward lineage
 * - Export to standard formats (PROV-JSON, etc.)
 */

export interface LineageNode {
  id: string; // Unique identifier for this node
  type: 'input' | 'transformation' | 'output' | 'validation' | 'aggregation';
  timestamp: string; // ISO 8601
  metadata: Record<string, any>;
  name?: string; // Human-readable name
  description?: string;
}

export interface LineageEdge {
  from: string; // Source node ID
  to: string; // Target node ID
  relationship: 'derived_from' | 'transformed_by' | 'validated_by' | 'aggregated_from' | 'depends_on';
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  metadata: {
    createdAt: string;
    schema_version: string;
    root_node?: string;
  };
}

/**
 * Lineage Tracker - Main class for tracking data lineage
 */
export class LineageTracker {
  private nodes: Map<string, LineageNode> = new Map();
  private edges: LineageEdge[] = [];
  private metadata: Record<string, any> = {};

  constructor(metadata?: Record<string, any>) {
    this.metadata = metadata || {};
    this.metadata.createdAt = new Date().toISOString();
    this.metadata.schema_version = '1.0.0';
  }

  /**
   * Add a node to the lineage graph
   */
  addNode(node: LineageNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node already exists: ${node.id}`);
    }
    this.nodes.set(node.id, node);
  }

  /**
   * Add an edge between nodes
   */
  addEdge(edge: LineageEdge): void {
    if (!this.nodes.has(edge.from)) {
      throw new Error(`Source node not found: ${edge.from}`);
    }
    if (!this.nodes.has(edge.to)) {
      throw new Error(`Target node not found: ${edge.to}`);
    }

    this.edges.push({
      ...edge,
      timestamp: edge.timestamp || new Date().toISOString()
    });
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): LineageNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(type: LineageNode['type']): LineageNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /**
   * Get upstream nodes (what this node was derived from)
   */
  getUpstream(nodeId: string, maxDepth?: number): LineageNode[] {
    return this._traverse(nodeId, 'upstream', maxDepth);
  }

  /**
   * Get downstream nodes (what was derived from this node)
   */
  getDownstream(nodeId: string, maxDepth?: number): LineageNode[] {
    return this._traverse(nodeId, 'downstream', maxDepth);
  }

  /**
   * Get direct parents of a node
   */
  getParents(nodeId: string): LineageNode[] {
    const parentIds = this.edges
      .filter(e => e.to === nodeId)
      .map(e => e.from);

    return parentIds
      .map(id => this.nodes.get(id))
      .filter(Boolean) as LineageNode[];
  }

  /**
   * Get direct children of a node
   */
  getChildren(nodeId: string): LineageNode[] {
    const childIds = this.edges
      .filter(e => e.from === nodeId)
      .map(e => e.to);

    return childIds
      .map(id => this.nodes.get(id))
      .filter(Boolean) as LineageNode[];
  }

  /**
   * Get edges connected to a node
   */
  getEdges(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): LineageEdge[] {
    if (direction === 'in') {
      return this.edges.filter(e => e.to === nodeId);
    } else if (direction === 'out') {
      return this.edges.filter(e => e.from === nodeId);
    } else {
      return this.edges.filter(e => e.from === nodeId || e.to === nodeId);
    }
  }

  /**
   * Find all root nodes (nodes with no parents)
   */
  getRootNodes(): LineageNode[] {
    const nodesWithParents = new Set(this.edges.map(e => e.to));
    return Array.from(this.nodes.values()).filter(
      n => !nodesWithParents.has(n.id)
    );
  }

  /**
   * Find all leaf nodes (nodes with no children)
   */
  getLeafNodes(): LineageNode[] {
    const nodesWithChildren = new Set(this.edges.map(e => e.from));
    return Array.from(this.nodes.values()).filter(
      n => !nodesWithChildren.has(n.id)
    );
  }

  /**
   * Export lineage graph
   */
  exportGraph(): LineageGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      metadata: {
        createdAt: this.metadata.createdAt,
        schema_version: this.metadata.schema_version,
        root_node: this.getRootNodes()[0]?.id
      }
    };
  }

  /**
   * Import lineage graph
   */
  importGraph(graph: LineageGraph): void {
    this.nodes.clear();
    this.edges = [];

    for (const node of graph.nodes) {
      this.nodes.set(node.id, node);
    }

    this.edges = graph.edges;
    this.metadata = graph.metadata || {};
  }

  /**
   * Export to PROV-JSON format (W3C standard)
   */
  exportProvJSON(): any {
    const entities: Record<string, any> = {};
    const activities: Record<string, any> = {};
    const agents: Record<string, any> = {};
    const derivations: any[] = [];
    const generations: any[] = [];
    const usages: any[] = [];

    // Convert nodes to PROV entities/activities
    for (const node of this.nodes.values()) {
      if (node.type === 'transformation' || node.type === 'validation') {
        // Activity
        activities[node.id] = {
          'prov:type': node.type,
          'prov:startTime': node.timestamp,
          ...node.metadata
        };
      } else {
        // Entity
        entities[node.id] = {
          'prov:type': node.type,
          'prov:generatedAtTime': node.timestamp,
          ...node.metadata
        };
      }
    }

    // Convert edges to PROV relations
    for (const edge of this.edges) {
      if (edge.relationship === 'derived_from') {
        derivations.push({
          'prov:generatedEntity': edge.to,
          'prov:usedEntity': edge.from,
          'prov:time': edge.timestamp
        });
      } else if (edge.relationship === 'transformed_by') {
        generations.push({
          'prov:entity': edge.to,
          'prov:activity': edge.from,
          'prov:time': edge.timestamp
        });
      }
    }

    return {
      'prefix': {
        'prov': 'http://www.w3.org/ns/prov#',
        'researchflow': 'http://researchflow.com/prov#'
      },
      'entity': entities,
      'activity': activities,
      'wasDerivedFrom': derivations,
      'wasGeneratedBy': generations,
      'used': usages
    };
  }

  /**
   * Export to Mermaid diagram format
   */
  exportMermaid(): string {
    const lines: string[] = ['graph TD'];

    // Add nodes
    for (const node of this.nodes.values()) {
      const shape = this._getMermaidShape(node.type);
      const label = node.name || node.id;
      lines.push(`  ${node.id}${shape[0]}"${label}"${shape[1]}`);
    }

    // Add edges
    for (const edge of this.edges) {
      const arrow = this._getMermaidArrow(edge.relationship);
      lines.push(`  ${edge.from} ${arrow} ${edge.to}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate lineage summary
   */
  generateSummary(): string {
    const lines: string[] = [];

    lines.push('# Data Lineage Summary');
    lines.push('');
    lines.push(`**Total Nodes**: ${this.nodes.size}`);
    lines.push(`**Total Edges**: ${this.edges.length}`);
    lines.push(`**Root Nodes**: ${this.getRootNodes().length}`);
    lines.push(`**Leaf Nodes**: ${this.getLeafNodes().length}`);
    lines.push('');

    // Node type breakdown
    const typeCount: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      typeCount[node.type] = (typeCount[node.type] || 0) + 1;
    }

    lines.push('## Node Types');
    for (const [type, count] of Object.entries(typeCount)) {
      lines.push(`- ${type}: ${count}`);
    }

    return lines.join('\n');
  }

  /**
   * Private method for graph traversal
   */
  private _traverse(
    startId: string,
    direction: 'upstream' | 'downstream',
    maxDepth?: number
  ): LineageNode[] {
    const visited = new Set<string>();
    const result: LineageNode[] = [];
    const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || (maxDepth !== undefined && depth > maxDepth)) {
        continue;
      }

      visited.add(id);
      const node = this.nodes.get(id);

      if (node && id !== startId) {
        result.push(node);
      }

      // Get neighbors
      const neighbors = direction === 'upstream'
        ? this.getParents(id)
        : this.getChildren(id);

      for (const neighbor of neighbors) {
        queue.push({ id: neighbor.id, depth: depth + 1 });
      }
    }

    return result;
  }

  private _getMermaidShape(type: LineageNode['type']): [string, string] {
    switch (type) {
      case 'input':
        return ['[', ']']; // Rectangle
      case 'output':
        return ['([', '])'];  // Stadium
      case 'transformation':
        return ['{{', '}}']; // Hexagon
      case 'validation':
        return ['{', '}']; // Rhombus
      case 'aggregation':
        return ['[[', ']]']; // Subroutine
      default:
        return ['(', ')']; // Rounded rectangle
    }
  }

  private _getMermaidArrow(relationship: LineageEdge['relationship']): string {
    switch (relationship) {
      case 'derived_from':
        return '-->|derived from|';
      case 'transformed_by':
        return '-->|transformed|';
      case 'validated_by':
        return '-.->|validated|';
      case 'aggregated_from':
        return '==>|aggregated|';
      case 'depends_on':
        return '-.->|depends|';
      default:
        return '-->';
    }
  }
}

/**
 * Helper function to create a lineage node
 */
export function createLineageNode(
  id: string,
  type: LineageNode['type'],
  metadata?: Record<string, any>
): LineageNode {
  return {
    id,
    type,
    timestamp: new Date().toISOString(),
    metadata: metadata || {}
  };
}

/**
 * Helper function to track a simple transformation
 */
export function trackTransformation(
  tracker: LineageTracker,
  inputId: string,
  outputId: string,
  transformationId: string,
  transformationMetadata?: Record<string, any>
): void {
  // Add transformation node
  tracker.addNode(
    createLineageNode(transformationId, 'transformation', transformationMetadata)
  );

  // Link input -> transformation -> output
  tracker.addEdge({
    from: inputId,
    to: transformationId,
    relationship: 'transformed_by'
  });

  tracker.addEdge({
    from: transformationId,
    to: outputId,
    relationship: 'derived_from'
  });
}

// Example usage
if (require.main === module) {
  // Create tracker
  const tracker = new LineageTracker({
    project: 'thyroid-research',
    pipeline: 'data-processing'
  });

  // Add nodes
  tracker.addNode({
    id: 'raw_data_001',
    type: 'input',
    timestamp: new Date().toISOString(),
    metadata: {
      filename: 'thyroid_data.xlsx',
      rows: 1000
    }
  });

  tracker.addNode({
    id: 'clean_001',
    type: 'transformation',
    timestamp: new Date().toISOString(),
    metadata: {
      operation: 'remove_nulls',
      rows_removed: 50
    }
  });

  tracker.addNode({
    id: 'cleaned_data_001',
    type: 'output',
    timestamp: new Date().toISOString(),
    metadata: {
      rows: 950,
      format: 'parquet'
    }
  });

  // Add edges
  tracker.addEdge({
    from: 'raw_data_001',
    to: 'clean_001',
    relationship: 'transformed_by'
  });

  tracker.addEdge({
    from: 'clean_001',
    to: 'cleaned_data_001',
    relationship: 'derived_from'
  });

  // Query lineage
  console.log('Upstream of cleaned_data_001:');
  console.log(tracker.getUpstream('cleaned_data_001'));

  // Export graph
  const graph = tracker.exportGraph();
  console.log('\nLineage Graph:');
  console.log(JSON.stringify(graph, null, 2));

  // Generate Mermaid diagram
  console.log('\nMermaid Diagram:');
  console.log(tracker.exportMermaid());

  // Generate summary
  console.log('\n' + tracker.generateSummary());
}
