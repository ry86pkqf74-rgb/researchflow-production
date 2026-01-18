/**
 * Data Tagger Service
 * Auto-tags data points for section relevance
 */

import type { ClinicalDataset, IMRaDSection } from '../types';

export type SectionTag = 'methods' | 'results' | 'discussion' | 'introduction';

export interface TaggedDataPoint {
  field: string;
  value: unknown;
  tags: SectionTag[];
  relevanceScores: Record<SectionTag, number>;
  reasoning: string;
}

/**
 * Data Tagger Service - Tags data points for manuscript sections
 */
export class DataTaggerService {
  private static instance: DataTaggerService;

  private constructor() {}

  static getInstance(): DataTaggerService {
    if (!this.instance) {
      this.instance = new DataTaggerService();
    }
    return this.instance;
  }

  /**
   * Tag data point for section relevance
   */
  tagForSection(field: string, value: unknown): SectionTag[] {
    const tags: SectionTag[] = [];

    // Methods: Study design, procedures, measurements
    if (this.isMethodsRelated(field)) {
      tags.push('methods');
    }

    // Results: Outcomes, statistics, findings
    if (this.isResultsRelated(field)) {
      tags.push('results');
    }

    // Discussion: Comparisons, interpretations
    if (this.isDiscussionRelated(field)) {
      tags.push('discussion');
    }

    // Introduction: Background, context
    if (this.isIntroductionRelated(field)) {
      tags.push('introduction');
    }

    return tags;
  }

  /**
   * Tag all data points in dataset
   */
  tagDataset(data: ClinicalDataset): TaggedDataPoint[] {
    const tagged: TaggedDataPoint[] = [];

    // Tag metadata fields
    for (const [field, value] of Object.entries(data.metadata)) {
      const tags = this.tagForSection(field, value);
      if (tags.length > 0) {
        tagged.push({
          field,
          value,
          tags,
          relevanceScores: this.calculateRelevance(field, tags),
          reasoning: this.explainTags(field, tags),
        });
      }
    }

    // Tag statistical results
    if (data.statistics) {
      for (const test of data.statistics.tests || []) {
        tagged.push({
          field: `statistical_test_${test.name}`,
          value: test,
          tags: ['results'],
          relevanceScores: { results: 1.0 } as any,
          reasoning: 'Statistical test results belong in Results section',
        });
      }
    }

    return tagged;
  }

  /**
   * Extract statistical summary
   */
  extractStatistics(data: ClinicalDataset): Record<string, unknown> {
    return {
      sampleSize: data.metadata.sampleSize,
      statistics: data.statistics?.summary || {},
      tests: data.statistics?.tests || [],
    };
  }

  /**
   * Check if field is methods-related
   */
  private isMethodsRelated(field: string): boolean {
    const methodsKeywords = [
      'design', 'procedure', 'protocol', 'method', 'measurement',
      'instrument', 'eligibility', 'criteria', 'setting', 'recruitment',
      'participants', 'population', 'variables', 'timeframe'
    ];
    return methodsKeywords.some(kw => field.toLowerCase().includes(kw));
  }

  /**
   * Check if field is results-related
   */
  private isResultsRelated(field: string): boolean {
    const resultsKeywords = [
      'outcome', 'result', 'finding', 'statistic', 'pvalue', 'p-value',
      'significant', 'test', 'analysis', 'effect', 'difference', 'mean',
      'median', 'percentage', 'count', 'rate'
    ];
    return resultsKeywords.some(kw => field.toLowerCase().includes(kw));
  }

  /**
   * Check if field is discussion-related
   */
  private isDiscussionRelated(field: string): boolean {
    const discussionKeywords = [
      'interpretation', 'implication', 'limitation', 'comparison',
      'clinical', 'significance', 'practical'
    ];
    return discussionKeywords.some(kw => field.toLowerCase().includes(kw));
  }

  /**
   * Check if field is introduction-related
   */
  private isIntroductionRelated(field: string): boolean {
    const introKeywords = [
      'background', 'context', 'rationale', 'objective', 'aim', 'purpose'
    ];
    return introKeywords.some(kw => field.toLowerCase().includes(kw));
  }

  /**
   * Calculate relevance scores
   */
  private calculateRelevance(field: string, tags: SectionTag[]): Record<SectionTag, number> {
    const scores: Partial<Record<SectionTag, number>> = {};

    for (const tag of tags) {
      // Simple relevance: 1.0 if tagged, 0.0 otherwise
      scores[tag] = 1.0;
    }

    // Fill in missing sections with 0
    const allSections: SectionTag[] = ['methods', 'results', 'discussion', 'introduction'];
    for (const section of allSections) {
      if (!(section in scores)) {
        scores[section] = 0.0;
      }
    }

    return scores as Record<SectionTag, number>;
  }

  /**
   * Explain why tags were assigned
   */
  private explainTags(field: string, tags: SectionTag[]): string {
    const explanations: string[] = [];

    if (tags.includes('methods')) {
      explanations.push('describes methodology or study procedures');
    }
    if (tags.includes('results')) {
      explanations.push('contains outcome data or statistical results');
    }
    if (tags.includes('discussion')) {
      explanations.push('relevant for interpretation or comparison');
    }
    if (tags.includes('introduction')) {
      explanations.push('provides background or context');
    }

    return `Field "${field}" ${explanations.join(' and ')}`;
  }
}

/**
 * Factory function
 */
export function getDataTagger(): DataTaggerService {
  return DataTaggerService.getInstance();
}
