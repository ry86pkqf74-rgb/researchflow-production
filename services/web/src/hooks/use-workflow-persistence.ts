import { useEffect, useRef, useCallback } from 'react';
import type { TopicVersionHistory } from '@packages/core/types';

/**
 * Complete persistent state for the workflow
 * This interface defines all state that should be preserved across sessions
 */
export interface WorkflowPersistentState {
  expandedGroups: string[];
  executionState: Record<number, { status: string; result?: unknown }>;
  scopeValuesByStage: Record<number, Record<string, string>>;
  topicVersionHistory: TopicVersionHistory;
  isTopicLocked: boolean;
  selectedManuscriptId: number | null;
  selectedJournalId: string | null;
  overviewByStage: Record<number, string>;
  lifecycleState: string;
  lastSavedAt: string;
}

/**
 * Default empty state for WorkflowPersistentState
 */
const DEFAULT_WORKFLOW_STATE: WorkflowPersistentState = {
  expandedGroups: [],
  executionState: {},
  scopeValuesByStage: {},
  topicVersionHistory: {
    currentVersion: 0,
    versions: [],
  },
  isTopicLocked: false,
  selectedManuscriptId: null,
  selectedJournalId: null,
  overviewByStage: {},
  lifecycleState: 'DRAFT',
  lastSavedAt: new Date().toISOString(),
};

const STORAGE_KEY = 'ros-workflow-state';

/**
 * Hook for managing workflow state persistence with localStorage
 * Provides automatic save functionality with debouncing for critical changes
 * 
 * @returns Object containing persistence functions:
 *   - saveWorkflowState: Save partial state to localStorage
 *   - loadWorkflowState: Load state from localStorage
 *   - clearWorkflowState: Clear all persisted state
 */
export function useWorkflowPersistence() {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load workflow state from localStorage
   * @returns Persisted state or null if not found/invalid
   */
  const loadWorkflowState = useCallback((): WorkflowPersistentState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as WorkflowPersistentState;
      
      // Validate that parsed state has expected structure
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'expandedGroups' in parsed &&
        'executionState' in parsed &&
        'scopeValuesByStage' in parsed &&
        'topicVersionHistory' in parsed &&
        'isTopicLocked' in parsed &&
        'selectedManuscriptId' in parsed &&
        'selectedJournalId' in parsed &&
        'overviewByStage' in parsed &&
        'lifecycleState' in parsed &&
        'lastSavedAt' in parsed
      ) {
        return parsed;
      }

      console.warn('Stored workflow state has invalid structure, returning null');
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to load workflow state from localStorage: ${errorMessage}`
      );
      return null;
    }
  }, []);

  /**
   * Save partial workflow state to localStorage
   * Merges provided state with existing state and updates lastSavedAt
   * @param state Partial state to merge with existing state
   */
  const saveWorkflowState = useCallback(
    (state: Partial<WorkflowPersistentState>): void => {
      try {
        // Load existing state or use defaults
        const existingState = loadWorkflowState() || DEFAULT_WORKFLOW_STATE;

        // Merge new state with existing
        const mergedState: WorkflowPersistentState = {
          ...existingState,
          ...state,
          lastSavedAt: new Date().toISOString(),
        };

        // Attempt to stringify and save
        const serialized = JSON.stringify(mergedState);
        localStorage.setItem(STORAGE_KEY, serialized);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to save workflow state to localStorage: ${errorMessage}`);
      }
    },
    [loadWorkflowState]
  );

  /**
   * Clear all persisted workflow state
   */
  const clearWorkflowState = useCallback((): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to clear workflow state from localStorage: ${errorMessage}`);
    }
  }, []);

  /**
   * Auto-save state with debouncing (1 second)
   * Useful for auto-saving critical changes during user interactions
   * @param state Partial state to auto-save
   */
  const autoSaveWorkflowState = useCallback(
    (state: Partial<WorkflowPersistentState>): void => {
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        saveWorkflowState(state);
      }, 1000);
    },
    [saveWorkflowState]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveWorkflowState,
    loadWorkflowState,
    clearWorkflowState,
    autoSaveWorkflowState,
  };
}
