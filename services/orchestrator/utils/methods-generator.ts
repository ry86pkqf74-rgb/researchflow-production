import type { StatisticalPlan, SAPExecutionResult, AnalysisResult } from "@researchflow/core/types/sap"

export interface MethodsNarrative {
  studyDesign: string;
  sampleSize: string;
  primaryAnalysis: string;
  covariateAdjustment: string;
  sensitivityAnalyses: string;
  missingData: string;
  multiplicity: string;
  software: string;
}

export interface StatisticalMethodsDocument {
  sapId: string;
  sapVersion: number;
  generatedAt: string;
  datasetHash: string;
  randomSeed: number;
  narrative: MethodsNarrative;
  fullText: string;
  softwareVersions: Record<string, string>;
  executionLog: string[];
}

const MODEL_DESCRIPTIONS: Record<string, string> = {
  linear: 'linear regression',
  logistic: 'logistic regression',
  cox: 'Cox proportional hazards regression',
  poisson: 'Poisson regression',
  mixed: 'linear mixed-effects model',
  ordinal: 'ordinal logistic regression',
  negative_binomial: 'negative binomial regression'
};

const CORRECTION_DESCRIPTIONS: Record<string, string> = {
  none: 'No adjustment for multiple comparisons was performed',
  bonferroni: 'Bonferroni correction was applied to adjust for multiple comparisons',
  fdr: 'False discovery rate (FDR) was controlled using the Benjamini-Hochberg procedure',
  hierarchical: 'A hierarchical testing procedure was employed to preserve the type I error rate',
  holm: 'Holm-Bonferroni step-down procedure was used for multiple comparison adjustment'
};

const MISSING_DATA_DESCRIPTIONS: Record<string, string> = {
  MCAR: 'missing completely at random (MCAR)',
  MAR: 'missing at random (MAR)',
  MNAR: 'missing not at random (MNAR)'
};

const MISSING_APPROACH_DESCRIPTIONS: Record<string, string> = {
  complete_case: 'complete case analysis was performed',
  multiple_imputation: 'multiple imputation was used',
  sensitivity: 'sensitivity analyses were conducted to assess robustness'
};

function formatCovariateList(covariates: string[]): string {
  if (covariates.length === 0) return 'No covariates were included';
  if (covariates.length === 1) return covariates[0];
  if (covariates.length === 2) return `${covariates[0]} and ${covariates[1]}`;
  return `${covariates.slice(0, -1).join(', ')}, and ${covariates[covariates.length - 1]}`;
}

function generateStudyDesignSection(sap: StatisticalPlan): string {
  const primaryCount = sap.primaryAnalyses.length;
  const secondaryCount = sap.secondaryAnalyses?.length || 0;
  
  let text = `This statistical analysis plan defines ${primaryCount} primary `;
  text += primaryCount === 1 ? 'analysis' : 'analyses';
  
  if (secondaryCount > 0) {
    text += ` and ${secondaryCount} secondary `;
    text += secondaryCount === 1 ? 'analysis' : 'analyses';
  }
  
  text += `. The significance level was set at α = ${sap.alphaLevel}.`;
  
  return text;
}

function generatePrimaryAnalysisSection(sap: StatisticalPlan): string {
  if (sap.primaryAnalyses.length === 0) {
    return 'No primary analyses were specified.';
  }

  const analyses = sap.primaryAnalyses.map((analysis, index) => {
    const modelDesc = MODEL_DESCRIPTIONS[analysis.modelType] || analysis.modelType;
    return `For the primary analysis${sap.primaryAnalyses.length > 1 ? ` ${index + 1}` : ''}, ` +
      `${modelDesc} was used to assess the association between ${analysis.exposureVariable} ` +
      `and ${analysis.outcomeVariable}. ${analysis.justification}`;
  });

  return analyses.join(' ');
}

function generateCovariateSection(sap: StatisticalPlan): string {
  const strategy = sap.covariateStrategy;
  const covariates = formatCovariateList(strategy.covariateList);
  
  let text = '';
  
  switch (strategy.adjustment) {
    case 'unadjusted':
      text = 'Unadjusted analyses were performed without covariate adjustment.';
      break;
    case 'minimally_adjusted':
      text = `Minimally adjusted analyses included ${covariates} as covariates.`;
      break;
    case 'fully_adjusted':
      text = `Fully adjusted analyses included ${covariates} as covariates.`;
      break;
  }
  
  if (strategy.selectionRationale) {
    text += ` ${strategy.selectionRationale}`;
  }
  
  return text;
}

function generateSensitivitySection(sap: StatisticalPlan): string {
  if (!sap.sensitivityAnalyses || sap.sensitivityAnalyses.length === 0) {
    return 'No sensitivity analyses were pre-specified.';
  }
  
  const analyses = sap.sensitivityAnalyses.map(sa => 
    `${sa.name}: ${sa.description} (${sa.modification})`
  );
  
  return `The following sensitivity analyses were performed: ${analyses.join('; ')}.`;
}

function generateMissingDataSection(sap: StatisticalPlan): string {
  const plan = sap.missingDataPlan;
  const mechanism = MISSING_DATA_DESCRIPTIONS[plan.mechanism];
  const approach = MISSING_APPROACH_DESCRIPTIONS[plan.approach];
  
  let text = `Missing data were assumed to be ${mechanism}. `;
  text += `To handle missing values, ${approach}. `;
  
  if (plan.assumptions) {
    text += plan.assumptions;
  }
  
  return text;
}

function generateMultiplicitySection(sap: StatisticalPlan): string {
  return CORRECTION_DESCRIPTIONS[sap.multiplicityCorrection] + '.';
}

function generateSoftwareSection(
  softwareVersions: Record<string, string>,
  randomSeed: number
): string {
  const versions = Object.entries(softwareVersions)
    .map(([name, version]) => `${name} (version ${version})`)
    .join(', ');
  
  let text = `Statistical analyses were performed using ${versions || 'standard statistical software'}. `;
  text += `For reproducibility, all random processes were seeded with ${randomSeed}.`;
  
  return text;
}

export function generateMethodsNarrative(
  sap: StatisticalPlan,
  executionResult?: SAPExecutionResult
): MethodsNarrative {
  return {
    studyDesign: generateStudyDesignSection(sap),
    sampleSize: executionResult 
      ? `The analysis included ${executionResult.results[0]?.sampleSize || 'N'} participants.`
      : 'Sample size will be determined upon data availability.',
    primaryAnalysis: generatePrimaryAnalysisSection(sap),
    covariateAdjustment: generateCovariateSection(sap),
    sensitivityAnalyses: generateSensitivitySection(sap),
    missingData: generateMissingDataSection(sap),
    multiplicity: generateMultiplicitySection(sap),
    software: generateSoftwareSection(
      executionResult?.softwareVersions || { 'Python': '3.11', 'statsmodels': '0.14.0' },
      sap.randomSeed
    )
  };
}

export function generateFullMethodsText(
  sap: StatisticalPlan,
  executionResult?: SAPExecutionResult
): string {
  const narrative = generateMethodsNarrative(sap, executionResult);
  
  const sections = [
    '## Statistical Methods',
    '',
    '### Study Design and Analysis Plan',
    narrative.studyDesign,
    '',
    '### Sample Size',
    narrative.sampleSize,
    '',
    '### Primary Analyses',
    narrative.primaryAnalysis,
    '',
    '### Covariate Adjustment',
    narrative.covariateAdjustment,
    '',
    '### Missing Data Handling',
    narrative.missingData,
    '',
    '### Sensitivity Analyses',
    narrative.sensitivityAnalyses,
    '',
    '### Multiple Comparison Adjustment',
    narrative.multiplicity,
    '',
    '### Software and Reproducibility',
    narrative.software
  ];
  
  return sections.join('\n');
}

export function generateStatisticalMethodsDocument(
  sap: StatisticalPlan,
  executionResult?: SAPExecutionResult
): StatisticalMethodsDocument {
  const narrative = generateMethodsNarrative(sap, executionResult);
  const fullText = generateFullMethodsText(sap, executionResult);
  
  return {
    sapId: sap.id,
    sapVersion: sap.topicVersion,
    generatedAt: new Date().toISOString(),
    datasetHash: executionResult?.datasetHash || 'pending',
    randomSeed: sap.randomSeed,
    narrative,
    fullText,
    softwareVersions: executionResult?.softwareVersions || {
      'Python': '3.11',
      'pandas': '2.0.0',
      'numpy': '1.24.0',
      'statsmodels': '0.14.0',
      'scipy': '1.11.0'
    },
    executionLog: executionResult?.executionLog || []
  };
}

export function formatResultsTable(results: AnalysisResult[]): string {
  if (results.length === 0) return 'No results available.';
  
  const headers = ['Analysis', 'Model', 'Effect (95% CI)', 'P-value'];
  const rows = results.map(r => [
    r.analysisName,
    MODEL_DESCRIPTIONS[r.modelType] || r.modelType,
    `${r.effectEstimate.toFixed(2)} (${r.confidenceInterval[0].toFixed(2)}, ${r.confidenceInterval[1].toFixed(2)})`,
    r.pValue < 0.001 ? '<0.001' : r.pValue.toFixed(3)
  ]);
  
  const colWidths = headers.map((h, i) => 
    Math.max(h.length, ...rows.map(r => r[i].length))
  );
  
  const separator = colWidths.map(w => '-'.repeat(w)).join(' | ');
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
  const dataRows = rows.map(row => 
    row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ')
  );
  
  return [headerRow, separator, ...dataRows].join('\n');
}

export function generateMethodsForExport(
  sap: StatisticalPlan,
  executionResult?: SAPExecutionResult,
  format: 'markdown' | 'plain' | 'html' = 'markdown'
): string {
  const doc = generateStatisticalMethodsDocument(sap, executionResult);
  
  switch (format) {
    case 'plain':
      return doc.fullText.replace(/^##?\s*/gm, '').replace(/\*\*/g, '');
    case 'html':
      return doc.fullText
        .replace(/^## (.*)/gm, '<h2>$1</h2>')
        .replace(/^### (.*)/gm, '<h3>$1</h3>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^/, '<p>').replace(/$/, '</p>');
    default:
      return doc.fullText;
  }
}
