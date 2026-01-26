/**
 * Dataset UI State Store
 *
 * Zustand store for dataset management UI state (filters, selections, etc.)
 */

import { create } from 'zustand';
import type { DataClassification } from '@/types/api';

interface DatasetFilters {
  classification?: DataClassification;
  uploadedBy?: string;
  searchQuery?: string;
}

interface DatasetState {
  selectedDatasetId: string | null;
  filters: DatasetFilters;
  sortBy: 'name' | 'uploadedAt' | 'classification';
  sortOrder: 'asc' | 'desc';
  setSelectedDataset: (id: string | null) => void;
  setFilters: (filters: Partial<DatasetFilters>) => void;
  clearFilters: () => void;
  setSorting: (sortBy: DatasetState['sortBy'], sortOrder: 'asc' | 'desc') => void;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  selectedDatasetId: null,
  filters: {},
  sortBy: 'uploadedAt',
  sortOrder: 'desc',
  setSelectedDataset: (id) => set({ selectedDatasetId: id }),
  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
  clearFilters: () => set({ filters: {} }),
  setSorting: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
}));
