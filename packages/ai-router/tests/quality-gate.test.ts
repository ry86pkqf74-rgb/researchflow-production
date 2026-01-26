/**
 * Quality Gate Service Tests (Phase 11)
 *
 * Tests for the enhanced quality checks including:
 * - Citation detection
 * - Key points coverage
 * - Question mark detection
 * - Length validation
 * - Placeholder detection
 *
 * Last Updated: 2026-01-23
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService } from '../src/quality-gate.service';

describe('QualityGateService', () => {
  let service: QualityGateService;

  beforeEach(() => {
    service = new QualityGateService();
  });

  describe('checkCitationsPresent', () => {
    it('should detect numbered citations [1], [2]', () => {
      const content = 'The study showed significant results [1]. Previous work [2] confirmed this.';
      const result = service.checkCitationsPresent(content, 2);
      
      expect(result.passed).toBe(true);
      expect(result.category).toBe('citations');
      expect(result.details?.actual).toBe(2);
    });

    it('should detect author citations (Smith, 2024)', () => {
      const content = 'According to Smith (2024), the findings were clear. Jones et al. (2023) agreed.';
      const result = service.checkCitationsPresent(content, 2);
      
      expect(result.passed).toBe(true);
      expect(result.details?.actual).toBeGreaterThanOrEqual(2);
    });

    it('should fail when insufficient citations', () => {
      const content = 'This is content without any citations.';
      const result = service.checkCitationsPresent(content, 3);
      
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('expected at least 3');
    });

    it('should detect DOI references', () => {
      const content = 'See doi:10.1234/example.2024 for details.';
      const result = service.checkCitationsPresent(content, 1);
      
      expect(result.passed).toBe(true);
    });

    it('should handle range citations [1-5]', () => {
      const content = 'Multiple studies [1-5] support this conclusion.';
      const result = service.checkCitationsPresent(content, 1);
      
      expect(result.passed).toBe(true);
    });
  });

  describe('checkKeyPointsCovered', () => {
    it('should pass when all key points are covered', () => {
      const content = 'The methods section describes our approach. The results show clear outcomes. Our conclusions are supported by the data.';
      const keyPoints = ['methods', 'results', 'conclusions'];
      const result = service.checkKeyPointsCovered(content, keyPoints);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.category).toBe('coverage');
    });

    it('should fail when key points are missing', () => {
      const content = 'The methods section describes our approach.';
      const keyPoints = ['methods', 'results', 'conclusions'];
      const result = service.checkKeyPointsCovered(content, keyPoints);
      
      expect(result.passed).toBe(false);
      expect(result.details?.missing).toContain('results');
      expect(result.details?.missing).toContain('conclusions');
      expect(result.score).toBeCloseTo(1/3, 2);
    });

    it('should be case-insensitive by default', () => {
      const content = 'METHODS were used to analyze RESULTS.';
      const keyPoints = ['methods', 'results'];
      const result = service.checkKeyPointsCovered(content, keyPoints, false);
      
      expect(result.passed).toBe(true);
    });

    it('should handle multi-word key points', () => {
      const content = 'The statistical analysis revealed important findings.';
      const keyPoints = ['statistical analysis'];
      const result = service.checkKeyPointsCovered(content, keyPoints);
      
      expect(result.passed).toBe(true);
    });

    it('should return passed for empty key points array', () => {
      const content = 'Any content here.';
      const result = service.checkKeyPointsCovered(content, []);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
    });
  });

  describe('checkNoQuestionMarks', () => {
    it('should pass when no question marks present', () => {
      const content = 'This is a definitive statement. The results are clear.';
      const result = service.checkNoQuestionMarks(content);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.category).toBe('confidence');
    });

    it('should fail when question marks are present', () => {
      const content = 'Is this correct? Should we consider alternatives?';
      const result = service.checkNoQuestionMarks(content);
      
      expect(result.passed).toBe(false);
      expect(result.details?.actual).toBe(2);
      expect(result.severity).toBe('warning'); // Not blocking
    });

    it('should reduce score by 0.1 per question mark', () => {
      const content = 'Question one? Question two? Question three?';
      const result = service.checkNoQuestionMarks(content);
      
      expect(result.score).toBeCloseTo(0.7, 1);
    });
  });

  describe('checkLengthWithinBounds', () => {
    it('should pass when within bounds', () => {
      const content = 'One two three four five six seven eight nine ten.';
      const result = service.checkLengthWithinBounds(content, 5, 15);
      
      expect(result.passed).toBe(true);
      expect(result.category).toBe('length');
    });

    it('should fail when too short', () => {
      const content = 'Too short.';
      const result = service.checkLengthWithinBounds(content, 50, 200);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('too short');
      expect(result.details?.actual).toBeLessThan(50);
    });

    it('should fail when too long', () => {
      const content = 'word '.repeat(100);
      const result = service.checkLengthWithinBounds(content, 10, 50);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('too long');
    });

    it('should handle edge case at exact min', () => {
      const content = 'one two three four five';
      const result = service.checkLengthWithinBounds(content, 5, 10);
      
      expect(result.passed).toBe(true);
    });
  });

  describe('checkNoPlaceholders', () => {
    it('should pass when no placeholders present', () => {
      const content = 'This is complete content with no missing parts.';
      const result = service.checkNoPlaceholders(content);
      
      expect(result.passed).toBe(true);
      expect(result.category).toBe('completeness');
    });

    it('should detect [TODO] placeholders', () => {
      const content = 'The introduction is complete. [TODO: Add conclusion]';
      const result = service.checkNoPlaceholders(content);
      
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.details?.found).toContain('[TODO: Add conclusion]');
    });

    it('should detect TBD placeholders', () => {
      const content = 'Results are TBD pending analysis.';
      const result = service.checkNoPlaceholders(content);
      
      expect(result.passed).toBe(false);
    });

    it('should detect XXX placeholders', () => {
      const content = 'Value is XXX until confirmed.';
      const result = service.checkNoPlaceholders(content);
      
      expect(result.passed).toBe(false);
    });

    it('should detect [INSERT] placeholders', () => {
      const content = 'See Figure [INSERT FIGURE NUMBER] for details.';
      const result = service.checkNoPlaceholders(content);
      
      expect(result.passed).toBe(false);
    });

    it('should detect <PLACEHOLDER> style', () => {
      const content = 'Replace <YOUR_NAME> with actual name.';
      const result = service.checkNoPlaceholders(content);
      
      expect(result.passed).toBe(false);
    });
  });

  describe('validateNarrativeContent', () => {
    it('should run multiple checks based on options', () => {
      const content = 'The study found significant results [1]. Methods included analysis. Results show improvement.';
      const checks = service.validateNarrativeContent(content, {
        minCitations: 1,
        keyPoints: ['methods', 'results'],
        minWords: 5,
        maxWords: 50,
        checkPlaceholders: true,
      });
      
      expect(checks.length).toBeGreaterThanOrEqual(3);
      expect(checks.every(c => c.passed)).toBe(true);
    });

    it('should report all failures', () => {
      const content = 'Short [TODO].';
      const checks = service.validateNarrativeContent(content, {
        minCitations: 3,
        keyPoints: ['methods', 'results'],
        minWords: 100,
        checkPlaceholders: true,
      });
      
      const failedChecks = checks.filter(c => !c.passed);
      expect(failedChecks.length).toBeGreaterThanOrEqual(3);
    });

    it('should skip optional checks when not specified', () => {
      const content = 'Simple content without citations?';
      const checks = service.validateNarrativeContent(content, {
        checkPlaceholders: true,
        checkQuestionMarks: false,
      });
      
      // Should only have placeholder check
      const questionCheck = checks.find(c => c.name === 'no_question_marks');
      expect(questionCheck).toBeUndefined();
    });
  });

  describe('validate (existing method)', () => {
    it('should validate basic content checks', () => {
      const result = service.validate('Valid content here', 'summarize', 'text');
      
      expect(result.passed).toBe(true);
      expect(result.checks.some(c => c.name === 'not_empty')).toBe(true);
    });

    it('should fail for empty content', () => {
      const result = service.validate('', 'summarize', 'text');
      
      expect(result.passed).toBe(false);
      expect(result.checks.find(c => c.name === 'not_empty')?.passed).toBe(false);
    });

    it('should validate JSON format when required', () => {
      const validJson = '{"key": "value"}';
      const result = service.validate(validJson, 'classify', 'json');
      
      expect(result.checks.find(c => c.name === 'valid_json')?.passed).toBe(true);
    });

    it('should fail for invalid JSON when required', () => {
      const invalidJson = '{key: value}';
      const result = service.validate(invalidJson, 'classify', 'json');
      
      expect(result.checks.find(c => c.name === 'valid_json')?.passed).toBe(false);
    });
  });
});
