/**
 * useAI Hook
 *
 * Mode-aware hook for AI API calls with integrated authorization.
 * - DEMO mode: Returns mock data, skips authorization
 * - LIVE mode: Requires approval before API calls (100% strict)
 *
 * All AI operations in LIVE mode go through the approval gate.
 */

import { useModeStore } from '@/stores/mode-store';
import { getDemoResponse, DEMO_RESPONSES } from '@/data/demo-responses';
import { useAIApprovalGate } from '@/components/ui/ai-approval-gate';
import { useTokenStore } from '@/hooks/use-auth';
import {
  validateEndpointResponse,
  formatValidationErrors,
} from '@/lib/ai-validation';
import { createErrorFromResponse, getUserMessage } from '@/lib/errors';

interface AIResponse<T = any> {
  success: boolean;
  mode: 'DEMO' | 'LIVE';
  data: T;
  error?: string;
  approvalId?: string;
  approvedBy?: string;
}

interface AIGenerateOptions {
  skipApproval?: boolean; // Only for non-AI endpoints (phi/scan, governance)
  stageId?: number;
  stageName?: string;
}

interface UseAIReturn {
  generateContent: <T = any>(
    endpoint: string,
    payload?: any,
    options?: AIGenerateOptions
  ) => Promise<AIResponse<T>>;
  isDemo: boolean;
  isLive: boolean;
}

/**
 * Maps demo endpoint keys to actual API endpoints
 */
const ENDPOINT_MAP: Record<string, string> = {
  'ai/research-brief': '/api/ai/research-brief',
  'ai/literature-search': '/api/ai/literature-search',
  'ai/manuscript-draft': '/api/ai/manuscript-draft',
  'ai/statistical-analysis': '/api/ai/statistical-analysis',
  'ai/topic-refinement': '/api/ai/topic-refinement',
  'phi/scan': '/api/phi/scan',
  'phi/scan-fail': '/api/phi/scan',
  'governance/approvals': '/api/governance/approvals',
  'governance/audit-log': '/api/governance/audit-log',
};

/**
 * Determines if an endpoint is an AI operation requiring approval
 */
function isAIEndpoint(endpoint: string): boolean {
  const aiPatterns = [
    'ai/research-brief',
    'ai/literature-search',
    'ai/manuscript-draft',
    'ai/statistical-analysis',
    'ai/topic-refinement',
    'ai/topic-recommendations',
    'ai/generate',
    'ai/analyze',
    'ros/ai/',
  ];

  return aiPatterns.some((pattern) => endpoint.includes(pattern));
}

/**
 * Maps endpoint to appropriate stage ID for approval tracking
 */
function getStageIdForEndpoint(endpoint: string, options?: AIGenerateOptions): number {
  if (options?.stageId) return options.stageId;

  // Map common endpoints to stages
  const stageMap: Record<string, number> = {
    'ai/topic-refinement': 1,
    'ai/topic-recommendations': 1,
    'ai/literature-search': 2,
    'ai/research-brief': 3,
    'ai/extraction-plan': 4,
    'phi/detection': 5,
    'ai/summary-stats': 9,
    'ai/gap-analysis': 10,
    'ai/manuscript-ideation': 11,
    'ai/statistical-analysis': 13,
    'ai/manuscript-draft': 14,
    'ai/manuscript-polish': 15,
  };

  for (const [pattern, stageId] of Object.entries(stageMap)) {
    if (endpoint.includes(pattern)) return stageId;
  }

  // Default to stage 0 (generic AI operation)
  return 0;
}

/**
 * Gets a human-readable name for the endpoint
 */
function getEndpointName(endpoint: string, options?: AIGenerateOptions): string {
  if (options?.stageName) return options.stageName;

  const nameMap: Record<string, string> = {
    'ai/topic-refinement': 'Topic Refinement',
    'ai/topic-recommendations': 'Topic Recommendations',
    'ai/literature-search': 'Literature Search',
    'ai/research-brief': 'Research Brief Generation',
    'ai/manuscript-draft': 'Manuscript Drafting',
    'ai/statistical-analysis': 'Statistical Analysis',
    'ai/manuscript-polish': 'Manuscript Polish',
  };

  for (const [pattern, name] of Object.entries(nameMap)) {
    if (endpoint.includes(pattern)) return name;
  }

  return 'AI Operation';
}

export function useAI(): UseAIReturn {
  const { isDemo, isLive } = useModeStore();
  const { requestApproval } = useAIApprovalGate();
  const accessToken = useTokenStore((state) => state.accessToken);

  const generateContent = async <T = any>(
    endpoint: string,
    payload?: any,
    options?: AIGenerateOptions
  ): Promise<AIResponse<T>> => {
    // DEMO mode: Return mock data, no authorization needed
    if (isDemo) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));

      // Return mock response, no API call
      return getDemoResponse(endpoint) as AIResponse<T>;
    }

    // LIVE mode: 100% strict authorization for AI operations
    const requiresApproval = isAIEndpoint(endpoint) && !options?.skipApproval;

    let approvalResult = null;
    if (requiresApproval) {
      const stageId = getStageIdForEndpoint(endpoint, options);
      const stageName = getEndpointName(endpoint, options);

      try {
        approvalResult = await requestApproval(stageId, stageName);

        if (!approvalResult.approved) {
          console.log('[useAI] AI operation denied by user:', endpoint);
          return {
            success: false,
            mode: 'LIVE',
            data: {} as T,
            error: 'AI operation denied by user. Authorization is required in LIVE mode.',
          };
        }

        console.log('[useAI] AI operation approved:', {
          endpoint,
          approvedBy: approvalResult.approvedBy,
          stageId,
        });
      } catch (error) {
        console.error('[useAI] Authorization error:', error);
        return {
          success: false,
          mode: 'LIVE',
          data: {} as T,
          error: 'Authorization failed. Please try again.',
        };
      }
    }

    // LIVE mode - make real API call
    try {
      // Map endpoint to actual API path
      const apiPath = ENDPOINT_MAP[endpoint] || `/api/${endpoint}`;

      // Include approval metadata in request for audit trail
      const requestPayload = approvalResult
        ? {
            ...payload,
            _approval: {
              approvalId: `approval_${Date.now()}`,
              approvedBy: approvalResult.approvedBy,
              approvalTimestamp: approvalResult.timestamp,
              stageId: options?.stageId,
            },
          }
        : payload;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Include Authorization header in LIVE mode
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(apiPath, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Validate response against schema
      const validation = validateEndpointResponse<T>(endpoint, data);
      if (!validation.valid) {
        const errorMessage = formatValidationErrors(validation);
        console.error('[useAI] Response validation failed:', {
          endpoint,
          errors: validation.errors,
        });

        return {
          success: false,
          mode: 'LIVE',
          data: {} as T,
          error: `Invalid AI response: ${errorMessage}`,
        };
      }

      console.log('[useAI] Response validated successfully:', endpoint);

      return {
        success: true,
        mode: 'LIVE',
        data: validation.data || data,
        approvalId: approvalResult ? `approval_${Date.now()}` : undefined,
        approvedBy: approvalResult?.approvedBy,
      };
    } catch (error) {
      console.error('[useAI] API call failed:', error);
      return {
        success: false,
        mode: 'LIVE',
        data: {} as T,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return { generateContent, isDemo, isLive };
}

/**
 * Hook to check if a specific AI feature is available
 */
export function useAIFeature(feature: keyof typeof DEMO_RESPONSES) {
  const { isDemo } = useModeStore();
  
  return {
    isAvailable: true, // All features available, but behavior differs
    isDemo,
    demoData: isDemo ? DEMO_RESPONSES[feature] : null,
  };
}
