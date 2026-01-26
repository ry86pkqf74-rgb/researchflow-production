/**
 * Search Results Component (Task 98)
 *
 * Displays search results with highlighting and filtering.
 */

import { FileText, FolderOpen, Database, Calendar, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface SearchResult {
  id: string;
  type: 'artifact' | 'manuscript' | 'research';
  title?: string;
  filename?: string;
  snippet?: string;
  highlight?: string;
  researchId?: string;
  researchTitle?: string;
  artifactType?: string;
  createdAt: string;
  relevance?: number;
  // Semantic search fields
  similarity?: number;
  matchType?: 'keyword' | 'semantic' | 'both';
  keywordScore?: number;
  semanticScore?: number;
  combinedScore?: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  mode?: 'keyword' | 'semantic' | 'hybrid';
  onResultClick?: (result: SearchResult) => void;
  loading?: boolean;
}

const TYPE_ICONS = {
  artifact: Database,
  manuscript: FileText,
  research: FolderOpen,
};

const TYPE_COLORS = {
  artifact: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  manuscript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  research: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!text || !query) return text;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function ResultCard({
  result,
  query,
  mode,
  onClick,
}: {
  result: SearchResult;
  query: string;
  mode?: 'keyword' | 'semantic' | 'hybrid';
  onClick?: () => void;
}) {
  const Icon = TYPE_ICONS[result.type];
  const colorClass = TYPE_COLORS[result.type];
  const title = result.title || result.filename || 'Untitled';
  const createdDate = new Date(result.createdAt).toLocaleDateString();

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={colorClass} variant="secondary">
                {result.type}
              </Badge>
              {result.artifactType && result.artifactType !== result.type && (
                <Badge variant="outline" className="text-xs">
                  {result.artifactType}
                </Badge>
              )}

              {/* Similarity score for semantic/hybrid searches */}
              {(mode === 'semantic' || mode === 'hybrid') && result.similarity !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {Math.round(result.similarity * 100)}% match
                </Badge>
              )}

              {/* Match type indicator for hybrid searches */}
              {mode === 'hybrid' && result.matchType === 'both' && (
                <Badge variant="secondary" className="text-xs">
                  Keyword + Semantic
                </Badge>
              )}
              {mode === 'hybrid' && result.matchType === 'keyword' && (
                <Badge variant="outline" className="text-xs">
                  Keyword only
                </Badge>
              )}
              {mode === 'hybrid' && result.matchType === 'semantic' && (
                <Badge variant="outline" className="text-xs">
                  Semantic only
                </Badge>
              )}
            </div>
            <h4 className="font-medium truncate">
              {highlightMatch(title, query)}
            </h4>
            {result.snippet && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {highlightMatch(result.snippet, query)}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {result.researchTitle && (
                <span className="flex items-center gap-1 truncate">
                  <FolderOpen className="h-3 w-3" />
                  {result.researchTitle}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {createdDate}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="flex-shrink-0">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SearchResults({
  results,
  query,
  mode,
  onResultClick,
  loading,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-muted rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-20 mb-2" />
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">No results found</h3>
        <p className="text-muted-foreground mt-2">
          Try adjusting your search terms or filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <ResultCard
          key={result.id}
          result={result}
          query={query}
          mode={mode}
          onClick={() => onResultClick?.(result)}
        />
      ))}
    </div>
  );
}
