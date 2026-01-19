/**
 * Claim Verifier Service Tests
 * Tests for AI-powered claim verification against evidence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ClaimVerifierService,
  getClaimVerifier,
  type VerificationContext,
} from '../claim-verifier.service';
import type { ClaimVerificationResult } from '../../types';

// Mock the AI router
const mockRoute = vi.fn();
vi.mock('@researchflow/ai-router', () => ({
  getModelRouter: vi.fn(() => ({
    route: mockRoute,
  })),
}));

describe('ClaimVerifierService', () => {
  let service: ClaimVerifierService;

  beforeEach(() => {
    mockRoute.mockReset();
    service = new ClaimVerifierService();
  });

  describe('verifyClaim', () => {
    it('should verify a claim with supporting evidence', async () => {
      const mockResponse = {
        parsed: {
          verified: true,
          confidence: 0.95,
          supporting_evidence: [
            'Study data shows p < 0.001',
            'Consistent with previous literature',
          ],
          contradicting_evidence: [],
          recommendation: 'accept' as const,
          reasoning: 'Claim is strongly supported by available evidence',
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const context: VerificationContext = {
        studyData: {
          p_value: 0.0001,
          effect_size: 0.8,
        },
      };

      const result = await service.verifyClaim(
        'Treatment showed significant effect',
        context
      );

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.supportingEvidence).toHaveLength(2);
      expect(result.contradictingEvidence).toHaveLength(0);
      expect(result.recommendation).toBe('accept');
      expect(result.reasoning).toBeDefined();
      expect(result.claim).toBe('Treatment showed significant effect');
    });

    it('should flag claim with contradicting evidence', async () => {
      const mockResponse = {
        parsed: {
          verified: false,
          confidence: 0.3,
          supporting_evidence: [],
          contradicting_evidence: [
            'p-value is above significance threshold',
            'Effect size is negligible',
          ],
          recommendation: 'revise' as const,
          reasoning: 'Claim is not supported by the data',
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const context: VerificationContext = {
        studyData: {
          p_value: 0.15,
          effect_size: 0.1,
        },
      };

      const result = await service.verifyClaim(
        'Treatment showed significant effect',
        context
      );

      expect(result.verified).toBe(false);
      expect(result.confidence).toBe(0.3);
      expect(result.contradictingEvidence).toHaveLength(2);
      expect(result.recommendation).toBe('revise');
    });

    it('should recommend citation when evidence is missing', async () => {
      const mockResponse = {
        parsed: {
          verified: false,
          confidence: 0.5,
          supporting_evidence: [],
          contradicting_evidence: [],
          recommendation: 'citation_needed' as const,
          reasoning: 'Claim requires citation support',
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const result = await service.verifyClaim(
        'Previous studies have shown similar results',
        {}
      );

      expect(result.recommendation).toBe('citation_needed');
      expect(result.verified).toBe(false);
    });

    it('should recommend removal for unsupported claims', async () => {
      const mockResponse = {
        parsed: {
          verified: false,
          confidence: 0.1,
          supporting_evidence: [],
          contradicting_evidence: ['Contradicts all available evidence'],
          recommendation: 'remove' as const,
          reasoning: 'Claim is false and should be removed',
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const result = await service.verifyClaim(
        'No adverse effects were observed',
        {
          studyData: { adverse_events: 25, total_participants: 100 },
        }
      );

      expect(result.recommendation).toBe('remove');
      expect(result.verified).toBe(false);
      expect(result.confidence).toBeLessThan(0.2);
    });

    it('should include literature context in verification', async () => {
      const mockResponse = {
        parsed: {
          verified: true,
          confidence: 0.9,
          supporting_evidence: ['Meta-analysis supports this finding'],
          contradicting_evidence: [],
          recommendation: 'accept' as const,
          reasoning: 'Well-supported by literature',
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const context: VerificationContext = {
        literatureContext: 'Meta-analysis of 15 RCTs showed similar effect',
      };

      const result = await service.verifyClaim(
        'Intervention reduces symptoms by 30%',
        context
      );

      expect(result.verified).toBe(true);
      expect(result.supportingEvidence).toContain('Meta-analysis supports this finding');
    });

    it('should use citations in verification', async () => {
      const mockResponse = {
        parsed: {
          verified: true,
          confidence: 0.85,
          supporting_evidence: ['Smith et al. reported similar findings'],
          contradicting_evidence: [],
          recommendation: 'accept' as const,
          reasoning: 'Supported by cited studies',
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const context: VerificationContext = {
        citations: [
          {
            id: 'smith2023',
            title: 'Effects of intervention on symptoms',
            abstract: 'Study found 30% reduction in symptoms',
            findings: ['30% reduction observed', 'p < 0.01'],
          },
        ],
      };

      const result = await service.verifyClaim(
        'Studies report 30% symptom reduction',
        context
      );

      expect(result.verified).toBe(true);
      expect(result.recommendation).toBe('accept');
    });

    it('should throw error if response cannot be parsed', async () => {
      mockRoute.mockResolvedValue({ parsed: null });

      await expect(
        service.verifyClaim('Some claim', {})
      ).rejects.toThrow('Failed to parse verification response');
    });

    it('should handle mixed evidence', async () => {
      const mockResponse = {
        parsed: {
          verified: true,
          confidence: 0.7,
          supporting_evidence: ['Main outcome supports claim', 'Subgroup analysis agrees'],
          contradicting_evidence: ['One secondary outcome contradicts'],
          recommendation: 'revise' as const,
          reasoning: 'Mostly supported but needs qualification',
        },
      };

      mockRoute.mockResolvedValue(mockResponse);

      const result = await service.verifyClaim(
        'Treatment is effective across all outcomes',
        { studyData: { primary_p: 0.01, secondary_p: 0.08 } }
      );

      expect(result.verified).toBe(true);
      expect(result.supportingEvidence).toHaveLength(2);
      expect(result.contradictingEvidence).toHaveLength(1);
      expect(result.recommendation).toBe('revise');
    });
  });

  describe('verifyBatch', () => {
    it('should verify multiple claims in parallel', async () => {
      mockRoute
        .mockResolvedValueOnce({
          parsed: {
            verified: true,
            confidence: 0.9,
            supporting_evidence: ['Evidence 1'],
            contradicting_evidence: [],
            recommendation: 'accept',
            reasoning: 'Supported',
          },
        })
        .mockResolvedValueOnce({
          parsed: {
            verified: false,
            confidence: 0.4,
            supporting_evidence: [],
            contradicting_evidence: ['Contradiction'],
            recommendation: 'revise',
            reasoning: 'Not supported',
          },
        });

      const claims = ['Claim 1', 'Claim 2'];
      const context: VerificationContext = { studyData: {} };

      const results = await service.verifyBatch(claims, context);

      expect(results).toHaveLength(2);
      expect(results[0].verified).toBe(true);
      expect(results[1].verified).toBe(false);
    });

    it('should handle empty claims array', async () => {
      const results = await service.verifyBatch([], {});

      expect(results).toHaveLength(0);
    });

    it('should propagate verification errors', async () => {
      mockRoute.mockResolvedValue({ parsed: null });

      await expect(service.verifyBatch(['Claim 1'], {})).rejects.toThrow(
        'Failed to parse verification response'
      );
    });
  });

  describe('extractClaims', () => {
    it('should extract claims from text', async () => {
      const mockResponse = {
        parsed: [
          'Treatment reduced symptoms by 30%',
          'No adverse effects were observed',
          'Results were statistically significant',
        ],
      };

      mockRoute.mockResolvedValue(mockResponse);

      const text = `
        In our study, treatment reduced symptoms by 30%.
        No adverse effects were observed during the trial.
        Results were statistically significant (p < 0.001).
      `;

      const claims = await service.extractClaims(text);

      expect(claims).toHaveLength(3);
      expect(claims[0]).toContain('Treatment reduced symptoms');
      expect(claims[1]).toContain('No adverse effects');
      expect(claims[2]).toContain('statistically significant');
    });

    it('should handle text with no claims', async () => {
      const mockResponse = {
        parsed: [],
      };

      mockRoute.mockResolvedValue(mockResponse);

      const text = 'This is a methods description with no factual claims.';
      const claims = await service.extractClaims(text);

      expect(claims).toHaveLength(0);
    });

    it('should throw error if response is not an array', async () => {
      mockRoute.mockResolvedValue({ parsed: { invalid: 'format' } });

      await expect(service.extractClaims('Some text')).rejects.toThrow(
        'Failed to extract claims'
      );
    });

    it('should throw error if parsing fails', async () => {
      mockRoute.mockResolvedValue({ parsed: null });

      await expect(service.extractClaims('Some text')).rejects.toThrow(
        'Failed to extract claims'
      );
    });
  });

  describe('verifySection', () => {
    it('should extract and verify all claims in section', async () => {
      // Mock extractClaims
      mockRoute.mockResolvedValueOnce({
        parsed: ['Claim 1', 'Claim 2'],
      });

      // Mock verifyClaim for first claim
      mockRoute.mockResolvedValueOnce({
        parsed: {
          verified: true,
          confidence: 0.9,
          supporting_evidence: ['Evidence'],
          contradicting_evidence: [],
          recommendation: 'accept',
          reasoning: 'Supported',
        },
      });

      // Mock verifyClaim for second claim
      mockRoute.mockResolvedValueOnce({
        parsed: {
          verified: false,
          confidence: 0.5,
          supporting_evidence: [],
          contradicting_evidence: ['Contradiction'],
          recommendation: 'revise',
          reasoning: 'Not supported',
        },
      });

      const text = 'Section with claims about the study results.';
      const context: VerificationContext = { studyData: {} };

      const result = await service.verifySection(text, context);

      expect(result.claims).toHaveLength(2);
      expect(result.flaggedClaims).toBe(1);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThan(1);
    });

    it('should calculate correct overall score', async () => {
      // Mock extractClaims
      mockRoute.mockResolvedValueOnce({
        parsed: ['Claim 1', 'Claim 2'],
      });

      // Both claims verified with high confidence
      mockRoute.mockResolvedValue({
        parsed: {
          verified: true,
          confidence: 0.9,
          supporting_evidence: ['Evidence'],
          contradicting_evidence: [],
          recommendation: 'accept',
          reasoning: 'Supported',
        },
      });

      const result = await service.verifySection('Text', {});

      expect(result.claims).toHaveLength(2);
      expect(result.flaggedClaims).toBe(0);
      expect(result.overallScore).toBeCloseTo(0.9, 1);
    });

    it('should handle section with no claims', async () => {
      mockRoute.mockResolvedValueOnce({
        parsed: [],
      });

      const result = await service.verifySection('Methods section', {});

      expect(result.claims).toHaveLength(0);
      expect(result.flaggedClaims).toBe(0);
      expect(result.overallScore).toBe(0);
    });

    it('should count flagged claims correctly', async () => {
      // Mock extractClaims
      mockRoute.mockResolvedValueOnce({
        parsed: ['Claim 1', 'Claim 2', 'Claim 3'],
      });

      // Claim 1: accept
      mockRoute.mockResolvedValueOnce({
        parsed: {
          verified: true,
          confidence: 0.9,
          supporting_evidence: [],
          contradicting_evidence: [],
          recommendation: 'accept',
          reasoning: 'OK',
        },
      });

      // Claim 2: revise (flagged)
      mockRoute.mockResolvedValueOnce({
        parsed: {
          verified: true,
          confidence: 0.7,
          supporting_evidence: [],
          contradicting_evidence: [],
          recommendation: 'revise',
          reasoning: 'Needs revision',
        },
      });

      // Claim 3: remove (flagged)
      mockRoute.mockResolvedValueOnce({
        parsed: {
          verified: false,
          confidence: 0.3,
          supporting_evidence: [],
          contradicting_evidence: [],
          recommendation: 'remove',
          reasoning: 'Unsupported',
        },
      });

      const result = await service.verifySection('Text', {});

      expect(result.flaggedClaims).toBe(2);
    });
  });

  describe('generateReport', () => {
    it('should generate report for verified claims', () => {
      const results: ClaimVerificationResult[] = [
        {
          claim: 'Treatment was effective',
          verified: true,
          confidence: 0.95,
          supportingEvidence: ['Study data supports this'],
          contradictingEvidence: [],
          recommendation: 'accept',
          reasoning: 'Well-supported by data',
        },
        {
          claim: 'No side effects occurred',
          verified: true,
          confidence: 0.9,
          supportingEvidence: ['Adverse events log was empty'],
          contradictingEvidence: [],
          recommendation: 'accept',
          reasoning: 'Confirmed by safety data',
        },
      ];

      const report = service.generateReport(results);

      expect(report).toContain('Claim Verification Report');
      expect(report).toContain('Total Claims: 2');
      expect(report).toContain('Verified: 2');
      expect(report).toContain('Needs Attention: 0');
      expect(report).toContain('Should Remove: 0');
      expect(report).toContain('Treatment was effective');
      expect(report).toContain('Verified');
      expect(report).toContain('95.0%');
    });

    it('should report claims needing attention', () => {
      const results: ClaimVerificationResult[] = [
        {
          claim: 'Claim needs revision',
          verified: false,
          confidence: 0.6,
          supportingEvidence: [],
          contradictingEvidence: ['Some contradiction'],
          recommendation: 'revise',
          reasoning: 'Needs qualification',
        },
        {
          claim: 'Claim needs citation',
          verified: false,
          confidence: 0.5,
          supportingEvidence: [],
          contradictingEvidence: [],
          recommendation: 'citation_needed',
          reasoning: 'Needs supporting citation',
        },
      ];

      const report = service.generateReport(results);

      expect(report).toContain('Needs Attention: 2');
      expect(report).toContain('Should Remove: 0');
      expect(report).toContain('REVISE');
      expect(report).toContain('CITATION_NEEDED');
    });

    it('should report claims to be removed', () => {
      const results: ClaimVerificationResult[] = [
        {
          claim: 'False claim',
          verified: false,
          confidence: 0.1,
          supportingEvidence: [],
          contradictingEvidence: ['Contradicts all evidence'],
          recommendation: 'remove',
          reasoning: 'Claim is false',
        },
      ];

      const report = service.generateReport(results);

      expect(report).toContain('Should Remove: 1');
      expect(report).toContain('REMOVE');
      expect(report).toContain('False claim');
    });

    it('should include supporting and contradicting evidence', () => {
      const results: ClaimVerificationResult[] = [
        {
          claim: 'Mixed evidence claim',
          verified: true,
          confidence: 0.7,
          supportingEvidence: ['Supporting point 1', 'Supporting point 2'],
          contradictingEvidence: ['Contradicting point 1'],
          recommendation: 'revise',
          reasoning: 'Partial support',
        },
      ];

      const report = service.generateReport(results);

      expect(report).toContain('Supporting Evidence:');
      expect(report).toContain('Supporting point 1');
      expect(report).toContain('Supporting point 2');
      expect(report).toContain('Contradicting Evidence:');
      expect(report).toContain('Contradicting point 1');
    });

    it('should handle empty results array', () => {
      const report = service.generateReport([]);

      expect(report).toContain('Total Claims: 0');
      expect(report).toContain('Verified: 0');
      expect(report).toContain('Needs Attention: 0');
      expect(report).toContain('Should Remove: 0');
    });

    it('should number claims sequentially', () => {
      const results: ClaimVerificationResult[] = [
        {
          claim: 'First claim',
          verified: true,
          confidence: 0.9,
          supportingEvidence: [],
          contradictingEvidence: [],
          recommendation: 'accept',
          reasoning: 'OK',
        },
        {
          claim: 'Second claim',
          verified: true,
          confidence: 0.85,
          supportingEvidence: [],
          contradictingEvidence: [],
          recommendation: 'accept',
          reasoning: 'OK',
        },
      ];

      const report = service.generateReport(results);

      expect(report).toMatch(/1\.\s+"First claim"/);
      expect(report).toMatch(/2\.\s+"Second claim"/);
    });
  });

  describe('getClaimVerifier - Singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getClaimVerifier();
      const instance2 = getClaimVerifier();

      expect(instance1).toBe(instance2);
    });

    it('should return ClaimVerifierService instance', () => {
      const instance = getClaimVerifier();

      expect(instance).toBeInstanceOf(ClaimVerifierService);
    });
  });
});
