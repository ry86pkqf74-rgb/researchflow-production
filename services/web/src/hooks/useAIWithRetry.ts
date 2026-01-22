/**
 * useAIWithRetry Hook
 *
 * Wraps useAI with automatic retry logic for transient failures.
 * - Retries network errors (fetch failures, timeouts)
 * - Does NOT retry application errors (validation failures, user denial, 4xx errors)
 * - Exponential backoff: 1s, 2s, 4s
 * - Toast notifications for retry attempts
 * - Final error toast after exhausting retries
 */

import { useAI, type AIGenerateOptions } from './useAI';
import { useToast } from './use-toast';
import { isRetryableError as checkRetryable, getUserMessage } from '@/lib/errors';

interface AIResponse<T = any> {
  success: boolean;
  mode: 'DEMO' | 'LIVE';
  data: T;
  error?: string;
  approvalId?: string;
  approvedBy?: string;
}

interface RetryOptions extends AIGenerateOptions {
  maxRetries?: number; // Default: 2 (total 3 attempts)
  showRetryToasts?: boolean; // Default: true
}

interface UseAIWithRetryReturn {
  generateWithRetry: <T = any>(
    endpoint: string,
    payload?: any,
    options?: RetryOptions
  ) => Promise<AIResponse<T>>;
  isDemo: boolean;
  isLive: boolean;
}

/**
 * Determines if an error is retryable (network/transient issues)
 */
function isRetryableError(error: string): boolean {
  const retryablePatterns = [
    'fetch',
    'network',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'Failed to fetch',
    'NetworkError',
    'CORS',
    '5', // 5xx server errors
  ];

  return retryablePatterns.some((pattern) => error.toLowerCase().includes(pattern.toLowerCase()));
}

/**
 * Hook that adds automatic retry logic to AI operations
 */
export function useAIWithRetry(): UseAIWithRetryReturn {
  const { generateContent, isDemo, isLive } = useAI();
  const { toast } = useToast();

  const generateWithRetry = async <T = any>(
    endpoint: string,
    payload?: any,
    options?: RetryOptions
  ): Promise<AIResponse<T>> => {
    const maxRetries = options?.maxRetries ?? 2;
    const showRetryToasts = options?.showRetryToasts ?? true;
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[useAIWithRetry] Attempt ${attempt + 1}/${maxRetries + 1} for ${endpoint}`);

        const result = await generateContent<T>(endpoint, payload, {
          stageId: options?.stageId,
          stageName: options?.stageName,
          skipApproval: options?.skipApproval,
        });

        // Success - return immediately
        if (result.success) {
          if (attempt > 0 && showRetryToasts) {
            // Show success toast if we retried
            toast({
              title: 'Success',
              description: `Operation completed after ${attempt + 1} attempt${attempt > 0 ? 's' : ''}`,
              variant: 'default',
            });
          }
          return result;
        }

        // Error returned from AI operation
        lastError = result.error || 'Unknown error';

        // Check if error is retryable
        if (!isRetryableError(lastError)) {
          console.log('[useAIWithRetry] Non-retryable error:', lastError);
          // Non-retryable error (validation failure, user denial, 4xx)
          return result;
        }

        // Retryable error - attempt retry if we have attempts left
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s

          console.log(`[useAIWithRetry] Retryable error, waiting ${delayMs}ms before retry:`, lastError);

          if (showRetryToasts) {
            toast({
              title: `Retrying... (${attempt + 1}/${maxRetries})`,
              description: 'Network error detected, retrying request',
              variant: 'default',
            });
          }

          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        // Unexpected error (should be rare since useAI catches most errors)
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error('[useAIWithRetry] Unexpected error:', error);

        if (!isRetryableError(lastError)) {
          // Non-retryable error
          return {
            success: false,
            mode: isLive ? 'LIVE' : 'DEMO',
            data: {} as T,
            error: lastError,
          };
        }

        // Retryable error - continue to retry if we have attempts left
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt);

          if (showRetryToasts) {
            toast({
              title: `Retrying... (${attempt + 1}/${maxRetries})`,
              description: 'Network error detected, retrying request',
              variant: 'default',
            });
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // Exhausted all retries
    console.error('[useAIWithRetry] All retry attempts exhausted:', lastError);

    if (showRetryToasts) {
      toast({
        title: 'Operation Failed',
        description: lastError || 'Failed after multiple retry attempts',
        variant: 'destructive',
      });
    }

    return {
      success: false,
      mode: isLive ? 'LIVE' : 'DEMO',
      data: {} as T,
      error: lastError || 'Operation failed after retries',
    };
  };

  return { generateWithRetry, isDemo, isLive };
}

/**
 * Helper to create a retry-wrapped version of a specific AI operation
 */
export function createRetryableOperation<TPayload, TResponse>(
  endpoint: string,
  options?: Omit<RetryOptions, 'stageId' | 'stageName'>
) {
  return (
    generateWithRetry: ReturnType<typeof useAIWithRetry>['generateWithRetry'],
    payload: TPayload,
    operationOptions?: Pick<RetryOptions, 'stageId' | 'stageName'>
  ): Promise<AIResponse<TResponse>> => {
    return generateWithRetry<TResponse>(endpoint, payload, {
      ...options,
      ...operationOptions,
    });
  };
}
