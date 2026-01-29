/**
 * EventCard
 * Compact event display with expandable JSON details
 * 
 * Phase 6 Insights & Observability
 */

import { memo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
} from 'lucide-react';
import { type InsightEvent, type InsightCategory, type InsightSeverity } from '@/api/insights-api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';


// ============================================================================
// Types & Config
// ============================================================================

interface EventCardProps {
  event: InsightEvent;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const CATEGORY_ICONS: Record<InsightCategory, typeof Activity> = {
  trace: Activity,
  metric: BarChart3,
  alert: AlertTriangle,
  audit: FileText,
};

const CATEGORY_COLORS: Record<InsightCategory, string> = {
  trace: 'bg-indigo-500',
  metric: 'bg-blue-500',
  alert: 'bg-orange-500',
  audit: 'bg-purple-500',
};

const SEVERITY_STYLES: Record<InsightSeverity, { badge: string; text: string }> = {
  info: { badge: 'bg-gray-100 text-gray-700', text: 'text-gray-600' },
  warning: { badge: 'bg-yellow-100 text-yellow-700', text: 'text-yellow-600' },
  error: { badge: 'bg-red-100 text-red-700', text: 'text-red-600' },
  critical: { badge: 'bg-red-600 text-white', text: 'text-red-600' },
};


// ============================================================================
// Component
// ============================================================================

export const EventCard = memo(function EventCard({
  event,
  expanded = false,
  onToggleExpand,
}: EventCardProps) {
  const Icon = CATEGORY_ICONS[event.category];
  const categoryColor = CATEGORY_COLORS[event.category];
  const severityStyle = SEVERITY_STYLES[event.severity];

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(event.id);
  }, [event.id]);

  const relativeTime = formatDistanceToNow(new Date(event.timestamp), {
    addSuffix: true,
  });

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        expanded && 'ring-2 ring-primary/20'
      )}
    >
      {/* Compact Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        {/* Category Indicator */}
        <div className={cn('w-1 h-10 rounded-full', categoryColor)} />

        {/* Icon */}
        <Icon className={cn('h-4 w-4 flex-none', severityStyle.text)} />

        {/* Event Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{event.eventType}</span>
            <Badge className={cn('text-xs', severityStyle.badge)}>
              {event.severity}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{event.source}</span>
            <span>•</span>
            <span>{relativeTime}</span>
            {event.traceId && (
              <>
                <span>•</span>
                <span className="font-mono truncate max-w-[100px]">
                  {event.traceId.slice(0, 8)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expand Toggle */}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 border-t">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 py-3 text-sm">
            <div>
              <span className="text-muted-foreground">Event ID:</span>
              <div className="flex items-center gap-1">
                <code className="text-xs bg-muted px-1 rounded truncate">
                  {event.id}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopyId}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Timestamp:</span>
              <div className="text-xs font-mono">
                {new Date(event.timestamp).toISOString()}
              </div>
            </div>
            {event.traceId && (
              <div>
                <span className="text-muted-foreground">Trace ID:</span>
                <div className="text-xs font-mono truncate">{event.traceId}</div>
              </div>
            )}
            {event.spanId && (
              <div>
                <span className="text-muted-foreground">Span ID:</span>
                <div className="text-xs font-mono">{event.spanId}</div>
              </div>
            )}
            {event.researchId && (
              <div>
                <span className="text-muted-foreground">Research ID:</span>
                <div className="text-xs font-mono truncate">{event.researchId}</div>
              </div>
            )}
          </div>

          {/* JSON Payload */}
          {event.payload && Object.keys(event.payload).length > 0 && (
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">Payload:</span>
              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto max-h-48">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          )}

          {/* Tags */}
          {event.tags && Object.keys(event.tags).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(event.tags).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key}: {value}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
});

export default EventCard;
