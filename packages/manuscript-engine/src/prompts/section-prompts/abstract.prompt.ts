/**
 * Abstract Section Prompts
 *
 * Structured prompts for generating abstracts.
 */

import type { SectionPromptContext } from '../../types';

export function buildAbstractPrompt(context: SectionPromptContext): string {
  return `Generate a structured abstract for a ${context.studyType} research manuscript.

${context.objective ? `Study Objective: ${context.objective}\n` : ''}

${context.methodology ? `Study Methods: ${context.methodology}\n` : ''}

${
  context.keyFindings && context.keyFindings.length > 0
    ? `Key Findings:\n${context.keyFindings.map((f) => `- ${f}`).join('\n')}\n`
    : ''
}

${context.existingContent ? `Full Manuscript Content:\n${context.existingContent}\n` : ''}

Create a structured abstract with these sections:

1. **Background/Objectives** (2-3 sentences, ~50-75 words):
   - Brief context establishing the problem
   - Clear statement of study objective or hypothesis
   - Rationale for the study

2. **Methods** (3-4 sentences, ~75-100 words):
   - Study design and setting
   - Key inclusion criteria
   - Primary intervention or exposure (if applicable)
   - Main outcome measures
   - Basic statistical approach

3. **Results** (4-5 sentences, ~100-125 words):
   - Number of participants
   - Primary outcome results with statistics
   - Key secondary outcomes
   - Important subgroup findings
   - Adverse events if relevant

4. **Conclusions** (2-3 sentences, ~50-75 words):
   - Direct answer to research question
   - Clinical or scientific implications
   - Significance of findings
   - Future directions (optional)

Requirements:
- Total length: 250-350 words (check journal requirements)
- Use past tense for study methods and results
- Use present tense for conclusions
- Include key statistics (p-values, CIs, effect sizes)
- Be specific and quantitative
- Avoid abbreviations (except standard units)
- Make abstract self-contained (understandable without full text)
- No citations in abstract

Key principles:
- Emphasize novel findings
- Be precise with numbers
- Match conclusions to results
- Ensure each section flows logically
- Make every word count`;
}

export function buildUnstructuredAbstractPrompt(context: SectionPromptContext): string {
  return `Generate an unstructured abstract for a ${context.studyType} research manuscript.

${context.objective ? `Study Objective: ${context.objective}\n` : ''}

${context.methodology ? `Study Methods: ${context.methodology}\n` : ''}

${
  context.keyFindings && context.keyFindings.length > 0
    ? `Key Findings:\n${context.keyFindings.map((f) => `- ${f}`).join('\n')}\n`
    : ''
}

Create a single coherent paragraph abstract (200-250 words) that includes:
- Brief background and objective
- Key methodological details
- Main results with statistics
- Clinical/scientific implications

Flow the narrative smoothly from context → methods → results → conclusions.

Requirements:
- Concise and clear
- Standalone (no references to tables/figures)
- Quantitative results
- No subheadings
- Appropriate tense usage`;
}

export const ABSTRACT_TEMPLATES = {
  background_opener: [
    '[Disease/condition] is a major [health concern/clinical challenge] affecting [population].',
    'The optimal [treatment/approach] for [condition] in [population] remains uncertain.',
    'While [current approach] is standard, [limitation/gap] persists.',
    'Recent evidence suggests [new understanding], but [gap] remains unclear.',
  ],

  objective_statement: [
    'We aimed to determine whether [intervention] improves [outcome] in [population].',
    'The objective was to evaluate the [association/effect] between [X] and [Y].',
    'This study investigated [research question] in [population/setting].',
    'We hypothesized that [hypothesis] and conducted this [study type] to test this hypothesis.',
  ],

  methods_summary: [
    'This [study design] included [N] [participants] from [setting] between [dates].',
    'Participants were randomized to receive [intervention 1] or [intervention 2].',
    'The primary outcome was [outcome]; secondary outcomes included [outcomes].',
    'We performed [analysis type] to assess [relationship/difference].',
  ],

  results_summary: [
    'Of [N] participants ([demographics]), [N] received [intervention 1] and [N] received [intervention 2].',
    'The primary outcome occurred in [X]% vs [Y]% (p = Z; 95% CI: A-B).',
    '[Intervention] was associated with [increased/decreased/no difference in] [outcome] ([statistic]).',
    'In subgroup analysis, [finding] was observed in [subgroup].',
  ],

  conclusion_statement: [
    'Among [population], [intervention] resulted in [outcome], suggesting [implication].',
    'These findings support [recommendation] for [population/condition].',
    'This study provides evidence that [conclusion], with implications for [clinical practice/research].',
    '[Intervention] did not improve [outcome], indicating that [alternative approach] may be warranted.',
  ],
};

export function validateAbstractLength(abstract: string, maxWords: number = 350): {
  valid: boolean;
  currentWords: number;
  message: string;
} {
  const wordCount = abstract.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    valid: wordCount <= maxWords,
    currentWords: wordCount,
    message:
      wordCount <= maxWords
        ? `Abstract length is within limit (${wordCount}/${maxWords} words).`
        : `Abstract exceeds word limit (${wordCount}/${maxWords} words). Please shorten by ${
            wordCount - maxWords
          } words.`,
  };
}

export function getAbstractKeywords(): string[] {
  return [
    'background',
    'objective',
    'methods',
    'design',
    'participants',
    'intervention',
    'outcomes',
    'results',
    'conclusion',
    'findings',
    'implications',
    'randomized',
    'controlled',
    'trial',
  ];
}
