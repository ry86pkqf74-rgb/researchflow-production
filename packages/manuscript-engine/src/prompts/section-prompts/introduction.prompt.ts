/**
 * Introduction Section Prompts
 *
 * Structured prompts for generating introduction sections.
 */

import type { SectionPromptContext } from '../../types';

export function buildIntroductionPrompt(context: SectionPromptContext): string {
  return `Generate a well-structured Introduction section for a ${context.studyType} research manuscript.

${context.objective ? `Study Objective: ${context.objective}` : ''}

${context.methodology ? `Study Design: ${context.methodology}` : ''}

${
  context.keyFindings && context.keyFindings.length > 0
    ? `Key Findings:\n${context.keyFindings.map((f) => `- ${f}`).join('\n')}`
    : ''
}

${context.existingContent ? `Existing Content:\n${context.existingContent}\n` : ''}

Structure the Introduction following standard medical manuscript format:

1. **Background/Context** (2-3 paragraphs):
   - Establish the clinical or scientific context
   - Review relevant literature briefly
   - Identify the knowledge gap or clinical need

2. **Significance** (1 paragraph):
   - Explain why this research is important
   - Discuss potential impact on patient care or scientific understanding

3. **Study Objective** (1 paragraph):
   - Clearly state the research question or hypothesis
   - Define specific aims or objectives
   - Preview the study approach

Requirements:
- Use formal academic tone
- Include logical transitions between paragraphs
- Cite relevant literature (indicate where citations are needed with [CITE])
- Build from general context to specific study aims
- Typically 1-1.5 pages (500-800 words)
- End with a clear statement of study objectives

Medical writing guidelines:
- Use past tense for completed work, present tense for established facts
- Be specific and precise in terminology
- Avoid overstating novelty or significance
- Maintain objectivity
- Follow journal-specific formatting if provided`;
}

export function buildIntroductionRefinementPrompt(
  existingIntroduction: string,
  feedback: string
): string {
  return `Refine this Introduction section based on the provided feedback:

Current Introduction:
${existingIntroduction}

Feedback:
${feedback}

Please revise the Introduction to address all feedback points while:
- Maintaining the logical flow and structure
- Preserving key content and citations
- Ensuring clarity and precision
- Following medical manuscript standards

Return the refined Introduction section.`;
}

export const INTRODUCTION_TEMPLATES = {
  background_opener: [
    '[Condition/Disease] represents a significant [clinical/public health] challenge, affecting approximately [X] [patients/population] [globally/in region].',
    'The management of [condition] has evolved significantly over the past [timeframe], yet [challenge/gap] remains a critical concern.',
    'Recent advances in [field/technology] have transformed our understanding of [condition/process], revealing [key insight].',
  ],

  gap_statement: [
    'Despite these advances, [specific gap] remains poorly understood.',
    'However, limited data exist regarding [specific aspect] in [population/context].',
    'The optimal [approach/strategy] for [specific situation] has not been established.',
    'Critical questions remain about [specific issue], particularly regarding [specific aspect].',
  ],

  significance_statement: [
    'Understanding [aspect] is crucial for [reason] and may lead to [potential impact].',
    'This research addresses a critical gap in [area] with direct implications for [clinical practice/patient outcomes].',
    'These findings could inform [clinical guidelines/treatment strategies] for [population].',
  ],

  objective_statement: [
    'Therefore, we conducted this [study type] to [primary objective].',
    'The primary aim of this study was to [specific aim].',
    'We hypothesized that [hypothesis] and designed a [study type] to test this hypothesis.',
    'This investigation aimed to [objective 1], [objective 2], and [objective 3].',
  ],
};

export function getIntroductionKeywords(): string[] {
  return [
    'background',
    'context',
    'significance',
    'gap',
    'objective',
    'hypothesis',
    'aim',
    'rationale',
    'prevalence',
    'incidence',
    'burden',
    'challenge',
    'approach',
    'investigation',
    'understanding',
  ];
}
