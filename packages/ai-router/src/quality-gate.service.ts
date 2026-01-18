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
      };
    }

    return {
      name: 'length_check',
      passed: true,
      severity: 'info',
    };
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
