import { useState, useEffect } from 'react';

/**
 * Custom hook to get the variant assignment for an A/B test experiment
 *
 * Returns the variant key ('control' by default) and tracks the user's
 * deterministic assignment across sessions.
 *
 * @param experimentKey - The experiment key (e.g., 'onboarding_flow_v2')
 * @returns string - The variant key assigned to the user
 *
 * @example
 * ```tsx
 * const variant = useExperiment('onboarding_flow_v2');
 *
 * if (variant === 'variant_a') {
 *   return <NewOnboardingFlow />;
 * }
 *
 * return <OriginalOnboardingFlow />;
 * ```
 */
export function useExperiment(experimentKey: string): string {
  const [variant, setVariant] = useState<string>('control');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch(`/api/experiments/${experimentKey}/variant`, {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) {
          console.warn(`[useExperiment] Failed to fetch variant for ${experimentKey}: ${res.status}`);
          return { variant: 'control' };
        }
        return res.json();
      })
      .then(data => {
        setVariant(data.variant || 'control');
        setLoading(false);
      })
      .catch(err => {
        console.error(`[useExperiment] Error fetching variant for ${experimentKey}:`, err);
        setVariant('control'); // Fail safe to control
        setLoading(false);
      });
  }, [experimentKey]);

  return variant;
}

/**
 * Custom hook to get experiment metadata (status, description, etc.)
 *
 * @param experimentKey - The experiment key
 * @returns Experiment metadata or null if not found
 *
 * @example
 * ```tsx
 * const experiment = useExperimentMetadata('onboarding_flow_v2');
 *
 * if (experiment && experiment.status === 'RUNNING') {
 *   const variant = useExperiment('onboarding_flow_v2');
 *   // ... use variant
 * }
 * ```
 */
export function useExperimentMetadata(experimentKey: string) {
  const [experiment, setExperiment] = useState<{
    experimentKey: string;
    name: string;
    description?: string;
    status: string;
    startDate?: string;
    endDate?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/experiments/${experimentKey}`, {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) {
            return null;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => setExperiment(data))
      .catch(err => {
        console.error(`[useExperimentMetadata] Error fetching metadata for ${experimentKey}:`, err);
        setExperiment(null);
      });
  }, [experimentKey]);

  return experiment;
}

/**
 * Helper hook to conditionally render components based on variant
 *
 * @param experimentKey - The experiment key
 * @param variants - Object mapping variant keys to React nodes
 * @returns React node for the assigned variant (or control)
 *
 * @example
 * ```tsx
 * const ExperimentalFeature = () => {
 *   return useExperimentVariant('new_dashboard', {
 *     control: <OldDashboard />,
 *     variant_a: <NewDashboardA />,
 *     variant_b: <NewDashboardB />,
 *   });
 * };
 * ```
 */
export function useExperimentVariant<T>(
  experimentKey: string,
  variants: Record<string, T>
): T {
  const variant = useExperiment(experimentKey);

  // Return the component for the assigned variant, or control if not found
  return variants[variant] || variants.control;
}
