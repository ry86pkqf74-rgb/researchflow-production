/**
 * Prompt Loader
 *
 * Centralized prompt management with template rendering.
 */

import type { PromptSpec, RenderedPrompt, PromptRegistryEntry } from './types.js';

/**
 * In-memory prompt registry
 */
const promptRegistry = new Map<string, PromptRegistryEntry>();

/**
 * Register a prompt specification
 */
export function registerPrompt(spec: PromptSpec): void {
  promptRegistry.set(spec.id, {
    spec,
    loadedAt: new Date(),
  });
}

/**
 * Get a prompt specification by ID
 */
export function getPromptSpec(promptId: string): PromptSpec | undefined {
  return promptRegistry.get(promptId)?.spec;
}

/**
 * List all registered prompts
 */
export function listPrompts(): PromptSpec[] {
  return Array.from(promptRegistry.values()).map((entry) => entry.spec);
}

/**
 * List prompts by category
 */
export function listPromptsByCategory(
  category: PromptSpec['category']
): PromptSpec[] {
  return listPrompts().filter((spec) => spec.category === category);
}

/**
 * Render a prompt template with variables
 */
export function renderPrompt(
  promptId: string,
  variables: Record<string, string>
): RenderedPrompt | null {
  const entry = promptRegistry.get(promptId);
  if (!entry) {
    return null;
  }

  const { spec } = entry;

  // Validate required variables
  for (const varDef of spec.variables) {
    if (varDef.required && !(varDef.name in variables)) {
      if (varDef.defaultValue !== undefined) {
        variables[varDef.name] = varDef.defaultValue;
      } else {
        throw new Error(
          `Missing required variable: ${varDef.name} for prompt ${promptId}`
        );
      }
    }
  }

  // Apply defaults for optional variables
  for (const varDef of spec.variables) {
    if (!(varDef.name in variables) && varDef.defaultValue !== undefined) {
      variables[varDef.name] = varDef.defaultValue;
    }
  }

  // Render templates
  const system = renderTemplate(spec.systemPrompt, variables);
  const user = renderTemplate(spec.userPromptTemplate, variables);

  return {
    system,
    user,
    modelTier: spec.modelTier,
    maxTokens: spec.metadata?.maxTokens,
  };
}

/**
 * Simple template rendering with {{variable}} syntax
 */
function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match;
  });
}

/**
 * Clear all registered prompts (useful for testing)
 */
export function clearPrompts(): void {
  promptRegistry.clear();
}

/**
 * Get prompt count
 */
export function getPromptCount(): number {
  return promptRegistry.size;
}

// =============================================================================
// Built-in Prompt Specifications
// =============================================================================

/**
 * Conference Scout Prompt
 */
export const CONFERENCE_SCOUT_PROMPT: PromptSpec = {
  id: 'conference-scout',
  name: 'Conference Scout',
  version: '1.0.0',
  description: 'Identify relevant conferences for research dissemination',
  category: 'conference',
  modelTier: 'MINI',
  systemPrompt: `You are a Conference Scout assistant specializing in identifying relevant academic conferences for healthcare research.

Your role is to:
1. Identify conferences matching the research topic and methodology
2. Evaluate conference reputation and impact
3. Provide submission deadlines and requirements
4. Consider geographic and timing preferences

Always provide structured, actionable recommendations with clear rationale.`,
  userPromptTemplate: `Research Topic: {{topic}}

Research Type: {{researchType}}

Preferred Regions: {{preferredRegions}}

Timeline: {{timeline}}

Please identify the top conferences that would be appropriate for this research, including:
- Conference name and location
- Submission deadlines
- Impact factor or reputation
- Relevance to the research topic
- Any special considerations`,
  variables: [
    {
      name: 'topic',
      description: 'The main research topic or title',
      required: true,
    },
    {
      name: 'researchType',
      description: 'Type of research (e.g., clinical trial, observational study)',
      required: false,
      defaultValue: 'Not specified',
    },
    {
      name: 'preferredRegions',
      description: 'Preferred geographic regions for conferences',
      required: false,
      defaultValue: 'Any region',
    },
    {
      name: 'timeline',
      description: 'Target timeline for submission',
      required: false,
      defaultValue: 'Within next 12 months',
    },
  ],
  metadata: {
    author: 'ResearchFlow',
    lastUpdated: '2025-01-27',
    phiSafe: true,
    maxTokens: 2000,
  },
};

/**
 * Data Extraction Prompt
 */
export const DATA_EXTRACTION_PROMPT: PromptSpec = {
  id: 'data-extraction',
  name: 'Data Extraction Assistant',
  version: '1.0.0',
  description: 'Guide structured data extraction from clinical datasets',
  category: 'extraction',
  modelTier: 'STANDARD',
  systemPrompt: `You are a Data Extraction specialist for healthcare research.

Your role is to:
1. Understand the data structure and available fields
2. Identify relevant variables for the research question
3. Suggest appropriate data cleaning strategies
4. Ensure PHI protection throughout the process

IMPORTANT: Never request or process actual patient data values. Work only with schema metadata and statistical summaries.`,
  userPromptTemplate: `Research Question: {{researchQuestion}}

Dataset Schema:
{{datasetSchema}}

Please provide guidance on:
1. Which variables are most relevant to the research question
2. Suggested data quality checks
3. Potential derived variables to create
4. Any concerns about the data structure`,
  variables: [
    {
      name: 'researchQuestion',
      description: 'The research question being investigated',
      required: true,
    },
    {
      name: 'datasetSchema',
      description: 'JSON schema or description of available data fields',
      required: true,
    },
  ],
  metadata: {
    author: 'ResearchFlow',
    lastUpdated: '2025-01-27',
    phiSafe: true,
    maxTokens: 3000,
  },
};

/**
 * Statistical Analysis Prompt
 */
export const STATISTICAL_ANALYSIS_PROMPT: PromptSpec = {
  id: 'statistical-analysis',
  name: 'Statistical Analysis Advisor',
  version: '1.0.0',
  description: 'Recommend and explain appropriate statistical methods',
  category: 'analysis',
  modelTier: 'STANDARD',
  systemPrompt: `You are a Statistical Analysis advisor for healthcare research.

Your role is to:
1. Recommend appropriate statistical methods based on study design and data characteristics
2. Explain the rationale for each recommendation
3. Identify assumptions that need to be verified
4. Suggest sensitivity analyses

Provide clear explanations suitable for researchers with varying statistical backgrounds.`,
  userPromptTemplate: `Research Goal: {{researchGoal}}

Study Design: {{studyDesign}}

Data Characteristics:
{{dataCharacteristics}}

Dependent Variable: {{dependentVar}}
Independent Variables: {{independentVars}}

Please recommend:
1. Primary statistical method(s) with rationale
2. Assumptions to verify
3. Alternative methods if assumptions are violated
4. Suggested sensitivity analyses`,
  variables: [
    {
      name: 'researchGoal',
      description: 'The primary research goal or hypothesis',
      required: true,
    },
    {
      name: 'studyDesign',
      description: 'Study design (e.g., cross-sectional, cohort, RCT)',
      required: false,
      defaultValue: 'Observational',
    },
    {
      name: 'dataCharacteristics',
      description: 'Summary of data characteristics (types, distributions)',
      required: true,
    },
    {
      name: 'dependentVar',
      description: 'The outcome or dependent variable',
      required: false,
      defaultValue: 'Not specified',
    },
    {
      name: 'independentVars',
      description: 'The predictor or independent variables',
      required: false,
      defaultValue: 'Not specified',
    },
  ],
  metadata: {
    author: 'ResearchFlow',
    lastUpdated: '2025-01-27',
    phiSafe: true,
    maxTokens: 3000,
  },
};

/**
 * Manuscript Drafting Prompt
 */
export const MANUSCRIPT_DRAFTING_PROMPT: PromptSpec = {
  id: 'manuscript-drafting',
  name: 'Manuscript Drafting Assistant',
  version: '1.0.0',
  description: 'Assist with scientific manuscript composition',
  category: 'manuscript',
  modelTier: 'FRONTIER',
  systemPrompt: `You are a Manuscript Drafting assistant for healthcare research publications.

Your role is to:
1. Help structure manuscript sections following journal guidelines
2. Ensure scientific accuracy and clarity
3. Maintain appropriate academic tone
4. Follow CONSORT, STROBE, or other relevant reporting guidelines

Provide suggestions that can be refined by the research team while maintaining scientific integrity.`,
  userPromptTemplate: `Section: {{section}}

Study Summary: {{studySummary}}

Key Findings: {{keyFindings}}

Target Journal Style: {{journalStyle}}

Please help draft this section, focusing on:
1. Clear and concise scientific writing
2. Appropriate structure for the section type
3. Logical flow of information
4. Adherence to reporting guidelines`,
  variables: [
    {
      name: 'section',
      description: 'Manuscript section (Introduction, Methods, Results, Discussion)',
      required: true,
    },
    {
      name: 'studySummary',
      description: 'Brief summary of the study',
      required: true,
    },
    {
      name: 'keyFindings',
      description: 'Key findings to include',
      required: false,
      defaultValue: 'To be determined from analysis',
    },
    {
      name: 'journalStyle',
      description: 'Target journal or style preference',
      required: false,
      defaultValue: 'General medical journal',
    },
  ],
  metadata: {
    author: 'ResearchFlow',
    lastUpdated: '2025-01-27',
    phiSafe: true,
    maxTokens: 4000,
  },
};

/**
 * Research Brief Prompt
 */
export const RESEARCH_BRIEF_PROMPT: PromptSpec = {
  id: 'research-brief',
  name: 'Research Brief Generator',
  version: '1.0.0',
  description: 'Generate concise research briefs and summaries',
  category: 'general',
  modelTier: 'MINI',
  systemPrompt: `You are a Research Brief assistant that creates clear, concise summaries of research projects.

Your role is to:
1. Synthesize complex research into digestible summaries
2. Highlight key objectives, methods, and findings
3. Identify potential implications and next steps
4. Adapt the brief to the target audience`,
  userPromptTemplate: `Project Title: {{title}}

Objectives: {{objectives}}

Methods Overview: {{methods}}

Current Status: {{status}}

Target Audience: {{audience}}

Please create a research brief that:
1. Summarizes the project purpose and significance
2. Outlines the methodology in accessible terms
3. Highlights key progress or findings
4. Identifies next steps or recommendations`,
  variables: [
    {
      name: 'title',
      description: 'Research project title',
      required: true,
    },
    {
      name: 'objectives',
      description: 'Research objectives',
      required: true,
    },
    {
      name: 'methods',
      description: 'Overview of methods used',
      required: false,
      defaultValue: 'Not yet determined',
    },
    {
      name: 'status',
      description: 'Current project status',
      required: false,
      defaultValue: 'In progress',
    },
    {
      name: 'audience',
      description: 'Target audience for the brief',
      required: false,
      defaultValue: 'General research team',
    },
  ],
  metadata: {
    author: 'ResearchFlow',
    lastUpdated: '2025-01-27',
    phiSafe: true,
    maxTokens: 1500,
  },
};

/**
 * Initialize built-in prompts
 */
export function initializeBuiltInPrompts(): void {
  registerPrompt(CONFERENCE_SCOUT_PROMPT);
  registerPrompt(DATA_EXTRACTION_PROMPT);
  registerPrompt(STATISTICAL_ANALYSIS_PROMPT);
  registerPrompt(MANUSCRIPT_DRAFTING_PROMPT);
  registerPrompt(RESEARCH_BRIEF_PROMPT);
}

// Auto-initialize on module load
initializeBuiltInPrompts();
