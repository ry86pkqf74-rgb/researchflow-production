/**
 * Claim Verifier Service
 *
 * Verifies claims against provided data and literature context.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { ClaimVerificationResult } from '../types';

export interface VerificationContext {
  studyData?: Record<string, unknown>;
  literatureContext?: string;
  citations?: Array<{
    id: string;
    title: string;
    abstract?: string;
    findings?: string[];
  }>;
}

export class ClaimVerifierService {
  private router = getModelRouter();

  /**
   * Verify a claim against available evidence
   */
  async verifyClaim(
    claim: string,
    context: VerificationContext
  ): Promise<ClaimVerificationResult> {
    const prompt = this.buildVerificationPrompt(claim, context);

    const request: AIRouterRequest = {
      taskType: 'protocol_reasoning',
      prompt,
      systemPrompt:
        'You are an expert medical researcher specializing in evidence verification. Assess claims against available data and literature with scientific rigor.',
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.2,
      forceTier: 'FRONTIER', // Use frontier model for complex verification
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse verification response');
    }

    const result = response.parsed as {
      verified: boolean;
      confidence: number;
      supporting_evidence: string[];
      contradicting_evidence: string[];
      recommendation: 'accept' | 'revise' | 'citation_needed' | 'remove';
      reasoning: string;
    };

    return {
      claim,
      verified: result.verified,
      confidence: result.confidence,
      supportingEvidence: result.supporting_evidence,
      contradictingEvidence: result.contradicting_evidence,
      recommendation: result.recommendation,
      reasoning: result.reasoning,
    };
  }

  /**
   * Build verification prompt with context
   */
  private buildVerificationPrompt(claim: string, context: VerificationContext): string {
    let prompt = `Verify the following claim against the available evidence:\n\nClaim: "${claim}"\n\n`;

    if (context.studyData && Object.keys(context.studyData).length > 0) {
      prompt += `Study Data:\n${JSON.stringify(context.studyData, null, 2)}\n\n`;
    }

    if (context.literatureContext) {
      prompt += `Literature Context:\n${context.literatureContext}\n\n`;
    }

    if (context.citations && context.citations.length > 0) {
      prompt += `Available Citations:\n`;
      context.citations.forEach((citation, i) => {
        prompt += `\n${i + 1}. ${citation.title}\n`;
        if (citation.abstract) {
          prompt += `   Abstract: ${citation.abstract}\n`;
        }
        if (citation.findings && citation.findings.length > 0) {
          prompt += `   Key Findings:\n`;
          citation.findings.forEach((finding) => {
            prompt += `   - ${finding}\n`;
          });
        }
      });
      prompt += `\n`;
    }

    prompt += `Please analyze this claim and respond in JSON format:
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "supporting_evidence": ["list of supporting evidence"],
  "contradicting_evidence": ["list of contradicting evidence"],
  "recommendation": "accept|revise|citation_needed|remove",
  "reasoning": "Detailed explanation of your assessment"
}`;

    return prompt;
  }

  /**
   * Verify multiple claims in batch
   */
  async verifyBatch(
    claims: string[],
    context: VerificationContext
  ): Promise<ClaimVerificationResult[]> {
    const results = await Promise.all(
      claims.map((claim) => this.verifyClaim(claim, context))
    );
    return results;
  }

  /**
   * Extract claims from text
   */
  async extractClaims(text: string): Promise<string[]> {
    const prompt = `Extract all factual claims from the following medical research text. A claim is a statement that makes an assertion about data, findings, or conclusions.

Text:
${text}

Return a JSON array of claims: ["claim1", "claim2", ...]`;

    const request: AIRouterRequest = {
      taskType: 'extract_metadata',
      prompt,
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.1,
      forceTier: 'NANO',
    };

    const response = await this.router.route(request);

    if (!response.parsed || !Array.isArray(response.parsed)) {
      throw new Error('Failed to extract claims');
    }

    return response.parsed as string[];
  }

  /**
   * Verify all claims in a text section
   */
  async verifySection(
    text: string,
    context: VerificationContext
  ): Promise<{
    claims: ClaimVerificationResult[];
    overallScore: number;
    flaggedClaims: number;
  }> {
    // Extract claims
    const claimTexts = await this.extractClaims(text);

    // Verify each claim
    const claims = await this.verifyBatch(claimTexts, context);

    // Calculate metrics
    const flaggedClaims = claims.filter(
      (c) => !c.verified || c.recommendation === 'revise' || c.recommendation === 'remove'
    ).length;

    const avgConfidence =
      claims.reduce((sum, c) => sum + c.confidence, 0) / (claims.length || 1);

    const overallScore = avgConfidence * (1 - flaggedClaims / (claims.length || 1));

    return {
      claims,
      overallScore,
      flaggedClaims,
    };
  }

  /**
   * Generate verification report
   */
  generateReport(results: ClaimVerificationResult[]): string {
    const verified = results.filter((r) => r.verified).length;
    const needsAttention = results.filter(
      (r) => r.recommendation === 'revise' || r.recommendation === 'citation_needed'
    ).length;
    const shouldRemove = results.filter((r) => r.recommendation === 'remove').length;

    let report = `Claim Verification Report\n`;
    report += `Total Claims: ${results.length}\n`;
    report += `Verified: ${verified}\n`;
    report += `Needs Attention: ${needsAttention}\n`;
    report += `Should Remove: ${shouldRemove}\n\n`;

    results.forEach((result, i) => {
      report += `\n${i + 1}. "${result.claim}"\n`;
      report += `   Status: ${result.verified ? 'Verified' : 'Unverified'}\n`;
      report += `   Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
      report += `   Recommendation: ${result.recommendation.toUpperCase()}\n`;
      report += `   Reasoning: ${result.reasoning}\n`;

      if (result.supportingEvidence.length > 0) {
        report += `   Supporting Evidence:\n`;
        result.supportingEvidence.forEach((e) => {
          report += `   - ${e}\n`;
        });
      }

      if (result.contradictingEvidence.length > 0) {
        report += `   Contradicting Evidence:\n`;
        result.contradictingEvidence.forEach((e) => {
          report += `   - ${e}\n`;
        });
      }
    });

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: ClaimVerifierService | null = null;

export function getClaimVerifier(): ClaimVerifierService {
  if (!instance) {
    instance = new ClaimVerifierService();
  }
  return instance;
}
