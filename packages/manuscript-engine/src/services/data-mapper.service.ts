/**
 * Data Mapper Service
 * Maps clinical datasets to appropriate manuscript sections
 */

import type { ClinicalDataset, IMRaDSection, DataToSectionMapping, StatisticalSummary } from '../types';

export interface MappingResult {
  section: IMRaDSection;
  content: string;
  dataPoints: Array<{
    field: string;
    value: unknown;
    relevance: number;
  }>;
  confidence: number;
}

/**
 * Data Mapper Service - Maps clinical data to manuscript sections
 */
export class DataMapperService {
  private static instance: DataMapperService;

  private constructor() {}

  static getInstance(): DataMapperService {
    if (!this.instance) {
      this.instance = new DataMapperService();
    }
    return this.instance;
  }

  /**
   * Map clinical dataset to Results section
   */
  mapToResults(data: ClinicalDataset): string {
    const parts: string[] = [];

    // Participant summary
    if (data.metadata.sampleSize) {
      parts.push(
        `A total of ${data.metadata.sampleSize} ${data.metadata.population} were included in the analysis.`
      );
    }

    // Statistical results
    if (data.statistics) {
      const { summary, tests } = data.statistics;

      // Add statistical test results
      for (const test of tests || []) {
        let sentence = `${test.name}`;
        if (test.statistic !== undefined) {
          sentence += ` yielded a test statistic of ${this.formatNumber(test.statistic)}`;
        }
        if (test.pValue !== undefined) {
          sentence += ` (p = ${this.formatPValue(test.pValue)})`;
        }
        if (test.confidenceInterval) {
          sentence += `, 95% CI [${(test.confidenceInterval as [number, number]).map(v => this.formatNumber(v)).join(', ')}]`;
        }
        parts.push(sentence + '.');
      }
    }

    return parts.join(' ');
  }

  /**
   * Map dataset metadata to Methods section
   */
  mapToMethods(metadata: ClinicalDataset['metadata']): string {
    const parts: string[] = [];

    // Study design
    parts.push(`This ${metadata.studyDesign} included ${metadata.population}.`);

    // Sample size
    parts.push(`A total of ${metadata.sampleSize} participants were enrolled.`);

    // Variables
    if (metadata.variables.length > 0) {
      parts.push(
        `Variables assessed included: ${metadata.variables.join(', ')}.`
      );
    }

    // Timeframe
    if (metadata.timeframe) {
      parts.push(`The study was conducted ${metadata.timeframe}.`);
    }

    return parts.join(' ');
  }

  /**
   * Map data summary to Abstract
   */
  mapToAbstract(data: ClinicalDataset): string {
    const parts: string[] = [];

    // Background (brief)
    parts.push(`Background: Clinical data analysis of ${data.metadata.population}.`);

    // Methods
    parts.push(`Methods: ${data.metadata.studyDesign} with n=${data.metadata.sampleSize}.`);

    // Results (key findings)
    if (data.statistics?.tests && data.statistics.tests.length > 0) {
      const mainTest = data.statistics.tests[0];
      let resultStr = `Results: ${mainTest.name}`;
      if (mainTest.pValue !== undefined) {
        resultStr += ` (p = ${this.formatPValue(mainTest.pValue)})`;
      }
      parts.push(resultStr + '.');
    }

    return parts.join(' ');
  }

  /**
   * Automatically map dataset to all relevant sections
   */
  mapToManuscript(data: ClinicalDataset): Record<string, string> {
    return {
      abstract: this.mapToAbstract(data),
      methods: this.mapToMethods(data.metadata),
      results: this.mapToResults(data),
    };
  }

  /**
   * Extract statistical summary from dataset
   */
  extractStatistics(data: ClinicalDataset): StatisticalSummary | null {
    if (!data.statistics) return null;

    const { summary, tests } = data.statistics;

    // Extract descriptive stats (simplified)
    const descriptive = {
      n: data.metadata.sampleSize,
      mean: typeof summary.mean === 'number' ? summary.mean : undefined,
      median: typeof summary.median === 'number' ? summary.median : undefined,
      sd: typeof summary.sd === 'number' ? summary.sd : undefined,
      range: Array.isArray(summary.range) ? [summary.range[0], summary.range[1]] as [number, number] : undefined,
    };

    // Extract inferential stats from first test
    const inferential = tests && tests[0] ? {
      test: tests[0].name,
      pValue: tests[0].pValue || 0,
      statistic: tests[0].statistic || 0,
      confidenceInterval: tests[0].confidenceInterval as [number, number] | undefined,
    } : undefined;

    return {
      descriptive,
      inferential,
    };
  }

  /**
   * Format number for manuscript
   */
  private formatNumber(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  }

  /**
   * Format p-value according to AMA style
   */
  private formatPValue(p: number): string {
    if (p < 0.001) return '<0.001';
    if (p < 0.01) return p.toFixed(3);
    return p.toFixed(2);
  }
}

/**
 * Factory function
 */
export function getDataMapper(): DataMapperService {
  return DataMapperService.getInstance();
}
