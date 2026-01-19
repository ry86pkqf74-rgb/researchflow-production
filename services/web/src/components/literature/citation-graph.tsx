/**
 * Citation Graph Visualization Component
 * Task: Visualize citation networks and relationships
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Filter,
  RefreshCw,
  Info
} from 'lucide-react';

// Types
interface CitationNode {
  id: string;
  title: string;
  authors: string[];
  year: number;
  citationCount: number;
  isSource: boolean;
  doi?: string;
  abstract?: string;
}

interface CitationEdge {
  source: string;
  target: string;
  type: 'cites' | 'cited_by';
}

interface CitationGraphData {
  nodes: CitationNode[];
  edges: CitationEdge[];
}

interface CitationGraphProps {
  data: CitationGraphData;
  onNodeClick?: (node: CitationNode) => void;
  onNodeHover?: (node: CitationNode | null) => void;
  height?: number;
  width?: number;
}

// Force simulation parameters
const SIMULATION_CONFIG = {
  chargeStrength: -300,
  linkDistance: 100,
  collisionRadius: 30,
  centerForce: 0.1,
};

// Node rendering configuration
const NODE_CONFIG = {
  minRadius: 8,
  maxRadius: 30,
  sourceColor: '#2563eb',
  citesColor: '#16a34a',
  citedByColor: '#dc2626',
  defaultColor: '#6b7280',
};

export function CitationGraph({
  data,
  onNodeClick,
  onNodeHover,
  height = 600,
  width = 800
}: CitationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<CitationNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CitationNode | null>(null);
  const [filterYear, setFilterYear] = useState<[number, number]>([1990, 2024]);
  const [showLabels, setShowLabels] = useState(true);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Calculate node radius based on citation count
  const getNodeRadius = useCallback((node: CitationNode) => {
    const maxCitations = Math.max(...data.nodes.map(n => n.citationCount || 1));
    const normalized = (node.citationCount || 1) / maxCitations;
    return NODE_CONFIG.minRadius + normalized * (NODE_CONFIG.maxRadius - NODE_CONFIG.minRadius);
  }, [data.nodes]);

  // Get node color based on relationship
  const getNodeColor = useCallback((node: CitationNode) => {
    if (node.isSource) return NODE_CONFIG.sourceColor;

    const incomingEdges = data.edges.filter(e => e.target === node.id);
    const outgoingEdges = data.edges.filter(e => e.source === node.id);

    if (incomingEdges.length > outgoingEdges.length) {
      return NODE_CONFIG.citesColor;
    } else if (outgoingEdges.length > incomingEdges.length) {
      return NODE_CONFIG.citedByColor;
    }
    return NODE_CONFIG.defaultColor;
  }, [data.edges]);

  // Initialize node positions using force-directed layout simulation
  useEffect(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize random positions
    data.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / data.nodes.length;
      const radius = 150 + Math.random() * 100;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    // Simple force simulation (10 iterations)
    for (let iter = 0; iter < 50; iter++) {
      // Repulsion between nodes
      data.nodes.forEach((node1, i) => {
        data.nodes.forEach((node2, j) => {
          if (i >= j) return;

          const pos1 = positions.get(node1.id)!;
          const pos2 = positions.get(node2.id)!;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = SIMULATION_CONFIG.chargeStrength / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          pos1.x -= fx;
          pos1.y -= fy;
          pos2.x += fx;
          pos2.y += fy;
        });
      });

      // Attraction along edges
      data.edges.forEach(edge => {
        const sourcePos = positions.get(edge.source);
        const targetPos = positions.get(edge.target);

        if (sourcePos && targetPos) {
          const dx = targetPos.x - sourcePos.x;
          const dy = targetPos.y - sourcePos.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = (distance - SIMULATION_CONFIG.linkDistance) * 0.01;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          sourcePos.x += fx;
          sourcePos.y += fy;
          targetPos.x -= fx;
          targetPos.y -= fy;
        }
      });

      // Center gravity
      data.nodes.forEach(node => {
        const pos = positions.get(node.id)!;
        pos.x += (centerX - pos.x) * SIMULATION_CONFIG.centerForce;
        pos.y += (centerY - pos.y) * SIMULATION_CONFIG.centerForce;
      });
    }

    setNodePositions(positions);
  }, [data, width, height]);

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodePositions.size === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Apply zoom and offset
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Filter nodes by year
    const filteredNodes = data.nodes.filter(
      node => node.year >= filterYear[0] && node.year <= filterYear[1]
    );
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    // Draw edges
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    data.edges.forEach(edge => {
      if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) return;

      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);

      if (sourcePos && targetPos) {
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();

        // Draw arrow
        const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
        const targetNode = data.nodes.find(n => n.id === edge.target);
        const radius = targetNode ? getNodeRadius(targetNode) : 10;

        const arrowX = targetPos.x - radius * Math.cos(angle);
        const arrowY = targetPos.y - radius * Math.sin(angle);

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fillStyle = '#9ca3af';
        ctx.fill();
        ctx.restore();
      }
    });

    // Draw nodes
    filteredNodes.forEach(node => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      const radius = getNodeRadius(node);
      const color = getNodeColor(node);
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Highlight ring
      if (isHovered || isSelected) {
        ctx.strokeStyle = isSelected ? '#fbbf24' : '#60a5fa';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Label
      if (showLabels && radius > 12) {
        ctx.fillStyle = '#1f2937';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const label = node.title.length > 20 ? node.title.substring(0, 20) + '...' : node.title;
        ctx.fillText(label, pos.x, pos.y + radius + 12);
      }
    });

    ctx.restore();
  }, [data, nodePositions, zoom, offset, filterYear, showLabels, hoveredNode, selectedNode, getNodeRadius, getNodeColor, width, height]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    // Check for node hover
    let found: CitationNode | null = null;
    for (const node of data.nodes) {
      const pos = nodePositions.get(node.id);
      if (pos) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance <= getNodeRadius(node)) {
          found = node;
          break;
        }
      }
    }

    setHoveredNode(found);
    onNodeHover?.(found);
    canvas.style.cursor = found ? 'pointer' : isDragging.current ? 'grabbing' : 'grab';

    // Handle dragging
    if (isDragging.current) {
      setOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Check for click on node
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    for (const node of data.nodes) {
      const pos = nodePositions.get(node.id);
      if (pos) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance <= getNodeRadius(node)) {
          setSelectedNode(node);
          onNodeClick?.(node);
          return;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.1, Math.min(3, z * delta)));
  };

  const handleZoomIn = () => setZoom(z => Math.min(3, z * 1.2));
  const handleZoomOut = () => setZoom(z => Math.max(0.1, z / 1.2));
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'citation-graph.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Statistics
  const stats = {
    totalNodes: data.nodes.length,
    totalEdges: data.edges.length,
    avgCitations: Math.round(data.nodes.reduce((sum, n) => sum + (n.citationCount || 0), 0) / data.nodes.length),
    yearRange: [Math.min(...data.nodes.map(n => n.year)), Math.max(...data.nodes.map(n => n.year))]
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Citation Network</CardTitle>
            <CardDescription>
              {stats.totalNodes} papers, {stats.totalEdges} citations ({stats.yearRange[0]}-{stats.yearRange[1]})
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Year: {filterYear[0]} - {filterYear[1]}</span>
            <Slider
              className="w-48"
              min={1990}
              max={2024}
              step={1}
              value={filterYear}
              onValueChange={(value) => setFilterYear(value as [number, number])}
            />
          </div>
          <Button
            variant={showLabels ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLabels(!showLabels)}
          >
            Labels
          </Button>
        </div>

        <div className="relative border rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { isDragging.current = false; setHoveredNode(null); }}
            onWheel={handleWheel}
            className="bg-gray-50"
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white/90 p-3 rounded-lg shadow-sm">
            <div className="text-xs font-medium mb-2">Legend</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_CONFIG.sourceColor }} />
                <span className="text-xs">Source paper</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_CONFIG.citesColor }} />
                <span className="text-xs">Cites source</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_CONFIG.citedByColor }} />
                <span className="text-xs">Cited by source</span>
              </div>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredNode && (
            <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg max-w-xs">
              <div className="font-medium text-sm">{hoveredNode.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {hoveredNode.authors.slice(0, 2).join(', ')}{hoveredNode.authors.length > 2 ? ' et al.' : ''} ({hoveredNode.year})
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{hoveredNode.citationCount} citations</Badge>
                {hoveredNode.doi && <Badge variant="outline">DOI</Badge>}
              </div>
            </div>
          )}
        </div>

        {/* Selected node details */}
        {selectedNode && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{selectedNode.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedNode.authors.join(', ')} ({selectedNode.year})
                </p>
                {selectedNode.abstract && (
                  <p className="text-sm mt-2 line-clamp-3">{selectedNode.abstract}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 mt-3">
              <Badge>{selectedNode.citationCount} citations</Badge>
              {selectedNode.doi && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => window.open(`https://doi.org/${selectedNode.doi}`, '_blank')}>
                  DOI: {selectedNode.doi}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CitationGraph;
