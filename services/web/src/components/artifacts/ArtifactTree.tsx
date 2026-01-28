/**
 * ART-001: Artifact Tree View Component
 * Hierarchical view of artifacts: Run → Stage → Output
 * Expandable folders with file icons and sizes
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  FileCode,
  FileJson,
  Table,
  Image,
  File,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface TreeNode {
  id: string;
  name: string;
  type: 'run' | 'stage' | 'file';
  mimeType?: string;
  size?: number;
  children?: TreeNode[];
  metadata?: Record<string, unknown>;
}

interface ArtifactTreeProps {
  nodes: TreeNode[];
  onSelectFile?: (node: TreeNode) => void;
  onDownload?: (node: TreeNode) => void;
  expandedIds?: Set<string>;
  className?: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'application/json': FileJson,
  'text/csv': Table,
  'text/plain': FileText,
  'text/markdown': FileText,
  'image/png': Image,
  'image/jpeg': Image,
  'image/svg+xml': Image,
  'application/pdf': File,
};

function getFileIcon(mimeType?: string, type?: string): React.ComponentType<{ className?: string }> {
  if (mimeType && TYPE_ICONS[mimeType]) {
    return TYPE_ICONS[mimeType];
  }

  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.startsWith('text/code') || mimeType?.startsWith('application/')) {
    return FileCode;
  }

  return FileText;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function TreeNodeItem({
  node,
  level = 0,
  expanded,
  onToggle,
  onSelectFile,
  onDownload,
}: {
  node: TreeNode;
  level?: number;
  expanded?: boolean;
  onToggle: (id: string) => void;
  onSelectFile?: (node: TreeNode) => void;
  onDownload?: (node: TreeNode) => void;
}) {
  const isFolder = node.type !== 'file';
  const hasChildren = node.children && node.children.length > 0;

  const Icon =
    node.type === 'run'
      ? Folder
      : node.type === 'stage'
        ? Folder
        : getFileIcon(node.mimeType);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded hover:bg-accent cursor-pointer group',
          'transition-colors'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren && (
          <button
            onClick={() => onToggle(node.id)}
            className="p-0 h-5 w-5 flex items-center justify-center"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        {hasChildren && !isFolder && <div className="w-5" />}

        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => !isFolder && onSelectFile?.(node)}
        >
          <p className="text-sm truncate hover:text-primary transition-colors">
            {node.name}
          </p>
        </div>

        {node.size !== undefined && !isFolder && (
          <Badge variant="outline" className="text-xs ml-2 shrink-0">
            {formatFileSize(node.size)}
          </Badge>
        )}

        {!isFolder && onDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(node);
            }}
          >
            <Download className="h-3 w-3" />
          </Button>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              onDownload={onDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArtifactTree({
  nodes,
  onSelectFile,
  onDownload,
  expandedIds: initialExpandedIds,
  className,
}: ArtifactTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    initialExpandedIds || new Set()
  );

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // Auto-expand first level for better UX
  const autoExpandFirstLevel = useMemo(() => {
    const newExpanded = new Set(expandedIds);
    nodes.forEach((node) => {
      if (node.type === 'run' && node.children) {
        newExpanded.add(node.id);
      }
    });
    return newExpanded;
  }, []);

  return (
    <div className={cn('space-y-1 p-2', className)}>
      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No artifacts available
        </p>
      ) : (
        nodes.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            expanded={autoExpandFirstLevel.has(node.id)}
            onToggle={toggleExpanded}
            onSelectFile={onSelectFile}
            onDownload={onDownload}
          />
        ))
      )}
    </div>
  );
}

export default ArtifactTree;
