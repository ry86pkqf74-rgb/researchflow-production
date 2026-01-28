/**
 * ART-008: Artifact Comparison (Diff View) Component
 * Side-by-side or unified diff
 * Support text-based artifacts
 */

import React, { useState, useMemo } from 'react';
import {
  Columns,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface DiffArtifact {
  id: string;
  name: string;
  content: string;
  mimeType: string;
}

interface ArtifactDiffProps {
  left: DiffArtifact;
  right: DiffArtifact;
  viewMode?: 'split' | 'unified' | 'diff';
  className?: string;
}

type DiffLine = {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
};

// Simple diff algorithm (Myers' algorithm would be more sophisticated)
function generateDiff(leftText: string, rightText: string): DiffLine[] {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');
  const result: DiffLine[] = [];

  const maxLines = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftLines[i] ?? '';
    const rightLine = rightLines[i] ?? '';

    if (leftLine === rightLine) {
      result.push({ type: 'unchanged', content: leftLine, lineNumber: i + 1 });
    } else {
      if (leftLine) {
        result.push({ type: 'removed', content: leftLine, lineNumber: i + 1 });
      }
      if (rightLine) {
        result.push({ type: 'added', content: rightLine, lineNumber: i + 1 });
      }
    }
  }

  return result;
}

function getLineClassName(type: string): string {
  switch (type) {
    case 'added':
      return 'bg-green-500/10 text-green-700 dark:text-green-300';
    case 'removed':
      return 'bg-red-500/10 text-red-700 dark:text-red-300';
    default:
      return '';
  }
}

function getLineSymbol(type: string): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    default:
      return ' ';
  }
}

export function ArtifactDiff({
  left,
  right,
  viewMode: initialViewMode = 'split',
  className,
}: ArtifactDiffProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified' | 'diff'>(
    initialViewMode
  );
  const [copied, setCopied] = useState<string | null>(null);

  const diff = useMemo(() => {
    return generateDiff(left.content, right.content);
  }, [left.content, right.content]);

  const leftLines = left.content.split('\n');
  const rightLines = right.content.split('\n');

  // Count changes
  const changes = useMemo(() => {
    const added = diff.filter((l) => l.type === 'added').length;
    const removed = diff.filter((l) => l.type === 'removed').length;
    return { added, removed };
  }, [diff]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Columns className="h-5 w-5" />
            Comparison
          </h3>
          <Badge variant="outline">{changes.removed} removed</Badge>
          <Badge variant="outline" className="bg-green-500/10">
            {changes.added} added
          </Badge>
        </div>

        <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="split">Split View</SelectItem>
            <SelectItem value="unified">Unified</SelectItem>
            <SelectItem value="diff">Diff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {viewMode === 'split' ? (
        <SplitView
          left={left}
          right={right}
          leftLines={leftLines}
          rightLines={rightLines}
          onCopy={handleCopy}
          copied={copied}
        />
      ) : viewMode === 'unified' ? (
        <UnifiedDiffView
          diff={diff}
          onCopy={handleCopy}
          copied={copied}
        />
      ) : (
        <DiffOnlyView
          diff={diff}
          onCopy={handleCopy}
          copied={copied}
        />
      )}
    </div>
  );
}

function SplitView({
  left,
  right,
  leftLines,
  rightLines,
  onCopy,
  copied,
}: {
  left: DiffArtifact;
  right: DiffArtifact;
  leftLines: string[];
  rightLines: string[];
  onCopy: (content: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{left.name}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(left.content, `left-${left.id}`)}
            className="h-7"
          >
            {copied === `left-${left.id}` ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>

        <ScrollArea className="h-96 border rounded-md bg-muted p-2">
          <pre className="font-mono text-xs leading-relaxed">
            {leftLines.map((line, i) => (
              <div key={i} className="flex">
                <span className="w-8 text-right pr-2 text-muted-foreground flex-shrink-0">
                  {i + 1}
                </span>
                <span>{line || '\u00A0'}</span>
              </div>
            ))}
          </pre>
        </ScrollArea>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{right.name}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(right.content, `right-${right.id}`)}
            className="h-7"
          >
            {copied === `right-${right.id}` ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>

        <ScrollArea className="h-96 border rounded-md bg-muted p-2">
          <pre className="font-mono text-xs leading-relaxed">
            {rightLines.map((line, i) => (
              <div key={i} className="flex">
                <span className="w-8 text-right pr-2 text-muted-foreground flex-shrink-0">
                  {i + 1}
                </span>
                <span>{line || '\u00A0'}</span>
              </div>
            ))}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}

function UnifiedDiffView({
  diff,
  onCopy,
  copied,
}: {
  diff: DiffLine[];
  onCopy: (content: string, id: string) => void;
  copied: string | null;
}) {
  const content = diff.map((line) => line.content).join('\n');

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopy(content, 'unified')}
          className="h-7"
        >
          {copied === 'unified' ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      <ScrollArea className="h-96 border rounded-md bg-muted p-2">
        <pre className="font-mono text-xs leading-relaxed">
          {diff.map((line, i) => (
            <div
              key={i}
              className={cn(
                'flex px-2',
                getLineClassName(line.type)
              )}
            >
              <span className="select-none w-6 text-center flex-shrink-0 mr-2">
                {getLineSymbol(line.type)}
              </span>
              <span className="w-8 text-right pr-2 text-muted-foreground flex-shrink-0">
                {line.lineNumber}
              </span>
              <span>{line.content || '\u00A0'}</span>
            </div>
          ))}
        </pre>
      </ScrollArea>
    </div>
  );
}

function DiffOnlyView({
  diff,
  onCopy,
  copied,
}: {
  diff: DiffLine[];
  onCopy: (content: string, id: string) => void;
  copied: string | null;
}) {
  const diffLines = diff.filter((l) => l.type !== 'unchanged');
  const content = diffLines.map((line) => line.content).join('\n');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {diffLines.length} changed lines
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopy(content, 'diff')}
          className="h-7"
        >
          {copied === 'diff' ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      <ScrollArea className="h-96 border rounded-md bg-muted p-2">
        <pre className="font-mono text-xs leading-relaxed">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'flex px-2',
                getLineClassName(line.type)
              )}
            >
              <span className="select-none w-6 text-center flex-shrink-0 mr-2">
                {getLineSymbol(line.type)}
              </span>
              <span className="w-8 text-right pr-2 text-muted-foreground flex-shrink-0">
                {line.lineNumber}
              </span>
              <span>{line.content || '\u00A0'}</span>
            </div>
          ))}
        </pre>
      </ScrollArea>
    </div>
  );
}

export default ArtifactDiff;
