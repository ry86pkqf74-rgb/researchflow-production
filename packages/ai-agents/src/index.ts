/**
 * AI Agents Package
 *
 * Phase-specific AI agents for the ResearchFlow workflow.
 */

// Types
export * from './types/agent.types.js';

// Prompts
export * from './prompts/index.js';

// Base classes
export { BaseAgent } from './agents/BaseAgent.js';

// Concrete agents
export { ConferenceScoutAgent } from './agents/ConferenceScoutAgent.js';
export { DataExtractionAgent } from './agents/DataExtractionAgent.js';
export { StatisticalAnalysisAgent } from './agents/StatisticalAnalysisAgent.js';
export { ManuscriptDraftingAgent } from './agents/ManuscriptDraftingAgent.js';

// Registry
export {
  AGENT_REGISTRY,
  STAGE_TO_AGENTS,
  STAGE_DESCRIPTIONS,
  getAgentsForStage,
  getAgentById,
  getStageDescription,
  getAllAgentIds,
} from './registry.js';

// Agent factory
import type { AgentConfig } from './types/agent.types.js';
import { BaseAgent } from './agents/BaseAgent.js';
import { ConferenceScoutAgent } from './agents/ConferenceScoutAgent.js';
import { DataExtractionAgent } from './agents/DataExtractionAgent.js';
import { StatisticalAnalysisAgent } from './agents/StatisticalAnalysisAgent.js';
import { ManuscriptDraftingAgent } from './agents/ManuscriptDraftingAgent.js';

/**
 * Create an agent instance by ID
 */
export function createAgent(agentId: string): BaseAgent | null {
  switch (agentId) {
    case 'conference-scout':
      return new ConferenceScoutAgent();
    case 'data-extraction':
      return new DataExtractionAgent();
    case 'statistical-analysis':
      return new StatisticalAnalysisAgent();
    case 'manuscript-drafting':
      return new ManuscriptDraftingAgent();
    default:
      return null;
  }
}
