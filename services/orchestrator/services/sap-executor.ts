import crypto from "crypto";

export interface SAPConfig {
  analysisType: 'regression' | 'survival' | 'comparison' | 'descriptive' | 'mixed';
  primaryOutcome: string;
  covariates: string[];
  subgroups?: string[];
  alpha?: number;
  powerTarget?: number;
  sensitivityAnalyses?: string[];
}

export interface StatisticalResult {
  name: string;
  coefficient?: number;
  standardError?: number;
  pValue: number;
  confidenceInterval: [number, number];
  effectSize?: number;
  interpretation: string;
}

export interface AnalysisResults {
  primaryAnalysis: {
    method: string;
    results: StatisticalResult[];
    modelFit?: {
      rSquared?: number;
      adjustedRSquared?: number;
      aic?: number;
      bic?: number;
    };
  };
  secondaryAnalyses: Array<{
    name: string;
    method: string;
    results: StatisticalResult[];
  }>;
  sensitivityAnalyses: Array<{
    name: string;
    robustness: 'consistent' | 'sensitive' | 'inconsistent';
    notes: string;
  }>;
  summaryStatistics: {
    n: number;
    nEvents?: number;
    meanAge?: number;
    femalePercent?: number;
  };
}

export interface ExecutionResult {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  estimatedDuration: number;
  queuedAt: string;
  results?: AnalysisResults;
}

const executionStore = new Map<string, ExecutionResult>();

function generatePValue(): number {
  const rand = Math.random();
  if (rand < 0.3) return Math.random() * 0.01;
  if (rand < 0.5) return 0.01 + Math.random() * 0.04;
  if (rand < 0.7) return 0.05 + Math.random() * 0.45;
  return 0.5 + Math.random() * 0.5;
}

function generateCoefficient(): number {
  return (Math.random() - 0.5) * 4;
}

function generateConfidenceInterval(coefficient: number, se: number): [number, number] {
  const margin = 1.96 * se;
  return [
    Math.round((coefficient - margin) * 1000) / 1000,
    Math.round((coefficient + margin) * 1000) / 1000
  ];
}

export function generateMockResults(config: SAPConfig): AnalysisResults {
  const primaryResults: StatisticalResult[] = [];
  
  const mainCoef = generateCoefficient();
  const mainSE = Math.abs(mainCoef * 0.3) + 0.1;
  const mainPValue = generatePValue();
  
  primaryResults.push({
    name: config.primaryOutcome,
    coefficient: Math.round(mainCoef * 1000) / 1000,
    standardError: Math.round(mainSE * 1000) / 1000,
    pValue: Math.round(mainPValue * 10000) / 10000,
    confidenceInterval: generateConfidenceInterval(mainCoef, mainSE),
    effectSize: Math.round(Math.abs(mainCoef / (mainSE * 2)) * 100) / 100,
    interpretation: mainPValue < 0.05 
      ? `Statistically significant association detected (p=${mainPValue.toFixed(4)})`
      : `No statistically significant association (p=${mainPValue.toFixed(4)})`
  });

  for (const covariate of config.covariates.slice(0, 5)) {
    const coef = generateCoefficient();
    const se = Math.abs(coef * 0.4) + 0.05;
    const pVal = generatePValue();
    
    primaryResults.push({
      name: covariate,
      coefficient: Math.round(coef * 1000) / 1000,
      standardError: Math.round(se * 1000) / 1000,
      pValue: Math.round(pVal * 10000) / 10000,
      confidenceInterval: generateConfidenceInterval(coef, se),
      interpretation: pVal < 0.05 
        ? `Significant covariate effect`
        : `Non-significant covariate`
    });
  }

  const secondaryAnalyses = [];
  if (config.subgroups && config.subgroups.length > 0) {
    for (const subgroup of config.subgroups.slice(0, 3)) {
      const subCoef = generateCoefficient();
      const subSE = Math.abs(subCoef * 0.35) + 0.08;
      const subPVal = generatePValue();
      
      secondaryAnalyses.push({
        name: `Subgroup Analysis: ${subgroup}`,
        method: config.analysisType === 'survival' ? 'Cox Proportional Hazards' : 'Multivariable Regression',
        results: [{
          name: config.primaryOutcome,
          coefficient: Math.round(subCoef * 1000) / 1000,
          standardError: Math.round(subSE * 1000) / 1000,
          pValue: Math.round(subPVal * 10000) / 10000,
          confidenceInterval: generateConfidenceInterval(subCoef, subSE),
          interpretation: `Subgroup-specific estimate for ${subgroup}`
        }]
      });
    }
  }

  const sensitivityAnalyses: AnalysisResults['sensitivityAnalyses'] = [];
  if (config.sensitivityAnalyses) {
    for (const analysis of config.sensitivityAnalyses.slice(0, 3)) {
      const robustnessRand = Math.random();
      const robustness: AnalysisResults['sensitivityAnalyses'][number]['robustness'] =
        robustnessRand < 0.6 ? 'consistent' : robustnessRand < 0.85 ? 'sensitive' : 'inconsistent';
      
      sensitivityAnalyses.push({
        name: analysis,
        robustness,
        notes: robustness === 'consistent' 
          ? 'Results remain stable under alternative specifications'
          : robustness === 'sensitive'
          ? 'Results show moderate sensitivity to model specification'
          : 'Results differ substantially from primary analysis'
      });
    }
  }

  const methodMap: Record<string, string> = {
    'regression': 'Multivariable Linear Regression',
    'survival': 'Cox Proportional Hazards Model',
    'comparison': 'Two-sample t-test / Chi-square test',
    'descriptive': 'Descriptive Statistics',
    'mixed': 'Mixed Effects Model'
  };

  return {
    primaryAnalysis: {
      method: methodMap[config.analysisType] || 'Statistical Analysis',
      results: primaryResults,
      modelFit: config.analysisType !== 'descriptive' ? {
        rSquared: Math.round(Math.random() * 0.4 + 0.3) * 100 / 100,
        adjustedRSquared: Math.round(Math.random() * 0.35 + 0.25) * 100 / 100,
        aic: Math.round(Math.random() * 500 + 1000),
        bic: Math.round(Math.random() * 500 + 1050)
      } : undefined
    },
    secondaryAnalyses,
    sensitivityAnalyses,
    summaryStatistics: {
      n: Math.floor(Math.random() * 2000) + 500,
      nEvents: config.analysisType === 'survival' ? Math.floor(Math.random() * 300) + 50 : undefined,
      meanAge: Math.round((Math.random() * 20 + 45) * 10) / 10,
      femalePercent: Math.round((Math.random() * 30 + 40) * 10) / 10
    }
  };
}

export async function executeSAP(config: SAPConfig, datasetId: string): Promise<ExecutionResult> {
  const executionId = crypto.randomUUID();
  
  const estimatedDuration = Math.floor(Math.random() * 30) + 15;
  
  const result: ExecutionResult = {
    executionId,
    status: 'queued',
    estimatedDuration,
    queuedAt: new Date().toISOString()
  };
  
  executionStore.set(executionId, result);
  
  setTimeout(() => {
    const storedResult = executionStore.get(executionId);
    if (storedResult) {
      storedResult.status = 'completed';
      storedResult.results = generateMockResults(config);
    }
  }, estimatedDuration * 100);
  
  return result;
}

export function getExecutionStatus(executionId: string): ExecutionResult | undefined {
  return executionStore.get(executionId);
}