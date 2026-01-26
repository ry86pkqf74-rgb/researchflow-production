/**
 * Results Section Prompts
 *
 * Structured prompts for generating results sections.
 */

import type { SectionPromptContext } from '../../types';

export function buildResultsPrompt(context: SectionPromptContext): string {
  return `Generate a clear and comprehensive Results section for a ${context.studyType} research manuscript.

${
  context.keyFindings && context.keyFindings.length > 0
    ? `Key Findings:\n${context.keyFindings.map((f) => `- ${f}`).join('\n')}\n`
    : ''
}

${context.methodology ? `Study Methods: ${context.methodology}\n` : ''}

${context.existingContent ? `Existing Content:\n${context.existingContent}\n` : ''}

Structure the Results section logically:

1. **Study Flow/Participant Characteristics** (first paragraph):
   - Number of participants screened, enrolled, and analyzed
   - Reasons for exclusions
   - Baseline demographics and characteristics
   - Reference to CONSORT/STROBE diagram if applicable

2. **Primary Outcomes**:
   - Report primary outcome(s) first
   - Include statistical significance and effect sizes
   - Provide confidence intervals
   - Reference tables and figures

3. **Secondary Outcomes**:
   - Present secondary outcomes systematically
   - Maintain consistent statistical reporting
   - Note any unexpected findings

4. **Subgroup and Sensitivity Analyses** (if applicable):
   - Report pre-specified subgroup analyses
   - Present sensitivity analyses results

5. **Adverse Events** (if applicable):
   - Describe serious adverse events
   - Report common side effects

Requirements:
- Use past tense throughout
- Present findings objectively without interpretation
- Report statistics consistently (e.g., mean ± SD, median [IQR])
- Include exact p-values when possible (not just p < 0.05)
- Reference all tables and figures
- Organize logically, typically following methods section order
- Typically 2-3 pages (800-1200 words)

Statistical reporting standards:
- Include sample sizes for each analysis (n = X)
- Report both point estimates and confidence intervals
- Provide effect sizes along with p-values
- Note statistical tests used for each comparison
- Report both significant and non-significant findings

Writing style:
- Be concise and direct
- Use active voice when appropriate
- Avoid interpretation or discussion
- Present data systematically
- Use parallel structure for similar analyses`;
}

export function buildResultsDataParagraph(data: Record<string, unknown>): string {
  return `Write a results paragraph incorporating this data:

${JSON.stringify(data, null, 2)}

Requirements:
- Integrate data naturally into prose
- Use appropriate statistical terminology
- Include p-values and confidence intervals
- Reference tables/figures as appropriate (e.g., "Table 1", "Figure 2")
- Maintain objective, factual tone
- Use past tense

Example format:
"The mean age was X ± Y years, with Z% female participants. [Primary outcome] was significantly [higher/lower] in [group 1] compared to [group 2] (X vs Y, p = Z; 95% CI: A-B)."`;
}

export const RESULTS_TEMPLATES = {
  participant_flow: [
    'A total of [N] participants were screened, of whom [N] met inclusion criteria and [N] were enrolled.',
    'Of [N] participants enrolled, [N] completed the study protocol and were included in the final analysis.',
    '[N] participants were excluded due to [reason 1] (n=[X]), [reason 2] (n=[Y]), and [reason 3] (n=[Z]).',
    'The study flow is shown in Figure [X] (CONSORT diagram).',
  ],

  baseline_characteristics: [
    'Baseline characteristics were well-balanced between groups (Table [X]).',
    'The mean age was [X] ± [SD] years, and [Y]% were female.',
    'Participants in [group 1] and [group 2] were similar with respect to [characteristics].',
    'No significant differences were observed in baseline demographics between groups (all p > 0.05).',
  ],

  primary_outcome: [
    'The primary outcome of [outcome] occurred in [X]% of [group 1] compared to [Y]% of [group 2] (p = Z; 95% CI: A-B).',
    '[Group 1] demonstrated significantly [higher/lower] [outcome] compared to [group 2] ([statistic]: [value], p = X).',
    'The mean difference in [outcome] between groups was [X] (95% CI: Y-Z, p = A).',
  ],

  secondary_outcomes: [
    'Secondary analyses revealed [finding] (Table [X]).',
    'No significant difference was observed in [outcome] between groups (p = X).',
    '[Outcome 2] was [higher/lower] in [group 1] compared to [group 2] ([X] vs [Y], p = Z).',
  ],

  subgroup_analysis: [
    'Subgroup analyses by [variable] showed [finding] (Figure [X]).',
    'The treatment effect was consistent across pre-specified subgroups, with no significant interaction (p for interaction = X).',
    'A greater effect was observed in [subgroup] compared to [subgroup] (p for interaction = X).',
  ],

  adverse_events: [
    'Adverse events occurred in [X]% of [group 1] and [Y]% of [group 2] (p = Z).',
    'Serious adverse events were rare, occurring in [N] participants ([details]).',
    'The most common adverse events were [event 1] ([X]%), [event 2] ([Y]%), and [event 3] ([Z]%).',
    'No treatment-related deaths occurred during the study period.',
  ],

  statistical_reporting: [
    'Data are presented as mean ± standard deviation (SD) for continuous variables and number (percentage) for categorical variables.',
    'Median values are reported with interquartile range [IQR].',
    'Odds ratios (OR) and hazard ratios (HR) are presented with 95% confidence intervals.',
  ],
};

export function getResultsKeywords(): string[] {
  return [
    'participants',
    'enrolled',
    'analyzed',
    'baseline',
    'characteristics',
    'outcome',
    'primary',
    'secondary',
    'significant',
    'difference',
    'comparison',
    'effect',
    'confidence interval',
    'p-value',
    'subgroup',
    'adverse events',
  ];
}
