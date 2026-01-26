/**
 * Tutorial Hook (Task 108: Inline Tutorials)
 *
 * React Query hook for tutorial state management and API integration.
 * Handles progress tracking, step navigation, and completion states.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TutorialStep {
  title: string;
  content: string;
  targetSelector?: string;
  videoUrl?: string;
}

export interface Tutorial {
  id: string;
  tutorialKey: string;
  title: string;
  description?: string;
  videoUrl?: string;
  steps: TutorialStep[];
  enabled: boolean;
  orgId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TutorialProgress {
  started?: string;
  completed?: boolean;
  currentStep?: number;
  totalSteps?: number;
  dismissedPermanently?: boolean;
  viewCount?: number;
}

export function useTutorial(tutorialKey: string) {
  const queryClient = useQueryClient();

  // Fetch tutorial definition
  const {
    data: tutorial,
    isLoading: tutorialLoading,
    error: tutorialError,
  } = useQuery<Tutorial>({
    queryKey: ['tutorial', tutorialKey],
    queryFn: async () => {
      const response = await fetch(`/api/tutorials/${tutorialKey}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tutorial');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch user progress
  const {
    data: progress,
    isLoading: progressLoading,
    error: progressError,
  } = useQuery<TutorialProgress>({
    queryKey: ['tutorial-progress', tutorialKey],
    queryFn: async () => {
      const response = await fetch(`/api/tutorials/${tutorialKey}/progress`, {
        credentials: 'include',
      });

      if (!response.ok) {
        // Return empty progress if not found
        if (response.status === 404) {
          return {};
        }
        throw new Error('Failed to fetch progress');
      }

      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Update progress mutation
  const { mutate: updateProgress, isPending: isUpdating } = useMutation({
    mutationFn: async (data: Partial<TutorialProgress>) => {
      const response = await fetch(`/api/tutorials/${tutorialKey}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update progress');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-progress', tutorialKey] });
    },
  });

  // Start tutorial mutation
  const { mutate: startTutorial } = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tutorials/${tutorialKey}/start`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to start tutorial');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-progress', tutorialKey] });
    },
  });

  // Complete tutorial mutation
  const { mutate: completeTutorial } = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tutorials/${tutorialKey}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to complete tutorial');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-progress', tutorialKey] });
    },
  });

  const currentStep = progress?.currentStep || 0;
  const isCompleted = progress?.completed || false;
  const isDismissed = progress?.dismissedPermanently || false;

  return {
    // Data
    tutorial,
    progress,
    currentStep,
    isCompleted,
    isDismissed,
    shouldShow: !isCompleted && !isDismissed,

    // Loading states
    isLoading: tutorialLoading || progressLoading,
    isUpdating,

    // Errors
    error: tutorialError || progressError,

    // Actions
    start: () => startTutorial(),
    nextStep: () => {
      if (tutorial) {
        const nextStepIndex = Math.min(currentStep + 1, tutorial.steps.length - 1);
        updateProgress({ currentStep: nextStepIndex });
      }
    },
    prevStep: () => {
      const prevStepIndex = Math.max(0, currentStep - 1);
      updateProgress({ currentStep: prevStepIndex });
    },
    goToStep: (stepIndex: number) => {
      if (tutorial && stepIndex >= 0 && stepIndex < tutorial.steps.length) {
        updateProgress({ currentStep: stepIndex });
      }
    },
    complete: () => completeTutorial(),
    dismiss: () => updateProgress({ dismissedPermanently: true }),
  };
}

/**
 * Hook to fetch all available tutorials
 */
export function useAvailableTutorials() {
  return useQuery<{ tutorials: Tutorial[]; count: number }>({
    queryKey: ['tutorials'],
    queryFn: async () => {
      const response = await fetch('/api/tutorials', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tutorials');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
