import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TopicVersion } from "@packages/core/types";

interface VersionHistoryResponse {
  topicId: string;
  currentVersion: number;
  currentHash: string;
  history: TopicVersion[];
  mode: string;
}

interface OutdatedCheckResponse {
  topicId: string;
  currentVersion: number;
  currentVersionTag: string;
  executedVersion: number;
  isOutdated: boolean;
  versionDelta: number;
  requiresRerun: boolean;
  mode: string;
}

interface DiffResponse {
  topicId: string;
  fromVersion: number;
  toVersion: number;
  diff: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
    changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  }[];
  mode: string;
}

interface LockResponse {
  message: string;
  topic: {
    id: string;
    status: string;
    lockedAt: string;
    lockedBy: string;
  };
}

export function useTopicVersionHistory(topicId: string | undefined) {
  return useQuery<VersionHistoryResponse>({
    queryKey: ['/api/ros/topics', topicId, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/ros/topics/${topicId}/versions`, { 
        credentials: 'include' 
      });
      if (!res.ok) throw new Error('Failed to fetch version history');
      return res.json();
    },
    enabled: !!topicId,
    staleTime: 30000,
  });
}

export function useTopicOutdatedCheck(topicId: string | undefined, stageExecutedVersion: number) {
  return useQuery<OutdatedCheckResponse>({
    queryKey: ['/api/ros/topics', topicId, 'outdated-check', { stageExecutedVersion }],
    queryFn: async () => {
      const res = await fetch(
        `/api/ros/topics/${topicId}/outdated-check?stageExecutedVersion=${stageExecutedVersion}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to check outdated status');
      return res.json();
    },
    enabled: !!topicId && stageExecutedVersion > 0,
    staleTime: 30000,
  });
}

export function useTopicVersionDiff(
  topicId: string | undefined, 
  fromVersion: number | undefined, 
  toVersion: number | undefined
) {
  return useQuery<DiffResponse>({
    queryKey: ['/api/ros/topics', topicId, 'diff', { fromVersion, toVersion }],
    queryFn: async () => {
      const res = await fetch(
        `/api/ros/topics/${topicId}/diff?fromVersion=${fromVersion}&toVersion=${toVersion}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch version diff');
      return res.json();
    },
    enabled: !!topicId && fromVersion !== undefined && toVersion !== undefined && fromVersion !== toVersion,
    staleTime: 60000,
  });
}

interface LockTopicOptions {
  onSuccess?: (data: LockResponse) => void;
  onError?: (error: Error) => void;
}

export function useLockTopic(topicId: string | undefined, options?: LockTopicOptions) {
  return useMutation({
    mutationFn: async (): Promise<LockResponse> => {
      if (!topicId) throw new Error('Topic ID is required');
      
      const res = await apiRequest('POST', `/api/topics/${topicId}/lock`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ros/topics', topicId] });
      queryClient.invalidateQueries({ queryKey: ['/api/topics', topicId] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}

export function useLockTopicROS(topicId: string | undefined, options?: LockTopicOptions) {
  return useMutation({
    mutationFn: async (): Promise<LockResponse> => {
      if (!topicId) throw new Error('Topic ID is required');
      
      const res = await fetch(`/api/ros/topics/${topicId}/lock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          throw new Error(errorData.error || 'Topic is already locked');
        }
        throw new Error(errorData.error || 'Failed to lock topic');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ros/topics', topicId] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
