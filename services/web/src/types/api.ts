/**
 * Frontend API Types for ResearchFlow Canvas
 *
 * These types define the structure of data exchanged between the client and server.
 * Once Replit adds the governance tables to shared/schema.ts, we can import types
 * directly from there instead of maintaining duplicates here.
 *
 * INTEGRATION NOTE: When shared/schema.ts is updated with Dataset, Approval, and
 * AuditLog tables, replace these placeholder types with imports like:
 * import type { Dataset, Approval, AuditLog } from '@shared/schema';
 */

// ============================================
// PLACEHOLDER TYPES (Until Replit adds tables)
// ============================================

/**
 * Dataset classification levels for data governance
 */
export type DataClassification = 'SYNTHETIC' | 'DEIDENTIFIED' | 'IDENTIFIED' | 'UNKNOWN';

/**
 * Dataset entity representing research data
 * TODO: Replace with import from @shared/schema when available
 */
export interface Dataset {
  id: string;
  name: string;
  classification: DataClassification;
  uploadedAt: Date | string;
  uploadedBy: string;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  phiScanPassed: boolean;
  phiScanAt?: Date | string | null;
  source?: string | null;
  irbNumber?: string | null;
  deidentificationMethod?: string | null;
  schemaVersion?: string | null;
  format: string; // CSV, XLSX, JSON, etc.
  sizeBytes: number;
  recordCount: number;
}

/**
 * Input for creating a new dataset
 */
export interface CreateDatasetInput {
  name: string;
  classification: DataClassification;
  uploadedBy: string;
  source?: string;
  irbNumber?: string;
  deidentificationMethod?: string;
  format: string;
  sizeBytes: number;
  recordCount: number;
}

/**
 * Approval workflow statuses
 */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Operations that require approval
 */
export type ApprovalOperation =
  | 'UPLOAD'
  | 'EXPORT'
  | 'LLM_CALL'
  | 'MODE_CHANGE'
  | 'DATA_TRANSFORM';

/**
 * Approval entity for governance workflows
 * TODO: Replace with import from @shared/schema when available
 */
export interface Approval {
  id: string;
  operation: ApprovalOperation;
  requestedById: string;
  requestedByEmail: string;
  approvedById?: string | null;
  approvedByEmail?: string | null;
  status: ApprovalStatus;
  reason?: string | null;
  datasetId?: string | null;
  createdAt: Date | string;
  approvedAt?: Date | string | null;
}

/**
 * Input for requesting an approval
 */
export interface ApprovalRequest {
  operation: ApprovalOperation;
  requestedById: string;
  requestedByEmail: string;
  reason?: string;
  datasetId?: string;
}

/**
 * Audit log entry for compliance tracking
 * TODO: Replace with import from @shared/schema when available
 */
export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  operation: string;
  datasetId?: string | null;
  ipAddress?: string | null;
  timestamp: Date | string;
  details?: string | null; // JSON string
  hashChain?: string | null; // SHA256 hash for tamper detection
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  userId?: string;
  operation?: string;
  datasetId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

// ============================================
// PHI SCANNING
// ============================================

/**
 * Result of PHI scanning operation
 */
export interface PhiScanResult {
  passed: boolean;
  detectedPatterns: string[];
  confidence: number; // 0-1
  scannedAt: Date | string;
  warnings: string[];
}

// ============================================
// USER & AUTHENTICATION
// ============================================

/**
 * User roles for RBAC
 */
export type UserRole = 'VIEWER' | 'RESEARCHER' | 'STEWARD' | 'ADMIN';

/**
 * User permissions
 */
export type Permission =
  | 'VIEW_DATA'
  | 'UPLOAD_DATA'
  | 'EXPORT_DATA'
  | 'APPROVE_OPERATIONS'
  | 'MANAGE_USERS'
  | 'CONFIGURE_SYSTEM'
  | 'VIEW_AUDIT_LOGS'
  | 'CHANGE_MODE';

/**
 * User entity
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  permissions: Permission[];
  createdAt?: Date | string;
}

// ============================================
// GOVERNANCE
// ============================================

/**
 * Governance modes
 */
export type GovernanceMode = 'STANDBY' | 'DEMO' | 'LIVE';

/**
 * Feature flags for governance
 */
export interface FeatureFlags {
  REQUIRE_PHI_SCAN: boolean;
  PHI_SCAN_ON_UPLOAD: boolean;
  ALLOW_UPLOADS: boolean;
  ALLOW_EXPORTS: boolean;
  ALLOW_LLM_CALLS: boolean;
  REQUIRE_APPROVAL_FOR_EXPORTS: boolean;
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Error severity levels for routing to appropriate handlers
 */
export type ErrorSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL';

/**
 * API error response structure
 */
export interface APIError {
  message: string;
  code?: string;
  severity: ErrorSeverity;
  details?: Record<string, any>;
  timestamp: Date | string;
}

// ============================================
// API RESPONSE WRAPPERS
// ============================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
