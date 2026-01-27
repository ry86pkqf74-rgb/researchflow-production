/**
 * Phase Chat API Module
 *
 * Client-side API for phase-specific chat with AI agents.
 */

import { apiRequest } from '../lib/queryClient';

// API base URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  modelTier: string;
}

export interface PhaseChatInput {
  query: string;
  topic?: string;
  context?: Record<string, unknown>;
  conversationId?: string;
}

export interface PhaseChatResponse {
  stage: number;
  stageDescription: string;
  agentUsed: string;
  topic: string;
  conversationId: string;
  response: {
    content: string;
    citations?: string[];
    metadata: {
      modelTier: string;
      phiScanRequired: boolean;
      tokensUsed?: number;
      processingTimeMs?: number;
    };
  };
}

export interface StageAgentsResponse {
  stage: number;
  stageDescription: string;
  agents: AgentInfo[];
}

export interface AgentRegistryResponse {
  agents: AgentInfo[];
  stageMappings: Record<number, string[]>;
  stageDescriptions: Record<number, string>;
}

/**
 * Get available agents for a workflow stage
 */
export async function getAgentsForStage(stage: number): Promise<StageAgentsResponse> {
  const response = await apiRequest('GET', `${API_BASE}/api/phase/${stage}/agents`);
  return response.json();
}

/**
 * Send a chat message to the phase-specific agent
 */
export async function sendPhaseChatMessage(
  stage: number,
  input: PhaseChatInput
): Promise<PhaseChatResponse> {
  const response = await apiRequest('POST', `${API_BASE}/api/phase/${stage}/chat`, input);
  return response.json();
}

/**
 * Send a message to a specific agent
 */
export async function sendAgentMessage(
  stage: number,
  agentId: string,
  input: PhaseChatInput
): Promise<PhaseChatResponse> {
  const response = await apiRequest('POST', `${API_BASE}/api/phase/${stage}/chat/${agentId}`, input);
  return response.json();
}

/**
 * Get the full agent registry
 */
export async function getAgentRegistry(): Promise<AgentRegistryResponse> {
  const response = await apiRequest('GET', `${API_BASE}/api/phase/registry`);
  return response.json();
}
