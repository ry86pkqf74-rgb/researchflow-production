/**
 * Live Log Console Component (Phase 4C - RUN-004)
 *
 * Real-time filterable log viewer for run output.
 * Displays INFO, WARN, ERROR level logs with filtering.
 * Auto-scrolls to latest with pause option.
 *
 * Features:
 * - Real-time log streaming
 * - Log level filtering (INFO/WARN/ERROR)
 * - Auto-scroll with pause toggle
 * - Timestamp display
 * - Search/filter capability
 * - Export logs functionality
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Pause,
  Play,
  Download,
  Trash2,
  Search,
} from 'lucide-react';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
  source?: string;
}

interface LogConsoleProps {
  logs: LogEntry[];
  onClear?: () => void;
  onExport?: () => void;
  maxLogs?: number;
  className?: string;
}

const levelIcons: Record<LogLevel, React.ReactNode> = {
  INFO: <Info className="h-4 w-4" />,
  WARN: <AlertTriangle className="h-4 w-4" />,
  ERROR: <AlertCircle className="h-4 w-4" />,
};

const levelColors: Record<LogLevel, string> = {
  INFO: 'text-blue-600',
  WARN: 'text-yellow-600',
  ERROR: 'text-red-600',
};

const levelBadgeVariants: Record<LogLevel, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  INFO: 'default',
  WARN: 'secondary',
  ERROR: 'destructive',
};

const levelBgColors: Record<LogLevel, string> = {
  INFO: 'bg-blue-50 border-blue-200',
  WARN: 'bg-yellow-50 border-yellow-200',
  ERROR: 'bg-red-50 border-red-200',
};

export function LogConsole({
  logs,
  onClear,
  onExport,
  maxLogs = 1000,
  className,
}: LogConsoleProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(
    new Set(['INFO', 'WARN', 'ERROR'])
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter logs based on search and level
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => selectedLevels.has(log.level))
      .filter((log) =>
        searchQuery === ''
          ? true
          : log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.details?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(-maxLogs);
  }, [logs, selectedLevels, searchQuery, maxLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const toggleLevel = (level: LogLevel) => {
    const next = new Set(selectedLevels);
    if (next.has(level)) {
      next.delete(level);
    } else {
      next.add(level);
    }
    setSelectedLevels(next);
  };

  const handleExport = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp}] ${log.level}: ${log.message}${log.details ? '\n' + log.details : ''}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    onExport?.();
  };

  const infoCount = logs.filter((l) => l.level === 'INFO').length;
  const warnCount = logs.filter((l) => l.level === 'WARN').length;
  const errorCount = logs.filter((l) => l.level === 'ERROR').length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Run Logs</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {filteredLogs.length} logs
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Controls */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Level Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-600">Filter:</span>

            <button
              onClick={() => toggleLevel('INFO')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                selectedLevels.has('INFO')
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              )}
            >
              <Info className="h-3.5 w-3.5" />
              Info ({infoCount})
            </button>

            <button
              onClick={() => toggleLevel('WARN')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                selectedLevels.has('WARN')
                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Warn ({warnCount})
            </button>

            <button
              onClick={() => toggleLevel('ERROR')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                selectedLevels.has('ERROR')
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              )}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Error ({errorCount})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className="flex items-center gap-1"
            >
              {autoScroll ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>

            {onClear && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                className="flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Log Viewer */}
        <div
          ref={scrollRef}
          className="bg-gray-950 text-gray-100 p-4 rounded-lg border border-gray-800 h-96 overflow-y-auto font-mono text-xs space-y-1 scroll-smooth"
        >
          {filteredLogs.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              {logs.length === 0
                ? 'No logs yet'
                : 'No logs match the current filters'}
            </p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'px-3 py-1 rounded border-l-4',
                  log.level === 'INFO' && 'border-l-blue-500 text-blue-200',
                  log.level === 'WARN' && 'border-l-yellow-500 text-yellow-200',
                  log.level === 'ERROR' && 'border-l-red-500 text-red-200'
                )}
              >
                <span className="text-gray-500">[{log.timestamp}]</span>
                {' '}
                <span className={cn('font-semibold', levelColors[log.level])}>
                  {log.level}
                </span>
                {log.source && <span className="text-gray-600 mx-1">({log.source})</span>}
                {': '}
                <span>{log.message}</span>
                {log.details && (
                  <>
                    <br />
                    <span className="text-gray-500 ml-6">{log.details}</span>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Stats Footer */}
        <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t">
          <p>
            Showing {filteredLogs.length} of {logs.length} logs
          </p>
          {autoScroll && <p className="text-blue-600 font-medium">Auto-scrolling enabled</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default LogConsole;
