/**
 * Prompt Refinement Service (Phase 8)
 *
 * Generates refined prompts based on failed quality checks.
 * Part of the AI self-improvement loop that enables automatic
 * retry with enhanced instructions.
 *
 * SAFETY INVARIANTS:
 * - No PHI in refinement prompts
 * - Original content not stored, only checksums
 * - Refinement history tracked for analytics
 *
 * Last Updated: 2026-01-23
 */

import type { QualityCheck, AITaskType, ModelTier } from './types';
import {
  RefinementRule,
  getApplicableRules,
  formatInstruction,
  getRuleByCheckName,
} from './refinement-rules';
import * as crypto from 'crypto';

/**
 * Refinement context for tracking attempts
 */
export interface RefinementContext {
  /** Original prompt (for reference, not stored) */
  originalPrompt: string;
  /** Task type being refined */
  taskType: AITaskType;
  /** Current model tier */
  currentTier: ModelTier;
  /** Number of refinement attempts so far */
  attemptCount: number;
  /** Maximum allowed attempts */
  maxAttempts: number;
  /** Previous failed checks (most recent first) */
  previousFailures: QualityCheck[][];
  /** Refinement rules already applied */
  appliedRules: string[];
}

/**
 * Result of prompt refinement
 */
export interface RefinementResult {
  /** Whether refinement was applied */
  refined: boolean;
  /** Refined prompt (or original if not refined) */
  prompt: string;
  /** Instructions added to the prompt */
  instructions: string[];
  /** Rules that were applied */
  appliedRules: RefinementRule[];
  /** Reason if refinement was not possible */
  skipReason?: string;
  /** Whether to escalate to higher tier */
  shouldEscalate: boolean;
  /** Suggested target tier for escalation */
  suggestedTier?: ModelTier;
  /** Anonymized summary for logging (no PHI) */
  summary: RefinementSummary;
}

/**
 * Anonymized refinement summary for logging
 */
export interface RefinementSummary {
  /** SHA-256 hash of original prompt (first 16 chars) */
  promptHash: string;
  /** Number of failed checks */
  failedCheckCount: number;
  /** Categories of failed checks */
  failedCategories: string[];
  /** Rules applied */
  rulesApplied: string[];
  /** Attempt number */
  attemptNumber: number;
  /** Whether escalation recommended */
  escalationRecommended: boolean;
  /** Timestamp */
  timestamp: string;
}

/**
 * Prompt Refinement Service
 *
 * Analyzes failed quality checks and generates enhanced prompts
 * with additional instructions to address the failures.
 */
export class PromptRefinementService {
  private maxAttempts: number;
  private escalationThreshold: number;

  constructor(options: { maxAttempts?: number; escalationThreshold?: number } = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.escalationThreshold = options.escalationThreshold ?? 2;
  }

  /**
   * Generate a refined prompt based on failed quality checks
   */
  refine(
    originalPrompt: string,
    failedChecks: QualityCheck[],
    context: Partial<RefinementContext> = {}
  ): RefinementResult {
    const fullContext: RefinementContext = {
      originalPrompt,
      taskType: context.taskType ?? 'draft_section',
      currentTier: context.currentTier ?? 'MINI',
      attemptCount: context.attemptCount ?? 0,
      maxAttempts: context.maxAttempts ?? this.maxAttempts,
      previousFailures: context.previousFailures ?? [],
      appliedRules: context.appliedRules ?? [],
    };

    // Check if we've exceeded max attempts
    if (fullContext.attemptCount >= fullContext.maxAttempts) {
      return this.createSkipResult(
        originalPrompt,
        failedChecks,
        fullContext,
        'Maximum refinement attempts exceeded'
      );
    }

    // Get applicable rules for failed checks
    const applicableRules = getApplicableRules(failedChecks);

    // Filter out rules that have been applied too many times
    const newRules = applicableRules.filter((rule) => {
      const applicationCount = fullContext.appliedRules.filter(
        (r) => r === rule.checkName
      ).length;
      return applicationCount < rule.maxApplications;
    });

    // If no new rules can be applied, consider escalation
    if (newRules.length === 0) {
      return this.createEscalationResult(
        originalPrompt,
        failedChecks,
        fullContext,
        'No applicable refinement rules remaining'
      );
    }

    // Generate instructions from rules
    const instructions = this.generateInstructions(newRules, failedChecks);

    // Build refined prompt
    const refinedPrompt = this.buildRefinedPrompt(
      originalPrompt,
      instructions,
      fullContext
    );

    // Determine if escalation should also be recommended
    const shouldEscalate =
      fullContext.attemptCount >= this.escalationThreshold &&
      fullContext.currentTier !== 'FRONTIER';

    // Create summary
    const summary = this.createSummary(
      originalPrompt,
      failedChecks,
      newRules,
      fullContext,
      shouldEscalate
    );

    return {
      refined: true,
      prompt: refinedPrompt,
      instructions,
      appliedRules: newRules,
      shouldEscalate,
      suggestedTier: shouldEscalate ? this.getNextTier(fullContext.currentTier) : undefined,
      summary,
    };
  }

  /**
   * Generate refinement instructions from rules and checks
   */
  private generateInstructions(
    rules: RefinementRule[],
    failedChecks: QualityCheck[]
  ): string[] {
    const instructions: string[] = [];

    for (const rule of rules) {
      // Find the corresponding failed check
      const check = failedChecks.find(
        (c) => c.name === rule.checkName || c.name === 'length_within_bounds'
      );

      if (check) {
        const instruction = formatInstruction(rule, check);
        instructions.push(instruction);
      }
    }

    return instructions;
  }

  /**
   * Build the refined prompt with instructions
   */
  private buildRefinedPrompt(
    originalPrompt: string,
    instructions: string[],
    context: RefinementContext
  ): string {
    if (instructions.length === 0) {
      return originalPrompt;
    }

    // Format instructions as a refinement block
    const refinementBlock = [
      '',
      '---',
      `REFINEMENT INSTRUCTIONS (Attempt ${context.attemptCount + 1}/${context.maxAttempts}):`,
      'Please address the following issues in your response:',
      '',
      ...instructions.map((inst, i) => `${i + 1}. ${inst}`),
      '',
      '---',
      '',
    ].join('\n');

    // Append refinement block to original prompt
    return originalPrompt + refinementBlock;
  }

  /**
   * Create result when refinement is skipped
   */
  private createSkipResult(
    originalPrompt: string,
    failedChecks: QualityCheck[],
    context: RefinementContext,
    reason: string
  ): RefinementResult {
    const shouldEscalate = context.currentTier !== 'FRONTIER';

    return {
      refined: false,
      prompt: originalPrompt,
      instructions: [],
      appliedRules: [],
      skipReason: reason,
      shouldEscalate,
      suggestedTier: shouldEscalate ? this.getNextTier(context.currentTier) : undefined,
      summary: this.createSummary(
        originalPrompt,
        failedChecks,
        [],
        context,
        shouldEscalate
      ),
    };
  }

  /**
   * Create result when escalation is recommended
   */
  private createEscalationResult(
    originalPrompt: string,
    failedChecks: QualityCheck[],
    context: RefinementContext,
    reason: string
  ): RefinementResult {
    const shouldEscalate = context.currentTier !== 'FRONTIER';

    return {
      refined: false,
      prompt: originalPrompt,
      instructions: [],
      appliedRules: [],
      skipReason: reason,
      shouldEscalate,
      suggestedTier: shouldEscalate ? this.getNextTier(context.currentTier) : undefined,
      summary: this.createSummary(
        originalPrompt,
        failedChecks,
        [],
        context,
        shouldEscalate
      ),
    };
  }

  /**
   * Create anonymized summary for logging
   */
  private createSummary(
    originalPrompt: string,
    failedChecks: QualityCheck[],
    appliedRules: RefinementRule[],
    context: RefinementContext,
    escalationRecommended: boolean
  ): RefinementSummary {
    // Hash the prompt for tracking without storing content
    const promptHash = crypto
      .createHash('sha256')
      .update(originalPrompt)
      .digest('hex')
      .substring(0, 16);

    // Extract unique categories
    const failedCategories = [
      ...new Set(
        failedChecks
          .filter((c) => !c.passed && c.category)
          .map((c) => c.category!)
      ),
    ];

    return {
      promptHash,
      failedCheckCount: failedChecks.filter((c) => !c.passed).length,
      failedCategories,
      rulesApplied: appliedRules.map((r) => r.checkName),
      attemptNumber: context.attemptCount + 1,
      escalationRecommended,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get the next tier for escalation
   */
  private getNextTier(currentTier: ModelTier): ModelTier {
    const tierOrder: ModelTier[] = ['NANO', 'MINI', 'FRONTIER'];
    const currentIndex = tierOrder.indexOf(currentTier);
    return tierOrder[Math.min(currentIndex + 1, tierOrder.length - 1)];
  }

  /**
   * Check if refinement is possible for given checks
   */
  canRefine(failedChecks: QualityCheck[], context: Partial<RefinementContext> = {}): boolean {
    const attemptCount = context.attemptCount ?? 0;
    const maxAttempts = context.maxAttempts ?? this.maxAttempts;

    if (attemptCount >= maxAttempts) {
      return false;
    }

    const applicableRules = getApplicableRules(failedChecks);
    return applicableRules.length > 0;
  }

  /**
   * Get refinement recommendation without generating prompt
   */
  getRecommendation(
    failedChecks: QualityCheck[],
    context: Partial<RefinementContext> = {}
  ): {
    canRefine: boolean;
    shouldEscalate: boolean;
    suggestedTier?: ModelTier;
    applicableRules: string[];
  } {
    const attemptCount = context.attemptCount ?? 0;
    const currentTier = context.currentTier ?? 'MINI';
    const canRefineResult = this.canRefine(failedChecks, context);
    const applicableRules = getApplicableRules(failedChecks);

    const shouldEscalate =
      !canRefineResult ||
      (attemptCount >= this.escalationThreshold && currentTier !== 'FRONTIER');

    return {
      canRefine: canRefineResult,
      shouldEscalate,
      suggestedTier: shouldEscalate ? this.getNextTier(currentTier) : undefined,
      applicableRules: applicableRules.map((r) => r.checkName),
    };
  }
}

/**
 * Create singleton instance
 */
let defaultInstance: PromptRefinementService | null = null;

export function getPromptRefinementService(): PromptRefinementService {
  if (!defaultInstance) {
    defaultInstance = new PromptRefinementService();
  }
  return defaultInstance;
}

/**
 * Convenience function for one-off refinement
 */
export function refinePrompt(
  originalPrompt: string,
  failedChecks: QualityCheck[],
  context?: Partial<RefinementContext>
): RefinementResult {
  return getPromptRefinementService().refine(originalPrompt, failedChecks, context);
}
