/**
 * Phrase Library
 *
 * Medical phrase templates by manuscript section.
 */

import type { PhraseTemplate, ManuscriptSection } from '../types';

/**
 * Phrase templates organized by section and category
 */
export const PHRASE_LIBRARY: PhraseTemplate[] = [
  // INTRODUCTION PHRASES
  {
    category: 'background',
    section: 'introduction',
    pattern: '{disease} represents a significant {impact_type} burden',
    example: 'Colorectal cancer represents a significant global health burden',
    variables: ['disease', 'impact_type'],
  },
  {
    category: 'background',
    section: 'introduction',
    pattern: 'The incidence of {condition} has {trend} over the past {timeframe}',
    example: 'The incidence of type 2 diabetes has increased over the past two decades',
    variables: ['condition', 'trend', 'timeframe'],
  },
  {
    category: 'gap',
    section: 'introduction',
    pattern: 'Despite advances in {field}, {limitation} remains poorly understood',
    example:
      'Despite advances in immunotherapy, the optimal treatment sequence remains poorly understood',
    variables: ['field', 'limitation'],
  },
  {
    category: 'gap',
    section: 'introduction',
    pattern: 'Limited data exist regarding {topic} in {population}',
    example: 'Limited data exist regarding long-term outcomes in pediatric populations',
    variables: ['topic', 'population'],
  },
  {
    category: 'objective',
    section: 'introduction',
    pattern: 'We aimed to evaluate the {association_type} between {variable1} and {variable2}',
    example:
      'We aimed to evaluate the association between statin use and cardiovascular outcomes',
    variables: ['association_type', 'variable1', 'variable2'],
  },

  // METHODS PHRASES
  {
    category: 'study_design',
    section: 'methods',
    pattern:
      'This {design_type} study was conducted at {institution} between {start_date} and {end_date}',
    example:
      'This retrospective cohort study was conducted at Mass General Hospital between January 2018 and December 2020',
    variables: ['design_type', 'institution', 'start_date', 'end_date'],
  },
  {
    category: 'participants',
    section: 'methods',
    pattern: 'Eligible participants were {age_criteria} {gender} with {condition}',
    example: 'Eligible participants were adults aged 18-75 years with confirmed hypertension',
    variables: ['age_criteria', 'gender', 'condition'],
  },
  {
    category: 'exclusion',
    section: 'methods',
    pattern: 'Patients were excluded if they had {exclusion_criterion}',
    example: 'Patients were excluded if they had prior myocardial infarction',
    variables: ['exclusion_criterion'],
  },
  {
    category: 'intervention',
    section: 'methods',
    pattern:
      'Participants received {intervention} at a dose of {dose} {route} {frequency} for {duration}',
    example:
      'Participants received metformin at a dose of 1000 mg orally twice daily for 12 weeks',
    variables: ['intervention', 'dose', 'route', 'frequency', 'duration'],
  },
  {
    category: 'randomization',
    section: 'methods',
    pattern: 'Participants were randomized {ratio} to {group1} or {group2} using {method}',
    example:
      'Participants were randomized 1:1 to active treatment or placebo using computer-generated random sequence',
    variables: ['ratio', 'group1', 'group2', 'method'],
  },
  {
    category: 'outcomes',
    section: 'methods',
    pattern: 'The primary outcome was {outcome}, assessed at {timepoint} using {measure}',
    example:
      'The primary outcome was change in HbA1c, assessed at 12 weeks using standard laboratory methods',
    variables: ['outcome', 'timepoint', 'measure'],
  },
  {
    category: 'statistical_analysis',
    section: 'methods',
    pattern:
      '{variable_type} were compared between groups using {statistical_test}',
    example: 'Continuous variables were compared between groups using Student t-test',
    variables: ['variable_type', 'statistical_test'],
  },
  {
    category: 'statistical_analysis',
    section: 'methods',
    pattern: 'A p-value < {threshold} was considered statistically significant',
    example: 'A p-value < 0.05 was considered statistically significant',
    variables: ['threshold'],
  },

  // RESULTS PHRASES
  {
    category: 'enrollment',
    section: 'results',
    pattern:
      'Of {screened} participants screened, {enrolled} were enrolled and {analyzed} were included in the final analysis',
    example:
      'Of 450 participants screened, 320 were enrolled and 298 were included in the final analysis',
    variables: ['screened', 'enrolled', 'analyzed'],
  },
  {
    category: 'demographics',
    section: 'results',
    pattern: 'The mean age was {mean} ± {sd} years, and {percentage}% were {characteristic}',
    example: 'The mean age was 62.4 ± 8.2 years, and 48% were female',
    variables: ['mean', 'sd', 'percentage', 'characteristic'],
  },
  {
    category: 'baseline',
    section: 'results',
    pattern: 'Baseline characteristics were {comparison} between groups (Table {table_num})',
    example: 'Baseline characteristics were well-balanced between groups (Table 1)',
    variables: ['comparison', 'table_num'],
  },
  {
    category: 'primary_outcome',
    section: 'results',
    pattern:
      'The primary outcome occurred in {pct1}% of {group1} compared to {pct2}% of {group2} (p = {p_value})',
    example:
      'The primary outcome occurred in 15.2% of the treatment group compared to 22.8% of the control group (p = 0.03)',
    variables: ['pct1', 'group1', 'pct2', 'group2', 'p_value'],
  },
  {
    category: 'comparison',
    section: 'results',
    pattern:
      '{group1} demonstrated {direction} {outcome} compared to {group2} ({statistic}: {value}, 95% CI: {ci_lower}-{ci_upper}, p = {p_value})',
    example:
      'The treatment group demonstrated significantly lower systolic blood pressure compared to placebo (mean difference: -8.4 mmHg, 95% CI: -12.2 to -4.6, p < 0.001)',
    variables: [
      'group1',
      'direction',
      'outcome',
      'group2',
      'statistic',
      'value',
      'ci_lower',
      'ci_upper',
      'p_value',
    ],
  },
  {
    category: 'non_significant',
    section: 'results',
    pattern: 'No significant difference was observed in {outcome} between groups (p = {p_value})',
    example: 'No significant difference was observed in quality of life scores between groups (p = 0.42)',
    variables: ['outcome', 'p_value'],
  },

  // DISCUSSION PHRASES
  {
    category: 'principal_findings',
    section: 'discussion',
    pattern: 'In this {study_type}, we found that {finding}',
    example:
      'In this randomized controlled trial, we found that early intervention significantly reduced disease progression',
    variables: ['study_type', 'finding'],
  },
  {
    category: 'interpretation',
    section: 'discussion',
    pattern: 'These findings suggest that {interpretation}, which may be explained by {mechanism}',
    example:
      'These findings suggest that statin therapy reduces cardiovascular events, which may be explained by pleiotropic anti-inflammatory effects',
    variables: ['interpretation', 'mechanism'],
  },
  {
    category: 'comparison',
    section: 'discussion',
    pattern: 'Our results are consistent with {author} et al., who reported {finding}',
    example:
      'Our results are consistent with Smith et al., who reported similar efficacy in a larger cohort',
    variables: ['author', 'finding'],
  },
  {
    category: 'contrast',
    section: 'discussion',
    pattern: 'In contrast to {study}, which found {previous_finding}, we observed {current_finding}',
    example:
      'In contrast to the ENHANCE trial, which found no benefit, we observed significant improvement in surrogate markers',
    variables: ['study', 'previous_finding', 'current_finding'],
  },
  {
    category: 'clinical_implications',
    section: 'discussion',
    pattern: 'These findings have important implications for {area}',
    example: 'These findings have important implications for clinical practice guidelines',
    variables: ['area'],
  },
  {
    category: 'clinical_implications',
    section: 'discussion',
    pattern: 'Clinicians should consider {recommendation} when {situation}',
    example:
      'Clinicians should consider early aggressive therapy when managing high-risk patients',
    variables: ['recommendation', 'situation'],
  },
  {
    category: 'strengths',
    section: 'discussion',
    pattern: 'Strengths of this study include {strength1}, {strength2}, and {strength3}',
    example:
      'Strengths of this study include the randomized design, diverse patient population, and rigorous outcome assessment',
    variables: ['strength1', 'strength2', 'strength3'],
  },
  {
    category: 'limitations',
    section: 'discussion',
    pattern: 'This study has several limitations. First, {limitation1}',
    example:
      'This study has several limitations. First, the single-center design may limit generalizability',
    variables: ['limitation1'],
  },
  {
    category: 'limitations',
    section: 'discussion',
    pattern: 'The {design_type} design limits {inference_type}',
    example: 'The cross-sectional design limits causal inference',
    variables: ['design_type', 'inference_type'],
  },
  {
    category: 'future_directions',
    section: 'discussion',
    pattern: 'Future studies should investigate {research_question} using {methodology}',
    example:
      'Future studies should investigate long-term outcomes using prospective cohort designs',
    variables: ['research_question', 'methodology'],
  },
  {
    category: 'conclusion',
    section: 'discussion',
    pattern: 'In conclusion, this study demonstrates that {key_finding}, with implications for {area}',
    example:
      'In conclusion, this study demonstrates that early intervention improves outcomes, with implications for treatment guidelines',
    variables: ['key_finding', 'area'],
  },

  // ABSTRACT PHRASES
  {
    category: 'background',
    section: 'abstract',
    pattern: '{condition} is a major {concern_type} affecting {population}',
    example: 'Heart failure is a major public health concern affecting millions worldwide',
    variables: ['condition', 'concern_type', 'population'],
  },
  {
    category: 'objective',
    section: 'abstract',
    pattern: 'We aimed to determine whether {intervention} improves {outcome} in {population}',
    example:
      'We aimed to determine whether remote monitoring improves mortality in heart failure patients',
    variables: ['intervention', 'outcome', 'population'],
  },
  {
    category: 'methods',
    section: 'abstract',
    pattern:
      'This {design} included {n} {participants} from {setting} between {start_date} and {end_date}',
    example:
      'This randomized controlled trial included 500 patients from 12 centers between 2018 and 2020',
    variables: ['design', 'n', 'participants', 'setting', 'start_date', 'end_date'],
  },
  {
    category: 'results',
    section: 'abstract',
    pattern: 'The primary outcome occurred in {pct1}% vs {pct2}% (p = {p_value})',
    example: 'The primary outcome occurred in 12.5% vs 18.3% (p = 0.02)',
    variables: ['pct1', 'pct2', 'p_value'],
  },
  {
    category: 'conclusion',
    section: 'abstract',
    pattern: 'Among {population}, {intervention} resulted in {outcome}',
    example: 'Among high-risk patients, intensive monitoring resulted in reduced mortality',
    variables: ['population', 'intervention', 'outcome'],
  },
];

/**
 * Get phrases by section
 */
export function getPhrasesBySection(section: ManuscriptSection): PhraseTemplate[] {
  return PHRASE_LIBRARY.filter((phrase) => phrase.section === section);
}

/**
 * Get phrases by category
 */
export function getPhrasesByCategory(category: string): PhraseTemplate[] {
  return PHRASE_LIBRARY.filter((phrase) => phrase.category === category);
}

/**
 * Get phrases by section and category
 */
export function getPhrasesBy(
  section: ManuscriptSection,
  category: string
): PhraseTemplate[] {
  return PHRASE_LIBRARY.filter(
    (phrase) => phrase.section === section && phrase.category === category
  );
}

/**
 * Fill phrase template with values
 */
export function fillPhrase(
  phrase: PhraseTemplate,
  values: Record<string, string>
): string {
  let filled = phrase.pattern;

  for (const variable of phrase.variables) {
    const value = values[variable];
    if (value) {
      filled = filled.replace(`{${variable}}`, value);
    }
  }

  return filled;
}

/**
 * Search phrases by keyword
 */
export function searchPhrases(keyword: string): PhraseTemplate[] {
  const lowerKeyword = keyword.toLowerCase();
  return PHRASE_LIBRARY.filter(
    (phrase) =>
      phrase.pattern.toLowerCase().includes(lowerKeyword) ||
      phrase.example.toLowerCase().includes(lowerKeyword) ||
      phrase.category.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Get all categories for a section
 */
export function getCategoriesForSection(section: ManuscriptSection): string[] {
  const categories = new Set(
    PHRASE_LIBRARY.filter((phrase) => phrase.section === section).map(
      (phrase) => phrase.category
    )
  );
  return Array.from(categories);
}

/**
 * Get random phrase from category
 */
export function getRandomPhrase(
  section: ManuscriptSection,
  category: string
): PhraseTemplate | null {
  const phrases = getPhrasesBy(section, category);
  if (phrases.length === 0) return null;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export default PHRASE_LIBRARY;
