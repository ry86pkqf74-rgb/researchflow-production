/**
 * Governance types for ResearchFlow Canvas
 * Defines strict mode separation between DEMO and LIVE environments
 */

export enum AppMode {
  DEMO = 'DEMO',       // Public, no auth, no real AI
  LIVE = 'LIVE',       // Authenticated, real AI, full functionality
  STANDBY = 'STANDBY'  // System locked - no data processing, read-only status/config
}

export interface ModeConfig {
  mode: AppMode;
  requiresAuth: boolean;
  allowsRealAI: boolean;
  allowsRealData: boolean;
  allowsExport: boolean;
}

export const MODE_CONFIGS: Record<AppMode, ModeConfig> = {
  [AppMode.DEMO]: {
    mode: AppMode.DEMO,
    requiresAuth: false,
    allowsRealAI: false,
    allowsRealData: false,
    allowsExport: false
  },
  [AppMode.LIVE]: {
    mode: AppMode.LIVE,
    requiresAuth: true,
    allowsRealAI: true,
    allowsRealData: true,
    allowsExport: true
  },
  [AppMode.STANDBY]: {
    mode: AppMode.STANDBY,
    requiresAuth: false,
    allowsRealAI: false,
    allowsRealData: false,
    allowsExport: false
  }
};

/**
 * PHI (Protected Health Information) protection levels
 */
export enum PHIProtectionLevel {
  NONE = 'NONE',           // No PHI protection (demo data)
  BASIC = 'BASIC',         // Basic scanning and validation
  ENHANCED = 'ENHANCED',   // Advanced pattern matching
  MAXIMUM = 'MAXIMUM'      // Full compliance mode with audit logs
}

/**
 * Audit action types for governance tracking
 */
export enum AuditActionType {
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_UPLOAD = 'DATA_UPLOAD',
  DATA_EXPORT = 'DATA_EXPORT',
  AI_GENERATION = 'AI_GENERATION',
  PHI_DETECTION = 'PHI_DETECTION',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  MODE_SWITCH = 'MODE_SWITCH'
}

/**
 * Audit log entry for governance compliance
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  action: AuditActionType;
  mode: AppMode;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure' | 'blocked';
  reason?: string;
}

/**
 * Governance gate check result
 */
export interface GovernanceGateResult {
  allowed: boolean;
  reason?: string;
  requiredMode?: AppMode;
  missingPermissions?: string[];
}
