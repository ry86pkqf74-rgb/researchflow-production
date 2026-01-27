/**
 * Search API Client
 *
 * Global search across projects, tasks, pages, goals, and workflows.
 */

import { api } from './client';

// Types
export type SearchResultType = 'project' | 'task' | 'page' | 'goal' | 'workflow' | 'artifact' | 'manuscript';

export interface SearchResult {
  id: string;
  name: string;
  type: SearchResultType;
  project_id?: string;
  project_name?: string;
  status?: string;
  progress?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
  // Additional context fields
  [key: string]: any;
}

export interface SearchSuggestion {
  text: string;
  type: SearchResultType;
  id?: string;
}

export interface GlobalSearchParams {
  q: string;
  types?: string; // comma-separated: projects,pages,tasks,goals
  limit?: number;
}

export interface ArtifactSearchParams {
  q: string;
  orgId?: string;
  type?: 'artifact' | 'manuscript' | 'all';
  limit?: number;
  offset?: number;
}

// API Functions
export const searchApi = {
  /**
   * Global search across all entity types
   * Searches projects, pages, tasks, goals by name/title
   */
  global: (params: GlobalSearchParams) =>
    api.get<{ query: string; results: SearchResult[]; total: number }>('/api/search/global', {
      q: params.q,
      types: params.types || 'all',
      limit: params.limit || 20,
    }),

  /**
   * Search artifacts and manuscripts
   */
  artifacts: (params: ArtifactSearchParams) =>
    api.get<{
      query: string;
      type: string;
      results: any[];
      count: number;
      limit: number;
      offset: number;
    }>('/api/search', params),

  /**
   * Get search suggestions for autocomplete
   */
  suggestions: (query: string, limit?: number) =>
    api.get<{ suggestions: SearchSuggestion[] }>('/api/search/suggestions', {
      q: query,
      limit: limit || 5,
    }),

  /**
   * Search within a specific research project
   */
  searchInResearch: (researchId: string, query: string, limit?: number) =>
    api.get<{
      query: string;
      researchId: string;
      results: any[];
      count: number;
    }>(`/api/search/research/${researchId}`, { q: query, limit }),

  /**
   * Quick search helper - returns first N results of each type
   */
  quickSearch: async (query: string, maxPerType: number = 3) => {
    const result = await searchApi.global({
      q: query,
      types: 'projects,pages,tasks,goals',
      limit: 50,
    });

    if (result.error || !result.data) {
      return result;
    }

    // Group by type and limit each
    const grouped: Record<string, SearchResult[]> = {};
    for (const item of result.data.results) {
      if (!grouped[item.type]) {
        grouped[item.type] = [];
      }
      if (grouped[item.type].length < maxPerType) {
        grouped[item.type].push(item);
      }
    }

    return {
      data: {
        query,
        grouped,
        total: result.data.total,
      },
      error: null,
    };
  },

  /**
   * Search projects only
   */
  searchProjects: (query: string, limit?: number) =>
    searchApi.global({ q: query, types: 'projects', limit }),

  /**
   * Search tasks only
   */
  searchTasks: (query: string, limit?: number) =>
    searchApi.global({ q: query, types: 'tasks', limit }),

  /**
   * Search pages only
   */
  searchPages: (query: string, limit?: number) =>
    searchApi.global({ q: query, types: 'pages', limit }),

  /**
   * Search goals only
   */
  searchGoals: (query: string, limit?: number) =>
    searchApi.global({ q: query, types: 'goals', limit }),
};

export default searchApi;
