/**
 * Global Search Component
 * Task 183: Improved search with filters
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Users, Calendar, Tag, Filter } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'research' | 'manuscript' | 'artifact' | 'user';
  title: string;
  description?: string;
  highlights?: string[];
  metadata?: Record<string, unknown>;
}

interface SearchFilters {
  types: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  tags?: string[];
  status?: string[];
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ types: [] });
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: searchQuery });
      if (filters.types.length) {
        params.set('types', filters.types.join(','));
      }
      if (filters.tags?.length) {
        params.set('tags', filters.tags.join(','));
      }
      if (filters.dateRange?.start) {
        params.set('startDate', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        params.set('endDate', filters.dateRange.end);
      }

      const response = await fetch(`/api/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query, performSearch]);

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'research':
        return <FileText className="w-4 h-4" />;
      case 'manuscript':
        return <FileText className="w-4 h-4" />;
      case 'user':
        return <Users className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const toggleTypeFilter = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-background border rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-card border rounded-lg shadow-2xl z-50 overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search research, manuscripts, artifacts..."
              className="flex-1 bg-transparent outline-none text-lg"
              autoComplete="off"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded hover:bg-muted ${showFilters ? 'bg-muted' : ''}`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Type:</span>
                {['research', 'manuscript', 'artifact', 'user'].map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleTypeFilter(type)}
                    className={`px-2 py-1 text-sm rounded ${
                      filters.types.includes(type)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {query ? 'No results found' : 'Start typing to search'}
            </div>
          ) : (
            <div>
              {results.map((result) => (
                <a
                  key={result.id}
                  href={`/${result.type}/${result.id}`}
                  className="flex items-start gap-3 p-4 hover:bg-muted transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="mt-1 text-muted-foreground">
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{result.title}</div>
                    {result.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {result.description}
                      </p>
                    )}
                    {result.highlights && result.highlights.length > 0 && (
                      <p
                        className="text-sm text-muted-foreground mt-1"
                        dangerouslySetInnerHTML={{
                          __html: `...${result.highlights[0]}...`,
                        }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {result.type}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="p-2 border-t bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            <kbd className="px-1 bg-background border rounded">↑↓</kbd> to navigate
            <kbd className="ml-2 px-1 bg-background border rounded">↵</kbd> to select
          </span>
          <span>
            <kbd className="px-1 bg-background border rounded">esc</kbd> to close
          </span>
        </div>
      </div>
    </>
  );
}
