import { z } from 'zod';

export const ModelTypeSchema = z.enum([
  'linear',
  'logistic', 
  'cox',
  'poisson',
  'mixed',
  'ordinal',
  'negative_binomial'
]);
export type ModelType = z.infer<typeof ModelTypeSchema>;

export const AdjustmentStrategySchema = z.enum([
  'unadjusted',
  'minimally_adjusted',
  'fully_adjusted'
]);
export type AdjustmentStrategy = z.infer<typeof AdjustmentStrategySchema>;

export const MissingDataMechanismSchema = z.enum([
  'MCAR',
  'MAR',
  'MNAR'
]);
export type MissingDataMechanism = z.infer<typeof MissingDataMechanismSchema>;

export const MissingDataApproachSchema = z.enum([
  'complete_case',
  'multiple_imputation',
  'sensitivity'
]);
export type MissingDataApproach = z.infer<typeof MissingDataApproachSchema>;

export const MultiplicityCorrectionSchema = z.enum([
  'none',
  'bonferroni',
  'fdr',
  'hierarchical',
  'holm'
]);
export type MultiplicityCorrection = z.infer<typeof MultiplicityCorrectionSchema>;

export const SAPStatusSchema = z.enum([
  'draft',
  'approved',
  'executed'
]);
export type SAPStatus = z.infer<typeof SAPStatusSchema>;

export const PrimaryAnalysisSchema = z.object({
  id: z.string(),
  hypothesis: z.string().min(1),
  outcomeVariable: z.string().min(1),
  exposureVariable: z.string().min(1),
  modelType: ModelTypeSchema,
  justification: z.string()
});
export type PrimaryAnalysis = z.infer<typeof PrimaryAnalysisSchema>;

export const CovariateStrategySchema = z.object({
  adjustment: AdjustmentStrategySchema,
  covariateList: z.array(z.string()),
  selectionRationale: z.string()
});
export type CovariateStrategy = z.infer<typeof CovariateStrategySchema>;

export const SensitivityAnalysisSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  modification: z.string()
});
export type SensitivityAnalysis = z.infer<typeof SensitivityAnalysisSchema>;

export const MissingDataPlanSchema = z.object({
  mechanism: MissingDataMechanismSchema,
  approach: MissingDataApproachSchema,
  assumptions: z.string()
});
export type MissingDataPlan = z.infer<typeof MissingDataPlanSchema>;

export const AssumptionCheckSchema = z.object({
  assumption: z.string().min(1),
  testMethod: z.string().min(1),
  threshold: z.string()
});
export type AssumptionCheck = z.infer<typeof AssumptionCheckSchema>;

export const SubgroupAnalysisSchema = z.object({
  variable: z.string().min(1),
  categories: z.array(z.string()),
  justification: z.string()
});
export type SubgroupAnalysis = z.infer<typeof SubgroupAnalysisSchema>;

export const StatisticalPlanSchema = z.object({
  id: z.string(),
  topicDeclarationId: z.string(),
  topicVersion: z.number().int().positive(),
  primaryAnalyses: z.array(PrimaryAnalysisSchema),
  secondaryAnalyses: z.array(PrimaryAnalysisSchema).optional(),
  covariateStrategy: CovariateStrategySchema,
  sensitivityAnalyses: z.array(SensitivityAnalysisSchema),
  missingDataPlan: MissingDataPlanSchema,
  multiplicityCorrection: MultiplicityCorrectionSchema,
  assumptionChecks: z.array(AssumptionCheckSchema),
  subgroupAnalyses: z.array(SubgroupAnalysisSchema).optional(),
  alphaLevel: z.number().min(0.001).max(0.1).default(0.05),
  randomSeed: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  status: SAPStatusSchema.default('draft'),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  executedAt: z.string().datetime().optional()
});
export type StatisticalPlan = z.infer<typeof StatisticalPlanSchema>;

export const CreateSAPRequestSchema = z.object({
  topicDeclarationId: z.string(),
  topicVersion: z.number().int().positive().optional(),
  primaryAnalyses: z.array(PrimaryAnalysisSchema).optional(),
  covariateStrategy: CovariateStrategySchema.optional(),
  alphaLevel: z.number().min(0.001).max(0.1).default(0.05)
});
export type CreateSAPRequest = z.infer<typeof CreateSAPRequestSchema>;

export const UpdateSAPRequestSchema = z.object({
  primaryAnalyses: z.array(PrimaryAnalysisSchema).optional(),
  secondaryAnalyses: z.array(PrimaryAnalysisSchema).optional(),
  covariateStrategy: CovariateStrategySchema.optional(),
  sensitivityAnalyses: z.array(SensitivityAnalysisSchema).optional(),
  missingDataPlan: MissingDataPlanSchema.optional(),
  multiplicityCorrection: MultiplicityCorrectionSchema.optional(),
  assumptionChecks: z.array(AssumptionCheckSchema).optional(),
  subgroupAnalyses: z.array(SubgroupAnalysisSchema).optional(),
  alphaLevel: z.number().min(0.001).max(0.1).optional(),
  randomSeed: z.number().int().optional()
});
export type UpdateSAPRequest = z.infer<typeof UpdateSAPRequestSchema>;

export interface SAPExecutionResult {
  sapId: string;
  executedAt: string;
  datasetHash: string;
  randomSeed: number;
  results: AnalysisResult[];
  softwareVersions: Record<string, string>;
  executionLog: string[];
  duration_ms: number;
}

export interface AnalysisResult {
  analysisId: string;
  analysisName: string;
  modelType: ModelType;
  outcome: string;
  exposure: string;
  sampleSize: number;
  effectEstimate: number;
  confidenceInterval: [number, number];
  pValue: number;
  adjustedPValue?: number;
  covariatesIncluded: string[];
  assumptions: AssumptionResult[];
  warnings?: string[];
}

export interface AssumptionResult {
  assumption: string;
  testStatistic: number;
  pValue: number;
  passed: boolean;
  message?: string;
}

export interface StatisticalMethods {
  sapId: string;
  sapVersion: number;
  generatedAt: string;
  datasetHash: string;
  randomSeed: number;
  narrative: string;
  softwareVersions: Record<string, string>;
  executionLog: string[];
}
