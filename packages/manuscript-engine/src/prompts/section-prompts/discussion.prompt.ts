/**
 * Discussion Section Prompts
 *
 * Structured prompts for generating discussion sections.
 */

import type { SectionPromptContext } from '../../types';

export function buildDiscussionPrompt(context: SectionPromptContext): string {
  return `Generate a thoughtful and comprehensive Discussion section for a ${context.studyType} research manuscript.

${context.objective ? `Study Objective: ${context.objective}\n` : ''}

${
  context.keyFindings && context.keyFindings.length > 0
    ? `Key Findings:\n${context.keyFindings.map((f) => `- ${f}`).join('\n')}\n`
    : ''
}

${context.methodology ? `Study Design: ${context.methodology}\n` : ''}

${context.existingContent ? `Existing Content:\n${context.existingContent}\n` : ''}

Structure the Discussion section following this framework:

1. **Principal Findings** (1 paragraph):
   - Brief summary of key results
   - Direct answer to research question
   - Avoid repeating detailed results

2. **Interpretation in Context** (2-3 paragraphs):
   - Explain what the findings mean
   - Compare with previous studies
   - Discuss agreements and disagreements with literature
   - Propose mechanisms or explanations

3. **Clinical/Scientific Implications** (1-2 paragraphs):
   - Discuss practical significance
   - Impact on clinical practice or research
   - Potential applications
   - Who benefits from these findings

4. **Strengths and Limitations** (1 paragraph):
   - Acknowledge study strengths first
   - Discuss limitations honestly
   - Explain how limitations might affect interpretation
   - Note measures taken to minimize limitations

5. **Future Directions** (1 paragraph):
   - Suggest specific research questions
   - Propose methodological improvements
   - Identify knowledge gaps

6. **Conclusions** (final paragraph):
   - Summarize key message
   - Restate significance
   - End with clear take-home message

Requirements:
- Use present tense for interpretations and implications
- Use past tense when referring to your study results
- Balance enthusiasm with appropriate caution
- Avoid overgeneralizing findings
- Acknowledge alternative explanations
- Typically 3-4 pages (1200-1600 words)

Discussion principles:
- Move from specific findings to broader implications
- Support interpretations with evidence
- Be balanced in discussing strengths and limitations
- Avoid introducing new results
- Maintain objectivity while discussing implications
- Connect findings back to introduction's knowledge gap`;
}

export function buildDiscussionRefinementPrompt(
  existingDiscussion: string,
  feedback: string
): string {
  return `Refine this Discussion section based on the provided feedback:

Current Discussion:
${existingDiscussion}

Feedback:
${feedback}

Please revise the Discussion to:
- Address all feedback points
- Maintain logical flow and structure
- Ensure balanced interpretation
- Strengthen connections to existing literature
- Clarify implications and limitations

Return the refined Discussion section.`;
}

export const DISCUSSION_TEMPLATES = {
  principal_findings: [
    'In this [study type], we found that [primary finding], demonstrating [key point].',
    'This study provides evidence that [finding], addressing a critical gap in [area].',
    'Our findings indicate that [result], which [supports/contradicts] [previous understanding].',
    'The principal finding of this study is that [finding], suggesting [interpretation].',
  ],

  interpretation: [
    'These findings suggest that [interpretation], which may be explained by [mechanism].',
    'This association between [X] and [Y] is consistent with [theoretical framework/previous studies].',
    'Our results align with those of [Author et al.], who reported [similar finding].',
    'Contrary to previous reports, we observed [finding], which may reflect [explanation].',
  ],

  comparison_to_literature: [
    'Our findings are consistent with previous studies demonstrating [finding] [CITE].',
    'In contrast to [Study], which reported [finding], we observed [different result].',
    'These results extend previous work by [Author et al.] [CITE] by [contribution].',
    'While [previous studies] suggested [X], our data indicate that [Y].',
  ],

  clinical_implications: [
    'These findings have important implications for [clinical practice/patient care].',
    'Clinicians should consider [recommendation] when [situation].',
    'This study supports the use of [intervention] in [population/setting].',
    'Our results suggest that [practice] may need to be re-evaluated in light of [finding].',
  ],

  strengths: [
    'Key strengths of this study include [strength 1], [strength 2], and [strength 3].',
    'The [study design] provides strong evidence for [causality/association].',
    'Our use of [method/measure] enhances the validity of these findings.',
    'The [sample size/diversity/follow-up period] strengthens confidence in these results.',
  ],

  limitations: [
    'Several limitations should be acknowledged.',
    'First, the [cross-sectional/retrospective] design limits causal inference.',
    'The sample was limited to [population/setting], which may affect generalizability.',
    'We were unable to [limitation], which represents an important area for future research.',
    'Residual confounding by [unmeasured variables] cannot be excluded.',
  ],

  future_directions: [
    'Future studies should investigate [specific question] using [suggested approach].',
    'Prospective trials are needed to determine whether [intervention] improves [outcome].',
    'Research examining [mechanism/pathway] would provide valuable insights into [phenomenon].',
    'Long-term follow-up studies are warranted to assess [outcome].',
  ],

  conclusions: [
    'In conclusion, this study demonstrates that [key finding], with important implications for [area].',
    'These findings suggest that [practice/approach] should be considered in [context].',
    'This work advances our understanding of [topic] and provides evidence for [conclusion].',
    'Further research is needed, but these results support [recommendation].',
  ],
};

export function getDiscussionKeywords(): string[] {
  return [
    'findings',
    'demonstrate',
    'suggest',
    'interpret',
    'implications',
    'consistent',
    'previous studies',
    'mechanisms',
    'strengths',
    'limitations',
    'future research',
    'conclusion',
    'significance',
    'clinical practice',
    'generalizability',
  ];
}
