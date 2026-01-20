import { useState, useEffect } from 'react';

/**
 * Custom hook to check if a feature flag is enabled
 *
 * Priority:
 * 1. Client-side environment variable (VITE_FEATURE_*)
 * 2. Server API response (cached)
 *
 * @param flagKey - The feature flag key (e.g., 'custom_fields')
 * @returns boolean - Whether the flag is enabled (defaults to false)
 *
 * @example
 * ```tsx
 * const isCustomFieldsEnabled = useFeatureFlag('custom_fields');
 *
 * if (isCustomFieldsEnabled) {
 *   return <CustomFieldsEditor />;
 * }
 * ```
 */
export function useFeatureFlag(flagKey: string): boolean {
  // Check VITE_FEATURE_* env var first (compile-time check)
  const envKey = `VITE_FEATURE_${flagKey.toUpperCase()}`;
  const envValue = import.meta.env[envKey];

  if (envValue !== undefined) {
    return envValue === 'true' || envValue === true;
  }

  // For runtime checking via API, use state
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    // Skip API call if env var was defined
    if (envValue !== undefined) {
      return;
    }

    // Fetch flag status from API
    fetch(`/api/experiments/flags/${flagKey}`, {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) {
          console.warn(`[useFeatureFlag] Failed to fetch flag ${flagKey}: ${res.status}`);
          return { enabled: false };
        }
        return res.json();
      })
      .then(data => setEnabled(data.enabled || false))
      .catch(err => {
        console.error(`[useFeatureFlag] Error fetching flag ${flagKey}:`, err);
        setEnabled(false); // Fail closed
      });
  }, [flagKey, envValue]);

  // Return env value if it exists, otherwise runtime state
  return envValue !== undefined ? (envValue === 'true' || envValue === true) : enabled;
}

/**
 * Custom hook to get all enabled feature flags
 *
 * @returns Array of { flagKey, description, tierRequired } objects
 *
 * @example
 * ```tsx
 * const enabledFlags = useEnabledFeatureFlags();
 *
 * return (
 *   <div>
 *     {enabledFlags.map(flag => (
 *       <div key={flag.flagKey}>{flag.description}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useEnabledFeatureFlags() {
  const [flags, setFlags] = useState<Array<{
    flagKey: string;
    description?: string;
    tierRequired?: string;
  }>>([]);

  useEffect(() => {
    fetch('/api/experiments/flags', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => setFlags(data || []))
      .catch(err => {
        console.error('[useEnabledFeatureFlags] Error fetching flags:', err);
        setFlags([]);
      });
  }, []);

  return flags;
}
