/**
 * Approvals API Functions
 *
 * API functions for approval workflow management
 */

import { apiGet, apiPost } from '../api-client';
import type { Approval, ApprovalRequest } from '@/types/api';

export const approvalsAPI = {
  /**
   * List all approval requests
   */
  list: () => apiGet<Approval[]>('/api/approvals'),

  /**
   * Get approval by ID
   */
  getById: (id: string) => apiGet<Approval>(`/api/approvals/${id}`),

  /**
   * Request approval for an operation
   */
  request: (data: ApprovalRequest) => apiPost<Approval>('/api/approvals', data),

  /**
   * Approve a request
   */
  approve: (id: string, reason: string) =>
    apiPost<Approval>(`/api/approvals/${id}/approve`, { reason }),

  /**
   * Reject a request
   */
  reject: (id: string, reason: string) =>
    apiPost<Approval>(`/api/approvals/${id}/reject`, { reason }),
};
