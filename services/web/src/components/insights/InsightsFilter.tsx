/**
 * InsightsFilter
 * Multi-select filtering for insight events
 * 
 * Phase 6 Insights & Observability
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { InsightCategory, InsightSeverity, InsightSource } from '@/api/insights-api';

// ============================================================================
// Types
// ============================================================================

export interface InsightFilters {
  categories: InsightCategory[];
  severities: InsightSeverity[];
  sources: InsightSource[];
  dateRange?: { from: Date; to: Date };
  searchQuery?: string;
}

interface InsightsFilterProps {
  filters: InsightFilters;
  onFiltersChange: (filters: InsightFilters) => void;
  className?: string;
}

const CATEGORIES: InsightCategory[] = ['trace', 'metric', 'alert', 'audit'];
const SEVERITIES: InsightSeverity[] = ['info', 'warning', 'error', 'critical'];
const SOURCES: InsightSource[] = ['orchestrator', 'worker', 'web', 'collab', 'guideline-engine'];


// ============================================================================
// Component
// ============================================================================

export function InsightsFilter({
  filters,
  onFiltersChange,
  className,
}: InsightsFilterProps) {
  const activeFilterCount =
    filters.categories.length +
    filters.severities.length +
    filters.sources.length +
    (filters.dateRange ? 1 : 0) +
    (filters.searchQuery ? 1 : 0);

  const toggleCategory = (category: InsightCategory) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const toggleSeverity = (severity: InsightSeverity) => {
    const newSeverities = filters.severities.includes(severity)
      ? filters.severities.filter((s) => s !== severity)
      : [...filters.severities, severity];
    onFiltersChange({ ...filters, severities: newSeverities });
  };

  const toggleSource = (source: InsightSource) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ ...filters, sources: newSources });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      categories: [],
      severities: [],
      sources: [],
      dateRange: undefined,
      searchQuery: undefined,
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary">{activeFilterCount}</Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* Search */}
      <div>
        <Label htmlFor="search" className="text-sm">Search</Label>
        <Input
          id="search"
          placeholder="Search by event ID or content..."
          value={filters.searchQuery ?? ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, searchQuery: e.target.value || undefined })
          }
          className="mt-1"
        />
      </div>

      {/* Categories */}
      <div>
        <Label className="text-sm">Categories</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {CATEGORIES.map((category) => (
            <label
              key={category}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={filters.categories.includes(category)}
                onCheckedChange={() => toggleCategory(category)}
              />
              <span className="text-sm capitalize">{category}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Severities */}
      <div>
        <Label className="text-sm">Severities</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {SEVERITIES.map((severity) => (
            <label
              key={severity}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={filters.severities.includes(severity)}
                onCheckedChange={() => toggleSeverity(severity)}
              />
              <span className="text-sm capitalize">{severity}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div>
        <Label className="text-sm">Sources</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {SOURCES.map((source) => (
            <label
              key={source}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={filters.sources.includes(source)}
                onCheckedChange={() => toggleSource(source)}
              />
              <span className="text-sm">{source}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-sm">Date Range</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal mt-1',
                !filters.dateRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange ? (
                <>
                  {format(filters.dateRange.from, 'LLL dd, y')} -{' '}
                  {format(filters.dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={
                filters.dateRange
                  ? { from: filters.dateRange.from, to: filters.dateRange.to }
                  : undefined
              }
              onSelect={(range) =>
                onFiltersChange({
                  ...filters,
                  dateRange: range?.from && range?.to
                    ? { from: range.from, to: range.to }
                    : undefined,
                })
              }
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default InsightsFilter;
