/**
 * Grammar Checker Service Tests
 * Tests for AI-powered grammar and style checking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GrammarCheckerService,
  getGrammarChecker,
} from '../grammar-checker.service';
import type { GrammarCheckResult, GrammarIssue } from '../../types';

// Mock the AI router
const mockRoute = vi.fn();
vi.mock('@researchflow/ai-router', () => ({
  getModelRouter: vi.fn(() => ({
    route: mockRoute,
  })),
}));

describe('GrammarCheckerService', () => {
  let service: GrammarCheckerService;

  beforeEach(() => {
    mockRoute.mockReset();
    service = new GrammarCheckerService();
  });

  describe('checkGrammar', () => {
    it('should check grammar and return result', async () => {
      const mockResponse = {
        parsed: {
          issues: [
            {
              message: 'Passive voice detected',
              shortMessage: 'Passive voice',
              offset: 10,
              length: 15,
              severity: 'warning' as const,
              category: 'style',
              rule: 'passive_voice',
              suggestions: ['were conducted', 'conducted'],
              context: {
                text: 'Studies were performed by researchers',
                offset: 0,
                length: 37,
              },
            },
          ],
          correctedText: 'Researchers conducted studies.',
          score: 85,
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const result = await service.checkGrammar('Studies were performed by researchers');

      expect(result.passed).toBe(true); // No errors, only warnings
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('warning');
      expect(result.correctedText).toBe('Researchers conducted studies.');
      expect(result.score).toBe(85);
    });

    it('should fail when errors are present', async () => {
      const mockResponse = {
        parsed: {
          issues: [
            {
              message: 'Subject-verb disagreement',
              offset: 5,
              length: 10,
              severity: 'error' as const,
              category: 'grammar',
              rule: 'subject_verb_agreement',
              suggestions: ['are'],
              context: {
                text: 'The data is incomplete',
                offset: 0,
                length: 22,
              },
            },
          ],
          correctedText: 'The data are incomplete.',
          score: 60,
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const result = await service.checkGrammar('The data is incomplete');

      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('error');
    });

    it('should pass with clean text', async () => {
      const mockResponse = {
        parsed: {
          issues: [],
          correctedText: 'This is a well-written sentence.',
          score: 100,
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const result = await service.checkGrammar('This is a well-written sentence.');

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBe(100);
    });

    it('should throw error if response cannot be parsed', async () => {
      mockRoute.mockResolvedValue({ parsed: null });

      await expect(
        service.checkGrammar('Some text')
      ).rejects.toThrow('Failed to parse grammar check response');
    });

    it('should handle multiple issues of different severities', async () => {
      const mockResponse = {
        parsed: {
          issues: [
            {
              message: 'Grammar error',
              offset: 0,
              length: 5,
              severity: 'error' as const,
              category: 'grammar',
              rule: 'rule1',
              suggestions: ['fix1'],
              context: { text: 'context1', offset: 0, length: 10 },
            },
            {
              message: 'Style warning',
              offset: 10,
              length: 5,
              severity: 'warning' as const,
              category: 'style',
              rule: 'rule2',
              suggestions: ['fix2'],
              context: { text: 'context2', offset: 5, length: 15 },
            },
            {
              message: 'Info suggestion',
              offset: 20,
              length: 5,
              severity: 'info' as const,
              category: 'clarity',
              rule: 'rule3',
              suggestions: ['fix3'],
              context: { text: 'context3', offset: 15, length: 20 },
            },
          ],
          correctedText: 'Corrected text',
          score: 70,
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const result = await service.checkGrammar('Some problematic text');

      expect(result.passed).toBe(false); // Has errors
      expect(result.issues).toHaveLength(3);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(1);
      expect(result.issues.filter((i) => i.severity === 'warning')).toHaveLength(1);
      expect(result.issues.filter((i) => i.severity === 'info')).toHaveLength(1);
    });
  });

  describe('checkAspect', () => {
    it('should check passive voice aspect', async () => {
      const mockResponse = {
        parsed: [
          {
            message: 'Passive voice detected here',
            offset: 0,
            length: 20,
            severity: 'warning' as const,
            category: 'passive_voice',
            rule: 'passive_voice_rule',
            suggestions: ['Active voice alternative'],
            context: { text: 'was analyzed by the team', offset: 0, length: 24 },
          },
        ],
      };

      mockRoute.mockResolvedValue(mockResponse);

      const issues = await service.checkAspect('Data was analyzed by the team', 'passive_voice');

      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('passive_voice');
      expect(issues[0].message).toContain('Passive voice');
    });

    it('should check word choice aspect', async () => {
      const mockResponse = {
        parsed: [
          {
            message: 'Use more precise medical terminology',
            offset: 10,
            length: 5,
            severity: 'info' as const,
            category: 'word_choice',
            rule: 'word_precision',
            suggestions: ['administered', 'prescribed'],
            context: { text: 'Patients given medication', offset: 5, length: 20 },
          },
        ],
      };

      mockRoute.mockResolvedValue(mockResponse);

      const issues = await service.checkAspect('Patients given medication', 'word_choice');

      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('word_choice');
      expect(issues[0].suggestions).toContain('administered');
    });

    it('should check sentence structure aspect', async () => {
      const mockResponse = {
        parsed: [
          {
            message: 'Sentence is too complex',
            offset: 0,
            length: 50,
            severity: 'warning' as const,
            category: 'sentence_structure',
            rule: 'complexity',
            suggestions: ['Split into two sentences'],
            context: { text: 'Long complex sentence here...', offset: 0, length: 50 },
          },
        ],
      };

      mockRoute.mockResolvedValue(mockResponse);

      const issues = await service.checkAspect(
        'This is a very long and complex sentence that should be split',
        'sentence_structure'
      );

      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('sentence_structure');
    });

    it('should check punctuation aspect', async () => {
      const mockResponse = {
        parsed: [
          {
            message: 'Missing comma',
            offset: 15,
            length: 0,
            severity: 'error' as const,
            category: 'punctuation',
            rule: 'comma_missing',
            suggestions: [','],
            context: { text: 'However the results', offset: 10, length: 19 },
          },
        ],
      };

      mockRoute.mockResolvedValue(mockResponse);

      const issues = await service.checkAspect('However the results showed', 'punctuation');

      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('punctuation');
      expect(issues[0].severity).toBe('error');
    });

    it('should return empty array if parsing fails', async () => {
      mockRoute.mockResolvedValue({ parsed: null });

      const issues = await service.checkAspect('Some text', 'passive_voice');

      expect(issues).toEqual([]);
    });

    it('should return empty array if parsed result is not an array', async () => {
      mockRoute.mockResolvedValue({ parsed: { invalid: 'format' } });

      const issues = await service.checkAspect('Some text', 'word_choice');

      expect(issues).toEqual([]);
    });
  });

  describe('applyCorrections', () => {
    it('should apply single correction', async () => {
      const text = 'The data is incomplete';
      const issues: GrammarIssue[] = [
        {
          message: 'Subject-verb disagreement',
          offset: 9,
          length: 2,
          severity: 'error',
          category: 'grammar',
          rule: 'subject_verb_agreement',
          suggestions: ['are'],
          context: { text: 'data is', offset: 5, length: 7 },
        },
      ];

      const corrected = await service.applyCorrections(text, issues);

      expect(corrected).toBe('The data are incomplete');
    });

    it('should apply multiple corrections in correct order', async () => {
      const text = 'The data is analyzed and the results is shown';
      const issues: GrammarIssue[] = [
        {
          message: 'Error 1',
          offset: 9,
          length: 2,
          severity: 'error',
          category: 'grammar',
          rule: 'rule1',
          suggestions: ['are'],
          context: { text: '', offset: 0, length: 0 },
        },
        {
          message: 'Error 2',
          offset: 37,
          length: 2,
          severity: 'error',
          category: 'grammar',
          rule: 'rule2',
          suggestions: ['are'],
          context: { text: '', offset: 0, length: 0 },
        },
      ];

      const corrected = await service.applyCorrections(text, issues);

      expect(corrected).toBe('The data are analyzed and the results are shown');
    });

    it('should handle issues without suggestions', async () => {
      const text = 'Original text';
      const issues: GrammarIssue[] = [
        {
          message: 'Issue without suggestion',
          offset: 0,
          length: 5,
          severity: 'info',
          category: 'style',
          rule: 'rule1',
          suggestions: [],
          context: { text: '', offset: 0, length: 0 },
        },
      ];

      const corrected = await service.applyCorrections(text, issues);

      expect(corrected).toBe('Original text'); // Unchanged
    });

    it('should apply corrections at beginning of text', async () => {
      const text = 'bad start of sentence';
      const issues: GrammarIssue[] = [
        {
          message: 'Capitalize',
          offset: 0,
          length: 3,
          severity: 'error',
          category: 'grammar',
          rule: 'capitalization',
          suggestions: ['Bad'],
          context: { text: '', offset: 0, length: 0 },
        },
      ];

      const corrected = await service.applyCorrections(text, issues);

      expect(corrected).toBe('Bad start of sentence');
    });

    it('should apply corrections at end of text', async () => {
      const text = 'Sentence without period';
      const issues: GrammarIssue[] = [
        {
          message: 'Add period',
          offset: 23,
          length: 0,
          severity: 'error',
          category: 'punctuation',
          rule: 'period_missing',
          suggestions: ['.'],
          context: { text: '', offset: 0, length: 0 },
        },
      ];

      const corrected = await service.applyCorrections(text, issues);

      expect(corrected).toBe('Sentence without period.');
    });

    it('should handle empty issues array', async () => {
      const text = 'Original text';
      const issues: GrammarIssue[] = [];

      const corrected = await service.applyCorrections(text, issues);

      expect(corrected).toBe('Original text');
    });
  });

  describe('getGrammarStats', () => {
    it('should count issues by severity', () => {
      const result: GrammarCheckResult = {
        passed: false,
        issues: [
          {
            message: 'Error 1',
            offset: 0,
            length: 5,
            severity: 'error',
            category: 'grammar',
            rule: 'rule1',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Error 2',
            offset: 10,
            length: 5,
            severity: 'error',
            category: 'grammar',
            rule: 'rule2',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Warning 1',
            offset: 20,
            length: 5,
            severity: 'warning',
            category: 'style',
            rule: 'rule3',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Info 1',
            offset: 30,
            length: 5,
            severity: 'info',
            category: 'clarity',
            rule: 'rule4',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
        ],
        correctedText: '',
        score: 60,
      };

      const stats = service.getGrammarStats(result);

      expect(stats.errorCount).toBe(2);
      expect(stats.warningCount).toBe(1);
      expect(stats.infoCount).toBe(1);
    });

    it('should count issues by category', () => {
      const result: GrammarCheckResult = {
        passed: false,
        issues: [
          {
            message: 'Grammar 1',
            offset: 0,
            length: 5,
            severity: 'error',
            category: 'grammar',
            rule: 'rule1',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Grammar 2',
            offset: 10,
            length: 5,
            severity: 'error',
            category: 'grammar',
            rule: 'rule2',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Style 1',
            offset: 20,
            length: 5,
            severity: 'warning',
            category: 'style',
            rule: 'rule3',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Clarity 1',
            offset: 30,
            length: 5,
            severity: 'info',
            category: 'clarity',
            rule: 'rule4',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
        ],
        correctedText: '',
        score: 60,
      };

      const stats = service.getGrammarStats(result);

      expect(stats.byCategory['grammar']).toBe(2);
      expect(stats.byCategory['style']).toBe(1);
      expect(stats.byCategory['clarity']).toBe(1);
    });

    it('should handle empty issues array', () => {
      const result: GrammarCheckResult = {
        passed: true,
        issues: [],
        correctedText: 'Perfect text',
        score: 100,
      };

      const stats = service.getGrammarStats(result);

      expect(stats.errorCount).toBe(0);
      expect(stats.warningCount).toBe(0);
      expect(stats.infoCount).toBe(0);
      expect(Object.keys(stats.byCategory)).toHaveLength(0);
    });
  });

  describe('generateReport', () => {
    it('should generate report for passed result', () => {
      const result: GrammarCheckResult = {
        passed: true,
        issues: [],
        correctedText: 'Perfect text',
        score: 100,
      };

      const report = service.generateReport(result);

      expect(report).toContain('Grammar Check Report');
      expect(report).toContain('Score: 100/100');
      expect(report).toContain('Status: PASSED');
      expect(report).toContain('Errors: 0');
      expect(report).toContain('Warnings: 0');
      expect(report).toContain('Suggestions: 0');
    });

    it('should generate report for failed result', () => {
      const result: GrammarCheckResult = {
        passed: false,
        issues: [
          {
            message: 'Subject-verb disagreement',
            offset: 5,
            length: 2,
            severity: 'error',
            category: 'grammar',
            rule: 'rule1',
            suggestions: ['are'],
            context: { text: '', offset: 0, length: 0 },
          },
        ],
        correctedText: 'Fixed text',
        score: 75,
      };

      const report = service.generateReport(result);

      expect(report).toContain('Score: 75/100');
      expect(report).toContain('Status: NEEDS ATTENTION');
      expect(report).toContain('Errors: 1');
      expect(report).toContain('Subject-verb disagreement');
      expect(report).toContain('Position: 5-7');
      expect(report).toContain('Severity: error');
      expect(report).toContain('Suggestions: are');
    });

    it('should include category breakdown', () => {
      const result: GrammarCheckResult = {
        passed: false,
        issues: [
          {
            message: 'Grammar error',
            offset: 0,
            length: 5,
            severity: 'error',
            category: 'grammar',
            rule: 'rule1',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Style warning',
            offset: 10,
            length: 5,
            severity: 'warning',
            category: 'style',
            rule: 'rule2',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Another grammar error',
            offset: 20,
            length: 5,
            severity: 'error',
            category: 'grammar',
            rule: 'rule3',
            suggestions: [],
            context: { text: '', offset: 0, length: 0 },
          },
        ],
        correctedText: '',
        score: 60,
      };

      const report = service.generateReport(result);

      expect(report).toContain('Issues by Category:');
      expect(report).toContain('grammar: 2');
      expect(report).toContain('style: 1');
    });

    it('should list all detailed issues', () => {
      const result: GrammarCheckResult = {
        passed: false,
        issues: [
          {
            message: 'First issue',
            offset: 0,
            length: 5,
            severity: 'error',
            category: 'grammar',
            rule: 'rule1',
            suggestions: ['fix1'],
            context: { text: '', offset: 0, length: 0 },
          },
          {
            message: 'Second issue',
            offset: 10,
            length: 8,
            severity: 'warning',
            category: 'style',
            rule: 'rule2',
            suggestions: ['fix2a', 'fix2b'],
            context: { text: '', offset: 0, length: 0 },
          },
        ],
        correctedText: '',
        score: 70,
      };

      const report = service.generateReport(result);

      expect(report).toContain('Detailed Issues:');
      expect(report).toContain('1. First issue');
      expect(report).toContain('Position: 0-5');
      expect(report).toContain('Suggestions: fix1');
      expect(report).toContain('2. Second issue');
      expect(report).toContain('Position: 10-18');
      expect(report).toContain('Suggestions: fix2a, fix2b');
    });
  });

  describe('getGrammarChecker - Singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getGrammarChecker();
      const instance2 = getGrammarChecker();

      expect(instance1).toBe(instance2);
    });

    it('should return GrammarCheckerService instance', () => {
      const instance = getGrammarChecker();

      expect(instance).toBeInstanceOf(GrammarCheckerService);
    });
  });
});
