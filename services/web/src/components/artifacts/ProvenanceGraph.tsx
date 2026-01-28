/**
 * ART-006: Provenance Graph Visualization Component
 * Show artifact lineage (which stage created what)
 * Interactive graph showing data flow
 */

import React, { useMemo } from 'react';
import { GitBranch, Database, FileOutput, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ProvenanceNode {
  id: string;
  name: string;
  type: 'run' | 'stage' | 'artifact';
  stageType?: string;
  timestamp?: string;
  size?: number;
  status?: 'success' | 'error' | 'running';
}

export interface ProvenanceEdge {
  from: string;
  to: string;
  label?: string;
}

interface ProvenanceGraphProps {
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
  className?: string;
}

function getNodeIcon(type: string) {
  switch (type) {
    case 'run':
      return <GitBranch className="h-5 w-5" />;
    case 'stage':
      return <Database className="h-5 w-5" />;
    case 'artifact':
      return <FileOutput className="h-5 w-5" />;
    default:
      return <Database className="h-5 w-5" />;
  }
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400';
    case 'error':
      return 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400';
    case 'running':
      return 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400 animate-pulse';
    default:
      return 'bg-muted border-muted-foreground/20 text-muted-foreground';
  }
}

/**
 * Simplified linear provenance graph
 * Shows the flow of data through stages
 */
export function ProvenanceGraph({
  nodes,
  edges,
  className,
}: ProvenanceGraphProps) {
  // Sort nodes by type for display
  const sortedNodes = useMemo(() => {
    const runs = nodes.filter((n) => n.type === 'run');
    const stages = nodes.filter((n) => n.type === 'stage');
    const artifacts = nodes.filter((n) => n.type === 'artifact');
    return [runs, stages, artifacts].filter((g) => g.length > 0).flat();
  }, [nodes]);

  // Group nodes by column for layout
  const nodesByLevel = useMemo(() => {
    const levels: Map<number, ProvenanceNode[]> = new Map();
    const visited = new Set<string>();

    const getLevel = (nodeId: string, level = 0): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const incomingEdges = edges.filter((e) => e.to === nodeId);
      if (incomingEdges.length === 0) return level;

      return Math.max(
        ...incomingEdges.map((e) => getLevel(e.from, level + 1))
      );
    };

    sortedNodes.forEach((node) => {
      const level = getLevel(node.id);
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node);
    });

    return levels;
  }, [sortedNodes, edges]);

  const maxLevel = Math.max(...nodesByLevel.keys(), 0);

  if (sortedNodes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No provenance data available
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="inline-flex gap-8 p-4 min-w-full">
        {Array.from({ length: maxLevel + 1 }).map((_, level) => {
          const levelNodes = nodesByLevel.get(level) || [];

          return (
            <div key={level} className="flex flex-col gap-4">
              {levelNodes.map((node) => (
                <div
                  key={node.id}
                  className={cn(
                    'border rounded-lg p-4 min-w-[200px]',
                    getStatusColor(node.status)
                  )}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="text-primary">{getNodeIcon(node.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{node.name}</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {node.type}
                      </Badge>
                    </div>
                  </div>

                  {node.stageType && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Stage: {node.stageType}
                    </p>
                  )}

                  {node.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(node.timestamp).toLocaleDateString()}
                    </p>
                  )}

                  {node.size !== undefined && node.type === 'artifact' && (
                    <p className="text-xs text-muted-foreground">
                      Size: {formatBytes(node.size)}
                    </p>
                  )}
                </div>
              ))}

              {level < maxLevel && (
                <div className="flex justify-center">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {edges.length > 0 && (
        <div className="text-xs text-muted-foreground text-center py-2 px-4">
          {edges.length} connections · {sortedNodes.length} entities
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default ProvenanceGraph;
