/**
 * useAI Hook
 * 
 * Mode-aware hook for AI API calls.
 * Returns mock data in DEMO mode, makes real API calls in LIVE mode.
 */

import { useModeStore } from '@/stores/mode-store';
import { getDemoResponse, DEMO_RESPONSES } from '@/data/demo-responses';

interface AIResponse<T = any> {
  success: boolean;
  mode: 'DEMO' | 'LIVE';
  data: T;
  error?: string;
}

interface UseAIReturn {
  generateContent: <T = any>(endpoint: string, payload?: any) => Promise<AIResponse<T>>;
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

export function useAI(): UseAIReturn {
  const { isDemo, isLive } = useModeStore();
  
  const generateContent = async <T = any>(endpoint: string, payload?: any): Promise<AIResponse<T>> => {
    if (isDemo) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
      
      // Return mock response, no API call
      return getDemoResponse(endpoint) as AIResponse<T>;
    }
    
    // LIVE mode - make real API call
    try {
      // Map endpoint to actual API path
      const apiPath = ENDPOINT_MAP[endpoint] || `/api/${endpoint}`;
      
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        success: true,
        mode: 'LIVE',
        data,
      };
    } catch (error) {
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
