export interface StudyComparison {
  id: string;
  studyName: string;
  authors: string;
  year: number;
  sampleSize: number;
  design: string;
  findings: string;
  limitations?: string;
  citationId?: string;
}

export interface ComparisonMatrix {
  rows: StudyComparison[];
  columns: string[];
  targetSection: 'introduction' | 'discussion';
}

export interface DiscussionSuggestion {
  type: 'agreement' | 'disagreement' | 'gap' | 'limitation';
  text: string;
  studies: string[];
}

export class ComparisonImporterService {
  importBulkComparisons(params: {
    manuscriptId: string;
    comparisons: StudyComparison[];
    targetSection: 'introduction' | 'discussion';
  }): ComparisonMatrix {
    return {
      rows: params.comparisons,
      columns: ['Study', 'Design', 'N', 'Findings', 'Limitations'],
      targetSection: params.targetSection
    };
  }

  buildComparisonMatrix(comparisons: StudyComparison[]): string[][] {
    return comparisons.map(comp => [
      `${comp.authors} (${comp.year})`,
      comp.design,
      comp.sampleSize.toString(),
      comp.findings,
      comp.limitations || 'Not reported'
    ]);
  }

  generateDiscussionText(comparisons: StudyComparison[], currentStudyFindings: string): DiscussionSuggestion[] {
    const suggestions: DiscussionSuggestion[] = [];

    // Agreement pattern
    const similar = comparisons.filter(c =>
      this.findingsAlign(c.findings, currentStudyFindings)
    );
    if (similar.length > 0) {
      suggestions.push({
        type: 'agreement',
        text: `Our findings align with ${similar.length} previous studies showing similar results.`,
        studies: similar.map(s => s.studyName)
      });
    }

    // Disagreement pattern
    const conflicting = comparisons.filter(c =>
      this.findingsConflict(c.findings, currentStudyFindings)
    );
    if (conflicting.length > 0) {
      suggestions.push({
        type: 'disagreement',
        text: `These results differ from prior work, which may be explained by methodological differences.`,
        studies: conflicting.map(s => s.studyName)
      });
    }

    return suggestions;
  }

  private findingsAlign(finding1: string, finding2: string): boolean {
    // Simple heuristic - check for common positive/negative sentiment
    const positive = ['increased', 'improved', 'beneficial', 'effective'];
    const negative = ['decreased', 'reduced', 'worsened', 'ineffective'];

    const f1Positive = positive.some(word => finding1.toLowerCase().includes(word));
    const f2Positive = positive.some(word => finding2.toLowerCase().includes(word));
    const f1Negative = negative.some(word => finding1.toLowerCase().includes(word));
    const f2Negative = negative.some(word => finding2.toLowerCase().includes(word));

    return (f1Positive && f2Positive) || (f1Negative && f2Negative);
  }

  private findingsConflict(finding1: string, finding2: string): boolean {
    const positive = ['increased', 'improved', 'beneficial', 'effective'];
    const negative = ['decreased', 'reduced', 'worsened', 'ineffective'];

    const f1Positive = positive.some(word => finding1.toLowerCase().includes(word));
    const f2Positive = positive.some(word => finding2.toLowerCase().includes(word));
    const f1Negative = negative.some(word => finding1.toLowerCase().includes(word));
    const f2Negative = negative.some(word => finding2.toLowerCase().includes(word));

    return (f1Positive && f2Negative) || (f1Negative && f2Positive);
  }
}

export const comparisonImporterService = new ComparisonImporterService();
