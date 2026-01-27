/**
 * Guidelines Engine Types
 *
 * Type definitions for clinical guidelines, scoring systems, staging,
 * and validation blueprint generation.
 */

// =============================================================================
// Source Registry
// =============================================================================

export interface SourceRegistry {
  id: string;
  publisherName: string;
  urlPattern?: string;
  accessMethod: 'public_web' | 'pdf' | 'api' | 'subscription' | 'manual_upload';
  licenseType: 'public_domain' | 'permissive' | 'copyrighted_linkable' | 'subscription' | 'internal_only' | 'unknown';
  updateCadence?: 'rolling' | 'annual' | 'major_editions';
  allowStoreFullText: boolean;
  allowStoreTables: boolean;
  allowStoreEmbeddings: boolean;
  allowShowExcerpts: boolean;
  excerptMaxLength: number;
  requireDeepLink: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Guideline Documents
// =============================================================================

export interface GuidelineDocument {
  id: string;
  title: string;
  publisher?: string;
  publicationDate?: Date;
  versionLabel?: string;
  url?: string;
  jurisdiction?: string;
  sourceRegistryId?: string;
  rawArtifactPath?: string;
  changeSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// System Cards
// =============================================================================

export interface ConditionConcept {
  system: 'MeSH' | 'SNOMED' | 'ICD10' | 'ICD11';
  code: string;
  term: string;
}

export interface InputVariable {
  name: string;
  type: 'numeric' | 'categorical' | 'boolean' | 'date' | 'text';
  unit?: string;
  required: boolean;
  description?: string;
  validValues?: string[] | { min?: number; max?: number };
}

export interface OutputDefinition {
  name: string;
  type: 'score' | 'stage' | 'grade' | 'class' | 'category' | 'risk';
  range?: string;
  labels?: string[];
  description?: string;
}

export interface InterpretationEntry {
  range: string;
  meaning: string;
  clinicalAction?: string;
}

export interface EvidenceSummary {
  derivationStudy?: string;
  derivationPopulation?: string;
  derivationSize?: number;
  validationStudies?: number;
  lastValidated?: Date;
  knownLimitations?: string[];
}

export type SystemCardType = 'score' | 'staging' | 'grading' | 'guideline' | 'classification' | 'criteria' | 'reporting_standard';
export type IntendedUse = 'diagnosis' | 'prognosis' | 'treatment_selection' | 'severity' | 'complications' | 'quality';
export type SystemCardStatus = 'active' | 'superseded' | 'retired' | 'draft';

export interface SystemCard {
  id: string;
  name: string;
  type: SystemCardType;
  specialty?: string;
  conditionConcepts: ConditionConcept[];
  intendedUse?: IntendedUse;
  population?: string;
  careSetting?: string;
  inputs: InputVariable[];
  outputs: OutputDefinition[];
  interpretation: InterpretationEntry[];
  limitations?: string[];
  evidenceSummary?: EvidenceSummary;
  guidelineDocumentId?: string;
  version?: string;
  effectiveDate?: Date;
  supersededBy?: string;
  status: SystemCardStatus;
  extractionConfidence?: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Rule Specs
// =============================================================================

export type RuleType = 'threshold' | 'lookup_table' | 'formula' | 'decision_tree';

export interface RuleTestCase {
  inputs: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  description?: string;
}

export interface ThresholdCriterion {
  variable: string;
  condition: 'equals' | 'gte' | 'gt' | 'lte' | 'lt' | 'boolean' | 'in';
  value?: unknown;
  threshold?: number;
  points: number;
  name?: string;
  required?: boolean;
}

export interface ThresholdRuleDefinition {
  criteria: ThresholdCriterion[];
  categories: Array<{ min: number; max: number; label: string }>;
  interpretations?: Record<string, string>;
}

export interface LookupRuleDefinition {
  keys: string[];
  table: Record<string, Record<string, unknown>>;
}

export interface FormulaRuleDefinition {
  formula: string;
  variables: Array<{ name: string; required: boolean; default?: number }>;
  categories?: Array<{ min: number; max: number; label: string }>;
}

export interface RuleSpec {
  id: string;
  systemCardId: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  ruleDefinition: ThresholdRuleDefinition | LookupRuleDefinition | FormulaRuleDefinition | Record<string, unknown>;
  testCases: RuleTestCase[];
  validated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Evidence Statements
// =============================================================================

export type EvidenceStrength = 'strong' | 'moderate' | 'weak' | 'expert_consensus';
export type EvidenceQuality = 'high' | 'moderate' | 'low' | 'very_low';
export type EvidenceType = 'rct' | 'cohort' | 'case_control' | 'case_series' | 'expert_opinion';

export interface EvidenceStatement {
  id: string;
  systemCardId: string;
  statementText: string;
  strength?: EvidenceStrength;
  quality?: EvidenceQuality;
  evidenceType?: EvidenceType;
  citationRef?: string;
  sourceUrl?: string;
  sourcePage?: string;
  sourceSection?: string;
  createdAt: Date;
}

// =============================================================================
// Version Graph
// =============================================================================

export type ChangeType = 'new_edition' | 'correction' | 'update' | 'major_revision';

export interface VersionGraphEntry {
  id: string;
  systemCardId: string;
  previousVersionId?: string;
  changeType?: ChangeType;
  changeSummary?: string;
  diffData?: Record<string, unknown>;
  createdAt: Date;
}

// =============================================================================
// Validation Blueprints
// =============================================================================

export type StudyIntent =
  | 'external_validation'
  | 'temporal_validation'
  | 'subgroup_validation'
  | 'head_to_head'
  | 'recalibration'
  | 'simplification'
  | 'fairness';

export interface DataDictionaryEntry {
  variable: string;
  type: 'numeric' | 'categorical' | 'boolean' | 'date' | 'text';
  source: string;
  required: boolean;
  description?: string;
  mapping?: string;
}

export interface OutcomeDefinition {
  name: string;
  type: 'binary' | 'continuous' | 'time_to_event' | 'ordinal';
  timeHorizon?: string;
  definition?: string;
}

export interface AnalysisMethod {
  method: string;
  rationale: string;
  assumptions?: string[];
  alternatives?: string[];
}

export interface ValidationMetric {
  metric: string;
  interpretation: string;
  threshold?: string;
}

export type BlueprintStatus = 'draft' | 'finalized' | 'exported';

export interface ValidationBlueprint {
  id: string;
  systemCardId: string;
  userId: string;
  studyIntent: StudyIntent;
  researchAims: string[];
  hypotheses: string[];
  dataDictionary: DataDictionaryEntry[];
  outcomes: OutcomeDefinition[];
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  analysisPlan: AnalysisMethod[];
  validationMetrics: ValidationMetric[];
  sensitivityAnalyses: string[];
  limitations?: string[];
  reportingChecklist: string[];
  status: BlueprintStatus;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Calculator Results
// =============================================================================

export type CalculationContext = 'research' | 'education' | 'demo';

export interface CalculatorResult {
  id: string;
  systemCardId: string;
  ruleSpecId?: string;
  userId?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  interpretation?: string;
  context: CalculationContext;
  createdAt: Date;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface SearchSystemCardsRequest {
  query?: string;
  type?: SystemCardType;
  specialty?: string;
  condition?: string;
  intendedUse?: IntendedUse;
  status?: SystemCardStatus;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchSystemCardsResponse {
  systems: SystemCard[];
  total: number;
  limit: number;
  offset: number;
}

export interface SystemCardWithDetails {
  systemCard: SystemCard;
  ruleSpecs: RuleSpec[];
  evidence: EvidenceStatement[];
  versions: VersionGraphEntry[];
}

export interface CompareVersionsRequest {
  systemCardIdA: string;
  systemCardIdB: string;
}

export interface VersionDifference {
  field: string;
  valueA: unknown;
  valueB: unknown;
  significance: 'minor' | 'moderate' | 'major';
}

export interface CompareVersionsResponse {
  systemA: SystemCard;
  systemB: SystemCard;
  differences: VersionDifference[];
  summary: string;
}

export interface GenerateBlueprintRequest {
  systemCardId: string;
  studyIntent: StudyIntent;
  additionalContext?: string;
  targetPopulation?: string;
  availableData?: string[];
}

export interface CalculateScoreRequest {
  systemCardId: string;
  inputs: Record<string, unknown>;
  context?: CalculationContext;
}

export interface CalculateScoreResponse {
  result: CalculatorResult;
  systemCard: SystemCard;
  ruleSpec?: RuleSpec;
}

export interface SummarizeGuidelineResponse {
  summary: string;
  systemCard: SystemCard;
}

// =============================================================================
// Create/Update DTOs
// =============================================================================

export type CreateSystemCardInput = Omit<SystemCard, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSystemCardInput = Partial<Omit<SystemCard, 'id' | 'createdAt' | 'updatedAt'>>;
export type CreateRuleSpecInput = Omit<RuleSpec, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateEvidenceStatementInput = Omit<EvidenceStatement, 'id' | 'createdAt'>;
export type CreateValidationBlueprintInput = Omit<ValidationBlueprint, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateValidationBlueprintInput = Partial<Omit<ValidationBlueprint, 'id' | 'systemCardId' | 'userId' | 'createdAt' | 'updatedAt'>>;
