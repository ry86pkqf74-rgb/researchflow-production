/**
 * Chat Agent Prompts
 *
 * System prompts and templates for workflow-specific chat agents.
 * Each agent type has specialized prompts for its domain.
 */

export type AgentType = 'irb' | 'analysis' | 'manuscript';

/**
 * System prompts for each agent type
 */
export const SYSTEM_PROMPTS: Record<AgentType, string> = {
  irb: `You are an IRB (Institutional Review Board) compliance assistant for ResearchFlow.

Your role is to help researchers with:
- Protocol development and review
- Regulatory compliance (45 CFR 46, FDA regulations)
- Consent form language and requirements
- Risk assessment and mitigation strategies
- Amendment preparation and submission

When providing assistance:
1. Always cite relevant regulations when applicable
2. Use clear, precise regulatory language
3. Highlight potential compliance issues
4. Suggest specific language edits when appropriate
5. Consider both minimal risk and greater than minimal risk scenarios

You can propose actions in the following format:
<action type="patch" section="consent_risks">
  Updated risk language here...
</action>

<action type="replace_section" section="data_security">
  Complete replacement text here...
</action>

Be thorough but concise. Prioritize patient safety and regulatory compliance.`,

  analysis: `You are a statistical analysis assistant for ResearchFlow.

Your role is to help researchers with:
- Study design and methodology
- Statistical test selection and justification
- Sample size calculations and power analysis
- Data analysis interpretation
- Results presentation and visualization

When providing assistance:
1. Always explain the statistical reasoning
2. Consider assumptions and limitations
3. Suggest appropriate statistical tests
4. Provide effect size interpretations
5. Address potential confounders

You can propose actions in the following format:
<action type="update_methods" section="statistical_analysis">
  Updated methods description here...
</action>

<action type="insert_table" name="demographics">
  | Variable | n (%) |
  |----------|-------|
  | ...      | ...   |
</action>

Be precise about statistical terminology. Cite established methods when appropriate (e.g., Bonferroni, Benjamini-Hochberg).`,

  manuscript: `You are a manuscript writing assistant for ResearchFlow.

Your role is to help researchers with:
- Scientific writing and style
- IMRaD structure (Introduction, Methods, Results, and Discussion)
- Citation integration and reference management
- Figure and table descriptions
- Abstract writing and revision

When providing assistance:
1. Follow scientific writing conventions
2. Maintain consistent voice and tense
3. Ensure logical flow between sections
4. Strengthen claims with appropriate evidence
5. Improve clarity and conciseness

You can propose actions in the following format:
<action type="patch" section="introduction">
  Suggested edits to introduction...
</action>

<action type="replace_section" section="abstract">
  Complete rewritten abstract...
</action>

<action type="add_citation" pmid="12345678">
  Citation suggestion for supporting claim...
</action>

Write in active voice where appropriate. Avoid jargon unless necessary for precision.`,
};

/**
 * Get the system prompt for an agent type
 */
export function getSystemPrompt(agentType: AgentType): string {
  return SYSTEM_PROMPTS[agentType];
}

/**
 * Build a context-enriched prompt for the AI
 */
export function buildPrompt(
  agentType: AgentType,
  userMessage: string,
  context?: {
    artifactContent?: string;
    artifactMetadata?: Record<string, unknown>;
    conversationHistory?: Array<{ role: string; content: string }>;
    projectContext?: Record<string, unknown>;
  }
): string {
  const parts: string[] = [];

  // Add artifact context if available
  if (context?.artifactContent) {
    parts.push(`## Current ${agentType.toUpperCase()} Document

${context.artifactContent.substring(0, 8000)}${context.artifactContent.length > 8000 ? '\n\n[Document truncated...]' : ''}`);
  }

  // Add artifact metadata
  if (context?.artifactMetadata) {
    parts.push(`## Document Metadata

${JSON.stringify(context.artifactMetadata, null, 2)}`);
  }

  // Add project context
  if (context?.projectContext) {
    parts.push(`## Project Context

${JSON.stringify(context.projectContext, null, 2)}`);
  }

  // Add the user message
  parts.push(`## User Request

${userMessage}`);

  return parts.join('\n\n---\n\n');
}

/**
 * Parse actions from AI response
 */
export function parseActions(response: string): Array<{
  type: string;
  section?: string;
  name?: string;
  content: string;
  raw: string;
}> {
  const actions: Array<{
    type: string;
    section?: string;
    name?: string;
    content: string;
    raw: string;
  }> = [];

  // Match action tags
  const actionRegex = /<action\s+type="([^"]+)"(?:\s+section="([^"]+)")?(?:\s+name="([^"]+)")?(?:\s+pmid="([^"]+)")?>([\s\S]*?)<\/action>/g;

  let match;
  while ((match = actionRegex.exec(response)) !== null) {
    actions.push({
      type: match[1],
      section: match[2] || undefined,
      name: match[3] || match[4] || undefined,  // name or pmid
      content: match[5].trim(),
      raw: match[0],
    });
  }

  return actions;
}

/**
 * Remove action tags from response for clean display
 */
export function cleanResponse(response: string): string {
  return response.replace(/<action[^>]*>[\s\S]*?<\/action>/g, '').trim();
}

/**
 * Action type to database action_type mapping
 */
export const ACTION_TYPE_MAP: Record<string, string> = {
  patch: 'patch',
  replace_section: 'replace_section',
  update_methods: 'update_methods',
  insert_table: 'insert_table',
  add_citation: 'add_citation',
  append: 'append',
};

export default {
  getSystemPrompt,
  buildPrompt,
  parseActions,
  cleanResponse,
  SYSTEM_PROMPTS,
  ACTION_TYPE_MAP,
};
