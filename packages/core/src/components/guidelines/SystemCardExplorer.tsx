/**
 * SystemCardExplorer Component
 *
 * A searchable, filterable explorer for clinical scoring systems,
 * staging criteria, and guidelines.
 *
 * Features:
 * - Full-text search across names and conditions
 * - Filter by type, specialty, intended use, and verification status
 * - Responsive card grid layout
 * - Click handlers for selection
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
  SystemCard,
  SystemCardType,
  IntendedUse,
  SearchSystemCardsParams,
  SearchSystemCardsResponse,
} from '../../api/guidelines-api';

// =============================================================================
// Types
// =============================================================================

export interface SystemCardExplorerProps {
  /** Initial search results or loaded data */
  initialData?: SearchSystemCardsResponse;
  /** Callback when a system card is selected */
  onSelect?: (card: SystemCard) => void;
  /** Callback for search/filter changes */
  onSearch?: (params: SearchSystemCardsParams) => Promise<SearchSystemCardsResponse>;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Custom class name */
  className?: string;
}

export interface FilterState {
  query: string;
  type: SystemCardType | '';
  specialty: string;
  intendedUse: IntendedUse | '';
  verifiedOnly: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SYSTEM_TYPES: { value: SystemCardType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'score', label: 'Scoring System' },
  { value: 'staging', label: 'Staging Criteria' },
  { value: 'grading', label: 'Grading Scale' },
  { value: 'classification', label: 'Classification' },
  { value: 'criteria', label: 'Diagnostic Criteria' },
  { value: 'guideline', label: 'Clinical Guideline' },
  { value: 'reporting_standard', label: 'Reporting Standard' },
];

const INTENDED_USES: { value: IntendedUse | ''; label: string }[] = [
  { value: '', label: 'All Uses' },
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'prognosis', label: 'Prognosis' },
  { value: 'treatment_selection', label: 'Treatment Selection' },
  { value: 'severity', label: 'Severity Assessment' },
  { value: 'complications', label: 'Complication Risk' },
  { value: 'quality', label: 'Quality Measure' },
];

const SPECIALTIES = [
  '',
  'Cardiology',
  'Hepatology',
  'Pulmonology',
  'Emergency Medicine',
  'Oncology',
  'Nephrology',
  'Neurology',
  'Infectious Disease',
  'Rheumatology',
  'Hematology',
];

// =============================================================================
// Styles (Tailwind CSS classes)
// =============================================================================

const styles = {
  container: 'w-full max-w-7xl mx-auto p-4',
  header: 'mb-6',
  title: 'text-2xl font-bold text-gray-900 mb-2',
  subtitle: 'text-gray-600',
  searchBar: 'mb-4',
  searchInput: 'w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
  filters: 'flex flex-wrap gap-3 mb-6',
  filterSelect: 'px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500',
  filterCheckbox: 'flex items-center gap-2 text-sm text-gray-700',
  grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  card: 'bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4',
  cardSelected: 'ring-2 ring-blue-500',
  cardHeader: 'flex items-start justify-between mb-2',
  cardTitle: 'font-semibold text-gray-900 text-lg',
  cardBadge: 'px-2 py-1 text-xs font-medium rounded-full',
  cardBadgeScore: 'bg-blue-100 text-blue-800',
  cardBadgeStaging: 'bg-purple-100 text-purple-800',
  cardBadgeCriteria: 'bg-green-100 text-green-800',
  cardBadgeDefault: 'bg-gray-100 text-gray-800',
  cardSpecialty: 'text-sm text-gray-500 mb-2',
  cardDescription: 'text-sm text-gray-600 mb-3',
  cardMeta: 'flex items-center gap-4 text-xs text-gray-500',
  cardVerified: 'flex items-center gap-1 text-green-600',
  cardInputs: 'text-gray-500',
  loading: 'flex items-center justify-center py-12',
  loadingSpinner: 'animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full',
  error: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg',
  empty: 'text-center py-12 text-gray-500',
  pagination: 'flex items-center justify-between mt-6',
  pageInfo: 'text-sm text-gray-600',
  pageButtons: 'flex gap-2',
  pageButton: 'px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed',
};

// =============================================================================
// Helper Functions
// =============================================================================

function getTypeBadgeClass(type: SystemCardType): string {
  switch (type) {
    case 'score':
      return styles.cardBadgeScore;
    case 'staging':
      return styles.cardBadgeStaging;
    case 'criteria':
    case 'classification':
      return styles.cardBadgeCriteria;
    default:
      return styles.cardBadgeDefault;
  }
}

function formatType(type: SystemCardType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// =============================================================================
// Component
// =============================================================================

export const SystemCardExplorer: React.FC<SystemCardExplorerProps> = ({
  initialData,
  onSelect,
  onSearch,
  loading = false,
  error,
  className = '',
}) => {
  // State
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    type: '',
    specialty: '',
    intendedUse: '',
    verifiedOnly: false,
  });
  const [data, setData] = useState<SearchSystemCardsResponse | undefined>(initialData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Debounced search
  const handleSearch = useCallback(async () => {
    if (!onSearch) return;

    setSearching(true);
    try {
      const params: SearchSystemCardsParams = {};
      if (filters.query) params.query = filters.query;
      if (filters.type) params.type = filters.type;
      if (filters.specialty) params.specialty = filters.specialty;
      if (filters.intendedUse) params.intendedUse = filters.intendedUse;
      if (filters.verifiedOnly) params.verified = true;

      const result = await onSearch(params);
      setData(result);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [filters, onSearch]);

  // Filter change handlers
  const handleFilterChange = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Card selection
  const handleCardClick = useCallback(
    (card: SystemCard) => {
      setSelectedId(card.id);
      onSelect?.(card);
    },
    [onSelect]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, card: SystemCard) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(card);
      }
    },
    [handleCardClick]
  );

  // Memoized display data
  const displayData = useMemo(() => {
    if (!data) return [];
    return data.systems;
  }, [data]);

  // Render loading state
  if (loading && !data) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Clinical Scoring Systems & Guidelines</h2>
        <p className={styles.subtitle}>
          Search and explore validated clinical prediction models, staging criteria, and guidelines
        </p>
      </div>

      {/* Search Bar */}
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search by name, condition, or keyword..."
          value={filters.query}
          onChange={(e) => handleFilterChange('query', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className={styles.searchInput}
          aria-label="Search system cards"
        />
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <select
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value as SystemCardType | '')}
          className={styles.filterSelect}
          aria-label="Filter by type"
        >
          {SYSTEM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={filters.specialty}
          onChange={(e) => handleFilterChange('specialty', e.target.value)}
          className={styles.filterSelect}
          aria-label="Filter by specialty"
        >
          <option value="">All Specialties</option>
          {SPECIALTIES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={filters.intendedUse}
          onChange={(e) => handleFilterChange('intendedUse', e.target.value as IntendedUse | '')}
          className={styles.filterSelect}
          aria-label="Filter by intended use"
        >
          {INTENDED_USES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        <label className={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => handleFilterChange('verifiedOnly', e.target.checked)}
          />
          <span>Verified only</span>
        </label>

        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Results Grid */}
      {displayData.length > 0 ? (
        <div className={styles.grid}>
          {displayData.map((card) => (
            <div
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(card)}
              onKeyDown={(e) => handleKeyDown(e, card)}
              className={`${styles.card} ${selectedId === card.id ? styles.cardSelected : ''}`}
              aria-selected={selectedId === card.id}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{card.name}</h3>
                <span className={`${styles.cardBadge} ${getTypeBadgeClass(card.type)}`}>
                  {formatType(card.type)}
                </span>
              </div>

              {card.specialty && <p className={styles.cardSpecialty}>{card.specialty}</p>}

              {card.population && (
                <p className={styles.cardDescription}>{card.population}</p>
              )}

              <div className={styles.cardMeta}>
                {card.verified && (
                  <span className={styles.cardVerified}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified
                  </span>
                )}
                <span className={styles.cardInputs}>
                  {card.inputs.length} inputs · {card.outputs.length} outputs
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && <div className={styles.empty}>No systems found matching your criteria</div>
      )}

      {/* Pagination */}
      {data && data.total > data.limit && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            Showing {data.offset + 1} - {Math.min(data.offset + data.limit, data.total)} of{' '}
            {data.total}
          </span>
          <div className={styles.pageButtons}>
            <button
              disabled={data.offset === 0}
              onClick={() => {
                const params: SearchSystemCardsParams = { offset: Math.max(0, data.offset - data.limit) };
                if (filters.query) params.query = filters.query;
                if (filters.type) params.type = filters.type;
                if (filters.specialty) params.specialty = filters.specialty;
                if (filters.intendedUse) params.intendedUse = filters.intendedUse;
                if (filters.verifiedOnly) params.verified = true;
                onSearch?.(params);
              }}
              className={styles.pageButton}
            >
              Previous
            </button>
            <button
              disabled={data.offset + data.limit >= data.total}
              onClick={() => {
                const params: SearchSystemCardsParams = { offset: data.offset + data.limit };
                if (filters.query) params.query = filters.query;
                if (filters.type) params.type = filters.type;
                if (filters.specialty) params.specialty = filters.specialty;
                if (filters.intendedUse) params.intendedUse = filters.intendedUse;
                if (filters.verifiedOnly) params.verified = true;
                onSearch?.(params);
              }}
              className={styles.pageButton}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemCardExplorer;
