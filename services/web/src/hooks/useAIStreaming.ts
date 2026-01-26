/**
 * useAIStreaming Hook
 *
 * Integrates SSE streaming with authorization for progressive AI feedback.
 * Shows real-time progress for long-running operations.
 */

import { useState, useCallback, useRef } from 'react';
import { useAIApprovalGate } from '@/components/ui/ai-approval-gate';
import { useModeStore } from '@/stores/mode-store';
import { createAIStream, type StreamRequestBody } from '@/lib/streaming';

interface StreamState {
  isStreaming: boolean;
  status: string;
  progress: number;
  tokens: string[];
  result: unknown | null;
  error: string | null;
}

interface StreamOptions {
  stageId?: number;
  stageName?: string;
  skipApproval?: boolean;
  modelTier?: 'MINI' | 'STANDARD' | 'ADVANCED';
  streamTokens?: boolean;
}

export function useAIStreaming() {
  const { requestApproval } = useAIApprovalGate();
  const { isDemo, isLive } = useModeStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    status: '',
    progress: 0,
    tokens: [],
    result: null,
    error: null,
  });

  const startStream = useCallback(
    async (operation: string, input: Record<string, unknown>, options?: StreamOptions) => {
      // Reset state
      setState({
        isStreaming: true,
        status: 'Initializing...',
        progress: 0,
        tokens: [],
        result: null,
        error: null,
      });

      try {
        // DEMO mode: Simulate streaming with mock data
        if (isDemo) {
          await simulateDemoStream(operation, setState);
          return;
        }

        // LIVE mode: Request approval first
        if (!options?.skipApproval) {
          const approval = await requestApproval(
            options?.stageId || 0,
            options?.stageName || operation
          );

          if (!approval.approved) {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: 'AI operation denied by user',
            }));
            return;
          }
        }

        // Create abort controller
        abortControllerRef.current = new AbortController();

        // Create stream request
        const requestBody: StreamRequestBody = {
          operation,
          input,
          options: {
            model_tier: options?.modelTier || 'STANDARD',
            stream_tokens: options?.streamTokens ?? true,
          },
        };

        const stream = createAIStream('/api/ai/stream', requestBody);

        // Set up event handlers
        stream
          .onStatus((data) => {
            setState((prev) => ({ ...prev, status: data.status }));
          })
          .onToken((data) => {
            setState((prev) => ({
              ...prev,
              tokens: [...prev.tokens, data.token],
            }));
          })
          .onProgress((data) => {
            setState((prev) => ({
              ...prev,
              progress: data.percent,
              status: data.message || prev.status,
            }));
          })
          .onDone((data) => {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              result: data.result,
              progress: 100,
              status: 'Complete',
            }));
          })
          .onError((data) => {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: data.message,
            }));
          });

        // Start streaming
        await stream.start();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },
    [requestApproval, isDemo, isLive]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      status: 'Cancelled',
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      status: '',
      progress: 0,
      tokens: [],
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    startStream,
    cancelStream,
    reset,
  };
}

/**
 * Simulate streaming in DEMO mode
 */
async function simulateDemoStream(
  operation: string,
  setState: React.Dispatch<React.SetStateAction<StreamState>>
) {
  const stages = getDemoStages(operation);

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const progress = ((i + 1) / stages.length) * 100;

    setState((prev) => ({
      ...prev,
      status: stage.status,
      progress,
    }));

    // Simulate token streaming for text generation
    if (stage.tokens) {
      for (const token of stage.tokens) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        setState((prev) => ({
          ...prev,
          tokens: [...prev.tokens, token],
        }));
      }
    }

    await new Promise((resolve) => setTimeout(resolve, stage.duration));
  }

  // Complete
  setState((prev) => ({
    ...prev,
    isStreaming: false,
    progress: 100,
    status: 'Complete',
    result: getDemoResult(operation),
  }));
}

/**
 * Get demo stages for different operations
 */
function getDemoStages(operation: string): Array<{
  status: string;
  duration: number;
  tokens?: string[];
}> {
  switch (operation) {
    case 'manuscript_draft':
      return [
        { status: 'Analyzing research data...', duration: 1000 },
        { status: 'Generating introduction...', duration: 1500, tokens: ['## Introduction', '\n\n', 'This study examines...'] },
        { status: 'Writing methods section...', duration: 1500 },
        { status: 'Generating results...', duration: 2000 },
        { status: 'Drafting discussion...', duration: 1500 },
        { status: 'Finalizing manuscript...', duration: 500 },
      ];
    case 'statistical_analysis':
      return [
        { status: 'Loading dataset...', duration: 800 },
        { status: 'Computing descriptive statistics...', duration: 1200 },
        { status: 'Running regression models...', duration: 1500 },
        { status: 'Generating tables...', duration: 1000 },
        { status: 'Creating visualizations...', duration: 1200 },
      ];
    case 'literature_search':
      return [
        { status: 'Searching PubMed...', duration: 1000 },
        { status: 'Searching Embase...', duration: 1000 },
        { status: 'Searching Cochrane Library...', duration: 800 },
        { status: 'Ranking results by relevance...', duration: 1200 },
      ];
    default:
      return [
        { status: 'Processing request...', duration: 1000 },
        { status: 'Generating response...', duration: 2000 },
        { status: 'Finalizing...', duration: 500 },
      ];
  }
}

/**
 * Get demo result for different operations
 */
function getDemoResult(operation: string): unknown {
  return {
    operation,
    mode: 'DEMO',
    message: `[DEMO] ${operation} completed successfully`,
    timestamp: new Date().toISOString(),
  };
}
