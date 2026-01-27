/**
 * GuidelineSearchBar Component
 *
 * Stage 20 integration - search and display medical guidelines
 * (TNM staging, Clavien-Dindo, ASA, ECOG, etc.)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Search, Loader2, ExternalLink, BookOpen, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface GuidelineSource {
  query: string;
  field: string;
  category: string;
  url: string;
  description: string;
}

interface ParsedGuideline {
  query: string;
  source_url: string;
  source_type: string;
  title: string;
  stages: Array<{
    name: string;
    criteria: string[];
    description?: string;
  }>;
  raw_text_preview: string;
  fetched_at: string;
  from_cache: boolean;
}

interface GuidelineSuggestions {
  validation_questions: string[];
  study_ideation: string[];
  checklist_items: string[];
}

interface GuidelineResult {
  query: string;
  parsed: ParsedGuideline;
  suggestions: GuidelineSuggestions;
  from_cache: boolean;
}

interface GuidelineSearchBarProps {
  onGuidelineSelect?: (result: GuidelineResult) => void;
  onValidationSelect?: (items: string[]) => void;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function GuidelineSearchBar({
  onGuidelineSelect,
  onValidationSelect,
  className = '',
}: GuidelineSearchBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuidelineResult | null>(null);
  const [sources, setSources] = useState<GuidelineSource[]>([]);
  const [showSources, setShowSources] = useState(false);

  // Fetch available sources on mount
  React.useEffect(() => {
    fetch(`${API_BASE}/api/guidelines/sources`)
      .then(res => res.json())
      .then(data => setSources(data.sources || []))
      .catch(err => console.error('Failed to fetch guideline sources:', err));
  }, []);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/guidelines/process?query=${encodeURIComponent(query.trim())}`
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || errData.error || 'Failed to process guideline');
      }

      const data = await response.json();
      setResult(data);

      if (onGuidelineSelect) {
        onGuidelineSelect(data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching');
    } finally {
      setLoading(false);
    }
  }, [query, onGuidelineSelect]);

  // Handle source click (quick search)
  const handleSourceClick = useCallback((source: GuidelineSource) => {
    setQuery(source.query);
    setTimeout(() => {
      handleSearch();
    }, 100);
  }, [handleSearch]);

  // Group sources by field
  const groupedSources = useMemo(() => {
    const groups: Record<string, GuidelineSource[]> = {};
    sources.forEach(source => {
      const field = source.field || 'other';
      if (!groups[field]) groups[field] = [];
      groups[field].push(source);
    });
    return groups;
  }, [sources]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search guidelines (e.g., 'clavien-dindo', 'tnm colorectal', 'asa classification')"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
        <Button variant="outline" onClick={() => setShowSources(!showSources)}>
          <BookOpen className="h-4 w-4 mr-2" />
          Sources
        </Button>
      </div>

      {/* Available Sources Panel */}
      {showSources && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Available Guideline Sources</CardTitle>
            <CardDescription>
              Click a source to search. {sources.length} guidelines indexed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(groupedSources).map(([field, fieldSources]) => (
                <div key={field}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    {field}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {fieldSources.map(source => (
                      <Badge
                        key={source.query}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleSourceClick(source)}
                      >
                        {source.query}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {result && !loading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {result.parsed.title || result.query}
                  {result.from_cache && (
                    <Badge variant="outline" className="text-xs">Cached</Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span className="capitalize">{result.parsed.source_type}</span>
                  <a
                    href={result.parsed.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1"
                  >
                    View Source <ExternalLink className="h-3 w-3" />
                  </a>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="stages" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stages">
                  Stages ({result.parsed.stages?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="validation">
                  Validation ({result.suggestions.validation_questions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="ideation">
                  Study Ideas ({result.suggestions.study_ideation?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Stages Tab */}
              <TabsContent value="stages" className="space-y-3">
                {result.parsed.stages?.length > 0 ? (
                  result.parsed.stages.map((stage, idx) => (
                    <div key={idx} className="border rounded-lg p-3">
                      <h4 className="font-medium">{stage.name}</h4>
                      {stage.description && (
                        <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
                      )}
                      {stage.criteria?.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {stage.criteria.map((criterion, cidx) => (
                            <li key={cidx} className="text-sm flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {criterion}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No structured stages found. View the source for full content.
                  </p>
                )}
              </TabsContent>

              {/* Validation Questions Tab */}
              <TabsContent value="validation" className="space-y-2">
                {result.suggestions.validation_questions?.map((question, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer"
                    onClick={() => onValidationSelect?.([question])}
                  >
                    <span className="text-primary font-medium">{idx + 1}.</span>
                    <span className="text-sm">{question}</span>
                  </div>
                ))}
                {result.suggestions.checklist_items?.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="text-sm font-medium mb-2">Checklist Items</h5>
                    {result.suggestions.checklist_items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="rounded" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Study Ideation Tab */}
              <TabsContent value="ideation" className="space-y-2">
                {result.suggestions.study_ideation?.map((idea, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <p className="text-sm">{idea}</p>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GuidelineSearchBar;
