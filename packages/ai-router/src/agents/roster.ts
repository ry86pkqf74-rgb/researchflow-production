/**
 * Agent Roster Type Definitions
 *
 * Defines the orchestration agents that bind together your AI tools.
 * Based on the ROS AI Tools Command Center in Notion.
 *
 * Agent Categories:
 * - Orchestrators: High-level planning and task decomposition
 * - Implementers: Code generation and modification
 * - Specialists: Domain-specific tasks (QA, Security, Design)
 * - Utilities: Supporting tools and integrations
 */

import type { AIProvider, AITaskType, ModelTier } from '../types';

// ============================================================================
// Tool Registry (mirrors Notion Command Center)
// ============================================================================

export type AITool =
  | 'claude-pro'
  | 'chatgpt-pro'
  | 'grok-expert'
  | 'mercury'
  | 'lm-studio'
  | 'sourcegraph'
  | 'context7'
  | 'cursor'
  | 'continue-dev'
  | 'codex-cli'
  | 'figma'
  | 'replit';

export interface ToolCapabilities {
  id: AITool;
  name: string;
  description: string;
  provider: AIProvider | 'local' | 'external';
  strengths: string[];
  useCases: string[];
  costTier: 'free' | 'low' | 'medium' | 'high';
  phiSafe: boolean;
}

export const TOOL_REGISTRY: Record<AITool, ToolCapabilities> = {
  'claude-pro': {
    id: 'claude-pro',
    name: 'Claude Pro',
    description: 'Architecture decisions and complex code review',
    provider: 'anthropic',
    strengths: ['Long context', 'Structured analysis', 'Code review', 'Documentation'],
    useCases: ['ADR writing', 'Complex refactoring', 'Security review', 'API design'],
    costTier: 'high',
    phiSafe: false,
  },
  'chatgpt-pro': {
    id: 'chatgpt-pro',
    name: 'ChatGPT Pro',
    description: 'Code generation and migration scripts',
    provider: 'openai',
    strengths: ['Code generation', 'Migration scripts', 'Test writing', 'Debugging'],
    useCases: ['Feature implementation', 'Bug fixes', 'Test generation', 'Migrations'],
    costTier: 'high',
    phiSafe: false,
  },
  'grok-expert': {
    id: 'grok-expert',
    name: 'Grok Expert',
    description: 'Brainstorming and rapid prototyping',
    provider: 'together',
    strengths: ['Fast ideation', 'Creative solutions', 'Real-time knowledge'],
    useCases: ['Brainstorming', 'Spike solutions', 'Research', 'Alternative approaches'],
    costTier: 'medium',
    phiSafe: false,
  },
  'mercury': {
    id: 'mercury',
    name: 'Mercury',
    description: 'Fast autocomplete and inline suggestions',
    provider: 'together',
    strengths: ['Speed', 'Inline completion', 'Low latency'],
    useCases: ['Autocomplete', 'Quick fixes', 'Boilerplate'],
    costTier: 'low',
    phiSafe: false,
  },
  'lm-studio': {
    id: 'lm-studio',
    name: 'LM Studio',
    description: 'PHI-safe local inference',
    provider: 'local',
    strengths: ['Privacy', 'No data leaving device', 'Offline capable'],
    useCases: ['PHI processing', 'Sensitive data', 'Offline development'],
    costTier: 'free',
    phiSafe: true,
  },
  'sourcegraph': {
    id: 'sourcegraph',
    name: 'Sourcegraph',
    description: 'Code search and intelligence',
    provider: 'external',
    strengths: ['Cross-repo search', 'Code navigation', 'Dependency tracking'],
    useCases: ['Finding implementations', 'Understanding codebase', 'Impact analysis'],
    costTier: 'medium',
    phiSafe: true,
  },
  'context7': {
    id: 'context7',
    name: 'Context7',
    description: 'Context aggregation and retrieval',
    provider: 'external',
    strengths: ['Context management', 'RAG', 'Knowledge retrieval'],
    useCases: ['Documentation lookup', 'Context injection', 'Knowledge base'],
    costTier: 'low',
    phiSafe: true,
  },
  'cursor': {
    id: 'cursor',
    name: 'Cursor',
    description: 'AI-powered IDE features',
    provider: 'external',
    strengths: ['IDE integration', 'Multi-file editing', 'Composer mode'],
    useCases: ['Large refactors', 'Feature implementation', 'Code review'],
    costTier: 'medium',
    phiSafe: false,
  },
  'continue-dev': {
    id: 'continue-dev',
    name: 'Continue.dev',
    description: 'Open-source AI coding assistant',
    provider: 'external',
    strengths: ['Flexible models', 'Open source', 'VS Code integration'],
    useCases: ['Code completion', 'Chat', 'Commands'],
    costTier: 'low',
    phiSafe: false,
  },
  'codex-cli': {
    id: 'codex-cli',
    name: 'Codex CLI',
    description: 'Terminal-based AI assistance',
    provider: 'openai',
    strengths: ['Shell commands', 'Scripts', 'DevOps tasks'],
    useCases: ['Shell automation', 'DevOps', 'System administration'],
    costTier: 'medium',
    phiSafe: false,
  },
  'figma': {
    id: 'figma',
    name: 'Figma',
    description: 'Design-to-code workflows',
    provider: 'external',
    strengths: ['Design tokens', 'Component specs', 'Visual assets'],
    useCases: ['UI implementation', 'Design system', 'Component creation'],
    costTier: 'medium',
    phiSafe: true,
  },
  'replit': {
    id: 'replit',
    name: 'Replit',
    description: 'Rapid debugging and prototyping sandbox',
    provider: 'external',
    strengths: ['Instant environments', 'Collaboration', 'Deployment'],
    useCases: ['Spike solutions', 'Bug reproduction', 'Prototypes', 'PoCs'],
    costTier: 'low',
    phiSafe: false,
  },
};

// ============================================================================
// Agent Definitions
// ============================================================================

export type AgentRole =
  | 'pm-orchestrator'
  | 'repo-cartographer'
  | 'backend-implementer'
  | 'frontend-implementer'
  | 'qa-release'
  | 'security-steward'
  | 'figma-agent'
  | 'replit-agent';

export interface AgentInputSpec {
  required: string[];
  optional: string[];
}

export interface AgentOutputSpec {
  produces: string[];
  format: 'markdown' | 'json' | 'code' | 'mixed';
}

export interface OrchestratorAgent {
  id: AgentRole;
  name: string;
  description: string;
  /** Primary tools this agent uses */
  tools: AITool[];
  /** Preferred models for this agent */
  models: {
    primary: string;
    fallback?: string;
  };
  /** Task types this agent handles */
  taskTypes: (AITaskType | string)[];
  /** Input specification */
  inputs: AgentInputSpec;
  /** Output specification */
  outputs: AgentOutputSpec;
  /** Risk level of operations */
  riskLevel: 'low' | 'medium' | 'high';
  /** Requires human approval */
  requiresApproval: boolean;
  /** Trigger conditions */
  triggers: string[];
}

export const AGENT_ROSTER: Record<AgentRole, OrchestratorAgent> = {
  'pm-orchestrator': {
    id: 'pm-orchestrator',
    name: 'Product/PM Orchestrator',
    description:
      'Converts feature ideas into specs, tasks, and acceptance criteria. Writes directly into Notion.',
    tools: ['claude-pro', 'chatgpt-pro'],
    models: {
      primary: 'claude-opus-4-5-20251101',
      fallback: 'gpt-4o',
    },
    taskTypes: ['complex_synthesis', 'protocol_reasoning'],
    inputs: {
      required: ['feature_idea', 'context'],
      optional: ['constraints', 'deadline', 'priority'],
    },
    outputs: {
      produces: ['spec', 'tasks', 'acceptance_criteria', 'notion_pages'],
      format: 'mixed',
    },
    riskLevel: 'low',
    requiresApproval: false,
    triggers: ['new_feature_request', 'roadmap_update', 'user_feedback'],
  },

  'repo-cartographer': {
    id: 'repo-cartographer',
    name: 'Repo Cartographer',
    description:
      'Answers "where is X implemented?" and proposes minimal diffs using Sourcegraph API.',
    tools: ['sourcegraph', 'claude-pro'],
    models: {
      primary: 'claude-sonnet-4-5-20250929',
    },
    taskTypes: ['extract_metadata', 'classify'],
    inputs: {
      required: ['question'],
      optional: ['file_hints', 'scope'],
    },
    outputs: {
      produces: ['file_locations', 'code_snippets', 'minimal_diff', 'explanation'],
      format: 'mixed',
    },
    riskLevel: 'low',
    requiresApproval: false,
    triggers: ['code_question', 'impact_analysis', 'refactor_planning'],
  },

  'backend-implementer': {
    id: 'backend-implementer',
    name: 'Backend Implementer',
    description: 'Applies backend changes, runs tests, and opens PRs using Cursor/Continue.',
    tools: ['cursor', 'continue-dev', 'chatgpt-pro', 'mercury'],
    models: {
      primary: 'gpt-4o',
      fallback: 'claude-sonnet-4-5-20250929',
    },
    taskTypes: ['draft_section', 'template_fill'],
    inputs: {
      required: ['task_spec', 'acceptance_criteria'],
      optional: ['related_prs', 'test_requirements'],
    },
    outputs: {
      produces: ['code_changes', 'tests', 'pr_link', 'evidence_log'],
      format: 'code',
    },
    riskLevel: 'medium',
    requiresApproval: false,
    triggers: ['backend_task_assigned', 'api_change_requested'],
  },

  'frontend-implementer': {
    id: 'frontend-implementer',
    name: 'Frontend Implementer',
    description: 'Implements UI components from Figma specs using Cursor/Continue.',
    tools: ['cursor', 'continue-dev', 'figma', 'mercury'],
    models: {
      primary: 'gpt-4o',
      fallback: 'claude-sonnet-4-5-20250929',
    },
    taskTypes: ['draft_section', 'template_fill'],
    inputs: {
      required: ['figma_url', 'component_list'],
      optional: ['design_tokens', 'existing_components'],
    },
    outputs: {
      produces: ['react_components', 'styles', 'tests', 'storybook_stories'],
      format: 'code',
    },
    riskLevel: 'medium',
    requiresApproval: false,
    triggers: ['frontend_task_assigned', 'design_handoff'],
  },

  'qa-release': {
    id: 'qa-release',
    name: 'QA/Release Agent',
    description:
      'Collects CI results, deployment URLs, smoke-test evidence. Updates Notion and gates releases.',
    tools: ['codex-cli', 'sourcegraph'],
    models: {
      primary: 'gpt-4o-mini',
    },
    taskTypes: ['classify', 'extract_metadata', 'format_validate'],
    inputs: {
      required: ['pr_url', 'ci_results'],
      optional: ['deployment_url', 'manual_test_notes'],
    },
    outputs: {
      produces: ['test_report', 'release_checklist', 'approval_request', 'notion_update'],
      format: 'mixed',
    },
    riskLevel: 'high',
    requiresApproval: true,
    triggers: ['pr_merged', 'deployment_complete', 'release_requested'],
  },

  'security-steward': {
    id: 'security-steward',
    name: 'Security Steward',
    description: 'Reviews RBAC, PHI, and auth changes. Runs in Claude for thorough analysis.',
    tools: ['claude-pro', 'sourcegraph'],
    models: {
      primary: 'claude-opus-4-5-20251101',
    },
    taskTypes: ['policy_check', 'phi_scan', 'protocol_reasoning'],
    inputs: {
      required: ['diff', 'affected_files'],
      optional: ['security_context', 'threat_model'],
    },
    outputs: {
      produces: ['security_review', 'risk_assessment', 'recommendations', 'approval_decision'],
      format: 'markdown',
    },
    riskLevel: 'high',
    requiresApproval: true,
    triggers: ['auth_change', 'phi_change', 'rbac_change', 'production_deployment'],
  },

  'figma-agent': {
    id: 'figma-agent',
    name: 'Figma Design Agent',
    description:
      'Reads Figma components/tokens, writes them into Notion task templates, hands to frontend implementer.',
    tools: ['figma', 'claude-pro'],
    models: {
      primary: 'claude-sonnet-4-5-20250929',
    },
    taskTypes: ['extract_metadata', 'template_fill'],
    inputs: {
      required: ['figma_url'],
      optional: ['component_filter', 'existing_design_system'],
    },
    outputs: {
      produces: ['component_list', 'design_tokens', 'acceptance_criteria', 'notion_task'],
      format: 'json',
    },
    riskLevel: 'low',
    requiresApproval: false,
    triggers: ['design_update', 'new_figma_file', 'design_system_change'],
  },

  'replit-agent': {
    id: 'replit-agent',
    name: 'Replit Debug Agent',
    description:
      'Reproduces problems in isolation, experiments with fixes, produces minimal diffs or PoCs.',
    tools: ['replit', 'grok-expert'],
    models: {
      primary: 'gpt-4o',
    },
    taskTypes: ['draft_section', 'complex_synthesis'],
    inputs: {
      required: ['issue_description'],
      optional: ['reproduction_steps', 'error_logs', 'related_code'],
    },
    outputs: {
      produces: ['reproduction_env', 'fix_diff', 'poc_code', 'explanation'],
      format: 'mixed',
    },
    riskLevel: 'low',
    requiresApproval: false,
    triggers: ['bug_blocked', 'spike_requested', 'poc_needed'],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the recommended agent for a task type
 */
export function getAgentForTaskType(taskType: AITaskType | string): AgentRole | null {
  for (const [role, agent] of Object.entries(AGENT_ROSTER)) {
    if (agent.taskTypes.includes(taskType)) {
      return role as AgentRole;
    }
  }
  return null;
}

/**
 * Get agents that require human approval
 */
export function getHighRiskAgents(): AgentRole[] {
  return Object.entries(AGENT_ROSTER)
    .filter(([_, agent]) => agent.requiresApproval)
    .map(([role]) => role as AgentRole);
}

/**
 * Get PHI-safe tools
 */
export function getPhiSafeTools(): AITool[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([_, tool]) => tool.phiSafe)
    .map(([id]) => id as AITool);
}

/**
 * Get tools by cost tier
 */
export function getToolsByCostTier(
  tier: 'free' | 'low' | 'medium' | 'high'
): AITool[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([_, tool]) => tool.costTier === tier)
    .map(([id]) => id as AITool);
}
