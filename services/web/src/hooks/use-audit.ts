/**
 * React Query Hooks for Audit Logs
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { auditAPI } from '@/lib/api/audit';
import type { AuditLogFilters } from '@/types/api';

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditAPI.list(filters),
  });
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: () => auditAPI.export(),
  });
}
