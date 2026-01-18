/**
 * Datasets API Functions
 *
 * API functions for dataset management in ResearchFlow Canvas
 */

import { apiGet, apiPost, apiDelete } from '../api-client';
import type { Dataset, CreateDatasetInput, PhiScanResult } from '@/types/api';

export const datasetsAPI = {
  /**
   * List all datasets
   */
  list: () => apiGet<Dataset[]>('/api/datasets'),

  /**
   * Get dataset by ID
   */
  getById: (id: string) => apiGet<Dataset>(`/api/datasets/${id}`),

  /**
   * Create new dataset
   */
  create: (data: CreateDatasetInput) => apiPost<Dataset>('/api/datasets', data),

  /**
   * Delete dataset
   */
  delete: (id: string) => apiDelete<void>(`/api/datasets/${id}`),

  /**
   * Run PHI scan on dataset
   */
  runPhiScan: (id: string) => apiPost<PhiScanResult>(`/api/datasets/${id}/phi-scan`, {}),
};
