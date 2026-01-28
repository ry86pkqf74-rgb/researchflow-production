/**
 * Deep Linking Utilities
 *
 * Provides utilities for generating shareable URLs and parsing URL parameters
 * to reconstruct application state. Enables users to share specific views,
 * filters, and configurations with others.
 */

import { useLocation } from "wouter";
import { useCallback } from "react";

/**
 * URL state parameters
 */
interface URLState {
  projectId?: string;
  runId?: string;
  artifactId?: string;
  tab?: string;
  filter?: string;
  sort?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Deep link configuration
 */
interface DeepLink {
  path: string;
  label: string;
  state?: URLState;
}

/**
 * Generate a shareable URL with encoded state
 *
 * @example
 * ```tsx
 * const url = generateDeepLink({
 *   path: '/projects/123',
 *   state: {
 *     tab: 'runs',
 *     filter: 'status:active',
 *   }
 * });
 * // https://app.example.com/projects/123?tab=runs&filter=status:active
 * ```
 */
export function generateDeepLink(config: DeepLink): string {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.REACT_APP_URL || "http://localhost:3000";

  const url = new URL(config.path, baseUrl);

  if (config.state) {
    Object.entries(config.state).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === "string") {
          url.searchParams.set(key, value);
        } else if (typeof value === "number") {
          url.searchParams.set(key, String(value));
        } else {
          url.searchParams.set(key, JSON.stringify(value));
        }
      }
    });
  }

  return url.toString();
}

/**
 * Parse URL parameters into state object
 *
 * @example
 * ```tsx
 * const state = parseDeepLink('?tab=runs&filter=status:active');
 * // { tab: 'runs', filter: 'status:active' }
 * ```
 */
export function parseDeepLink(search: string): URLState {
  const params = new URLSearchParams(search);
  const state: URLState = {};

  params.forEach((value, key) => {
    try {
      // Try to parse as JSON first (for complex types)
      state[key as keyof URLState] = JSON.parse(value);
    } catch {
      // Fall back to string
      state[key as keyof URLState] = value as any;
    }
  });

  return state;
}

/**
 * Hook for working with deep links
 *
 * @example
 * ```tsx
 * const { state, createLink, updateState } = useDeepLink();
 *
 * const handleTabChange = (tab: string) => {
 *   updateState({ tab });
 * };
 *
 * const shareUrl = createLink({
 *   label: "Shared view"
 * });
 * ```
 */
export function useDeepLink() {
  const [location, setLocation] = useLocation();

  const state = parseDeepLink(location.split("?")[1] || "");

  const createLink = useCallback(
    (config?: Partial<DeepLink>): string => {
      const path = config?.path || location.split("?")[0];
      return generateDeepLink({
        path,
        label: config?.label || "Shared Link",
        state: config?.state || state,
      });
    },
    [location, state]
  );

  const updateState = useCallback(
    (newState: Partial<URLState>) => {
      const updatedState = { ...state, ...newState };
      const url = generateDeepLink({
        path: location.split("?")[0],
        label: "",
        state: updatedState,
      });

      setLocation(url);
    },
    [state, location, setLocation]
  );

  const copyToClipboard = useCallback(async (url?: string): Promise<boolean> => {
    try {
      const linkToCopy = url || createLink();
      await navigator.clipboard.writeText(linkToCopy);
      return true;
    } catch {
      return false;
    }
  }, [createLink]);

  return {
    state,
    createLink,
    updateState,
    copyToClipboard,
    currentUrl: location,
  };
}

/**
 * Helper to create project deep links
 *
 * @example
 * ```tsx
 * const url = createProjectLink('project-123', { tab: 'runs' });
 * ```
 */
export function createProjectLink(
  projectId: string,
  state?: Omit<URLState, "projectId">
): string {
  return generateDeepLink({
    path: `/projects/${projectId}`,
    label: "Project Link",
    state: { projectId, ...state },
  });
}

/**
 * Helper to create run deep links
 *
 * @example
 * ```tsx
 * const url = createRunLink('project-123', 'run-456', { tab: 'artifacts' });
 * ```
 */
export function createRunLink(
  projectId: string,
  runId: string,
  state?: Omit<URLState, "projectId" | "runId">
): string {
  return generateDeepLink({
    path: `/projects/${projectId}/runs/${runId}`,
    label: "Run Link",
    state: { projectId, runId, ...state },
  });
}

/**
 * Helper to create artifact deep links
 *
 * @example
 * ```tsx
 * const url = createArtifactLink('project-123', 'artifact-789');
 * ```
 */
export function createArtifactLink(
  projectId: string,
  artifactId: string,
  state?: Omit<URLState, "projectId" | "artifactId">
): string {
  return generateDeepLink({
    path: `/projects/${projectId}/artifacts/${artifactId}`,
    label: "Artifact Link",
    state: { projectId, artifactId, ...state },
  });
}

/**
 * Helper to copy a deep link to clipboard
 *
 * @example
 * ```tsx
 * const copied = await copyDeepLink('/projects/123', { tab: 'runs' });
 * if (copied) {
 *   toast({ description: "Link copied to clipboard" });
 * }
 * ```
 */
export async function copyDeepLink(
  path: string,
  state?: URLState
): Promise<boolean> {
  try {
    const url = generateDeepLink({ path, label: "", state });
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a URL state is valid
 *
 * @example
 * ```tsx
 * if (isValidDeepLink(state)) {
 *   // Apply state
 * }
 * ```
 */
export function isValidDeepLink(state: URLState): boolean {
  // Ensure state has at least one valid parameter
  return Object.values(state).some((v) => v !== undefined && v !== null);
}
