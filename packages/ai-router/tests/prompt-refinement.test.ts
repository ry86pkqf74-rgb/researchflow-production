/**
 * Prompt Refinement Service Tests (Phase 11)
 *
 * Tests for the AI self-improvement prompt refinement system:
 * - Rule application
 * - Instruction generation
 * - Refinement context tracking
 * - Escalation logic
 *
 * Last Updated: 2026-01-23
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PromptRefinementService,
  getPromptRefinementService,
  refinePrompt,
} from '../src/prompt-refinement.service';
import {
  RefinementRule,
  getApplicableRules,
  formatInstruction,
  getRuleByCheckName,
} from '../src/refinement-rules';
import type { QualityCheck } from '../src/types';

describe('RefinementRules', () => {
  describe('getRuleByCheckName', () => {
    it('should find rule for citations_present', () => {
      const rule = getRuleByCheckName('citations_present');
      
      expect(rule).toBeDefined();
      expect(rule?.category).toBe('citations');
      expect(rule?.priority).toBe(90);
    });

    it('should find rule for key_points_covered', () => {
      const rule = getRuleByCheckName('key_points_covered');
      
      expect(rule).toBeDefined();
      expect(rule?.category).toBe('coverage');
      expect(rule?.priority).toBe(95);
    });

    it('should return undefined for unknown check', () => {
      const rule = getRuleByCheckName('unknown_check');
      
      expect(rule).toBeUndefined();
    });
  });

  describe('getApplicableRules', () => {
    it('should return rules for failed checks', () => {
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
        { name: 'key_points_covered', passed: false, severity: 'warning' },
      ];
      
      const rules = getApplicableRules(failedChecks);
      
      expect(rules.length).toBe(2);
      expect(rules[0].checkName).toBe('key_points_covered'); // Higher priority
      expect(rules[1].checkName).toBe('citations_present');
    });

    it('should skip passed checks', () => {
      const checks: QualityCheck[] = [
        { name: 'citations_present', passed: true, severity: 'info' },
        { name: 'key_points_covered', passed: false, severity: 'warning' },
      ];
      
      const rules = getApplicableRules(checks);
      
      expect(rules.length).toBe(1);
      expect(rules[0].checkName).toBe('key_points_covered');
    });

    it('should handle length_within_bounds short case', () => {
      const failedChecks: QualityCheck[] = [
        {
          name: 'length_within_bounds',
          passed: false,
          severity: 'warning',
          details: {
            expected: { min: 100, max: 500 },
            actual: 50,
          },
        },
      ];
      
      const rules = getApplicableRules(failedChecks);
      
      expect(rules.some(r => r.checkName === 'length_within_bounds_short')).toBe(true);
    });

    it('should handle length_within_bounds long case', () => {
      const failedChecks: QualityCheck[] = [
        {
          name: 'length_within_bounds',
          passed: false,
          severity: 'warning',
          details: {
            expected: { min: 100, max: 500 },
            actual: 1000,
          },
        },
      ];
      
      const rules = getApplicableRules(failedChecks);
      
      expect(rules.some(r => r.checkName === 'length_within_bounds_long')).toBe(true);
    });

    it('should sort by priority descending', () => {
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },  // priority 90
        { name: 'no_placeholders', passed: false, severity: 'error' },       // priority 100
        { name: 'key_points_covered', passed: false, severity: 'warning' },  // priority 95
      ];
      
      const rules = getApplicableRules(failedChecks);
      
      expect(rules[0].checkName).toBe('no_placeholders');     // 100
      expect(rules[1].checkName).toBe('key_points_covered'); // 95
      expect(rules[2].checkName).toBe('citations_present');  // 90
    });
  });

  describe('formatInstruction', () => {
    it('should format citation instruction with minCount', () => {
      const rule = getRuleByCheckName('citations_present')!;
      const check: QualityCheck = {
        name: 'citations_present',
        passed: false,
        severity: 'warning',
        details: { expected: 5, actual: 2 },
      };
      
      const instruction = formatInstruction(rule, check);
      
      expect(instruction).toContain('5');
      expect(instruction).toContain('references');
    });

    it('should format key points instruction with missing points', () => {
      const rule = getRuleByCheckName('key_points_covered')!;
      const check: QualityCheck = {
        name: 'key_points_covered',
        passed: false,
        severity: 'warning',
        details: {
          missing: ['results', 'conclusions'],
          found: ['methods'],
        },
      };
      
      const instruction = formatInstruction(rule, check);
      
      expect(instruction).toContain('results');
      expect(instruction).toContain('conclusions');
    });

    it('should format length instruction with target words', () => {
      const rule = getRuleByCheckName('length_within_bounds_short')!;
      const check: QualityCheck = {
        name: 'length_within_bounds',
        passed: false,
        severity: 'warning',
        details: {
          expected: { min: 100, max: 500 },
          actual: 50,
        },
      };
      
      const instruction = formatInstruction(rule, check);
      
      expect(instruction).toContain('300'); // midpoint
      expect(instruction).toContain('Expand');
    });
  });
});

describe('PromptRefinementService', () => {
  let service: PromptRefinementService;

  beforeEach(() => {
    service = new PromptRefinementService({
      maxAttempts: 3,
      escalationThreshold: 2,
    });
  });

  describe('refine', () => {
    it('should generate refined prompt for failed checks', () => {
      const originalPrompt = 'Write about clinical outcomes.';
      const failedChecks: QualityCheck[] = [
        {
          name: 'citations_present',
          passed: false,
          severity: 'warning',
          category: 'citations',
          details: { expected: 3, actual: 0 },
        },
      ];
      
      const result = service.refine(originalPrompt, failedChecks);
      
      expect(result.refined).toBe(true);
      expect(result.prompt).toContain('REFINEMENT INSTRUCTIONS');
      expect(result.prompt).toContain(originalPrompt);
      expect(result.appliedRules.length).toBe(1);
      expect(result.instructions.length).toBe(1);
    });

    it('should not refine when max attempts exceeded', () => {
      const originalPrompt = 'Write about clinical outcomes.';
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
      ];
      
      const result = service.refine(originalPrompt, failedChecks, {
        originalPrompt,
        taskType: 'draft_section',
        currentTier: 'MINI',
        attemptCount: 3, // Already at max
        maxAttempts: 3,
        previousFailures: [],
        appliedRules: [],
      });
      
      expect(result.refined).toBe(false);
      expect(result.skipReason).toContain('Maximum refinement attempts');
      expect(result.shouldEscalate).toBe(true);
    });

    it('should recommend escalation after threshold', () => {
      const originalPrompt = 'Write about clinical outcomes.';
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
      ];
      
      const result = service.refine(originalPrompt, failedChecks, {
        originalPrompt,
        taskType: 'draft_section',
        currentTier: 'MINI',
        attemptCount: 2, // At escalation threshold
        maxAttempts: 3,
        previousFailures: [],
        appliedRules: [],
      });
      
      expect(result.shouldEscalate).toBe(true);
      expect(result.suggestedTier).toBe('FRONTIER');
    });

    it('should not escalate from FRONTIER tier', () => {
      const originalPrompt = 'Write about clinical outcomes.';
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
      ];
      
      const result = service.refine(originalPrompt, failedChecks, {
        originalPrompt,
        taskType: 'draft_section',
        currentTier: 'FRONTIER',
        attemptCount: 2,
        maxAttempts: 3,
        previousFailures: [],
        appliedRules: [],
      });
      
      // Still refines but doesn't suggest escalation
      expect(result.suggestedTier).toBeUndefined();
    });

    it('should track applied rules', () => {
      const originalPrompt = 'Write about clinical outcomes.';
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
        { name: 'key_points_covered', passed: false, severity: 'warning', details: { missing: ['results'] } },
      ];
      
      const result = service.refine(originalPrompt, failedChecks);
      
      expect(result.appliedRules.length).toBe(2);
      expect(result.summary.rulesApplied).toContain('citations_present');
      expect(result.summary.rulesApplied).toContain('key_points_covered');
    });

    it('should create anonymized summary', () => {
      const originalPrompt = 'Sensitive prompt content here.';
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning', category: 'citations' },
      ];
      
      const result = service.refine(originalPrompt, failedChecks);
      
      expect(result.summary.promptHash).toHaveLength(16);
      expect(result.summary.failedCheckCount).toBe(1);
      expect(result.summary.failedCategories).toContain('citations');
      expect(result.summary.timestamp).toBeDefined();
    });

    it('should respect maxApplications for rules', () => {
      const originalPrompt = 'Write content.';
      const failedChecks: QualityCheck[] = [
        { name: 'no_question_marks', passed: false, severity: 'warning' },
      ];
      
      // First attempt
      const result1 = service.refine(originalPrompt, failedChecks, {
        originalPrompt,
        taskType: 'draft_section',
        currentTier: 'MINI',
        attemptCount: 0,
        maxAttempts: 3,
        previousFailures: [],
        appliedRules: ['no_question_marks'], // Already applied once
      });
      
      // no_question_marks has maxApplications: 1, so it shouldn't apply again
      expect(result1.appliedRules.find(r => r.checkName === 'no_question_marks')).toBeUndefined();
    });
  });

  describe('canRefine', () => {
    it('should return true when refinement is possible', () => {
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
      ];
      
      const canRefine = service.canRefine(failedChecks);
      
      expect(canRefine).toBe(true);
    });

    it('should return false when max attempts exceeded', () => {
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
      ];
      
      const canRefine = service.canRefine(failedChecks, {
        attemptCount: 3,
        maxAttempts: 3,
        originalPrompt: '',
        taskType: 'draft_section',
        currentTier: 'MINI',
        previousFailures: [],
        appliedRules: [],
      });
      
      expect(canRefine).toBe(false);
    });

    it('should return false when no applicable rules', () => {
      const failedChecks: QualityCheck[] = [
        { name: 'unknown_check', passed: false, severity: 'warning' },
      ];
      
      const canRefine = service.canRefine(failedChecks);
      
      expect(canRefine).toBe(false);
    });
  });

  describe('getRecommendation', () => {
    it('should provide refinement recommendation', () => {
      const failedChecks: QualityCheck[] = [
        { name: 'citations_present', passed: false, severity: 'warning' },
      ];
      
      const recommendation = service.getRecommendation(failedChecks);
      
      expect(recommendation.canRefine).toBe(true);
      expect(recommendation.applicableRules).toContain('citations_present');
    });

    it('should recommend escalation when no rules available', () => {
      const failedChecks: QualityCheck[] = [
        { name: 'unknown_check', passed: false, severity: 'warning' },
      ];
      
      const recommendation = service.getRecommendation(failedChecks);
      
      expect(recommendation.canRefine).toBe(false);
      expect(recommendation.shouldEscalate).toBe(true);
    });
  });
});

describe('refinePrompt convenience function', () => {
  it('should work as standalone function', () => {
    const originalPrompt = 'Write a summary.';
    const failedChecks: QualityCheck[] = [
      { name: 'citations_present', passed: false, severity: 'warning' },
    ];
    
    const result = refinePrompt(originalPrompt, failedChecks);
    
    expect(result.refined).toBe(true);
    expect(result.prompt).toContain('REFINEMENT INSTRUCTIONS');
  });
});

describe('getPromptRefinementService singleton', () => {
  it('should return same instance', () => {
    const service1 = getPromptRefinementService();
    const service2 = getPromptRefinementService();
    
    expect(service1).toBe(service2);
  });
});
