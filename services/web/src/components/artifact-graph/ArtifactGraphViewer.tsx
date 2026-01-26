/**
 * Artifact Graph Viewer
 *
 * Visualizes the artifact provenance graph using React Flow.
 * Shows relationships between topics, literature, datasets, analyses, manuscripts, and conference materials.
 *
 * Features:
 * - Interactive graph visualization
 * - Node filtering by type
 * - Outdated artifact highlighting
 * - Click to view artifact details
 * - Depth control for graph traversal
 */

import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

interface Artifact {
  id: string;
  type: string;
  name: string;
  status: string;
  updatedAt: string;
  phiStatus?: string;
}

interface ArtifactEdge {
  id: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  relationType: string;
  transformationType?: string;
}

interface ArtifactGraph {
  nodes: Artifact[];
  edges: ArtifactEdge[];
  outdatedNodes: string[];
  rootArtifactId: string;
}

interface ArtifactGraphViewerProps {
  artifactId: string;
  depth?: number;
  direction?: 'upstream' | 'downstream' | 'both';
  onNodeClick?: (artifact: Artifact) => void;
  className?: string;
}

// Node colors by artifact type
const ARTIFACT_TYPE_COLORS: Record<string, string> = {
  topic: '#8B5CF6', // Purple
  literature: '#3B82F6', // Blue
  dataset: '#10B981', // Green
  analysis: '#F59E0B', // Amber
  manuscript: '#EF4444', // Red
  conference_poster: '#EC4899', // Pink
  conference_slides: '#EC4899',
  conference_abstract: '#EC4899',
  figure: '#6366F1', // Indigo
  table: '#6366F1',
};

// Relation type labels
const RELATION_TYPE_LABELS: Record<string, string> = {
  derived_from: 'Derived From',
  references: 'References',
  supersedes: 'Supersedes',
  uses: 'Uses',
  generated_from: 'Generated From',
  exported_to: 'Exported To',
  annotates: 'Annotates',
};

export function ArtifactGraphViewer({
  artifactId,
  depth = 3,
  direction = 'both',
  onNodeClick,
  className = '',
}: ArtifactGraphViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<ArtifactGraph | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Fetch graph data
  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v2/artifacts/${artifactId}/graph?depth=${depth}&direction=${direction}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch artifact graph');
      }

      const data: ArtifactGraph = await response.json();
      setGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [artifactId, depth, direction]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Convert graph data to React Flow nodes and edges
  useEffect(() => {
    if (!graphData) return;

    // Create nodes
    const flowNodes: Node[] = graphData.nodes.map((artifact, index) => {
      const isRoot = artifact.id === graphData.rootArtifactId;
      const isOutdated = graphData.outdatedNodes.includes(artifact.id);

      return {
        id: artifact.id,
        type: 'default',
        position: { x: 0, y: index * 100 }, // Will be auto-laid out
        data: {
          label: (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{artifact.name}</span>
                {isRoot && <Badge variant="outline">Root</Badge>}
                {isOutdated && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Outdated
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize">
                {artifact.type.replace(/_/g, ' ')}
              </span>
              {artifact.phiStatus && (
                <Badge
                  variant={artifact.phiStatus === 'PASS' ? 'default' : 'destructive'}
                  className="mt-1 text-xs"
                >
                  PHI: {artifact.phiStatus}
                </Badge>
              )}
            </div>
          ),
        },
        style: {
          background: ARTIFACT_TYPE_COLORS[artifact.type] || '#6B7280',
          color: 'white',
          border: isRoot ? '3px solid #FFF' : isOutdated ? '2px solid #EF4444' : 'none',
          borderRadius: '8px',
          padding: '12px',
          minWidth: '200px',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    // Create edges
    const flowEdges: Edge[] = graphData.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceArtifactId,
      target: edge.targetArtifactId,
      label: RELATION_TYPE_LABELS[edge.relationType] || edge.relationType,
      type: 'smoothstep',
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      style: {
        strokeWidth: 2,
      },
      labelStyle: {
        fontSize: 10,
        fill: '#6B7280',
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, setNodes, setEdges]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const artifact = graphData?.nodes.find((a) => a.id === node.id);
      if (artifact && onNodeClick) {
        onNodeClick(artifact);
      }
    },
    [graphData, onNodeClick]
  );

  // Filter nodes by type
  const filterByType = (type: string | null) => {
    setSelectedType(type);

    if (!graphData) return;

    if (type === null) {
      // Reset to show all nodes
      const allNodes = graphData.nodes.map((artifact) =>
        nodes.find((n) => n.id === artifact.id)
      ).filter(Boolean) as Node[];
      setNodes(allNodes);
    } else {
      // Filter nodes
      const filtered = nodes.filter((node) => {
        const artifact = graphData.nodes.find((a) => a.id === node.id);
        return artifact?.type === type;
      });
      setNodes(filtered);
    }
  };

  // Get unique artifact types
  const artifactTypes = graphData
    ? Array.from(new Set(graphData.nodes.map((a) => a.type)))
    : [];

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchGraph} className="mt-4" variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      {/* Toolbar */}
      <div className="border-b p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Artifact Provenance Graph</h3>
          <Button onClick={fetchGraph} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => filterByType(null)}
            variant={selectedType === null ? 'default' : 'outline'}
            size="sm"
          >
            All
          </Button>
          {artifactTypes.map((type) => (
            <Button
              key={type}
              onClick={() => filterByType(type)}
              variant={selectedType === type ? 'default' : 'outline'}
              size="sm"
              style={{
                backgroundColor:
                  selectedType === type
                    ? ARTIFACT_TYPE_COLORS[type]
                    : undefined,
              }}
            >
              {type.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>

        {/* Stats */}
        {graphData && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{graphData.nodes.length} artifacts</span>
            <span>{graphData.edges.length} relationships</span>
            {graphData.outdatedNodes.length > 0 && (
              <span className="text-destructive font-medium">
                {graphData.outdatedNodes.length} outdated
              </span>
            )}
          </div>
        )}
      </div>

      {/* Graph visualization */}
      <div style={{ height: '600px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const artifact = graphData?.nodes.find((a) => a.id === node.id);
              return artifact
                ? ARTIFACT_TYPE_COLORS[artifact.type] || '#6B7280'
                : '#6B7280';
            }}
          />
        </ReactFlow>
      </div>
    </Card>
  );
}
