/**
 * Refinement Rules Configuration (Phase 8)
 *
 * Maps failed quality checks to refinement instructions for the AI
 * self-improvement loop. These rules guide how prompts are enhanced
 * when quality checks fail.
 *
 * SAFETY INVARIANTS:
 * - No PHI in refinement instructions
 * - Instructions are generic templates with placeholders
 *
 * Last Updated: 2026-01-23
 */

import type { QualityCheck } from './types';

/**
 * Check categories that can trigger refinement
 */
export type RefinableCheckCategory =
  | 'citations'
  | 'coverage'
  | 'length'
  | 'confidence'
  | 'completeness'
  | 'structure'
  | 'format';

/**
 * Refinement rule definition
 */
export interface RefinementRule {
  /** Check name this rule applies to */
  checkName: string;
  /** Category of the check */
  category: RefinableCheckCategory;
  /** Priority for ordering multiple refinements (higher = first) */
  priority: number;
  /** Template instruction with {placeholders} */
  instructionTemplate: string;
  /** Whether this rule can be combined with others */
  combinable: boolean;
  /** Maximum times this refinement can be applied */
  maxApplications: number;
}

/**
 * Default refinement rules for common quality check failures
 */
export const DEFAULT_REFINEMENT_RULES: RefinementRule[] = [
  // Citations
  {
    checkName: 'citations_present',
    category: 'citations',
    priority: 90,
    instructionTemplate:
      'Include at least {minCount} relevant references from the literature. ' +
      'Use standard citation formats like [1], [2] or (Author, Year). ' +
      'Ensure citations support key claims.',
    combinable: true,
    maxApplications: 2,
  },

  // Coverage
  {
    checkName: 'key_points_covered',
    category: 'coverage',
    priority: 95,
    instructionTemplate:
      'Ensure you thoroughly discuss the following required topics: {missingPoints}. ' +
      'Each topic should be addressed with sufficient detail.',
    combinable: true,
    maxApplications: 2,
  },

  // Confidence
  {
    checkName: 'no_question_marks',
    category: 'confidence',
    priority: 50,
    instructionTemplate:
      'Remove uncertain language. Replace any questions with definitive statements. ' +
      'If information is uncertain, qualify it with phrases like "evidence suggests" ' +
      'rather than asking questions.',
    combinable: true,
    maxApplications: 1,
  },

  // Length - too short
  {
    checkName: 'length_within_bounds_short',
    category: 'length',
    priority: 70,
    instructionTemplate:
      'Expand your response to approximately {targetWords} words. ' +
      'Add more detail, examples, or supporting evidence where appropriate.',
    combinable: true,
    maxApplications: 2,
  },

  // Length - too long
  {
    checkName: 'length_within_bounds_long',
    category: 'length',
    priority: 70,
    instructionTemplate:
      'Condense your response to approximately {targetWords} words. ' +
      'Focus on the most important points and remove redundant information.',
    combinable: true,
    maxApplications: 2,
  },

  // Completeness
  {
    checkName: 'no_placeholders',
    category: 'completeness',
    priority: 100,
    instructionTemplate:
      'Replace all placeholder text (such as [TODO], TBD, XXX, or bracketed instructions) ' +
      'with actual content. Ensure every section is fully completed.',
    combinable: true,
    maxApplications: 1,
  },

  // Structure
  {
    checkName: 'valid_json',
    category: 'structure',
    priority: 100,
    instructionTemplate:
      'Ensure your response is valid JSON. Check for proper quotes, brackets, ' +
      'and commas. Do not include any text outside the JSON structure.',
    combinable: false,
    maxApplications: 2,
  },

  // Format
  {
    checkName: 'summary_length',
    category: 'format',
    priority: 60,
    instructionTemplate:
      'Adjust the summary length to be between {minWords} and {maxWords} words. ' +
      'A summary should be concise while capturing all key points.',
    combinable: true,
    maxApplications: 2,
  },

  {
    checkName: 'abstract_length',
    category: 'format',
    priority: 60,
    instructionTemplate:
      'Adjust the abstract to be between 150 and 350 words. ' +
      'An abstract should include: background, methods, results, and conclusions.',
    combinable: true,
    maxApplications: 2,
  },

  {
    checkName: 'draft_length',
    category: 'format',
    priority: 60,
    instructionTemplate:
      'Expand the draft section to at least 100 words with substantive content. ' +
      'Include relevant details, evidence, and analysis.',
    combinable: true,
    maxApplications: 2,
  },

  {
    checkName: 'reasoning_depth',
    category: 'format',
    priority: 80,
    instructionTemplate:
      'Provide more thorough reasoning with at least 200 words of analysis. ' +
      'Include step-by-step logic, evidence evaluation, and clear conclusions.',
    combinable: true,
    maxApplications: 2,
  },
];

/**
 * Get refinement rule by check name
 */
export function getRuleByCheckName(checkName: string): RefinementRule | undefined {
  return DEFAULT_REFINEMENT_RULES.find((r) => r.checkName === checkName);
}

/**
 * Get refinement rules by category
 */
export function getRulesByCategory(category: RefinableCheckCategory): RefinementRule[] {
  return DEFAULT_REFINEMENT_RULES.filter((r) => r.category === category);
}

/**
 * Get applicable rules for failed checks, sorted by priority
 */
export function getApplicableRules(failedChecks: QualityCheck[]): RefinementRule[] {
  const rules: RefinementRule[] = [];

  for (const check of failedChecks) {
    // Skip passed checks
    if (check.passed) continue;

    // Find matching rule
    let rule = getRuleByCheckName(check.name);

    // Handle length_within_bounds special case
    if (!rule && check.name === 'length_within_bounds' && check.details) {
      const expected = check.details.expected as { min?: number; max?: number } | undefined;
      const actual = check.details.actual as number | undefined;
      if (expected && actual !== undefined) {
        if (actual < (expected.min || 0)) {
          rule = getRuleByCheckName('length_within_bounds_short');
        } else if (actual > (expected.max || Infinity)) {
          rule = getRuleByCheckName('length_within_bounds_long');
        }
      }
    }

    if (rule) {
      rules.push(rule);
    }
  }

  // Sort by priority (descending)
  return rules.sort((a, b) => b.priority - a.priority);
}

/**
 * Format instruction template with values from check details
 */
export function formatInstruction(
  rule: RefinementRule,
  check: QualityCheck
): string {
  let instruction = rule.instructionTemplate;
  const details = check.details || {};

  // Replace common placeholders
  const replacements: Record<string, string> = {
    minCount: String(details.expected ?? 'several'),
    maxCount: String(details.expected ?? 'fewer'),
    targetWords: String(
      typeof details.expected === 'object' && details.expected
        ? Math.round(
            ((details.expected as { min?: number; max?: number }).min || 0) +
              ((details.expected as { min?: number; max?: number }).max || 1000)
          ) / 2
        : details.expected ?? 'appropriate'
    ),
    minWords: String(
      typeof details.expected === 'object'
        ? (details.expected as { min?: number }).min ?? 50
        : 50
    ),
    maxWords: String(
      typeof details.expected === 'object'
        ? (details.expected as { max?: number }).max ?? 1000
        : 1000
    ),
    missingPoints: Array.isArray(details.missing)
      ? details.missing.join(', ')
      : String(details.missing ?? 'the required topics'),
    foundCount: String(details.actual ?? 0),
  };

  for (const [key, value] of Object.entries(replacements)) {
    instruction = instruction.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  return instruction;
}
