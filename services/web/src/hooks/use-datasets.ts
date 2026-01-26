/**
 * React Query Hooks for Datasets
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { datasetsAPI } from '@/lib/api/datasets';
import type { CreateDatasetInput } from '@/types/api';

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: datasetsAPI.list,
  });
}

export function useDataset(id: string | undefined) {
  return useQuery({
    queryKey: ['datasets', id],
    queryFn: () => datasetsAPI.getById(id!),
    enabled: !!id,
  });
}

export function useCreateDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDatasetInput) => datasetsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => datasetsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
}

export function usePhiScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => datasetsAPI.runPhiScan(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['datasets', id] });
    },
  });
}
