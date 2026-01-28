/**
 * Global Search Component
 *
 * Command palette style search that searches across all projects,
 * tasks, pages, goals, and workflows.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchApi, type SearchResult, type SearchResultType } from '@/api';

interface GlobalSearchProps {
  isOpen?: boolean;
  onClose?: () => void;
  onResultClick?: (result: SearchResult) => void;
}

const TYPE_ICONS: Record<SearchResultType, JSX.Element> = {
  project: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  task: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  page: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  goal: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  workflow: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  artifact: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  manuscript: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
};

const TYPE_LABELS: Record<SearchResultType, string> = {
  project: 'Project',
  task: 'Task',
  page: 'Page',
  goal: 'Goal',
  workflow: 'Workflow',
  artifact: 'Artifact',
  manuscript: 'Manuscript',
};

const TYPE_COLORS: Record<SearchResultType, string> = {
  project: 'bg-blue-100 text-blue-700',
  task: 'bg-green-100 text-green-700',
  page: 'bg-purple-100 text-purple-700',
  goal: 'bg-amber-100 text-amber-700',
  workflow: 'bg-indigo-100 text-indigo-700',
  artifact: 'bg-gray-100 text-gray-700',
  manuscript: 'bg-pink-100 text-pink-700',
};

export function GlobalSearch({ isOpen: controlledOpen, onClose, onResultClick }: GlobalSearchProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onClose || setInternalOpen;

  // Keyboard shortcut to open search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(isOpen ? undefined : () => setInternalOpen(true));
        if (!isOpen) setInternalOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchApi.global({ q: query, limit: 20 });
      if (result.data) {
        setResults(result.data.results);
        setSelectedIndex(0);
      }
      setLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  }, [results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalOpen(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result);
    } else {
      // Default navigation
      const urlMap: Record<SearchResultType, string> = {
        project: `/hub/${result.id}`,
        task: `/hub/${result.project_id}?task=${result.id}`,
        page: `/hub/${result.project_id}/pages/${result.id}`,
        goal: `/hub/${result.project_id}?goal=${result.id}`,
        workflow: `/workflows/${result.id}`,
        artifact: `/artifacts/${result.id}`,
        manuscript: `/manuscripts/${result.id}`,
      };
      window.location.href = urlMap[result.type] || `/hub/${result.project_id || result.id}`;
    }
    handleClose();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setInternalOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 text-xs bg-white border border-gray-200 rounded">
          <span>⌘</span>K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
      />

      {/* Search Modal */}
      <div className="fixed inset-x-3 sm:inset-x-4 top-16 sm:top-20 mx-auto max-w-2xl z-50">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, tasks, pages..."
              className="flex-1 text-base outline-none placeholder-gray-400"
            />
            {loading && (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-96 overflow-y-auto">
            {!query.trim() ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">Start typing to search across your workspace</p>
                <div className="mt-4 flex justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 rounded">↑↓ to navigate</span>
                  <span className="px-2 py-1 bg-gray-100 rounded">↵ to select</span>
                  <span className="px-2 py-1 bg-gray-100 rounded">esc to close</span>
                </div>
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No results found for "{query}"</p>
              </div>
            ) : (
              <ul className="py-2">
                {results.map((result, index) => (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`p-1.5 rounded ${TYPE_COLORS[result.type]}`}>
                        {TYPE_ICONS[result.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {result.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {TYPE_LABELS[result.type]}
                          {result.project_name && result.type !== 'project' && (
                            <span> · {result.project_name}</span>
                          )}
                        </div>
                      </div>
                      {result.status && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                          {result.status}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between">
            <span>{results.length > 0 ? `${results.length} results` : ''}</span>
            <div className="flex gap-4">
              <span><kbd className="px-1 bg-white border border-gray-200 rounded">↑</kbd> <kbd className="px-1 bg-white border border-gray-200 rounded">↓</kbd> navigate</span>
              <span><kbd className="px-1 bg-white border border-gray-200 rounded">↵</kbd> select</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default GlobalSearch;
