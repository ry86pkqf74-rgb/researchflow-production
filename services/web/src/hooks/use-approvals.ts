/**
 * React Query Hooks for Approvals
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsAPI } from '@/lib/api/approvals';
import type { ApprovalRequest } from '@/types/api';

export function useApprovals() {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: approvalsAPI.list,
  });
}

export function useApproval(id: string | undefined) {
  return useQuery({
    queryKey: ['approvals', id],
    queryFn: () => approvalsAPI.getById(id!),
    enabled: !!id,
  });
}

export function useRequestApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ApprovalRequest) => approvalsAPI.request(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalsAPI.approve(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalsAPI.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}
