/**
 * Search Results Page
 * Task 195: Web search across manuscripts/artifacts
 */

import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Search, FileText, Package, Filter, Clock } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'manuscript' | 'artifact' | 'research';
  title: string;
  description?: string;
  highlights?: string[];
  createdAt: string;
  score: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
}

export default function SearchPage() {
  const [, params] = useRoute('/search');
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    type: 'all' as 'all' | 'manuscript' | 'artifact' | 'research',
    sort: 'relevance' as 'relevance' | 'date',
  });

  // Get query from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type: filters.type === 'all' ? '' : filters.type,
        sort: filters.sort,
      });

      const response = await fetch(`/api/search?${params}`);
      if (response.ok) {
        const data: SearchResponse = await response.json();
        setResults(data.results);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation(`/search?q=${encodeURIComponent(query)}`);
    performSearch(query);
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'manuscript':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'artifact':
        return <Package className="w-5 h-5 text-green-500" />;
      default:
        return <FileText className="w-5 h-5 text-purple-500" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Search Header */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manuscripts, artifacts, and research..."
            className="w-full pl-12 pr-4 py-4 text-lg border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <div className="flex gap-2">
          {(['all', 'manuscript', 'artifact', 'research'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setFilters((f) => ({ ...f, type }));
                if (query) performSearch(query);
              }}
              className={`px-3 py-1 rounded-full text-sm capitalize ${
                filters.type === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <select
            value={filters.sort}
            onChange={(e) => {
              setFilters((f) => ({ ...f, sort: e.target.value as 'relevance' | 'date' }));
              if (query) performSearch(query);
            }}
            className="px-3 py-1 border rounded-md bg-background text-sm"
          >
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found {total} results for "{query}"
          </p>
          {results.map((result) => (
            <a
              key={result.id}
              href={`/${result.type}/${result.id}`}
              className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {getTypeIcon(result.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{result.title}</h3>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded capitalize">
                      {result.type}
                    </span>
                  </div>
                  {result.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {result.description}
                    </p>
                  )}
                  {result.highlights && result.highlights.length > 0 && (
                    <div
                      className="text-sm mt-2 text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: `...${result.highlights[0]}...` }}
                    />
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(result.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : query ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg">No results found for "{query}"</p>
          <p className="text-muted-foreground mt-1">
            Try different keywords or broaden your search
          </p>
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg">Start typing to search</p>
          <p className="text-muted-foreground mt-1">
            Search across manuscripts, artifacts, and research projects
          </p>
        </div>
      )}
    </div>
  );
}
