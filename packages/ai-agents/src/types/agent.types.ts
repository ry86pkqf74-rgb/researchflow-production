/**
 * Agent Type Definitions
 *
 * Core types for the AI agent system.
 */

import { z } from 'zod';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  modelTier: 'NANO' | 'MINI' | 'STANDARD' | 'FRONTIER';
  phiScanRequired: boolean;
  maxTokens: number;
}

export interface AgentInput {
  query: string;
  context?: Record<string, unknown>;
  workflowStage?: number;
  topic?: string;
}

export interface AgentOutput {
  content: string;
  citations?: string[];
  metadata: {
    modelUsed: string;
    tokensUsed: number;
    phiDetected: boolean;
    processingTimeMs: number;
  };
}

export interface IAgent {
  config: AgentConfig;
  execute(input: AgentInput): Promise<AgentOutput>;
  validateInput(input: AgentInput): boolean;
}

// Zod schemas for validation
export const AgentInputSchema = z.object({
  query: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
  workflowStage: z.number().int().min(1).max(20).optional(),
  topic: z.string().optional(),
});

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  modelTier: z.enum(['NANO', 'MINI', 'STANDARD', 'FRONTIER']),
  phiScanRequired: z.boolean(),
  maxTokens: z.number().positive(),
});
