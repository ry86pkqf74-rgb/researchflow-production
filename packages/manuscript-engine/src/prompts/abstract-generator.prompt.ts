/**
 * Abstract Generator Prompts
 * AI prompts for generating structured abstracts
 */

/**
 * Abstract generation prompt for clinical research
 */
export const ABSTRACT_GENERATOR_PROMPT = `You are generating a structured abstract for a medical research manuscript.

INPUT:
- Study objectives: {objectives}
- Methods summary: {methods}
- Key results: {results}
- Primary conclusion: {conclusion}

OUTPUT REQUIREMENTS:
Generate a 250-word structured abstract with these sections:

**Background:** 1-2 sentences describing the clinical problem and study rationale
**Methods:** 2-3 sentences describing study design, population, and analysis approach
**Results:** 3-4 sentences reporting key findings with exact statistics (include p-values and confidence intervals)
**Conclusions:** 1-2 sentences stating main conclusion and clinical implications

CONSTRAINTS:
- Total word count: 250 words (±10)
- No PHI or identifying information
- Use passive voice for methods ("Patients were enrolled...")
- Report exact statistics with confidence intervals
- End with clear clinical implications
- Use past tense for completed actions
- Use present tense for conclusions

STYLE GUIDELINES:
- Formal academic tone
- Avoid abbreviations in first use (define them)
- Be specific and quantitative
- Follow AMA Manual of Style conventions

Generate the abstract now:`;

/**
 * Structured abstract sections template
 */
export const STRUCTURED_ABSTRACT_SECTIONS = {
  background: {
    wordLimit: 50,
    prompt: 'Describe the clinical problem, knowledge gap, and study objective in 1-2 sentences.',
  },
  methods: {
    wordLimit: 75,
    prompt: 'Describe study design, setting, population, key variables, and statistical methods in 2-3 sentences.',
  },
  results: {
    wordLimit: 100,
    prompt: 'Report key findings with exact statistics (n, %, p-values, confidence intervals) in 3-4 sentences.',
  },
  conclusions: {
    wordLimit: 50,
    prompt: 'State main conclusion and clinical/research implications in 1-2 sentences.',
  },
} as const;

/**
 * Generate abstract from manuscript content
 */
export function buildAbstractPrompt(context: {
  objectives: string;
  methods: string;
  results: string;
  conclusion: string;
}): string {
  return ABSTRACT_GENERATOR_PROMPT
    .replace('{objectives}', context.objectives)
    .replace('{methods}', context.methods)
    .replace('{results}', context.results)
    .replace('{conclusion}', context.conclusion);
}

/**
 * Abstract quality validation prompts
 */
export const ABSTRACT_QUALITY_CHECKS = [
  'Contains all four required sections (Background, Methods, Results, Conclusions)',
  'Word count is between 240-260 words',
  'Results section includes specific statistics with p-values',
  'No PHI or identifying information present',
  'Conclusions are supported by the results',
  'Clinical implications are stated',
  'Passive voice used appropriately in Methods',
  'Past tense used for completed actions',
] as const;
