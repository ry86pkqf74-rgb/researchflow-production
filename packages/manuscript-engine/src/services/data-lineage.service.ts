import { v4 as uuid } from 'uuid';

export type LineageNodeType =
  | 'upload'
  | 'processing'
  | 'extraction'
  | 'transformation'
  | 'phi_scan'
  | 'section_insert'
  | 'export';

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string;
  timestamp: Date;
  userId: string;
  sourceId?: string;
  auditHash?: string;
  manuscriptSection?: string;
  details?: Record<string, unknown>;
}

export interface LineageEdge {
  from: string;
  to: string;
  relationship: 'derived_from' | 'processed_by' | 'inserted_into' | 'exported_from';
  timestamp: Date;
}

export class DataLineageService {
  private nodes: Map<string, LineageNode> = new Map();
  private edges: LineageEdge[] = [];

  recordEvent(params: {
    manuscriptId: string;
    type: LineageNodeType;
    label: string;
    userId: string;
    sourceId?: string;
    section?: string;
    auditHash?: string;
    details?: Record<string, unknown>;
  }): LineageNode {
    const node: LineageNode = {
      id: uuid(),
      type: params.type,
      label: params.label,
      timestamp: new Date(),
      userId: params.userId,
      sourceId: params.sourceId,
      manuscriptSection: params.section,
      auditHash: params.auditHash,
      details: { ...params.details, manuscriptId: params.manuscriptId }
    };

    this.nodes.set(node.id, node);

    if (params.sourceId && this.nodes.has(params.sourceId)) {
      this.edges.push({
        from: params.sourceId,
        to: node.id,
        relationship: this.inferRelationship(params.type),
        timestamp: new Date()
      });
    }

    return node;
  }

  traceToSource(nodeId: string): LineageNode[] {
    const path: LineageNode[] = [];
    let currentId: string | undefined = nodeId;

    while (currentId) {
      const node = this.nodes.get(currentId);
      if (!node) break;
      path.unshift(node);
      const edge = this.edges.find(e => e.to === currentId);
      currentId = edge?.from;
    }

    return path;
  }

  private inferRelationship(type: LineageNodeType): LineageEdge['relationship'] {
    switch (type) {
      case 'processing':
      case 'transformation':
        return 'processed_by';
      case 'section_insert':
        return 'inserted_into';
      case 'export':
        return 'exported_from';
      default:
        return 'derived_from';
    }
  }
}

export const dataLineageService = new DataLineageService();
