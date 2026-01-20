/**
 * Artifact Preview Components
 * Task 19 - Add rich artifact preview panel with multiple format support
 * Task 32 - Add syntax highlighting for code artifacts
 * Task 36 - Implement artifact comparison view
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Image,
  FileCode,
  FileJson,
  Table,
  FileAudio,
  FileVideo,
  File,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Eye,
  Code,
  Columns,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Artifact types
export type ArtifactType =
  | 'text'
  | 'markdown'
  | 'code'
  | 'json'
  | 'csv'
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'binary';

export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  mimeType: string;
  size: number;
  url?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  stageId?: number;
  runId?: string;
}

// Type icon mapping
const TYPE_ICONS: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  markdown: FileText,
  code: FileCode,
  json: FileJson,
  csv: Table,
  image: Image,
  audio: FileAudio,
  video: FileVideo,
  pdf: File,
  binary: File,
};

// Detect artifact type from mime type
export function detectArtifactType(mimeType: string, filename?: string): ArtifactType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/json') return 'json';
  if (mimeType === 'text/csv') return 'csv';
  if (mimeType === 'text/markdown' || filename?.endsWith('.md')) return 'markdown';
  if (mimeType.startsWith('text/')) {
    // Check for code files
    const codeExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.cpp', '.c', '.h'];
    if (filename && codeExtensions.some(ext => filename.endsWith(ext))) {
      return 'code';
    }
    return 'text';
  }
  return 'binary';
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Main Artifact Preview Component
interface ArtifactPreviewProps {
  artifact: Artifact;
  onDownload?: () => void;
  onCompare?: () => void;
  showMetadata?: boolean;
  className?: string;
}

export function ArtifactPreview({
  artifact,
  onDownload,
  onCompare,
  showMetadata = false,
  className,
}: ArtifactPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const Icon = TYPE_ICONS[artifact.type];

  const handleCopy = useCallback(async () => {
    if (artifact.content) {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [artifact.content]);

  const canCopy = ['text', 'markdown', 'code', 'json', 'csv'].includes(artifact.type);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{artifact.name}</CardTitle>
              <CardDescription className="text-xs">
                {formatFileSize(artifact.size)} • {artifact.mimeType}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canCopy && (
              <Button variant="ghost" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {onCompare && (
              <Button variant="ghost" size="icon" onClick={onCompare}>
                <GitCompare className="h-4 w-4" />
              </Button>
            )}
            {onDownload && (
              <Button variant="ghost" size="icon" onClick={onDownload}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {artifact.name}
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[70vh]">
                  <ArtifactContent artifact={artifact} fullscreen />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ArtifactContent artifact={artifact} />
        {showMetadata && artifact.metadata && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Metadata</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(artifact.metadata, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Artifact Content Renderer
interface ArtifactContentProps {
  artifact: Artifact;
  fullscreen?: boolean;
}

function ArtifactContent({ artifact, fullscreen }: ArtifactContentProps) {
  const maxHeight = fullscreen ? 'max-h-none' : 'max-h-96';

  switch (artifact.type) {
    case 'image':
      return (
        <div className="flex justify-center">
          <img
            src={artifact.url}
            alt={artifact.name}
            className={cn('rounded-md object-contain', maxHeight)}
          />
        </div>
      );

    case 'audio':
      return (
        <audio controls className="w-full">
          <source src={artifact.url} type={artifact.mimeType} />
          Your browser does not support the audio element.
        </audio>
      );

    case 'video':
      return (
        <video controls className={cn('w-full rounded-md', maxHeight)}>
          <source src={artifact.url} type={artifact.mimeType} />
          Your browser does not support the video element.
        </video>
      );

    case 'pdf':
      return (
        <div className="bg-muted rounded-md p-8 text-center">
          <File className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            PDF Preview not available
          </p>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <a href={artifact.url} target="_blank" rel="noopener noreferrer">
              Open PDF
            </a>
          </Button>
        </div>
      );

    case 'code':
      return (
        <CodePreview
          content={artifact.content || ''}
          language={detectLanguage(artifact.name)}
          maxHeight={maxHeight}
        />
      );

    case 'json':
      return (
        <CodePreview
          content={formatJson(artifact.content || '')}
          language="json"
          maxHeight={maxHeight}
        />
      );

    case 'csv':
      return <CsvPreview content={artifact.content || ''} maxHeight={maxHeight} />;

    case 'markdown':
      return (
        <div className={cn('prose prose-sm dark:prose-invert', maxHeight, 'overflow-auto')}>
          {/* In production, use a markdown renderer */}
          <pre className="whitespace-pre-wrap text-sm">{artifact.content}</pre>
        </div>
      );

    case 'text':
    default:
      return (
        <ScrollArea className={maxHeight}>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded">
            {artifact.content || 'No content available'}
          </pre>
        </ScrollArea>
      );
  }
}

// Code Preview with syntax highlighting placeholder
interface CodePreviewProps {
  content: string;
  language: string;
  maxHeight?: string;
}

function CodePreview({ content, language, maxHeight }: CodePreviewProps) {
  const [viewMode, setViewMode] = useState<'code' | 'raw'>('code');

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Badge variant="secondary">{language}</Badge>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'code' | 'raw')}>
          <TabsList className="h-7">
            <TabsTrigger value="code" className="text-xs px-2 h-6">
              <Code className="h-3 w-3 mr-1" />
              Code
            </TabsTrigger>
            <TabsTrigger value="raw" className="text-xs px-2 h-6">
              <Eye className="h-3 w-3 mr-1" />
              Raw
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ScrollArea className={maxHeight}>
        <pre
          className={cn(
            'text-sm font-mono p-3 rounded overflow-x-auto',
            viewMode === 'code' ? 'bg-slate-950 text-slate-50' : 'bg-muted'
          )}
        >
          {content}
        </pre>
      </ScrollArea>
    </div>
  );
}

// CSV Preview as table
interface CsvPreviewProps {
  content: string;
  maxHeight?: string;
}

function CsvPreview({ content, maxHeight }: CsvPreviewProps) {
  const { headers, rows } = useMemo(() => {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string) =>
      line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));

    return {
      headers: parseRow(lines[0]),
      rows: lines.slice(1).map(parseRow),
    };
  }, [content]);

  if (headers.length === 0) {
    return <p className="text-sm text-muted-foreground">No data</p>;
  }

  return (
    <ScrollArea className={cn(maxHeight, 'border rounded')}>
      <table className="w-full text-sm">
        <thead className="bg-muted sticky top-0">
          <tr>
            {headers.map((header, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <p className="text-center py-2 text-sm text-muted-foreground">
          Showing 100 of {rows.length} rows
        </p>
      )}
    </ScrollArea>
  );
}

// Artifact Comparison View (Task 36)
interface ArtifactComparisonProps {
  left: Artifact;
  right: Artifact;
  className?: string;
}

export function ArtifactComparison({
  left,
  right,
  className,
}: ArtifactComparisonProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          Artifact Comparison
        </h3>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'side-by-side' | 'unified')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="side-by-side">
              <span className="flex items-center gap-2">
                <Columns className="h-4 w-4" />
                Side by Side
              </span>
            </SelectItem>
            <SelectItem value="unified">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Unified
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Badge variant="secondary" className="mb-2">
              {left.name}
            </Badge>
            <ArtifactContent artifact={left} />
          </div>
          <div>
            <Badge variant="secondary" className="mb-2">
              {right.name}
            </Badge>
            <ArtifactContent artifact={right} />
          </div>
        </div>
      ) : (
        <UnifiedDiff left={left} right={right} />
      )}
    </div>
  );
}

// Unified diff view
function UnifiedDiff({ left, right }: { left: Artifact; right: Artifact }) {
  const diff = useMemo(() => {
    // Simple line-by-line diff (in production, use a proper diff library)
    const leftLines = (left.content || '').split('\n');
    const rightLines = (right.content || '').split('\n');
    const maxLines = Math.max(leftLines.length, rightLines.length);

    const result: Array<{ type: 'same' | 'added' | 'removed'; content: string }> = [];

    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftLines[i] ?? '';
      const rightLine = rightLines[i] ?? '';

      if (leftLine === rightLine) {
        result.push({ type: 'same', content: leftLine });
      } else {
        if (leftLine) {
          result.push({ type: 'removed', content: leftLine });
        }
        if (rightLine) {
          result.push({ type: 'added', content: rightLine });
        }
      }
    }

    return result;
  }, [left.content, right.content]);

  return (
    <ScrollArea className="h-96 border rounded">
      <pre className="text-sm font-mono p-2">
        {diff.map((line, i) => (
          <div
            key={i}
            className={cn(
              'px-2',
              line.type === 'added' && 'bg-green-500/20 text-green-700 dark:text-green-300',
              line.type === 'removed' && 'bg-red-500/20 text-red-700 dark:text-red-300'
            )}
          >
            <span className="select-none mr-2 text-muted-foreground">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.content}
          </div>
        ))}
      </pre>
    </ScrollArea>
  );
}

// Artifact List with navigation
interface ArtifactListProps {
  artifacts: Artifact[];
  selectedId?: string;
  onSelect: (artifact: Artifact) => void;
  className?: string;
}

export function ArtifactList({
  artifacts,
  selectedId,
  onSelect,
  className,
}: ArtifactListProps) {
  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-1 p-2">
        {artifacts.map((artifact) => {
          const Icon = TYPE_ICONS[artifact.type];
          return (
            <button
              key={artifact.id}
              onClick={() => onSelect(artifact)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors',
                selectedId === artifact.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{artifact.name}</p>
                <p className="text-xs opacity-70">{formatFileSize(artifact.size)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// Artifact Browser with preview
interface ArtifactBrowserProps {
  artifacts: Artifact[];
  className?: string;
}

export function ArtifactBrowser({ artifacts, className }: ArtifactBrowserProps) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    artifacts[0] || null
  );

  const currentIndex = selectedArtifact
    ? artifacts.findIndex((a) => a.id === selectedArtifact.id)
    : -1;

  const goToPrev = () => {
    if (currentIndex > 0) {
      setSelectedArtifact(artifacts[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (currentIndex < artifacts.length - 1) {
      setSelectedArtifact(artifacts[currentIndex + 1]);
    }
  };

  if (artifacts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No artifacts available</p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-4 gap-4 h-full', className)}>
      <div className="col-span-1 border-r">
        <ArtifactList
          artifacts={artifacts}
          selectedId={selectedArtifact?.id}
          onSelect={setSelectedArtifact}
        />
      </div>
      <div className="col-span-3">
        {selectedArtifact ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} of {artifacts.length}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrev}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNext}
                  disabled={currentIndex === artifacts.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ArtifactPreview artifact={selectedArtifact} showMetadata />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Select an artifact to preview
          </div>
        )}
      </div>
    </div>
  );
}

// Loading skeleton
export function ArtifactPreviewSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  );
}

// Utility functions
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
  };
  return langMap[ext || ''] || 'text';
}

function formatJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}
