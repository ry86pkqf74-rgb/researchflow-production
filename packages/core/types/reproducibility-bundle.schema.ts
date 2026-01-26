import { z } from "zod";

export const PromptRecordSchema = z.object({
  id: z.string(),
  stageId: z.string(),
  stageName: z.string(),
  promptTemplate: z.string(),
  renderedPrompt: z.string(),
  systemPrompt: z.string().optional(),
  variables: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  modelUsed: z.string(),
  tokenCount: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number()
  }),
  cost: z.number(),
  responseHash: z.string()
});

export type PromptRecord = z.infer<typeof PromptRecordSchema>;

export const ModelVersionSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  modelVersion: z.string().optional(),
  apiVersion: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  costPerInputToken: z.number(),
  costPerOutputToken: z.number()
});

export type ModelVersion = z.infer<typeof ModelVersionSchema>;

export const ValidationReportSchema = z.object({
  runId: z.string(),
  timestamp: z.string().datetime(),
  overallStatus: z.enum(["PASSED", "FAILED", "WARNINGS"]),
  checks: z.array(z.object({
    checkId: z.string(),
    checkName: z.string(),
    category: z.string(),
    status: z.enum(["PASSED", "FAILED", "SKIPPED", "WARNING"]),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })),
  summary: z.object({
    totalChecks: z.number(),
    passed: z.number(),
    failed: z.number(),
    warnings: z.number(),
    skipped: z.number()
  })
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export const DriftReportSchema = z.object({
  runId: z.string(),
  timestamp: z.string().datetime(),
  baselineTimestamp: z.string().datetime().optional(),
  overallDriftScore: z.number().min(0).max(1),
  driftDetected: z.boolean(),
  categories: z.array(z.object({
    category: z.string(),
    driftScore: z.number().min(0).max(1),
    changes: z.array(z.object({
      field: z.string(),
      previousValue: z.unknown(),
      currentValue: z.unknown(),
      changeType: z.enum(["ADDED", "REMOVED", "MODIFIED"]),
      significance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    }))
  })),
  recommendations: z.array(z.string())
});

export type DriftReport = z.infer<typeof DriftReportSchema>;

export const TokenUsageSummarySchema = z.object({
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalTokens: z.number(),
  byModel: z.record(z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    callCount: z.number()
  })),
  byStage: z.record(z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    callCount: z.number()
  }))
});

export type TokenUsageSummary = z.infer<typeof TokenUsageSummarySchema>;

export const CostBreakdownSchema = z.object({
  totalCost: z.number(),
  currency: z.string().default("USD"),
  byModel: z.record(z.number()),
  byStage: z.record(z.number()),
  byDate: z.record(z.number())
});

export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;

export const ReproducibilityBundleSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format"),
  bundleId: z.string().uuid(),
  researchId: z.string(),
  createdAt: z.string().datetime(),
  createdBy: z.object({
    userId: z.string(),
    name: z.string().optional(),
    role: z.string()
  }),
  environment: z.object({
    gitSha: z.string().length(40).optional(),
    gitBranch: z.string().optional(),
    gitDirty: z.boolean().optional(),
    nodeVersion: z.string().optional(),
    rosVersion: z.string().optional(),
    deploymentEnvironment: z.enum(["development", "staging", "production"])
  }),
  research: z.object({
    title: z.string(),
    description: z.string().optional(),
    topicVersion: z.number(),
    lifecycleState: z.string(),
    datasetClassification: z.string(),
    datasetHash: z.string().optional()
  }),
  prompts: z.array(PromptRecordSchema),
  modelVersions: z.array(ModelVersionSchema),
  tokenUsage: TokenUsageSummarySchema,
  costBreakdown: CostBreakdownSchema,
  validationReport: ValidationReportSchema.optional(),
  driftReport: DriftReportSchema.optional(),
  artifacts: z.array(z.object({
    artifactId: z.string(),
    artifactType: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number(),
    sha256Hash: z.string(),
    createdAt: z.string().datetime()
  })),
  approvals: z.array(z.object({
    gateId: z.string(),
    operationType: z.string(),
    status: z.string(),
    approvedBy: z.string().optional(),
    approvedAt: z.string().datetime().optional()
  })),
  checksum: z.string()
});

export type ReproducibilityBundle = z.infer<typeof ReproducibilityBundleSchema>;

export const ExportBundleRequestSchema = z.object({
  researchId: z.string(),
  includeArtifacts: z.boolean().default(true),
  includePrompts: z.boolean().default(true),
  includeValidation: z.boolean().default(true),
  includeDriftReport: z.boolean().default(true),
  format: z.enum(["json", "zip"]).default("zip")
});

export type ExportBundleRequest = z.infer<typeof ExportBundleRequestSchema>;
