/**
 * Prompt Types
 *
 * Type definitions for centralized prompt management.
 */

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * Prompt specification
 */
export interface PromptSpec {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'extraction' | 'analysis' | 'manuscript' | 'conference' | 'general';
  modelTier: 'NANO' | 'MINI' | 'STANDARD' | 'FRONTIER';
  systemPrompt: string;
  userPromptTemplate: string;
  variables: TemplateVariable[];
  examples?: Array<{
    input: Record<string, string>;
    expectedOutput: string;
  }>;
  metadata?: {
    author?: string;
    lastUpdated?: string;
    phiSafe?: boolean;
    maxTokens?: number;
  };
}

/**
 * Rendered prompt ready for API call
 */
export interface RenderedPrompt {
  system: string;
  user: string;
  modelTier: 'NANO' | 'MINI' | 'STANDARD' | 'FRONTIER';
  maxTokens?: number;
}

/**
 * Prompt registry entry
 */
export interface PromptRegistryEntry {
  spec: PromptSpec;
  loadedAt: Date;
}
