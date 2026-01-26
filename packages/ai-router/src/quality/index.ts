/**
 * AI Output Quality Control Module
 *
 * Provides checks for:
 * - Hallucination detection
 * - Bias detection
 * - Ethics scoring
 *
 * Tasks: 97, 102, 109 (AI Quality Controls)
 */

export {
  checkForHallucinations,
  passesHallucinationCheck,
  type HallucinationFlag,
  type HallucinationCheckResult,
  type HallucinationCheckOptions,
} from './hallucination-check.js';

export {
  checkForBias,
  passesBiasCheck,
  getNeutralAlternatives,
  type BiasFlag,
  type BiasCheckResult,
  type BiasCheckOptions,
} from './bias-check.js';

/**
 * Combined quality check result
 */
export interface QualityCheckResult {
  overallScore: number;
  hallucinationScore: number;
  biasScore: number;
  passedAllChecks: boolean;
  flags: Array<{
    source: 'hallucination' | 'bias';
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestedFix?: string;
  }>;
  suggestedFixes: string[];
}

/**
 * Run all quality checks on content
 */
export async function runQualityChecks(
  content: string,
  options?: {
    hallucination?: import('./hallucination-check.js').HallucinationCheckOptions;
    bias?: import('./bias-check.js').BiasCheckOptions;
  }
): Promise<QualityCheckResult> {
  const { checkForHallucinations } = await import('./hallucination-check.js');
  const { checkForBias } = await import('./bias-check.js');

  const hallucinationResult = checkForHallucinations(content, options?.hallucination);
  const biasResult = checkForBias(content, options?.bias);

  // Combine flags
  const flags: QualityCheckResult['flags'] = [
    ...hallucinationResult.flags.map((f) => ({
      source: 'hallucination' as const,
      type: f.type,
      severity: f.severity,
      message: f.message,
      suggestedFix: f.suggestedFix,
    })),
    ...biasResult.flags.map((f) => ({
      source: 'bias' as const,
      type: f.type,
      severity: f.severity,
      message: f.message,
      suggestedFix: f.suggestedFix,
    })),
  ];

  // Calculate overall score (weighted average)
  const overallScore = (hallucinationResult.riskScore + biasResult.biasScore) / 2;

  return {
    overallScore,
    hallucinationScore: hallucinationResult.riskScore,
    biasScore: biasResult.biasScore,
    passedAllChecks:
      hallucinationResult.failedChecks.length === 0 && biasResult.failedChecks.length === 0,
    flags,
    suggestedFixes: [
      ...hallucinationResult.suggestedFixes,
      ...biasResult.suggestedFixes,
    ],
  };
}
