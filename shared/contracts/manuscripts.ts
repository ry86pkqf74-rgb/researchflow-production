/**
 * Manuscript Contracts - Phase B
 *
 * Type definitions for manuscript generation, versioning, and exports.
 * All external API calls must be PHI-scanned before processing.
 */

export type GovernanceMode = "STANDBY" | "DEMO" | "LIVE";

export type ManuscriptSectionKey =
  | "TITLE"
  | "ABSTRACT"
  | "INTRODUCTION"
  | "METHODS"
  | "RESULTS"
  | "DISCUSSION"
  | "REFERENCES"
  | "FIGURES"
  | "TABLES"
  | "SUPPLEMENT"
  | "ACKNOWLEDGEMENTS"
  | "CONFLICTS";

export type ManuscriptFormat = "md" | "docx" | "pdf" | "latex_zip";

export type ManuscriptStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "EXPORTED" | "BLOCKED";

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "BLOCKED";

export interface Manuscript {
  id: string;
  title: string;
  mode: GovernanceMode;
  status: ManuscriptStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SectionRevision {
  id: string;
  manuscriptId: string;
  sectionKey: ManuscriptSectionKey;
  version: number;
  contentMd: string;
  contentJson?: Record<string, unknown>; // TipTap editor JSON
  createdAt: string;
  createdBy: string;
  commitMessage?: string;
  parentRevisionId?: string;
  wordCount?: number;
}

export interface GenerateSectionRequest {
  manuscriptId: string;
  sectionKey: ManuscriptSectionKey;
  inputs: {
    /** Pointers to lit summaries already stored internally */
    litSummaryRefs?: string[];
    /** Pointers to de-identified dataset metadata */
    dataMetadataRefs?: string[];
    /** Pointers to artifacts/figures/tables manifests */
    artifactRefs?: string[];
    /** Optional template hint */
    journalStyleId?: string;
  };
  constraints?: {
    wordTarget?: number;
    tone?: "medical_surgical" | "neutral" | "lay";
    citationStyle?: "vancouver" | "apa" | "nejm" | "ama";
  };
}

export interface GenerateSectionResponse {
  jobId: string;
  statusUrl: string;
}

export interface ExportRequest {
  manuscriptId: string;
  format: ManuscriptFormat;
  journalStyleId?: string;
  doubleBlind?: boolean;
}

export interface ExportResponse {
  jobId: string;
  statusUrl: string;
}

export interface ClaimCheckFinding {
  sentence: string;
  sectionKey: ManuscriptSectionKey;
  severity: "low" | "medium" | "high";
  evidenceRefs: string[];
  note: string;
  startIndex?: number;
  endIndex?: number;
}

export interface ClaimCheckResponse {
  findings: ClaimCheckFinding[];
  totalClaims: number;
  verifiedClaims: number;
  unsubstantiatedClaims: number;
}

export interface ManuscriptJob {
  id: string;
  manuscriptId: string;
  jobType: string;
  status: JobStatus;
  requestJson: Record<string, unknown>;
  resultJson?: Record<string, unknown>;
  errorText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RollbackRequest {
  targetRevisionId: string;
}

export interface RollbackResponse {
  ok: boolean;
  revision: {
    id: string;
    version: number;
  };
}

export interface PeerReviewSimulation {
  reviewer1: string;
  reviewer2: string;
  editor: string;
  actionItems: string[];
  overallScore?: number;
}

export interface SubmissionValidationIssue {
  severity: "low" | "medium" | "high";
  issue: string;
  section?: ManuscriptSectionKey;
  suggestion?: string;
}

export interface SubmissionValidationResult {
  isValid: boolean;
  issues: SubmissionValidationIssue[];
  wordCounts: Record<ManuscriptSectionKey, number>;
  missingRequiredSections: ManuscriptSectionKey[];
}

export interface CoDraftRequest {
  manuscriptId: string;
  sectionKey: ManuscriptSectionKey;
  instruction: string;
  selectedText?: string;
}

export interface CoDraftResponse {
  jobId: string;
  statusUrl: string;
}

export interface TranslationRequest {
  manuscriptId: string;
  sectionKey: ManuscriptSectionKey;
  targetLanguage: string;
}

export interface TranslationResponse {
  jobId: string;
  statusUrl: string;
}
