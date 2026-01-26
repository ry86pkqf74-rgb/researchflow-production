/**
 * Search Page (Task 98)
 *
 * Full-text search interface for searching artifacts and manuscripts.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchResults, SearchResult } from '@/components/search/SearchResults';

type SearchType = 'all' | 'artifact' | 'manuscript';
type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      let endpoint = '/api/search';
      let method = 'GET';
      let body: string | undefined;

      if (searchMode === 'semantic') {
        // Semantic vector search
        endpoint = '/api/search/semantic';
        method = 'POST';
        body = JSON.stringify({
          q: query,
          limit: 50,
          types: searchType !== 'all' ? [searchType] : undefined,
        });
      } else if (searchMode === 'hybrid') {
        // Hybrid keyword + semantic
        endpoint = '/api/search/hybrid';
        method = 'POST';
        body = JSON.stringify({
          q: query,
          limit: 50,
          keywordWeight: 0.5,
          semanticWeight: 0.5,
        });
      } else {
        // Keyword search (existing)
        const params = new URLSearchParams({
          q: query,
          limit: '50',
        });

        if (searchType !== 'all') {
          params.set('type', searchType);
        }

        endpoint = `/api/search?${params}`;
      }

      const response = await fetch(endpoint, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, searchType, searchMode]);

  // Search on Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'research') {
      window.location.href = `/pipeline?research=${result.id}`;
    } else if (result.researchId) {
      window.location.href = `/pipeline?research=${result.researchId}&artifact=${result.id}`;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6" />
            Search
          </h1>
          <p className="text-muted-foreground">
            Find artifacts, manuscripts, and research projects
          </p>
        </div>

        {/* Search Form */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for artifacts, manuscripts, or research..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9 pr-9"
                />
                {query && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select
                value={searchMode}
                onValueChange={(v) => setSearchMode(v as SearchMode)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Keyword</SelectItem>
                  <SelectItem value="semantic">Semantic 🔍</SelectItem>
                  <SelectItem value="hybrid">Hybrid ⚡</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={searchType}
                onValueChange={(v) => setSearchType(v as SearchType)}
              >
                <SelectTrigger className="w-36">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="manuscript">Manuscripts</SelectItem>
                  <SelectItem value="artifact">Artifacts</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={performSearch} disabled={loading || !query.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">
                {loading
                  ? 'Searching...'
                  : results.length === 0
                  ? 'No results'
                  : `${results.length} result${results.length === 1 ? '' : 's'}`}
              </h2>
              {results.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {results.filter((r) => r.type === 'manuscript').length} manuscripts
                  </Badge>
                  <Badge variant="outline">
                    {results.filter((r) => r.type === 'artifact').length} artifacts
                  </Badge>
                  <Badge variant="outline">
                    {results.filter((r) => r.type === 'research').length} projects
                  </Badge>
                </div>
              )}
            </div>

            <SearchResults
              results={results}
              query={query}
              mode={searchMode}
              onResultClick={handleResultClick}
              loading={loading}
            />
          </div>
        )}

        {/* Empty State */}
        {!hasSearched && (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Start searching</h3>
              <p className="text-muted-foreground mt-2">
                Enter a search term to find artifacts, manuscripts, and research projects
                across your organization.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setQuery('manuscript draft')}
                >
                  manuscript draft
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setQuery('analysis results')}
                >
                  analysis results
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setQuery('dataset')}
                >
                  dataset
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
