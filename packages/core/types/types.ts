import { z } from "zod";

export interface ScopeSubsection {
  id: string;
  label: string;
  placeholder: string;
}

export interface ScopeRefinement {
  enabled: boolean;
  subsections: ScopeSubsection[];
}

export interface AISuggestion {
  type: 'narrow' | 'expand' | 'improve';
  text: string;
  targetSection?: 'population' | 'intervention' | 'comparator' | 'outcomes' | 'timeframe';
}

export interface TopicScopeValues {
  population?: string;
  intervention?: string;
  comparator?: string;
  outcomes?: string;
  timeframe?: string;
}

export interface ExtendedTopicFields {
  datasetSource?: string;
  cohortInclusion?: string[];
  cohortExclusion?: string[];
  exposures?: string[];
  covariates?: string[];
  constraints?: string;
}

export interface TopicScopeValuesExtended extends TopicScopeValues, ExtendedTopicFields {}

export interface TopicVersion {
  version: number;
  timestamp: string;
  scopeValues: TopicScopeValues;
  extendedFields?: ExtendedTopicFields;
  changeType: 'initial' | 'refinement' | 'major_revision' | 'ai_suggestion';
  changeDescription?: string;
  aiSuggestionsApplied?: number[];
  createdBy?: string;
  sha256Hash?: string;
}

export interface TopicVersionHistory {
  currentVersion: number;
  versions: TopicVersion[];
  lockedAt?: string;
  lockedBy?: string;
}

export interface JournalRecommendation {
  id: string;
  name: string;
  impactFactor: number;
  acceptanceRate: string;
  reviewTime: string;
  strengths: string[];
  weaknesses: string[];
  fitScore: number;
  openAccess: boolean;
  publicationFee?: string;
}

export interface SubmissionRequirement {
  category: string;
  items: {
    name: string;
    description: string;
    required: boolean;
    status: 'pending' | 'complete';
  }[];
}

export interface SubmissionPackage {
  journal: JournalRecommendation;
  requirements: SubmissionRequirement[];
  documents: {
    name: string;
    type: string;
    content: string;
    status: 'generated' | 'pending';
  }[];
  checklist: {
    item: string;
    completed: boolean;
  }[];
}

export interface WorkflowStage {
  id: number;
  name: string;
  shortName: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  icon: string;
  outputs: string[];
  duration: string;
  scopeRefinement?: ScopeRefinement;
  aiSuggestions?: AISuggestion[];
  dependencies?: string[];
  executedAt?: string;
  topicVersionAtExecution?: string;
}

export interface WorkflowStageGroup {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  isOptional: boolean;
  stages: WorkflowStage[];
}

export interface ManuscriptProposal {
  id: number;
  title: string;
  abstract: string;
  relevanceScore: number;
  noveltyScore: number;
  feasibilityScore: number;
  suggestedJournals: string[];
  keywords: string[];
}

export interface ResearchCapability {
  id: string;
  title: string;
  description: string;
  features: string[];
  icon: string;
}

export interface ComplianceFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'active' | 'validated' | 'certified';
}

export interface DemoDataset {
  id: string;
  name: string;
  type: string;
  records: number;
  variables: number;
  description: string;
  domain?: string;
  dateRange?: string;
  phiStatus?: string;
}

export interface ResearchDataset {
  id: string;
  name: string;
  domain: string;
  type: string;
  records: number;
  variables: number;
  description: string;
  dateRange: string;
  phiStatus: string;
  icon: string;
  color: string;
  sampleVariables: string[];
}

export interface TimelineStep {
  id: string;
  name: string;
  traditionalDuration: string;
  rosDuration: string;
  traditionalDays: number;
  rosDays: number;
  description: string;
}

export interface ResearchTimeline {
  traditional: {
    totalDays: number;
    steps: TimelineStep[];
  };
  ros: {
    totalDays: number;
    steps: TimelineStep[];
  };
}

export interface GeneratedProposal {
  id: number;
  title: string;
  abstract: string;
  relevanceScore: number;
  noveltyScore: number;
  feasibilityScore: number;
  suggestedJournals: string[];
  keywords: string[];
  methodology: string;
  expectedOutcome: string;
}

export interface BaselineCharacteristic {
  variable: string;
  overall: string;
  group1: string;
  group2: string;
  pValue: string;
}

export const demoRequestSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  institution: z.string().min(1, "Institution is required"),
  message: z.string().optional(),
});

export type DemoRequest = z.infer<typeof demoRequestSchema>;

export interface StageExecutionOutput {
  title: string;
  content: string;
  type: 'text' | 'table' | 'list' | 'document' | 'chart';
}

export interface ManuscriptProposalCard {
  id: number;
  title: string;
  description: string;
  relevance: number;
  novelty: number;
  feasibility: number;
  targetJournals: string[];
}

export interface StageExecutionResult {
  stageId: number;
  stageName: string;
  status: 'completed' | 'error';
  executionTime: string;
  outputs: StageExecutionOutput[];
  summary: string;
  nextStageId?: number;
  aiPowered?: boolean;
  literatureData?: unknown;
  manuscriptProposals?: ManuscriptProposalCard[];
  journalRecommendations?: JournalRecommendation[];
}

export interface ResearchBrief {
  studyObjectives: string[];
  population: string;
  exposure: string;
  comparator: string;
  outcomes: string[];
  timeframe: string;
  candidateEndpoints: { name: string; definition: string }[];
  keyConfounders: string[];
  minimumDatasetFields: { field: string; reason: string }[];
  clarifyingPrompts: string[];
}

export interface EvidenceGapMap {
  knowns: { finding: string; evidence: string; sources: string[] }[];
  unknowns: { gap: string; importance: string; researchable: boolean }[];
  commonMethods: { method: string; description: string; applicability: string }[];
  commonPitfalls: { pitfall: string; mitigation: string }[];
  searchStrategies: { database: string; query: string }[];
}

export interface DataContribution {
  contributionStatements: { statement: string; dataSupport: string }[];
  claimBoundary: {
    canSay: string[];
    cannotSay: string[];
  };
  limitations: { limitation: string; impact: string; mitigation: string }[];
}

export interface TargetJournal {
  name: string;
  impactFactor: number;
  acceptanceLikelihood: "high" | "medium" | "low";
  alignment: string[];
  potentialGaps: string[];
  wordLimit: number;
  figureLimit: number;
  audience: string;
  whyThisJournal: string;
}

export interface StudyCard {
  id: number;
  title: string;
  researchQuestion: string;
  hypothesis: string;
  cohortDefinition: string;
  indexDate: string;
  exposures: string[];
  outcomes: string[];
  covariates: string[];
  plannedMethod: string;
  feasibilityScore: number;
  threatsToValidity: { threat: string; mitigation: string }[];
  expectedFigures: string[];
  expectedTables: string[];
  targetJournals: TargetJournal[];
}

export interface DecisionMatrixProposal {
  id: number;
  title: string;
  novelty: number;
  feasibility: number;
  clinicalImportance: number;
  timeToExecute: string;
  confoundingRisk: "low" | "medium" | "high";
  overallScore: number;
}

export interface DecisionMatrix {
  proposals: DecisionMatrixProposal[];
  recommendedPick: number;
  reasons: string[];
}

export interface ManuscriptVersion {
  id: string;
  branchName: string;
  content: string;
  topicVersionHash: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  parentVersionId?: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  changedSections?: string[];
}

export interface ManuscriptBranch {
  id: string;
  name: string;
  versions: ManuscriptVersion[];
  currentVersionId: string;
  isMain: boolean;
}

export interface ManuscriptWorkspaceState {
  branches: ManuscriptBranch[];
  activeBranchId: string;
  compareMode: boolean;
  compareBranchIds?: [string, string];
}

export interface SelectedJournal {
  journalId: string;
  name: string;
  impactFactor: number;
  scope: string;
  selectedAt: string;
}

export interface WorkflowState {
  id: string;
  topicVersionHash: string;
  currentStageId: number;
  stages: WorkflowStage[];
  selectedJournal?: SelectedJournal;
  manuscriptWorkspace?: ManuscriptWorkspaceState;
  createdAt: string;
  updatedAt: string;
}

export interface ReproducibilityArtifact {
  id: string;
  name: string;
  type: 'config' | 'data_schema' | 'analysis_script' | 'output' | 'manifest';
  path: string;
  size: string;
  hash?: string;
  description?: string;
}

export interface ReproducibilityBundle {
  id: string;
  name: string;
  artifacts: ReproducibilityArtifact[];
  checksum: string;
  generatedAt: string;
  topicVersionHash: string;
  totalSize: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
}
