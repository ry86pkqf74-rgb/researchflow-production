/**
 * Hallucination Detection for AI Outputs
 *
 * Implements tiered detection strategies:
 * - Tier 1: Structural + numeric sanity checks
 * - Tier 2: Evidence binding validation
 *
 * Tasks: 97, 102, 109 (AI Quality Controls)
 */

export interface HallucinationFlag {
  type: 'unreferenced_statistic' | 'impossible_value' | 'unsupported_claim' | 'missing_citation' | 'contradictory';
  severity: 'low' | 'medium' | 'high';
  location: {
    paragraph?: number;
    sentence?: number;
    text?: string;
  };
  message: string;
  suggestedFix?: string;
}

export interface HallucinationCheckResult {
  riskScore: number; // 0-1
  flags: HallucinationFlag[];
  passedChecks: string[];
  failedChecks: string[];
  suggestedFixes: string[];
  metadata: {
    totalParagraphs: number;
    totalSentences: number;
    statisticsFound: number;
    citationsFound: number;
    checksPerformed: number;
  };
}

export interface HallucinationCheckOptions {
  /** Require citations for statistical claims */
  requireCitations?: boolean;
  /** Minimum citation density (citations per 100 words) */
  minCitationDensity?: number;
  /** Check for impossible numeric values */
  checkNumericRanges?: boolean;
  /** Domain-specific validation rules */
  domain?: 'medical' | 'general' | 'statistical';
}

const DEFAULT_OPTIONS: HallucinationCheckOptions = {
  requireCitations: true,
  minCitationDensity: 0.5,
  checkNumericRanges: true,
  domain: 'medical',
};

/**
 * Patterns for detecting statistical claims
 */
const STATISTIC_PATTERNS = [
  // P-values
  /p\s*[<>=]\s*0?\.\d+/gi,
  // Percentages
  /\d+\.?\d*\s*%/g,
  // Confidence intervals
  /(?:CI|confidence interval)\s*[:\s]*[\[(]\s*\d+\.?\d*\s*[-–,]\s*\d+\.?\d*\s*[\])]/gi,
  // Sample sizes
  /n\s*[=:]\s*\d+/gi,
  // Odds/hazard ratios
  /(?:OR|HR|RR)\s*[=:]\s*\d+\.?\d*/gi,
  // Effect sizes
  /(?:Cohen['']?s?\s*)?d\s*[=:]\s*\d+\.?\d*/gi,
  // Correlations
  /r\s*[=:]\s*-?\d+\.?\d*/gi,
];

/**
 * Patterns for detecting citations
 */
const CITATION_PATTERNS = [
  // Numbered citations [1], [1,2], [1-3]
  /\[\d+(?:[-–,]\s*\d+)*\]/g,
  // Author-year citations (Smith et al., 2024)
  /\([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\)/g,
  // Superscript-style (implied by number at word boundary)
  /\b\d{1,2}(?=\s|$|[,.])/g,
];

/**
 * Impossible value ranges for medical domain
 */
const MEDICAL_VALUE_RANGES = {
  percentage: { min: 0, max: 100 },
  p_value: { min: 0, max: 1 },
  correlation: { min: -1, max: 1 },
  sample_size: { min: 1, max: 10000000 },
  age: { min: 0, max: 150 },
  bmi: { min: 10, max: 100 },
};

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Simple sentence splitting (handles common abbreviations)
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
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Find all statistics in text
 */
function findStatistics(text: string): Array<{ match: string; pattern: string }> {
  const results: Array<{ match: string; pattern: string }> = [];

  for (const pattern of STATISTIC_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      results.push({ match, pattern: pattern.source });
    }
  }

  return results;
}

/**
 * Find all citations in text
 */
function findCitations(text: string): string[] {
  const results: string[] = [];

  for (const pattern of CITATION_PATTERNS) {
    const matches = text.match(pattern) || [];
    results.push(...matches);
  }

  return [...new Set(results)]; // Dedupe
}

/**
 * Check if a statistic has a nearby citation
 */
function hasNearbyCitation(text: string, statisticPosition: number, windowSize: number = 100): boolean {
  const start = Math.max(0, statisticPosition - windowSize);
  const end = Math.min(text.length, statisticPosition + windowSize);
  const window = text.substring(start, end);

  return CITATION_PATTERNS.some((pattern) => pattern.test(window));
}

/**
 * Validate numeric values against domain-specific ranges
 */
function validateNumericValue(
  value: number,
  valueType: keyof typeof MEDICAL_VALUE_RANGES
): { valid: boolean; message?: string } {
  const range = MEDICAL_VALUE_RANGES[valueType];
  if (!range) return { valid: true };

  if (value < range.min || value > range.max) {
    return {
      valid: false,
      message: `Value ${value} is outside expected range [${range.min}, ${range.max}] for ${valueType}`,
    };
  }

  return { valid: true };
}

/**
 * Extract numeric value from statistic match
 */
function extractNumericValue(match: string): number | null {
  const numMatch = match.match(/-?\d+\.?\d*/);
  if (numMatch) {
    return parseFloat(numMatch[0]);
  }
  return null;
}

/**
 * Determine value type from statistic pattern
 */
function getValueType(match: string): keyof typeof MEDICAL_VALUE_RANGES | null {
  if (match.includes('%')) return 'percentage';
  if (/p\s*[<>=]/i.test(match)) return 'p_value';
  if (/^r\s*[=:]/i.test(match)) return 'correlation';
  if (/n\s*[=:]/i.test(match)) return 'sample_size';
  return null;
}

/**
 * Main hallucination check function
 */
export function checkForHallucinations(
  content: string,
  options: HallucinationCheckOptions = {}
): HallucinationCheckResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const flags: HallucinationFlag[] = [];
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const suggestedFixes: string[] = [];

  const paragraphs = splitIntoParagraphs(content);
  const allSentences = splitIntoSentences(content);
  const statistics = findStatistics(content);
  const citations = findCitations(content);
  const wordCount = countWords(content);

  let checksPerformed = 0;

  // Check 1: Citation density
  if (opts.requireCitations && opts.minCitationDensity) {
    checksPerformed++;
    const citationDensity = (citations.length / wordCount) * 100;

    if (citationDensity < opts.minCitationDensity) {
      failedChecks.push('citation_density');
      flags.push({
        type: 'missing_citation',
        severity: 'medium',
        location: {},
        message: `Citation density (${citationDensity.toFixed(2)}/100 words) is below threshold (${opts.minCitationDensity}/100 words)`,
        suggestedFix: 'Add citations for key claims and statistical findings',
      });
      suggestedFixes.push('Increase citation density by adding references for claims');
    } else {
      passedChecks.push('citation_density');
    }
  }

  // Check 2: Unreferenced statistics
  if (opts.requireCitations) {
    checksPerformed++;
    let unreferencedCount = 0;

    for (const stat of statistics) {
      const position = content.indexOf(stat.match);
      if (!hasNearbyCitation(content, position, 150)) {
        unreferencedCount++;

        // Find which sentence/paragraph
        let paragraphIndex = 0;
        let charCount = 0;
        for (let i = 0; i < paragraphs.length; i++) {
          if (charCount + paragraphs[i].length >= position) {
            paragraphIndex = i;
            break;
          }
          charCount += paragraphs[i].length + 2; // +2 for paragraph separator
        }

        flags.push({
          type: 'unreferenced_statistic',
          severity: 'high',
          location: {
            paragraph: paragraphIndex,
            text: stat.match,
          },
          message: `Statistic "${stat.match}" has no nearby citation`,
          suggestedFix: 'Add a citation for this statistical claim',
        });
      }
    }

    if (unreferencedCount === 0) {
      passedChecks.push('referenced_statistics');
    } else {
      failedChecks.push('referenced_statistics');
      suggestedFixes.push(`Add citations for ${unreferencedCount} unreferenced statistic(s)`);
    }
  }

  // Check 3: Impossible values
  if (opts.checkNumericRanges) {
    checksPerformed++;
    let impossibleCount = 0;

    for (const stat of statistics) {
      const value = extractNumericValue(stat.match);
      const valueType = getValueType(stat.match);

      if (value !== null && valueType) {
        const validation = validateNumericValue(value, valueType);
        if (!validation.valid) {
          impossibleCount++;
          flags.push({
            type: 'impossible_value',
            severity: 'high',
            location: { text: stat.match },
            message: validation.message || `Invalid value in "${stat.match}"`,
            suggestedFix: 'Verify and correct this value',
          });
        }
      }
    }

    if (impossibleCount === 0) {
      passedChecks.push('valid_numeric_ranges');
    } else {
      failedChecks.push('valid_numeric_ranges');
      suggestedFixes.push(`Review ${impossibleCount} value(s) that appear outside valid ranges`);
    }
  }

  // Calculate risk score
  // Weighted by severity: high=1, medium=0.5, low=0.2
  const maxPossibleScore = checksPerformed * 2; // Assuming max 2 high-severity flags per check
  let weightedFlagScore = 0;

  for (const flag of flags) {
    switch (flag.severity) {
      case 'high':
        weightedFlagScore += 1;
        break;
      case 'medium':
        weightedFlagScore += 0.5;
        break;
      case 'low':
        weightedFlagScore += 0.2;
        break;
    }
  }

  const riskScore = maxPossibleScore > 0 ? Math.min(weightedFlagScore / maxPossibleScore, 1) : 0;

  return {
    riskScore,
    flags,
    passedChecks,
    failedChecks,
    suggestedFixes: [...new Set(suggestedFixes)],
    metadata: {
      totalParagraphs: paragraphs.length,
      totalSentences: allSentences.length,
      statisticsFound: statistics.length,
      citationsFound: citations.length,
      checksPerformed,
    },
  };
}

/**
 * Quick check if content passes basic hallucination checks
 */
export function passesHallucinationCheck(
  content: string,
  maxRiskScore: number = 0.3,
  options?: HallucinationCheckOptions
): boolean {
  const result = checkForHallucinations(content, options);
  return result.riskScore <= maxRiskScore;
}
