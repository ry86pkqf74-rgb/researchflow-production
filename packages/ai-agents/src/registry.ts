/**
 * Agent Registry
 *
 * Maps workflow stages to specialized AI agents.
 * 20 stages covering the full research workflow.
 */

import type { AgentConfig } from './types/agent.types.js';

export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  // Data Extraction Agents (Stages 1-5)
  'data-extraction': {
    id: 'data-extraction',
    name: 'Data Extraction Agent',
    description: 'Extracts structured data from clinical documents',
    modelTier: 'STANDARD',
    phiScanRequired: true,
    maxTokens: 4096,
  },

  'data-validation': {
    id: 'data-validation',
    name: 'Data Validation Agent',
    description: 'Validates and cleans extracted data',
    modelTier: 'MINI',
    phiScanRequired: true,
    maxTokens: 2048,
  },

  'variable-identification': {
    id: 'variable-identification',
    name: 'Variable Identification Agent',
    description: 'Identifies key variables for analysis',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 4096,
  },

  'cohort-definition': {
    id: 'cohort-definition',
    name: 'Cohort Definition Agent',
    description: 'Helps define study cohorts and inclusion/exclusion criteria',
    modelTier: 'STANDARD',
    phiScanRequired: true,
    maxTokens: 4096,
  },

  // Analysis Agents (Stages 6-10)
  'statistical-analysis': {
    id: 'statistical-analysis',
    name: 'Statistical Analysis Agent',
    description: 'Guides statistical analysis and interprets results',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },

  'descriptive-stats': {
    id: 'descriptive-stats',
    name: 'Descriptive Statistics Agent',
    description: 'Generates summary statistics and visualizations',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 2048,
  },

  'model-builder': {
    id: 'model-builder',
    name: 'Model Building Agent',
    description: 'Assists with statistical model construction',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },

  'results-interpreter': {
    id: 'results-interpreter',
    name: 'Results Interpreter Agent',
    description: 'Interprets statistical results and effect sizes',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 4096,
  },

  // Manuscript Agents (Stages 11-15)
  'manuscript-drafting': {
    id: 'manuscript-drafting',
    name: 'Manuscript Drafting Agent',
    description: 'Drafts manuscript sections following IMRaD structure',
    modelTier: 'FRONTIER',
    phiScanRequired: true,
    maxTokens: 16384,
  },

  'introduction-writer': {
    id: 'introduction-writer',
    name: 'Introduction Writer Agent',
    description: 'Crafts compelling introductions with literature context',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },

  'methods-writer': {
    id: 'methods-writer',
    name: 'Methods Writer Agent',
    description: 'Writes detailed, reproducible methods sections',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 8192,
  },

  'results-writer': {
    id: 'results-writer',
    name: 'Results Writer Agent',
    description: 'Transforms statistical output into clear narrative',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 8192,
  },

  'discussion-writer': {
    id: 'discussion-writer',
    name: 'Discussion Writer Agent',
    description: 'Writes balanced discussions with implications',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },

  // Conference Prep Agents (Stages 16-20)
  'conference-scout': {
    id: 'conference-scout',
    name: 'Conference Scout Agent',
    description: 'Extracts submission guidelines and deadlines',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 2048,
  },

  'abstract-generator': {
    id: 'abstract-generator',
    name: 'Abstract Generator Agent',
    description: 'Generates conference abstracts within word limits',
    modelTier: 'STANDARD',
    phiScanRequired: true,
    maxTokens: 4096,
  },

  'poster-designer': {
    id: 'poster-designer',
    name: 'Poster Design Agent',
    description: 'Helps organize content for research posters',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 4096,
  },

  'presentation-prep': {
    id: 'presentation-prep',
    name: 'Presentation Prep Agent',
    description: 'Assists with slide content and speaker notes',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 4096,
  },

  // General Purpose
  'research-brief': {
    id: 'research-brief',
    name: 'Research Brief Agent',
    description: 'Generates research topic overviews',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 2048,
  },
};

/**
 * Maps workflow stages (1-20) to their available agents
 */
export const STAGE_TO_AGENTS: Record<number, string[]> = {
  // Data Collection & Extraction (1-5)
  1: ['data-extraction'],
  2: ['data-validation', 'data-extraction'],
  3: ['variable-identification', 'data-extraction'],
  4: ['cohort-definition', 'variable-identification'],
  5: ['data-validation', 'cohort-definition'],

  // Statistical Analysis (6-10)
  6: ['descriptive-stats', 'statistical-analysis'],
  7: ['statistical-analysis', 'model-builder'],
  8: ['model-builder', 'statistical-analysis'],
  9: ['results-interpreter', 'statistical-analysis'],
  10: ['results-interpreter', 'model-builder'],

  // Manuscript Writing (11-15)
  11: ['introduction-writer', 'manuscript-drafting'],
  12: ['methods-writer', 'manuscript-drafting'],
  13: ['results-writer', 'manuscript-drafting'],
  14: ['discussion-writer', 'manuscript-drafting'],
  15: ['abstract-generator', 'manuscript-drafting'],

  // Conference Preparation (16-20)
  16: ['conference-scout', 'abstract-generator'],
  17: ['abstract-generator', 'conference-scout'],
  18: ['poster-designer', 'abstract-generator'],
  19: ['presentation-prep', 'poster-designer'],
  20: ['conference-scout', 'presentation-prep'],
};

/**
 * Stage descriptions for context
 */
export const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: 'Data collection and initial extraction',
  2: 'Data validation and cleaning',
  3: 'Variable identification',
  4: 'Cohort definition',
  5: 'Data transformation',
  6: 'Descriptive statistics',
  7: 'Inferential analysis',
  8: 'Model building',
  9: 'Results interpretation',
  10: 'Sensitivity analysis',
  11: 'Introduction drafting',
  12: 'Methods section',
  13: 'Results section',
  14: 'Discussion section',
  15: 'Abstract and final review',
  16: 'Conference identification',
  17: 'Abstract preparation',
  18: 'Poster design',
  19: 'Presentation preparation',
  20: 'Submission and follow-up',
};

/**
 * Get agents available for a specific workflow stage
 */
export function getAgentsForStage(stage: number): AgentConfig[] {
  const agentIds = STAGE_TO_AGENTS[stage] || ['research-brief'];
  return agentIds
    .map((id) => AGENT_REGISTRY[id])
    .filter((agent): agent is AgentConfig => agent !== undefined);
}

/**
 * Get agent by ID
 */
export function getAgentById(agentId: string): AgentConfig | undefined {
  return AGENT_REGISTRY[agentId];
}

/**
 * Get stage description
 */
export function getStageDescription(stage: number): string {
  return STAGE_DESCRIPTIONS[stage] || 'Unknown stage';
}

/**
 * Get all agent IDs
 */
export function getAllAgentIds(): string[] {
  return Object.keys(AGENT_REGISTRY);
}
