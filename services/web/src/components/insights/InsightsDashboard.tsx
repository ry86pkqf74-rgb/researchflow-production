/**
 * InsightsDashboard
 * Real-time event stream with filtering and category tabs
 * 
 * Phase 6 Insights & Observability
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Download,
  FileText,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useInsightEventsRealtime, type InsightCategory, type InsightSeverity, type InsightEvent } from '@/api/insights-api';
import { EventCard } from './EventCard';
import { cn } from '@/lib/utils';


// ============================================================================
// Types
// ============================================================================

interface InsightsDashboardProps {
  researchId?: string;
  defaultCategory?: InsightCategory;
  className?: string;
}

type TimeRange = '1h' | '6h' | '24h' | '7d';

const CATEGORY_CONFIG: Record<InsightCategory | 'all', { label: string; icon: typeof Activity; color: string }> = {
  all: { label: 'All', icon: Activity, color: 'text-gray-600' },
  trace: { label: 'Trace', icon: Activity, color: 'text-indigo-500' },
  metric: { label: 'Metric', icon: BarChart3, color: 'text-blue-500' },
  alert: { label: 'Alert', icon: AlertTriangle, color: 'text-orange-500' },
  audit: { label: 'Audit', icon: FileText, color: 'text-purple-500' },
};

const TIME_RANGES: Record<TimeRange, { label: string; ms: number }> = {
  '1h': { label: 'Last hour', ms: 60 * 60 * 1000 },
  '6h': { label: 'Last 6 hours', ms: 6 * 60 * 60 * 1000 },
  '24h': { label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  '7d': { label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
};


// ============================================================================
// Component
// ============================================================================

export function InsightsDashboard({
  researchId,
  defaultCategory,
  className,
}: InsightsDashboardProps) {
  const [activeCategory, setActiveCategory] = useState<InsightCategory | 'all'>(
    defaultCategory ?? 'all'
  );
  const [severity, setSeverity] = useState<InsightSeverity | 'all'>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [isPaused, setIsPaused] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isHovering = useRef(false);

  // Calculate time filter
  const fromTime = new Date(Date.now() - TIME_RANGES[timeRange].ms).toISOString();

  // Fetch events with real-time polling
  const { data, isLoading, refetch, isFetching } = useInsightEventsRealtime(
    {
      category: activeCategory === 'all' ? undefined : activeCategory,
      severity: severity === 'all' ? undefined : severity,
      researchId,
      from: fromTime,
      limit: 100,
    },
    isPaused ? 0 : 5000 // Poll every 5s unless paused
  );

  const events = data?.events ?? [];

  // Count events by category
  const categoryCounts = events.reduce(
    (acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!isPaused && !isHovering.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isPaused]);

  // Pause on hover
  const handleMouseEnter = useCallback(() => {
    isHovering.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isHovering.current = false;
  }, []);

  // Export to CSV
  const handleExport = useCallback(() => {
    const headers = ['timestamp', 'category', 'eventType', 'source', 'severity', 'traceId'];
    const rows = events.map((e) =>
      [e.timestamp, e.category, e.eventType, e.source, e.severity, e.traceId ?? ''].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events]);

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="flex-none pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Insights Stream
            {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-4 mt-4">
          <Select value={severity} onValueChange={(v) => setSeverity(v as InsightSeverity | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[160px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIME_RANGES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="outline" className="ml-auto">
            {events.length} events
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs
          value={activeCategory}
          onValueChange={(v) => setActiveCategory(v as InsightCategory | 'all')}
          className="h-full flex flex-col"
        >
          <TabsList className="mx-4 mt-2">
            {Object.entries(CATEGORY_CONFIG).map(([key, { label, icon: Icon, color }]) => (
              <TabsTrigger key={key} value={key} className="relative">
                <Icon className={cn('h-4 w-4 mr-1', color)} />
                {label}
                {key !== 'all' && categoryCounts[key] ? (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 px-1.5 text-xs"
                  >
                    {categoryCounts[key]}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="flex-1 overflow-hidden m-0">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-4 py-2 space-y-2"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading events...
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  <p>No events in this time range</p>
                </div>
              ) : (
                events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    expanded={expandedEventId === event.id}
                    onToggleExpand={() =>
                      setExpandedEventId(
                        expandedEventId === event.id ? null : event.id
                      )
                    }
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default InsightsDashboard;
