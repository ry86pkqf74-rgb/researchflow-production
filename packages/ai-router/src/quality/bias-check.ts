/**
 * Bias Detection for AI Outputs
 *
 * Implements detection strategies for:
 * - Language bias (stigmatizing terms, unsupported generalizations)
 * - Demographic representation in claims
 * - Balanced perspective checks
 *
 * Tasks: 97, 102 (Bias Detection)
 */

export interface BiasFlag {
  type: 'stigmatizing_language' | 'unsupported_generalization' | 'demographic_bias' | 'perspective_imbalance';
  severity: 'low' | 'medium' | 'high';
  location: {
    paragraph?: number;
    sentence?: number;
    text?: string;
  };
  category: string;
  message: string;
  suggestedFix?: string;
}

export interface BiasCheckResult {
  biasScore: number; // 0-1
  flags: BiasFlag[];
  passedChecks: string[];
  failedChecks: string[];
  suggestedFixes: string[];
  categories: {
    [category: string]: {
      flagCount: number;
      severity: 'low' | 'medium' | 'high';
    };
  };
  metadata: {
    totalParagraphs: number;
    totalSentences: number;
    demographicMentions: number;
    checksPerformed: number;
  };
}

export interface BiasCheckOptions {
  /** Check for stigmatizing medical language */
  checkStigmatizingLanguage?: boolean;
  /** Check for unsupported generalizations */
  checkGeneralizations?: boolean;
  /** Check demographic representation balance */
  checkDemographicBalance?: boolean;
  /** Domain-specific checks */
  domain?: 'medical' | 'general';
  /** Custom term lists to check */
  customTerms?: {
    stigmatizing?: string[];
    neutral?: string[];
  };
}

const DEFAULT_OPTIONS: BiasCheckOptions = {
  checkStigmatizingLanguage: true,
  checkGeneralizations: true,
  checkDemographicBalance: true,
  domain: 'medical',
};

/**
 * Stigmatizing terms and their neutral alternatives (medical context)
 */
const STIGMATIZING_TERMS: Array<{ term: RegExp; category: string; neutral: string; severity: 'low' | 'medium' | 'high' }> = [
  // Mental health
  { term: /\bcrazy\b/gi, category: 'mental_health', neutral: 'experiencing symptoms', severity: 'high' },
  { term: /\binsane\b/gi, category: 'mental_health', neutral: 'experiencing mental health challenges', severity: 'high' },
  { term: /\bpsycho\b/gi, category: 'mental_health', neutral: 'person with mental illness', severity: 'high' },
  { term: /\bschizo\b/gi, category: 'mental_health', neutral: 'person with schizophrenia', severity: 'high' },
  { term: /\bmental(?:ly)?\s*(?:ill|sick|unstable)\b/gi, category: 'mental_health', neutral: 'experiencing mental health condition', severity: 'medium' },
  { term: /\bcommitted\s+suicide\b/gi, category: 'mental_health', neutral: 'died by suicide', severity: 'medium' },

  // Substance use
  { term: /\baddict(?:s|ed)?\b/gi, category: 'substance_use', neutral: 'person with substance use disorder', severity: 'medium' },
  { term: /\bjunkie\b/gi, category: 'substance_use', neutral: 'person with substance use disorder', severity: 'high' },
  { term: /\bsubstance\s*abuser?\b/gi, category: 'substance_use', neutral: 'person with substance use disorder', severity: 'medium' },
  { term: /\bdrug\s*abuser?\b/gi, category: 'substance_use', neutral: 'person who uses drugs', severity: 'medium' },
  { term: /\bclean\b(?=.*\b(?:drug|substance|sober)\b)/gi, category: 'substance_use', neutral: 'in recovery', severity: 'low' },

  // Physical conditions
  { term: /\bsuffering\s+from\b/gi, category: 'language', neutral: 'living with / diagnosed with', severity: 'low' },
  { term: /\bvictim\s+of\b(?=.*\b(?:disease|illness|condition)\b)/gi, category: 'language', neutral: 'person with', severity: 'low' },
  { term: /\bafflicted\s+(?:with|by)\b/gi, category: 'language', neutral: 'has / diagnosed with', severity: 'low' },
  { term: /\bcrippled?\b/gi, category: 'disability', neutral: 'person with mobility disability', severity: 'high' },
  { term: /\bhandicapped\b/gi, category: 'disability', neutral: 'person with disability', severity: 'medium' },

  // Weight/body
  { term: /\bobese\s+(?:patient|person|individual)s?\b/gi, category: 'weight', neutral: 'patient with obesity', severity: 'medium' },
  { term: /\bthe\s+obese\b/gi, category: 'weight', neutral: 'people with obesity', severity: 'high' },

  // Age
  { term: /\bthe\s+elderly\b/gi, category: 'age', neutral: 'older adults', severity: 'low' },
  { term: /\bsenile\b/gi, category: 'age', neutral: 'experiencing cognitive changes', severity: 'high' },

  // General
  { term: /\bnon-?compliant\b/gi, category: 'adherence', neutral: 'not following treatment plan', severity: 'low' },
  { term: /\bfrequent\s+flyer\b/gi, category: 'healthcare', neutral: 'patient with multiple visits', severity: 'medium' },
];

/**
 * Generalization patterns that may indicate bias
 */
const GENERALIZATION_PATTERNS: Array<{ pattern: RegExp; category: string; message: string }> = [
  { pattern: /\ball\s+(?:men|women|people|patients)\b/gi, category: 'universal', message: 'Universal generalization detected' },
  { pattern: /\balways\b/gi, category: 'absolute', message: 'Absolute term may indicate overgeneralization' },
  { pattern: /\bnever\b/gi, category: 'absolute', message: 'Absolute term may indicate overgeneralization' },
  { pattern: /\beveryone\b/gi, category: 'universal', message: 'Universal generalization detected' },
  { pattern: /\bno\s+one\b/gi, category: 'universal', message: 'Universal generalization detected' },
  { pattern: /\btypically\b(?!.*\bcitation\b|\[\d)/gi, category: 'unsupported', message: '"Typically" claim may need citation' },
  { pattern: /\bit\s+is\s+(?:well[-\s]?)?known\b/gi, category: 'unsupported', message: '"Well known" claim may need citation' },
  { pattern: /\bstudies\s+(?:show|suggest|indicate)\b(?!.*\[\d)/gi, category: 'vague_reference', message: 'Vague reference to studies needs specific citation' },
  { pattern: /\bresearch\s+(?:shows|suggests|indicates)\b(?!.*\[\d)/gi, category: 'vague_reference', message: 'Vague reference to research needs specific citation' },
];

/**
 * Demographic groups for balance checking
 */
const DEMOGRAPHIC_PATTERNS = {
  sex: [/\bmale\b/gi, /\bfemale\b/gi, /\bmen\b/gi, /\bwomen\b/gi],
  age: [/\byoung(?:er)?\b/gi, /\bold(?:er)?\b/gi, /\badult\b/gi, /\belderly\b/gi, /\bchild(?:ren)?\b/gi],
  race: [/\bwhite\b/gi, /\bblack\b/gi, /\basian\b/gi, /\bhispanic\b/gi, /\blatino?\b/gi, /\bcaucasian\b/gi],
};

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Count demographic mentions
 */
function countDemographicMentions(text: string): { total: number; byGroup: Record<string, number> } {
  const byGroup: Record<string, number> = {};
  let total = 0;

  for (const [group, patterns] of Object.entries(DEMOGRAPHIC_PATTERNS)) {
    byGroup[group] = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      byGroup[group] += matches.length;
      total += matches.length;
    }
  }

  return { total, byGroup };
}

/**
 * Find position in text and map to paragraph/sentence
 */
function findLocation(text: string, position: number, paragraphs: string[]): { paragraph: number; sentence?: number } {
  let charCount = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    if (charCount + paragraphs[i].length >= position) {
      return { paragraph: i };
    }
    charCount += paragraphs[i].length + 2;
  }
  return { paragraph: 0 };
}

/**
 * Main bias check function
 */
export function checkForBias(
  content: string,
  options: BiasCheckOptions = {}
): BiasCheckResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const flags: BiasFlag[] = [];
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const suggestedFixes: string[] = [];
  const categories: BiasCheckResult['categories'] = {};

  const paragraphs = splitIntoParagraphs(content);
  const allSentences = splitIntoSentences(content);
  const demographicInfo = countDemographicMentions(content);

  let checksPerformed = 0;

  // Check 1: Stigmatizing language
  if (opts.checkStigmatizingLanguage) {
    checksPerformed++;
    let stigmatizingCount = 0;

    // Include custom terms if provided
    const allTerms = [...STIGMATIZING_TERMS];
    if (opts.customTerms?.stigmatizing) {
      for (const term of opts.customTerms.stigmatizing) {
        allTerms.push({
          term: new RegExp(`\\b${term}\\b`, 'gi'),
          category: 'custom',
          neutral: `[preferred alternative for "${term}"]`,
          severity: 'medium',
        });
      }
    }

    for (const termDef of allTerms) {
      let match;
      const regex = new RegExp(termDef.term.source, termDef.term.flags);
      while ((match = regex.exec(content)) !== null) {
        stigmatizingCount++;
        const location = findLocation(content, match.index, paragraphs);

        flags.push({
          type: 'stigmatizing_language',
          severity: termDef.severity,
          location: {
            ...location,
            text: match[0],
          },
          category: termDef.category,
          message: `Potentially stigmatizing term: "${match[0]}"`,
          suggestedFix: `Consider using: "${termDef.neutral}"`,
        });

        // Track by category
        if (!categories[termDef.category]) {
          categories[termDef.category] = { flagCount: 0, severity: 'low' };
        }
        categories[termDef.category].flagCount++;
        if (
          termDef.severity === 'high' ||
          (termDef.severity === 'medium' && categories[termDef.category].severity === 'low')
        ) {
          categories[termDef.category].severity = termDef.severity;
        }
      }
    }

    if (stigmatizingCount === 0) {
      passedChecks.push('no_stigmatizing_language');
    } else {
      failedChecks.push('stigmatizing_language');
      suggestedFixes.push(`Review ${stigmatizingCount} potentially stigmatizing term(s)`);
    }
  }

  // Check 2: Unsupported generalizations
  if (opts.checkGeneralizations) {
    checksPerformed++;
    let generalizationCount = 0;

    for (const genDef of GENERALIZATION_PATTERNS) {
      let match;
      const regex = new RegExp(genDef.pattern.source, genDef.pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        generalizationCount++;
        const location = findLocation(content, match.index, paragraphs);

        flags.push({
          type: 'unsupported_generalization',
          severity: 'medium',
          location: {
            ...location,
            text: match[0],
          },
          category: genDef.category,
          message: genDef.message,
          suggestedFix: 'Add supporting evidence or qualify the statement',
        });
      }
    }

    if (generalizationCount === 0) {
      passedChecks.push('no_unsupported_generalizations');
    } else {
      failedChecks.push('unsupported_generalizations');
      suggestedFixes.push(`Review ${generalizationCount} potential generalization(s)`);
    }
  }

  // Check 3: Demographic balance
  if (opts.checkDemographicBalance) {
    checksPerformed++;

    // Check if one demographic group is mentioned significantly more
    const byGroup = demographicInfo.byGroup;
    const groups = Object.keys(byGroup);

    for (const group of groups) {
      if (byGroup[group] > 0) {
        // For paired demographics (male/female), check balance
        if (group === 'sex') {
          const malePattern = /\bmale\b|\bmen\b/gi;
          const femalePattern = /\bfemale\b|\bwomen\b/gi;
          const maleCount = (content.match(malePattern) || []).length;
          const femaleCount = (content.match(femalePattern) || []).length;

          if (maleCount > 0 && femaleCount > 0) {
            const ratio = Math.max(maleCount, femaleCount) / Math.min(maleCount, femaleCount);
            if (ratio > 3) {
              flags.push({
                type: 'demographic_bias',
                severity: 'low',
                location: {},
                category: 'sex_representation',
                message: `Imbalanced sex representation (${maleCount} male mentions vs ${femaleCount} female mentions)`,
                suggestedFix: 'Consider balancing references to different sexes where appropriate',
              });
            }
          }
        }
      }
    }

    if (!flags.some((f) => f.type === 'demographic_bias')) {
      passedChecks.push('demographic_balance');
    } else {
      failedChecks.push('demographic_balance');
    }
  }

  // Calculate bias score
  let weightedScore = 0;
  for (const flag of flags) {
    switch (flag.severity) {
      case 'high':
        weightedScore += 1;
        break;
      case 'medium':
        weightedScore += 0.5;
        break;
      case 'low':
        weightedScore += 0.2;
        break;
    }
  }

  const maxScore = checksPerformed * 3; // Assuming max 3 flags per check
  const biasScore = maxScore > 0 ? Math.min(weightedScore / maxScore, 1) : 0;

  return {
    biasScore,
    flags,
    passedChecks,
    failedChecks,
    suggestedFixes: [...new Set(suggestedFixes)],
    categories,
    metadata: {
      totalParagraphs: paragraphs.length,
      totalSentences: allSentences.length,
      demographicMentions: demographicInfo.total,
      checksPerformed,
    },
  };
}

/**
 * Quick check if content passes basic bias checks
 */
export function passesBiasCheck(
  content: string,
  maxBiasScore: number = 0.3,
  options?: BiasCheckOptions
): boolean {
  const result = checkForBias(content, options);
  return result.biasScore <= maxBiasScore;
}

/**
 * Get neutral alternatives for flagged terms
 */
export function getNeutralAlternatives(text: string): Array<{ original: string; neutral: string }> {
  const alternatives: Array<{ original: string; neutral: string }> = [];

  for (const termDef of STIGMATIZING_TERMS) {
    let match;
    const regex = new RegExp(termDef.term.source, termDef.term.flags);
    while ((match = regex.exec(text)) !== null) {
      alternatives.push({
        original: match[0],
        neutral: termDef.neutral,
      });
    }
  }

  return alternatives;
}
