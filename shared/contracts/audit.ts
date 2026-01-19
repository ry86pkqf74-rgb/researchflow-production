/**
 * Audit Contracts - Phase B
 *
 * Type definitions for audit trail and governance events.
 * All audit entries are append-only and hash-chained for integrity.
 */

export type AuditEventType =
  | "MANUSCRIPT_CREATED"
  | "SECTION_GENERATED"
  | "SECTION_EDITED"
  | "SECTION_ROLLBACK"
  | "EXPORT_REQUESTED"
  | "EXPORT_COMPLETED"
  | "PHI_BLOCKED"
  | "PHI_SCAN_PASSED"
  | "CLAIM_VERIFICATION"
  | "PEER_REVIEW_SIMULATED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "EXTERNAL_API_CALL"
  | "STYLE_CHECK"
  | "PLAGIARISM_CHECK"
  | "DOI_MINTED"
  | "ORCID_FETCHED"
  | "TRANSLATION_REQUESTED"
  | "FEEDBACK_SUBMITTED";

export interface ManuscriptAuditEvent {
  id: string;
  manuscriptId: string;
  eventType: AuditEventType;
  actor: string;
  detailsJson: AuditEventDetails;
  createdAt: string;
  previousHash?: string;
  currentHash: string;
}

export interface AuditEventDetails {
  /** Section affected, if applicable */
  sectionKey?: string;
  /** Job ID if event relates to a job */
  jobId?: string;
  /** Revision ID if event relates to a revision */
  revisionId?: string;
  /** Format for export events */
  format?: string;
  /** External service name for API calls */
  externalService?: string;
  /** PHI location info (never the actual PHI) */
  phiLocations?: PhiLocation[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Reason for approval/denial */
  reason?: string;
  /** IP address of actor (hashed in LIVE mode) */
  ipHash?: string;
}

export interface PhiLocation {
  /** Row/line number */
  row?: number;
  /** Column number */
  column?: number;
  /** Section where PHI was detected */
  section?: string;
  /** Start offset in text */
  startOffset: number;
  /** End offset in text */
  endOffset: number;
  /** PHI type detected */
  phiType: string;
}

export interface AuditTrailQuery {
  manuscriptId: string;
  startDate?: string;
  endDate?: string;
  eventTypes?: AuditEventType[];
  actor?: string;
  limit?: number;
  offset?: number;
}

export interface AuditTrailResponse {
  events: ManuscriptAuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface GovernanceGateResult {
  allowed: boolean;
  reason?: string;
  requiredApprovals?: string[];
  auditEventId?: string;
}

export interface ApprovalRequest {
  manuscriptId: string;
  action: "EXPORT" | "EXTERNAL_API" | "PUBLISH";
  requestedBy: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalResponse {
  id: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  approvedBy?: string;
  approvedAt?: string;
  denialReason?: string;
}
