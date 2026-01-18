/**
 * Audit Log API Functions
 *
 * API functions for audit log access and export
 */

import { apiGet, apiDownload } from '../api-client';
import type { AuditLog, AuditLogFilters } from '@/types/api';

export const auditAPI = {
  /**
   * List audit logs with optional filters
   */
  list: (filters?: AuditLogFilters) =>
    apiGet<AuditLog[]>('/api/audit', { params: filters as any }),

  /**
   * Export audit logs as CSV
   */
  export: () => apiDownload('/api/audit/export', 'audit-logs.csv'),
};
