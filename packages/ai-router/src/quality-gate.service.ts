/**
 * Quality Gate Service
 *
 * Validates AI outputs and determines if escalation is needed.
 * Ensures response quality before returning to the caller.
 */

import type {
  AITaskType,
  ModelTier,
  QualityCheck,
  EscalationDecision,
} from './types';
import { TIER_ESCALATION_ORDER } from './types';

/**
 * Quality gate validation result
 */
export interface QualityGateResult {
  passed: boolean;
  checks: QualityCheck[];
}

/**
 * Quality Gate Service
 *
 * Validates AI outputs based on task type and response format requirements.
 */
export class QualityGateService {
  /**
   * Validate AI output
   */
  validate(
    content: string,
    taskType: AITaskType,
    responseFormat?: 'text' | 'json'
  ): QualityGateResult {
    const checks: QualityCheck[] = [];

    // Basic content check
    checks.push(this.checkNotEmpty(content));

    // JSON validation if required
    if (responseFormat === 'json') {
      checks.push(this.checkValidJson(content));
    }

    // Task-specific validation
    const taskChecks = this.validateTaskSpecific(content, taskType, responseFormat);
    checks.push(...taskChecks);

    // Length checks
    checks.push(this.checkLength(content, taskType));

    const passed = checks.every(c => c.passed || c.severity !== 'error');

    return { passed, checks };
  }

  /**
   * Determine if escalation is needed
   */
  shouldEscalate(
    result: QualityGateResult,
    currentTier: ModelTier,
    escalationCount: number
  ): EscalationDecision {
    // Can't escalate from FRONTIER
    if (currentTier === 'FRONTIER') {
      return { shouldEscalate: false };
    }

    // Check for escalation-worthy failures
    const errorChecks = result.checks.filter(
      c => !c.passed && c.severity === 'error'
    );

    if (errorChecks.length === 0) {
      return { shouldEscalate: false };
    }

    // Determine target tier
    const currentIndex = TIER_ESCALATION_ORDER.indexOf(currentTier);
    const targetTier = TIER_ESCALATION_ORDER[currentIndex + 1];

    if (!targetTier) {
      return { shouldEscalate: false };
    }

    // Build escalation reason
    const reasons = errorChecks.map(c => c.reason).filter(Boolean);

    return {
      shouldEscalate: true,
      reason: reasons.join('; ') || 'Quality check failed',
      targetTier,
    };
  }

  /**
   * Check that content is not empty
   */
  private checkNotEmpty(content: string): QualityCheck {
    const passed = content.trim().length > 0;
    return {
      name: 'not_empty',
      passed,
      reason: passed ? undefined : 'Response content is empty',
      severity: 'error',
    };
  }

  /**
   * Check that content is valid JSON
   */
  private checkValidJson(content: string): QualityCheck {
    try {
      JSON.parse(content);
      return {
        name: 'valid_json',
        passed: true,
        severity: 'error',
      };
    } catch (error) {
      return {
        name: 'valid_json',
        passed: false,
        reason: `Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`,
        severity: 'error',
      };
    }
  }

  /**
   * Task-specific validation
   */
  private validateTaskSpecific(
    content: string,
    taskType: AITaskType,
    responseFormat?: 'text' | 'json'
  ): QualityCheck[] {
    const checks: QualityCheck[] = [];

    switch (taskType) {
      case 'classify':
        checks.push(this.validateClassification(content, responseFormat));
        break;

      case 'extract_metadata':
        checks.push(this.validateMetadataExtraction(content, responseFormat));
        break;

      case 'summarize':
        checks.push(this.validateSummary(content));
        break;

      case 'draft_section':
        checks.push(this.validateDraftSection(content));
        break;

      case 'abstract_generate':
        checks.push(this.validateAbstract(content));
        break;

      case 'protocol_reasoning':
      case 'complex_synthesis':
        checks.push(this.validateComplexReasoning(content));
        break;

      case 'phi_scan':
        checks.push(this.validatePhiScanResult(content, responseFormat));
        break;

      case 'format_validate':
        checks.push(this.validateFormatCheck(content, responseFormat));
        break;

      default:
        // No task-specific validation
        break;
    }

    return checks;
  }

  /**
   * Validate classification output
   */
  private validateClassification(
    content: string,
    responseFormat?: 'text' | 'json'
  ): QualityCheck {
    if (responseFormat === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (!parsed.classification && !parsed.category && !parsed.label) {
          return {
            name: 'classification_structure',
            passed: false,
            reason: 'Classification JSON missing classification/category/label field',
            severity: 'warning',
          };
        }
      } catch {
        // JSON check handled elsewhere
      }
    }

    return {
      name: 'classification_structure',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Validate metadata extraction output
   */
  private validateMetadataExtraction(
    content: string,
    responseFormat?: 'text' | 'json'
  ): QualityCheck {
    if (responseFormat === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          return {
            name: 'metadata_structure',
            passed: false,
            reason: 'Metadata extraction should return an object',
            severity: 'error',
          };
        }
      } catch {
        // JSON check handled elsewhere
      }
    }

    return {
      name: 'metadata_structure',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Validate summary output
   */
  private validateSummary(content: string): QualityCheck {
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Summaries should be between 50 and 1000 words
    if (wordCount < 50) {
      return {
        name: 'summary_length',
        passed: false,
        reason: `Summary too short: ${wordCount} words (minimum 50)`,
        severity: 'warning',
      };
    }

    if (wordCount > 1000) {
      return {
        name: 'summary_length',
        passed: false,
        reason: `Summary too long: ${wordCount} words (maximum 1000)`,
        severity: 'warning',
      };
    }

    return {
      name: 'summary_length',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Validate draft section output
   */
  private validateDraftSection(content: string): QualityCheck {
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Draft sections should be at least 100 words
    if (wordCount < 100) {
      return {
        name: 'draft_length',
        passed: false,
        reason: `Draft section too short: ${wordCount} words (minimum 100)`,
        severity: 'warning',
      };
    }

    return {
      name: 'draft_length',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Validate abstract output
   */
  private validateAbstract(content: string): QualityCheck {
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Abstracts should be 150-350 words
    if (wordCount < 150) {
      return {
        name: 'abstract_length',
        passed: false,
        reason: `Abstract too short: ${wordCount} words (minimum 150)`,
        severity: 'warning',
      };
    }

    if (wordCount > 350) {
      return {
        name: 'abstract_length',
        passed: false,
        reason: `Abstract too long: ${wordCount} words (maximum 350)`,
        severity: 'warning',
      };
    }

    return {
      name: 'abstract_length',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Validate complex reasoning output
   */
  private validateComplexReasoning(content: string): QualityCheck {
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Complex reasoning should produce substantial output
    if (wordCount < 200) {
      return {
        name: 'reasoning_depth',
        passed: false,
        reason: `Reasoning output too short: ${wordCount} words (minimum 200)`,
        severity: 'error',
      };
    }

    return {
      name: 'reasoning_depth',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Validate PHI scan result
   */
  private validatePhiScanResult(
    content: string,
    responseFormat?: 'text' | 'json'
  ): QualityCheck {
    if (responseFormat === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed.passed !== 'boolean' && typeof parsed.hasPhi !== 'boolean') {
          return {
            name: 'phi_scan_structure',
            passed: false,
            reason: 'PHI scan result missing passed/hasPhi field',
            severity: 'error',
          };
        }
      } catch {
        // JSON check handled elsewhere
      }
    }

    return {
      name: 'phi_scan_structure',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Validate format check result
   */
  private validateFormatCheck(
    content: string,
    responseFormat?: 'text' | 'json'
  ): QualityCheck {
    if (responseFormat === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed.valid !== 'boolean' && typeof parsed.isValid !== 'boolean') {
          return {
            name: 'format_check_structure',
            passed: false,
            reason: 'Format check result missing valid/isValid field',
            severity: 'warning',
          };
        }
      } catch {
        // JSON check handled elsewhere
      }
    }

    return {
      name: 'format_check_structure',
      passed: true,
      severity: 'info',
    };
  }

  /**
   * Check content length based on task type
   */
  private checkLength(content: string, taskType: AITaskType): QualityCheck {
    const length = content.length;

    // Minimum length for any response
    if (length < 10) {
      return {
        name: 'min_length',
        passed: false,
        reason: 'Response too short (less than 10 characters)',
        severity: 'error',
        category: 'length',
      };
    }

    // Maximum length checks (prevent runaway responses)
    const maxLengths: Partial<Record<AITaskType, number>> = {
      classify: 1000,
      extract_metadata: 5000,
      policy_check: 2000,
      phi_scan: 5000,
      format_validate: 2000,
      summarize: 10000,
      draft_section: 20000,
      template_fill: 15000,
      abstract_generate: 5000,
      protocol_reasoning: 50000,
      complex_synthesis: 50000,
      final_manuscript_pass: 100000,
    };

    const maxLength = maxLengths[taskType] || 50000;

    if (length > maxLength) {
      return {
        name: 'max_length',
        passed: false,
        reason: `Response exceeds maximum length for ${taskType}: ${length} > ${maxLength}`,
        severity: 'warning',
        category: 'length',
      };
    }

    return {
      name: 'length_check',
      passed: true,
      severity: 'info',
      category: 'length',
    };
  }

  // ==========================================================================
  // Phase 7: Enhanced Quality Checks for AI Self-Improvement Loop
  // ==========================================================================

  /**
   * Check that content contains citations/references
   * 
   * Detects patterns like:
   * - Numbered citations: [1], [2,3], [1-5]
   * - Author citations: (Smith, 2024), (Smith et al., 2023)
   * - Superscript-style: text¹, text²
   */
  checkCitationsPresent(content: string, minCount: number = 1): QualityCheck {
    // Citation patterns
    const patterns = [
      /\[\d+(?:[-,]\d+)*\]/g,                          // [1], [1,2], [1-5]
      /\([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\)/g, // (Smith, 2024), (Smith et al., 2023)
      /[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g,                               // Superscript numbers
      /\b(?:doi|DOI):\s*\S+/g,                         // DOI references
    ];

    const foundCitations: string[] = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundCitations.push(...matches);
      }
    }

    const uniqueCitations = [...new Set(foundCitations)];
    const passed = uniqueCitations.length >= minCount;
    const score = Math.min(uniqueCitations.length / minCount, 1.0);

    return {
      name: 'citations_present',
      passed,
      reason: passed 
        ? undefined 
        : `Found ${uniqueCitations.length} citations, expected at least ${minCount}`,
      severity: passed ? 'info' : 'warning',
      category: 'citations',
      score,
      details: {
        expected: minCount,
        actual: uniqueCitations.length,
        found: uniqueCitations.slice(0, 10), // Limit to first 10
      },
    };
  }

  /**
   * Check that content covers required key points
   * 
   * @param content - Content to check
   * @param keyPoints - Array of key points that should be mentioned
   * @param caseSensitive - Whether matching is case-sensitive
   */
  checkKeyPointsCovered(
    content: string, 
    keyPoints: string[],
    caseSensitive: boolean = false
  ): QualityCheck {
    const normalizedContent = caseSensitive ? content : content.toLowerCase();
    
    const covered: string[] = [];
    const missing: string[] = [];

    for (const point of keyPoints) {
      const normalizedPoint = caseSensitive ? point : point.toLowerCase();
      // Check for the key point or variations
      const words = normalizedPoint.split(/\s+/);
      const allWordsPresent = words.every(word => 
        normalizedContent.includes(word)
      );
      
      if (allWordsPresent) {
        covered.push(point);
      } else {
        missing.push(point);
      }
    }

    const score = keyPoints.length > 0 ? covered.length / keyPoints.length : 1.0;
    const passed = missing.length === 0;

    return {
      name: 'key_points_covered',
      passed,
      reason: passed 
        ? undefined 
        : `Missing key points: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`,
      severity: passed ? 'info' : 'warning',
      category: 'coverage',
      score,
      details: {
        expected: keyPoints,
        actual: covered.length,
        missing,
        found: covered,
      },
    };
  }

  /**
   * Check that content does not contain question marks (indicating uncertainty)
   * 
   * Question marks in AI-generated content may indicate the model is uncertain
   * or asking clarifying questions instead of providing definitive answers.
   */
  checkNoQuestionMarks(content: string): QualityCheck {
    // Count question marks, excluding those in quotes or code blocks
    const questionMarkPattern = /\?(?![^`]*`)/g;
    const matches = content.match(questionMarkPattern) || [];
    const questionCount = matches.length;

    const passed = questionCount === 0;
    const score = Math.max(0, 1 - (questionCount * 0.1)); // Reduce score by 0.1 per question

    return {
      name: 'no_question_marks',
      passed,
      reason: passed 
        ? undefined 
        : `Content contains ${questionCount} question mark(s), which may indicate uncertainty`,
      severity: 'warning', // Warning only, not blocking
      category: 'confidence',
      score,
      details: {
        expected: 0,
        actual: questionCount,
      },
    };
  }

  /**
   * Check that content length is within specified bounds
   * 
   * @param content - Content to check
   * @param minWords - Minimum word count
   * @param maxWords - Maximum word count
   */
  checkLengthWithinBounds(
    content: string,
    minWords: number,
    maxWords: number
  ): QualityCheck {
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    
    let passed = true;
    let reason: string | undefined;
    let score = 1.0;

    if (wordCount < minWords) {
      passed = false;
      reason = `Content too short: ${wordCount} words (minimum ${minWords})`;
      score = wordCount / minWords;
    } else if (wordCount > maxWords) {
      passed = false;
      reason = `Content too long: ${wordCount} words (maximum ${maxWords})`;
      score = maxWords / wordCount;
    }

    return {
      name: 'length_within_bounds',
      passed,
      reason,
      severity: passed ? 'info' : 'warning',
      category: 'length',
      score: Math.min(score, 1.0),
      details: {
        expected: { min: minWords, max: maxWords },
        actual: wordCount,
      },
    };
  }

  /**
   * Check that content does not contain placeholder text
   * 
   * Detects common placeholder patterns like [TODO], [INSERT], XXX, TBD
   */
  checkNoPlaceholders(content: string): QualityCheck {
    const placeholderPatterns = [
      /\[TODO[^\]]*\]/gi,
      /\[INSERT[^\]]*\]/gi,
      /\[PLACEHOLDER[^\]]*\]/gi,
      /\[YOUR[^\]]*\]/gi,
      /\[FILL[^\]]*\]/gi,
      /\bXXX+\b/g,
      /\bTBD\b/gi,
      /\bFIXME\b/gi,
      /\[\.{3,}\]/g,  // [...]
      /<[A-Z_]+>/g,   // <PLACEHOLDER>
    ];

    const foundPlaceholders: string[] = [];
    for (const pattern of placeholderPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundPlaceholders.push(...matches);
      }
    }

    const passed = foundPlaceholders.length === 0;
    const score = passed ? 1.0 : Math.max(0, 1 - (foundPlaceholders.length * 0.2));

    return {
      name: 'no_placeholders',
      passed,
      reason: passed 
        ? undefined 
        : `Content contains placeholder text: ${foundPlaceholders.slice(0, 3).join(', ')}`,
      severity: passed ? 'info' : 'error',
      category: 'completeness',
      score,
      details: {
        expected: 0,
        actual: foundPlaceholders.length,
        found: foundPlaceholders.slice(0, 10),
      },
    };
  }

  /**
   * Run all enhanced quality checks for narrative content
   * 
   * This is a convenience method for running all Phase 7 checks
   * on AI-generated narrative sections.
   */
  validateNarrativeContent(
    content: string,
    options: {
      minCitations?: number;
      keyPoints?: string[];
      minWords?: number;
      maxWords?: number;
      checkQuestionMarks?: boolean;
      checkPlaceholders?: boolean;
    } = {}
  ): QualityCheck[] {
    const checks: QualityCheck[] = [];

    // Citations check
    if (options.minCitations !== undefined && options.minCitations > 0) {
      checks.push(this.checkCitationsPresent(content, options.minCitations));
    }

    // Key points coverage
    if (options.keyPoints && options.keyPoints.length > 0) {
      checks.push(this.checkKeyPointsCovered(content, options.keyPoints));
    }

    // Length bounds
    if (options.minWords !== undefined || options.maxWords !== undefined) {
      checks.push(this.checkLengthWithinBounds(
        content,
        options.minWords || 0,
        options.maxWords || Infinity
      ));
    }

    // Question marks (optional, default false)
    if (options.checkQuestionMarks) {
      checks.push(this.checkNoQuestionMarks(content));
    }

    // Placeholders (optional, default true)
    if (options.checkPlaceholders !== false) {
      checks.push(this.checkNoPlaceholders(content));
    }

    return checks;
  }
}

/**
 * Create a singleton instance
 */
let defaultInstance: QualityGateService | null = null;

export function getQualityGate(): QualityGateService {
  if (!defaultInstance) {
    defaultInstance = new QualityGateService();
  }
  return defaultInstance;
}
