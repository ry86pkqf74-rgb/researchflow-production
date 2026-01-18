/**
 * Statistical Analysis Plan (SAP) Generator Service
 * Auto-generates comprehensive SAP from Topic Declaration
 */

import { v4 as uuid } from 'uuid';
import type {
  StatisticalPlan,
  PrimaryAnalysis,
  CovariateStrategy,
  SensitivityAnalysis,
  MissingDataPlan,
  AssumptionCheck,
  SubgroupAnalysis,
  ModelType,
  MultiplicityCorrection,
  MissingDataMechanism,
  MissingDataApproach
} from '@researchflow/core/types/sap';

export interface TopicDeclarationForSAP {
  id: string;
  version: number;
  researchQuestion: string;
  population: string;
  outcomes: string[];
  exposures: string[];
  covariates: string[];
  studyDesign?: string;
  timeframe?: string;
}

// Map outcome descriptions to outcome types and statistical models
const MODEL_MAPPING: Record<string, ModelType> = {
  'continuous': 'linear',
  'binary': 'logistic',
  'categorical': 'logistic',
  'time-to-event': 'cox',
  'survival': 'cox',
  'count': 'poisson',
  'ordinal': 'ordinal'
};

/**
 * Infer the type of outcome from its description
 */
function inferOutcomeType(outcome: string): string {
  const lower = outcome.toLowerCase();

  // Time-to-event outcomes
  if (lower.includes('death') || lower.includes('survival') ||
      lower.includes('time to') || lower.includes('time until') ||
      lower.includes('event-free') || lower.includes('progression-free')) {
    return 'time-to-event';
  }

  // Count outcomes
  if (lower.includes('count') || lower.includes('number of') ||
      lower.includes('frequency of') || lower.match(/\d+ or more/)) {
    return 'count';
  }

  // Binary outcomes
  if (lower.includes('yes/no') || lower.includes('binary') ||
      lower.includes('occurrence') || lower.includes('presence') ||
      lower.includes('absence') || lower.match(/\byes\b|\bno\b/)) {
    return 'binary';
  }

  // Ordinal outcomes
  if (lower.includes('ordinal') || lower.includes('grade') ||
      lower.includes('stage') || lower.includes('severity')) {
    return 'ordinal';
  }

  // Categorical outcomes
  if (lower.includes('category') || lower.includes('categorical') ||
      lower.includes('type of') || lower.includes('classification')) {
    return 'categorical';
  }

  // Default to continuous
  return 'continuous';
}

/**
 * Select appropriate statistical model based on outcome type
 */
function selectModelType(outcomeType: string): ModelType {
  return MODEL_MAPPING[outcomeType] || 'linear';
}

/**
 * Generate justification for model selection
 */
function generateModelJustification(outcomeType: string, modelType: ModelType, outcome: string): string {
  const justifications: Record<string, string> = {
    'linear': `Linear regression was selected as the outcome (${outcome}) is continuous with an assumed approximately normal distribution.`,
    'logistic': `Logistic regression was selected as the outcome (${outcome}) is ${outcomeType}.`,
    'cox': `Cox proportional hazards model was selected for the time-to-event outcome (${outcome}), allowing for censoring and time-varying risk.`,
    'poisson': `Poisson regression was selected for the count outcome (${outcome}), assuming a Poisson distribution of events.`,
    'mixed': `Linear mixed-effects model was selected to account for clustered or longitudinal data structure.`,
    'ordinal': `Ordinal logistic regression (proportional odds model) was selected for the ordered categorical outcome (${outcome}).`,
    'negative_binomial': `Negative binomial regression was selected for the count outcome (${outcome}) to allow for overdispersion beyond the Poisson model.`
  };

  return justifications[modelType] || `${modelType} model selected based on outcome characteristics.`;
}

/**
 * Generate assumption checks based on model type
 */
function generateAssumptionChecks(modelType: ModelType): AssumptionCheck[] {
  const checks: Record<ModelType, AssumptionCheck[]> = {
    'linear': [
      {
        assumption: 'Linearity of relationships',
        testMethod: 'Residual plots and partial residual plots',
        threshold: 'Visual inspection for systematic patterns'
      },
      {
        assumption: 'Normality of residuals',
        testMethod: 'Q-Q plots and Shapiro-Wilk test',
        threshold: 'p > 0.05 for Shapiro-Wilk; visual assessment of Q-Q plot'
      },
      {
        assumption: 'Homoscedasticity (constant variance)',
        testMethod: 'Breusch-Pagan test and residual vs fitted plots',
        threshold: 'p > 0.05 for Breusch-Pagan test'
      },
      {
        assumption: 'Independence of observations',
        testMethod: 'Durbin-Watson test (if time series)',
        threshold: 'DW statistic between 1.5 and 2.5'
      },
      {
        assumption: 'No multicollinearity',
        testMethod: 'Variance inflation factors (VIF)',
        threshold: 'VIF < 5 for all predictors'
      }
    ],
    'logistic': [
      {
        assumption: 'Linearity of log-odds',
        testMethod: 'Box-Tidwell test for continuous predictors',
        threshold: 'p > 0.05 for interaction terms with log transformation'
      },
      {
        assumption: 'No multicollinearity',
        testMethod: 'Variance inflation factors (VIF)',
        threshold: 'VIF < 5 for all predictors'
      },
      {
        assumption: 'Independence of observations',
        testMethod: 'Study design review',
        threshold: 'No clustering or repeated measures'
      },
      {
        assumption: 'Adequate sample size per predictor',
        testMethod: 'Events per variable (EPV) calculation',
        threshold: 'EPV ≥ 10 for each predictor'
      }
    ],
    'cox': [
      {
        assumption: 'Proportional hazards',
        testMethod: 'Schoenfeld residuals test and log-log survival plots',
        threshold: 'p > 0.05 for Schoenfeld test; parallel log-log curves'
      },
      {
        assumption: 'No influential outliers',
        testMethod: 'dfbeta residuals',
        threshold: 'No observations with |dfbeta| > 0.5'
      },
      {
        assumption: 'Linearity of continuous covariates',
        testMethod: 'Martingale residuals plots',
        threshold: 'Visual inspection for systematic patterns'
      }
    ],
    'poisson': [
      {
        assumption: 'No overdispersion',
        testMethod: 'Dispersion parameter test (deviance / df)',
        threshold: 'Dispersion ≈ 1 (use negative binomial if > 1.5)'
      },
      {
        assumption: 'Mean equals variance',
        testMethod: 'Compare sample mean and variance of outcome',
        threshold: 'Variance / mean ratio between 0.8 and 1.2'
      }
    ],
    'mixed': [
      {
        assumption: 'Linearity of fixed effects',
        testMethod: 'Residual plots',
        threshold: 'Visual inspection for patterns'
      },
      {
        assumption: 'Normality of random effects',
        testMethod: 'Q-Q plots of random effects',
        threshold: 'Visual assessment of normality'
      },
      {
        assumption: 'Homoscedasticity within groups',
        testMethod: 'Group-specific residual plots',
        threshold: 'Similar spread across groups'
      }
    ],
    'ordinal': [
      {
        assumption: 'Proportional odds',
        testMethod: 'Brant test for parallel regression assumption',
        threshold: 'p > 0.05 for Brant test'
      },
      {
        assumption: 'No multicollinearity',
        testMethod: 'Variance inflation factors (VIF)',
        threshold: 'VIF < 5 for all predictors'
      }
    ],
    'negative_binomial': [
      {
        assumption: 'Overdispersion parameter is significant',
        testMethod: 'Likelihood ratio test vs. Poisson',
        threshold: 'p < 0.05 favoring negative binomial'
      },
      {
        assumption: 'Mean-variance relationship',
        testMethod: 'Compare fitted vs observed variance',
        threshold: 'Negative binomial better captures variance'
      }
    ]
  };

  return checks[modelType] || [];
}

/**
 * Generate default sensitivity analyses
 */
function generateDefaultSensitivityAnalyses(
  primaryModel: ModelType,
  hasMissingData: boolean
): SensitivityAnalysis[] {
  const analyses: SensitivityAnalysis[] = [];

  // Complete case analysis (if there's missing data)
  if (hasMissingData) {
    analyses.push({
      name: 'Complete Case Analysis',
      description: 'Restrict analysis to participants with complete data on all variables',
      modification: 'Exclude participants with any missing covariate or outcome data'
    });
  }

  // Alternative model specification
  if (primaryModel === 'linear') {
    analyses.push({
      name: 'Robust Standard Errors',
      description: 'Account for potential heteroscedasticity',
      modification: 'Use Huber-White sandwich estimator for standard errors'
    });
  }

  if (primaryModel === 'cox') {
    analyses.push({
      name: 'Accelerated Failure Time Model',
      description: 'Alternative parametric survival model',
      modification: 'Use Weibull or log-normal AFT model instead of Cox'
    });
  }

  // E-value for unmeasured confounding
  analyses.push({
    name: 'E-value Calculation',
    description: 'Assess robustness to unmeasured confounding',
    modification: 'Calculate minimum strength of association required to nullify observed effect'
  });

  return analyses;
}

/**
 * Main SAP generation function
 */
export function generateSAPFromTopic(
  topic: TopicDeclarationForSAP,
  userId: string,
  researchId: string
): StatisticalPlan {
  // Generate primary analyses from outcomes and exposures
  const primaryAnalyses: PrimaryAnalysis[] = topic.outcomes.slice(0, 1).map((outcome, idx) => {
    const exposure = topic.exposures[0] || 'primary exposure';
    const outcomeType = inferOutcomeType(outcome);
    const modelType = selectModelType(outcomeType);

    return {
      id: `primary_${idx + 1}`,
      hypothesis: `${exposure} is associated with ${outcome} in ${topic.population}`,
      outcomeVariable: outcome,
      exposureVariable: exposure,
      modelType,
      justification: generateModelJustification(outcomeType, modelType, outcome)
    };
  });

  // Secondary analyses for additional outcomes
  const secondaryAnalyses: PrimaryAnalysis[] = topic.outcomes.slice(1, 3).map((outcome, idx) => {
    const exposure = topic.exposures[0] || 'primary exposure';
    const outcomeType = inferOutcomeType(outcome);
    const modelType = selectModelType(outcomeType);

    return {
      id: `secondary_${idx + 1}`,
      hypothesis: `${exposure} is associated with ${outcome} (secondary outcome)`,
      outcomeVariable: outcome,
      exposureVariable: exposure,
      modelType,
      justification: `Secondary analysis: ${generateModelJustification(outcomeType, modelType, outcome)}`
    };
  });

  // Covariate strategy
  const covariateStrategy: CovariateStrategy = {
    adjustment: topic.covariates.length === 0 ? 'unadjusted' :
                topic.covariates.length <= 3 ? 'minimally_adjusted' : 'fully_adjusted',
    covariateList: topic.covariates,
    selectionRationale: topic.covariates.length > 0
      ? 'Covariates were selected a priori based on directed acyclic graph (DAG) analysis and domain knowledge as potential confounders of the exposure-outcome relationship.'
      : 'Unadjusted analysis was specified based on randomization (if RCT) or lack of identified confounders.'
  };

  // Missing data plan
  const missingDataPlan: MissingDataPlan = {
    mechanism: 'MAR' as MissingDataMechanism,
    approach: 'multiple_imputation' as MissingDataApproach,
    assumptions: 'Missing data are assumed to be missing at random (MAR). Multiple imputation with chained equations (MICE) will be used with 20 imputations. Imputation models will include all analysis variables plus auxiliary variables predictive of missingness.'
  };

  // Assumption checks
  const primaryModelType = primaryAnalyses[0]?.modelType || 'linear';
  const assumptionChecks = generateAssumptionChecks(primaryModelType);

  // Sensitivity analyses
  const sensitivityAnalyses = generateDefaultSensitivityAnalyses(
    primaryModelType,
    true // Assume some missing data
  );

  // Multiplicity correction
  const multiplicityCorrection: MultiplicityCorrection =
    primaryAnalyses.length === 1 ? 'none' : 'holm';

  // Generate random seed for reproducibility
  const randomSeed = Math.floor(Math.random() * 1000000);

  const sap: StatisticalPlan = {
    id: uuid(),
    topicDeclarationId: topic.id,
    topicVersion: topic.version,
    primaryAnalyses,
    secondaryAnalyses: secondaryAnalyses.length > 0 ? secondaryAnalyses : undefined,
    covariateStrategy,
    sensitivityAnalyses,
    missingDataPlan,
    multiplicityCorrection,
    assumptionChecks,
    subgroupAnalyses: undefined, // Can be added later by user
    alphaLevel: 0.05,
    randomSeed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    approvedBy: undefined,
    approvedAt: undefined,
    executedAt: undefined
  };

  return sap;
}

/**
 * Generate suggested subgroup analyses based on topic
 */
export function suggestSubgroupAnalyses(topic: TopicDeclarationForSAP): SubgroupAnalysis[] {
  const suggestions: SubgroupAnalysis[] = [];

  // Common subgroups based on standard epidemiology
  const commonSubgroups = [
    {
      variable: 'age_group',
      categories: ['<65 years', '≥65 years'],
      justification: 'Age-specific effects may differ due to physiologic changes and comorbidity burden'
    },
    {
      variable: 'sex',
      categories: ['Male', 'Female'],
      justification: 'Sex differences in disease biology and treatment response are well-documented'
    }
  ];

  // Add disease-severity subgroup if relevant
  if (topic.researchQuestion.toLowerCase().includes('disease') ||
      topic.researchQuestion.toLowerCase().includes('severity')) {
    suggestions.push({
      variable: 'baseline_disease_severity',
      categories: ['Mild', 'Moderate', 'Severe'],
      justification: 'Treatment effects may vary by baseline disease severity'
    });
  }

  suggestions.push(...commonSubgroups);

  return suggestions;
}

/**
 * Validate SAP before approval
 */
export function validateSAP(sap: StatisticalPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for at least one primary analysis
  if (!sap.primaryAnalyses || sap.primaryAnalyses.length === 0) {
    errors.push('At least one primary analysis must be specified');
  }

  // Validate primary analyses
  sap.primaryAnalyses?.forEach((analysis, idx) => {
    if (!analysis.outcomeVariable) {
      errors.push(`Primary analysis ${idx + 1}: outcome variable is required`);
    }
    if (!analysis.exposureVariable) {
      errors.push(`Primary analysis ${idx + 1}: exposure variable is required`);
    }
    if (!analysis.hypothesis) {
      errors.push(`Primary analysis ${idx + 1}: hypothesis is required`);
    }
  });

  // Check covariate strategy
  if (!sap.covariateStrategy) {
    errors.push('Covariate adjustment strategy must be specified');
  }

  // Check missing data plan
  if (!sap.missingDataPlan) {
    errors.push('Missing data handling plan must be specified');
  }

  // Check random seed
  if (!sap.randomSeed || sap.randomSeed < 0) {
    errors.push('Valid random seed required for reproducibility');
  }

  // Check alpha level
  if (!sap.alphaLevel || sap.alphaLevel <= 0 || sap.alphaLevel > 0.5) {
    errors.push('Alpha level must be between 0 and 0.5');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
