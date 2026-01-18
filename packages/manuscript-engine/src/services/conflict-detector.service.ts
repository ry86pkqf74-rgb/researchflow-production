/**
 * Conflict Detector Service
 * Task T34: Detect conflicting findings across citations
 */

import type { Citation } from '../types/citation.types';

export interface ConflictingFinding {
  id: string;
  citationIds: string[];
  conflictType: 'opposite_findings' | 'contradictory_data' | 'methodological_dispute' | 'different_conclusions';
  severity: 'high' | 'moderate' | 'low';
  description: string;
  evidence: Array<{
    citationId: string;
    excerpt: string;
    stance: 'positive' | 'negative' | 'neutral' | 'mixed';
  }>;
  resolutionSuggestions: string[];
  detectedAt: Date;
}

export interface ConflictAnalysisResult {
  manuscriptId: string;
  totalConflicts: number;
  conflicts: ConflictingFinding[];
  overallConsistency: number; // 0-1 score (1 = highly consistent)
  recommendedAction: 'review_required' | 'minor_clarification' | 'no_action';
}

/**
 * Conflict patterns to detect
 */
const OPPOSITE_PATTERNS = [
  { positive: ['effective', 'beneficial', 'improved', 'increased', 'superior'], negative: ['ineffective', 'harmful', 'worsened', 'decreased', 'inferior'] },
  { positive: ['associated with', 'correlated with', 'linked to'], negative: ['not associated', 'no correlation', 'no link'] },
  { positive: ['significant', 'statistically significant'], negative: ['not significant', 'no significance', 'nonsignificant'] },
  { positive: ['reduced risk', 'lower risk', 'protective'], negative: ['increased risk', 'higher risk', 'risk factor'] },
];

/**
 * Conflict Detector Service
 * Analyzes citations to identify contradictory findings
 */
export class ConflictDetectorService {
  /**
   * Analyze citations for conflicts
   */
  async detectConflicts(
    manuscriptId: string,
    citations: Citation[]
  ): Promise<ConflictAnalysisResult> {
    const conflicts: ConflictingFinding[] = [];

    // Compare each pair of citations
    for (let i = 0; i < citations.length; i++) {
      for (let j = i + 1; j < citations.length; j++) {
        const cite1 = citations[i];
        const cite2 = citations[j];

        const conflict = this.compareForConflicts(cite1, cite2);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    // Calculate overall consistency
    const maxPossibleConflicts = (citations.length * (citations.length - 1)) / 2;
    const overallConsistency = maxPossibleConflicts > 0
      ? 1 - (conflicts.length / maxPossibleConflicts)
      : 1.0;

    // Determine recommended action
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high').length;
    const recommendedAction = this.determineRecommendedAction(
      conflicts.length,
      highSeverityConflicts,
      overallConsistency
    );

    return {
      manuscriptId,
      totalConflicts: conflicts.length,
      conflicts: conflicts.sort((a, b) => this.severityScore(b.severity) - this.severityScore(a.severity)),
      overallConsistency,
      recommendedAction,
    };
  }

  /**
   * Compare two citations for potential conflicts
   */
  private compareForConflicts(cite1: Citation, cite2: Citation): ConflictingFinding | null {
    // Extract key findings from abstracts
    const findings1 = this.extractFindings(cite1);
    const findings2 = this.extractFindings(cite2);

    // Check for opposite findings
    for (const f1 of findings1) {
      for (const f2 of findings2) {
        if (this.areOppositeFindings(f1.text, f2.text)) {
          return {
            id: this.generateConflictId(),
            citationIds: [cite1.id, cite2.id],
            conflictType: 'opposite_findings',
            severity: this.assessSeverity(f1.text, f2.text),
            description: `Studies report conflicting results regarding ${this.extractTopic(f1.text, f2.text)}`,
            evidence: [
              {
                citationId: cite1.id,
                excerpt: f1.text,
                stance: f1.stance,
              },
              {
                citationId: cite2.id,
                excerpt: f2.text,
                stance: f2.stance,
              },
            ],
            resolutionSuggestions: this.generateResolutionSuggestions(cite1, cite2, f1.text, f2.text),
            detectedAt: new Date(),
          };
        }
      }
    }

    // Check for contradictory data
    const dataConflict = this.checkDataContradiction(cite1, cite2);
    if (dataConflict) {
      return dataConflict;
    }

    // Check for methodological disputes
    const methodConflict = this.checkMethodologicalDispute(cite1, cite2);
    if (methodConflict) {
      return methodConflict;
    }

    return null;
  }

  /**
   * Extract key findings from citation abstract
   */
  private extractFindings(citation: Citation): Array<{ text: string; stance: 'positive' | 'negative' | 'neutral' | 'mixed' }> {
    if (!citation.abstract) return [];

    // Split abstract into sentences
    const sentences = citation.abstract.split(/[.!?]+/).filter(s => s.trim().length > 20);

    // Identify findings (sentences with outcome language)
    const findings: Array<{ text: string; stance: 'positive' | 'negative' | 'neutral' | 'mixed' }> = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      // Check if sentence contains outcome/finding language
      if (
        lower.includes('found') ||
        lower.includes('showed') ||
        lower.includes('demonstrated') ||
        lower.includes('associated') ||
        lower.includes('significant') ||
        lower.includes('effect')
      ) {
        findings.push({
          text: sentence.trim(),
          stance: this.determineStance(sentence),
        });
      }
    }

    return findings;
  }

  /**
   * Determine the stance (positive/negative/neutral) of a finding
   */
  private determineStance(text: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
    const lower = text.toLowerCase();

    const positiveIndicators = ['effective', 'beneficial', 'improved', 'increased', 'significant', 'superior', 'reduced risk'];
    const negativeIndicators = ['ineffective', 'harmful', 'worsened', 'no effect', 'not significant', 'inferior', 'increased risk'];

    const hasPositive = positiveIndicators.some(ind => lower.includes(ind));
    const hasNegative = negativeIndicators.some(ind => lower.includes(ind));

    if (hasPositive && hasNegative) return 'mixed';
    if (hasPositive) return 'positive';
    if (hasNegative) return 'negative';
    return 'neutral';
  }

  /**
   * Check if two findings are opposite
   */
  private areOppositeFindings(text1: string, text2: string): boolean {
    const lower1 = text1.toLowerCase();
    const lower2 = text2.toLowerCase();

    // Check for opposite patterns
    for (const pattern of OPPOSITE_PATTERNS) {
      const has1Positive = pattern.positive.some(p => lower1.includes(p));
      const has2Negative = pattern.negative.some(n => lower2.includes(n));

      const has1Negative = pattern.negative.some(n => lower1.includes(n));
      const has2Positive = pattern.positive.some(p => lower2.includes(p));

      if ((has1Positive && has2Negative) || (has1Negative && has2Positive)) {
        // Check if they're talking about the same topic
        if (this.haveSimilarTopic(lower1, lower2)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if two findings discuss similar topics
   */
  private haveSimilarTopic(text1: string, text2: string): boolean {
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 4));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 4));

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;

    return similarity > 0.2; // 20% word overlap
  }

  /**
   * Extract the topic being discussed
   */
  private extractTopic(text1: string, text2: string): string {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    // Find common medical/research terms
    const commonWords = words1.filter(w => words2.includes(w) && w.length > 5);

    return commonWords.slice(0, 3).join(' ') || 'this outcome';
  }

  /**
   * Check for contradictory numerical data
   */
  private checkDataContradiction(cite1: Citation, cite2: Citation): ConflictingFinding | null {
    // Extract numerical findings (e.g., "OR = 2.5" vs "OR = 0.5")
    const data1 = this.extractNumericalData(cite1.abstract || '');
    const data2 = this.extractNumericalData(cite2.abstract || '');

    // Check for contradictory effect sizes
    for (const d1 of data1) {
      for (const d2 of data2) {
        if (d1.metric === d2.metric && this.areContradictoryValues(d1.value, d2.value)) {
          return {
            id: this.generateConflictId(),
            citationIds: [cite1.id, cite2.id],
            conflictType: 'contradictory_data',
            severity: 'high',
            description: `Conflicting ${d1.metric} values reported: ${d1.value} vs ${d2.value}`,
            evidence: [
              { citationId: cite1.id, excerpt: d1.context, stance: 'neutral' },
              { citationId: cite2.id, excerpt: d2.context, stance: 'neutral' },
            ],
            resolutionSuggestions: [
              'Compare confidence intervals for overlap',
              'Examine population differences',
              'Review study quality and risk of bias',
            ],
            detectedAt: new Date(),
          };
        }
      }
    }

    return null;
  }

  private extractNumericalData(text: string): Array<{ metric: string; value: number; context: string }> {
    const data: Array<{ metric: string; value: number; context: string }> = [];

    // Extract odds ratios
    const orMatches = text.matchAll(/OR\s*=\s*([\d.]+)/gi);
    for (const match of orMatches) {
      data.push({ metric: 'OR', value: parseFloat(match[1]), context: match[0] });
    }

    // Extract hazard ratios
    const hrMatches = text.matchAll(/HR\s*=\s*([\d.]+)/gi);
    for (const match of hrMatches) {
      data.push({ metric: 'HR', value: parseFloat(match[1]), context: match[0] });
    }

    return data;
  }

  private areContradictoryValues(val1: number, val2: number): boolean {
    // Check if one is >1 (increased risk) and other is <1 (decreased risk)
    return (val1 > 1.2 && val2 < 0.8) || (val1 < 0.8 && val2 > 1.2);
  }

  private checkMethodologicalDispute(cite1: Citation, cite2: Citation): ConflictingFinding | null {
    // Simplified - would analyze methodology sections
    return null;
  }

  private assessSeverity(text1: string, text2: string): 'high' | 'moderate' | 'low' {
    // High severity if both use strong language ("significant", "clear")
    const strongLanguage = ['significant', 'clear', 'definitive', 'conclusive'];

    const hasStrong1 = strongLanguage.some(word => text1.toLowerCase().includes(word));
    const hasStrong2 = strongLanguage.some(word => text2.toLowerCase().includes(word));

    if (hasStrong1 && hasStrong2) return 'high';
    if (hasStrong1 || hasStrong2) return 'moderate';
    return 'low';
  }

  private generateResolutionSuggestions(
    cite1: Citation,
    cite2: Citation,
    finding1: string,
    finding2: string
  ): string[] {
    const suggestions = [
      'Examine methodological differences between studies',
      'Check if populations differ in key characteristics',
      'Review statistical power and sample sizes',
    ];

    // Add year-based suggestion if studies are from different eras
    if (Math.abs(cite1.year - cite2.year) > 5) {
      suggestions.push('Consider temporal differences (treatment standards may have evolved)');
    }

    return suggestions;
  }

  private determineRecommendedAction(
    totalConflicts: number,
    highSeverityConflicts: number,
    consistency: number
  ): ConflictAnalysisResult['recommendedAction'] {
    if (highSeverityConflicts > 0 || consistency < 0.7) {
      return 'review_required';
    }

    if (totalConflicts > 0) {
      return 'minor_clarification';
    }

    return 'no_action';
  }

  private severityScore(severity: ConflictingFinding['severity']): number {
    switch (severity) {
      case 'high': return 3;
      case 'moderate': return 2;
      case 'low': return 1;
    }
  }

  private generateConflictId(): string {
    return `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const conflictDetectorService = new ConflictDetectorService();
