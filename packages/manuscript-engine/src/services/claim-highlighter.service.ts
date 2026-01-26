/**
 * Claim Highlighter Service
 *
 * Highlights unsubstantiated claims in manuscript text.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { ClaimHighlightResult, HighlightedClaim } from '../types';

export class ClaimHighlighterService {
  private router = getModelRouter();

  /**
   * Highlight claims in text and assess substantiation
   */
  async highlightClaims(
    text: string,
    context?: {
      availableCitations?: string[];
      studyData?: Record<string, unknown>;
    }
  ): Promise<ClaimHighlightResult> {
    const prompt = this.buildHighlightPrompt(text, context);

    const request: AIRouterRequest = {
      taskType: 'extract_metadata',
      prompt,
      systemPrompt:
        'You are an expert medical editor specializing in identifying and assessing factual claims in research manuscripts.',
      responseFormat: 'json',
      maxTokens: 2000,
      temperature: 0.2,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse claim highlighting response');
    }

    const result = response.parsed as {
      claims: Array<{
        text: string;
        start: number;
        end: number;
        has_evidence: boolean;
        evidence_type?: 'citation' | 'data' | 'inference';
        strength: 'strong' | 'moderate' | 'weak';
        recommendation: string;
      }>;
    };

    const claims = result.claims.map((c) => ({
      text: c.text,
      start: c.start,
      end: c.end,
      hasEvidence: c.has_evidence,
      evidenceType: c.evidence_type,
      strength: c.strength,
      recommendation: c.recommendation,
    }));

    const substantiatedCount = claims.filter((c) => c.hasEvidence).length;
    const substantiationRate = claims.length > 0 ? substantiatedCount / claims.length : 1.0;
    const unreferencedClaimCount = claims.filter((c) => !c.hasEvidence).length;

    return {
      claims,
      substantiationRate,
      unreferencedClaimCount,
    };
  }

  /**
   * Build highlighting prompt
   */
  private buildHighlightPrompt(
    text: string,
    context?: {
      availableCitations?: string[];
      studyData?: Record<string, unknown>;
    }
  ): string {
    let prompt = `Identify all factual claims in this medical research text and assess whether each claim is substantiated with evidence.

Text:
${text}

`;

    if (context?.availableCitations && context.availableCitations.length > 0) {
      prompt += `Available Citations:\n${context.availableCitations
        .map((c, i) => `${i + 1}. ${c}`)
        .join('\n')}\n\n`;
    }

    if (context?.studyData) {
      prompt += `Study Data:\n${JSON.stringify(context.studyData, null, 2)}\n\n`;
    }

    prompt += `For each claim, determine:
1. The exact claim text and position
2. Whether it has supporting evidence (citation, data, or clear inference)
3. Type of evidence (citation, data, or inference)
4. Strength of evidence (strong, moderate, weak)
5. Recommendation for improvement

Respond in JSON format:
{
  "claims": [
    {
      "text": "claim text",
      "start": 0,
      "end": 50,
      "has_evidence": true/false,
      "evidence_type": "citation|data|inference",
      "strength": "strong|moderate|weak",
      "recommendation": "suggestion for improving claim substantiation"
    }
  ]
}`;

    return prompt;
  }

  /**
   * Highlight claims by strength
   */
  async highlightByStrength(
    text: string,
    minStrength: 'weak' | 'moderate' | 'strong' = 'weak'
  ): Promise<HighlightedClaim[]> {
    const result = await this.highlightClaims(text);

    const strengthOrder = { weak: 0, moderate: 1, strong: 2 };
    const minLevel = strengthOrder[minStrength];

    return result.claims.filter((claim) => strengthOrder[claim.strength] >= minLevel);
  }

  /**
   * Highlight unsubstantiated claims only
   */
  async highlightUnsubstantiated(text: string): Promise<HighlightedClaim[]> {
    const result = await this.highlightClaims(text);
    return result.claims.filter((claim) => !claim.hasEvidence);
  }

  /**
   * Get substantiation statistics
   */
  getStatistics(result: ClaimHighlightResult): {
    totalClaims: number;
    substantiatedClaims: number;
    unsubstantiatedClaims: number;
    substantiationRate: number;
    byStrength: Record<string, number>;
    byEvidenceType: Record<string, number>;
  } {
    const byStrength = result.claims.reduce((acc, claim) => {
      acc[claim.strength] = (acc[claim.strength] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byEvidenceType = result.claims.reduce((acc, claim) => {
      if (claim.evidenceType) {
        acc[claim.evidenceType] = (acc[claim.evidenceType] || 0) + 1;
      } else {
        acc['none'] = (acc['none'] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalClaims: result.claims.length,
      substantiatedClaims: result.claims.filter((c) => c.hasEvidence).length,
      unsubstantiatedClaims: result.unreferencedClaimCount,
      substantiationRate: result.substantiationRate,
      byStrength,
      byEvidenceType,
    };
  }

  /**
   * Annotate text with claim markers
   */
  annotateText(text: string, claims: HighlightedClaim[]): string {
    // Sort claims by position in reverse order
    const sortedClaims = [...claims].sort((a, b) => b.start - a.start);

    let annotated = text;

    for (const claim of sortedClaims) {
      const marker = claim.hasEvidence ? '[SUBSTANTIATED]' : '[NEEDS CITATION]';
      const strengthMarker = `[${claim.strength.toUpperCase()}]`;

      const before = annotated.substring(0, claim.end);
      const after = annotated.substring(claim.end);

      annotated = before + ` ${marker}${strengthMarker}` + after;
    }

    return annotated;
  }

  /**
   * Generate HTML visualization
   */
  generateHTMLVisualization(text: string, claims: HighlightedClaim[]): string {
    const sortedClaims = [...claims].sort((a, b) => a.start - b.start);

    let html = '<div style="font-family: Arial, sans-serif; line-height: 1.6;">\n';

    let lastIndex = 0;

    for (const claim of sortedClaims) {
      // Add text before claim
      if (claim.start > lastIndex) {
        html += this.escapeHTML(text.substring(lastIndex, claim.start));
      }

      // Add highlighted claim
      const color = claim.hasEvidence
        ? claim.strength === 'strong'
          ? '#c6efce'
          : claim.strength === 'moderate'
          ? '#ffeb9c'
          : '#ffc7ce'
        : '#ff6b6b';

      html += `<span style="background-color: ${color}; padding: 2px 4px; border-radius: 3px;" title="${this.escapeHTML(
        claim.recommendation
      )}">`;
      html += this.escapeHTML(text.substring(claim.start, claim.end));
      html += '</span>';

      lastIndex = claim.end;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      html += this.escapeHTML(text.substring(lastIndex));
    }

    html += '</div>\n\n';
    html += '<div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5;">\n';
    html += '<h3>Legend</h3>\n';
    html +=
      '<p><span style="background-color: #c6efce; padding: 2px 4px;">Strong Evidence</span></p>\n';
    html +=
      '<p><span style="background-color: #ffeb9c; padding: 2px 4px;">Moderate Evidence</span></p>\n';
    html +=
      '<p><span style="background-color: #ffc7ce; padding: 2px 4px;">Weak Evidence</span></p>\n';
    html +=
      '<p><span style="background-color: #ff6b6b; padding: 2px 4px;">No Evidence (Needs Citation)</span></p>\n';
    html += '</div>';

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generate claim substantiation report
   */
  generateReport(result: ClaimHighlightResult): string {
    const stats = this.getStatistics(result);

    let report = `Claim Substantiation Report\n\n`;

    report += `Summary:\n`;
    report += `- Total Claims: ${stats.totalClaims}\n`;
    report += `- Substantiated: ${stats.substantiatedClaims} (${(
      stats.substantiationRate * 100
    ).toFixed(1)}%)\n`;
    report += `- Unsubstantiated: ${stats.unsubstantiatedClaims}\n\n`;

    report += `Claims by Strength:\n`;
    Object.entries(stats.byStrength).forEach(([strength, count]) => {
      report += `- ${strength}: ${count}\n`;
    });
    report += `\n`;

    report += `Evidence Types:\n`;
    Object.entries(stats.byEvidenceType).forEach(([type, count]) => {
      report += `- ${type}: ${count}\n`;
    });
    report += `\n`;

    if (result.unreferencedClaimCount > 0) {
      report += `Unsubstantiated Claims:\n\n`;
      const unsubstantiated = result.claims.filter((c) => !c.hasEvidence);

      unsubstantiated.forEach((claim, i) => {
        report += `${i + 1}. "${claim.text}"\n`;
        report += `   Position: ${claim.start}-${claim.end}\n`;
        report += `   Strength: ${claim.strength}\n`;
        report += `   Recommendation: ${claim.recommendation}\n\n`;
      });
    } else {
      report += `All claims are substantiated with evidence.\n`;
    }

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: ClaimHighlighterService | null = null;

export function getClaimHighlighter(): ClaimHighlighterService {
  if (!instance) {
    instance = new ClaimHighlighterService();
  }
  return instance;
}
