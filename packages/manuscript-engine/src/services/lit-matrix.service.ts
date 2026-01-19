import type { Citation } from '../types/citation.types';

export interface PICOCriteria {
  population: string;
  intervention: string;
  comparison: string;
  outcome: string;
}

export interface StudyQuality {
  randomization: boolean;
  blinding: boolean;
  completeness: number; // 0-100%
  biasRisk: 'low' | 'moderate' | 'high';
  cochraneScore?: number;
}

export interface EffectSize {
  measure: 'OR' | 'RR' | 'MD' | 'SMD';
  value: number;
  confidenceInterval: [number, number];
  pValue: number;
}

export interface MatrixStudy {
  citation: Citation;
  pico: Partial<PICOCriteria>;
  quality: StudyQuality;
  sampleSize: number;
  effectSize?: EffectSize;
  notes?: string;
}

export interface LiteratureMatrix {
  title: string;
  researchQuestion: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  studies: MatrixStudy[];
  columns: string[];
}

export class LitMatrixService {
  createMatrix(params: {
    researchQuestion: string;
    inclusionCriteria: string[];
    exclusionCriteria: string[];
  }): LiteratureMatrix {
    return {
      title: 'Systematic Review Matrix',
      researchQuestion: params.researchQuestion,
      inclusionCriteria: params.inclusionCriteria,
      exclusionCriteria: params.exclusionCriteria,
      studies: [],
      columns: [
        'Study',
        'Population',
        'Intervention',
        'Comparison',
        'Outcome',
        'Sample Size',
        'Quality',
        'Effect Size',
        'Notes'
      ]
    };
  }

  addStudy(matrix: LiteratureMatrix, study: MatrixStudy): LiteratureMatrix {
    return {
      ...matrix,
      studies: [...matrix.studies, study]
    };
  }

  assessQuality(params: {
    hasRandomization: boolean;
    hasBlinding: boolean;
    completenessPercent: number;
  }): StudyQuality {
    const score = (params.hasRandomization ? 2 : 0) +
                  (params.hasBlinding ? 2 : 0) +
                  (params.completenessPercent >= 80 ? 1 : 0);

    let biasRisk: StudyQuality['biasRisk'] = 'low';
    if (score < 3) biasRisk = 'high';
    else if (score < 4) biasRisk = 'moderate';

    return {
      randomization: params.hasRandomization,
      blinding: params.hasBlinding,
      completeness: params.completenessPercent,
      biasRisk,
      cochraneScore: score
    };
  }

  calculateEffectSize(params: {
    measure: EffectSize['measure'];
    value: number;
    lowerCI: number;
    upperCI: number;
    pValue: number;
  }): EffectSize {
    return {
      measure: params.measure,
      value: params.value,
      confidenceInterval: [params.lowerCI, params.upperCI],
      pValue: params.pValue
    };
  }

  exportToTable(matrix: LiteratureMatrix): string[][] {
    const rows: string[][] = [];

    rows.push(matrix.columns);

    for (const study of matrix.studies) {
      const firstAuthor = study.citation.authors[0]?.lastName || 'Unknown';
      const year = study.citation.year;

      rows.push([
        `${firstAuthor} et al. (${year})`,
        study.pico.population || 'Not specified',
        study.pico.intervention || 'Not specified',
        study.pico.comparison || 'Not specified',
        study.pico.outcome || 'Not specified',
        study.sampleSize.toString(),
        `${study.quality.biasRisk} risk`,
        study.effectSize
          ? `${study.effectSize.measure}=${study.effectSize.value.toFixed(2)} (${study.effectSize.confidenceInterval[0].toFixed(2)}-${study.effectSize.confidenceInterval[1].toFixed(2)})`
          : 'N/A',
        study.notes || ''
      ]);
    }

    return rows;
  }

  generateSummary(matrix: LiteratureMatrix): string {
    const totalStudies = matrix.studies.length;
    const lowBias = matrix.studies.filter(s => s.quality.biasRisk === 'low').length;
    const avgSampleSize = Math.round(
      matrix.studies.reduce((sum, s) => sum + s.sampleSize, 0) / totalStudies
    );

    return `Systematic review included ${totalStudies} studies. ` +
           `${lowBias} studies (${Math.round((lowBias / totalStudies) * 100)}%) had low risk of bias. ` +
           `Average sample size was ${avgSampleSize} participants.`;
  }

  filterByQuality(matrix: LiteratureMatrix, minQuality: 'low' | 'moderate'): MatrixStudy[] {
    if (minQuality === 'low') {
      return matrix.studies.filter(s => s.quality.biasRisk === 'low');
    }
    return matrix.studies.filter(s => ['low', 'moderate'].includes(s.quality.biasRisk));
  }
}

export const litMatrixService = new LitMatrixService();
