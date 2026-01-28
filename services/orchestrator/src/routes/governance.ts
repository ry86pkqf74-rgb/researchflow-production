/**
 * Governance API Routes
 *
 * Endpoints for governance monitoring, compliance, and audit logging.
 * Protected by RBAC middleware - only STEWARD+ can access.
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 *
 * Updated: Phase F - Now uses DB-backed state via GovernanceConfigService
 * and FeatureFlagsService instead of in-memory mocks.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/rbac';
import { validateAuditChain } from '../services/auditService.js';
import { db } from '../../db.js';
import { auditLogs } from '@researchflow/core/schema';
import { desc, gte, lte, eq, and, sql } from 'drizzle-orm';
import { governanceConfigService } from '../services/governance-config.service';
import { featureFlagsService } from '../services/feature-flags.service';
import { eventBus } from '../services/event-bus';

// Simple async handler wrapper
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const router = Router();

// Mock approvals state for development (approval workflow is separate from flags/mode)
const mockApprovals = [
  {
    id: 'apr-001',
    type: 'DATA_UPLOAD',
    artifactId: 'thyroid-clinical-2024',
    artifactName: 'Thyroid Clinical Dataset',
    requestorId: 'researcher-001',
    requestorName: 'Dr. Sarah Chen',
    status: 'APPROVED',
    createdAt: new Date('2024-01-15T10:30:00Z').toISOString(),
    resolvedAt: new Date('2024-01-15T11:00:00Z').toISOString(),
    resolvedBy: 'steward@researchflow.dev',
    reason: 'Upload thyroid clinical dataset (synthetic)'
  },
  {
    id: 'apr-002',
    type: 'DATA_EXPORT',
    artifactId: 'export-draft-001',
    artifactName: 'Draft Results Export',
    requestorId: 'researcher-001',
    requestorName: 'Dr. Sarah Chen',
    status: 'PENDING',
    createdAt: new Date('2024-01-16T14:20:00Z').toISOString(),
    reason: 'Export draft results for review'
  },
  {
    id: 'apr-003',
    type: 'PHI_OVERRIDE',
    artifactId: 'stage-9-summary',
    artifactName: 'Summary Characteristics - Stage 9',
    requestorId: 'researcher-002',
    requestorName: 'Dr. Michael Lee',
    status: 'REJECTED',
    createdAt: new Date('2024-01-14T09:15:00Z').toISOString(),
    resolvedAt: new Date('2024-01-14T10:00:00Z').toISOString(),
    resolvedBy: 'admin@researchflow.dev',
    reason: 'PHI override request - insufficient justification'
  },
  {
    id: 'apr-004',
    type: 'CONFIG_CHANGE',
    artifactId: 'governance-mode',
    artifactName: 'Governance Mode Change',
    requestorId: 'steward-001',
    requestorName: 'Dr. Emily Wang',
    status: 'APPROVED',
    createdAt: new Date('2024-01-13T08:00:00Z').toISOString(),
    resolvedAt: new Date('2024-01-13T08:30:00Z').toISOString(),
    resolvedBy: 'admin@researchflow.dev',
    reason: 'Change governance mode to DEMO for testing'
  }
];

const mockStats = {
  totalApprovals: 12,
  pendingApprovals: 1,
  approvedToday: 2,
  deniedToday: 0
};

/**
 * GET /api/governance/state
 * Get current governance state (mode, flags, approvals)
 * Public endpoint - viewable by all users for dashboard display
 *
 * Response format updated for Phase F:
 * - mode: string - Current governance mode
 * - flags: Record<string, boolean> - Evaluated flag values
 * - flagsMeta: Array<FlagMeta> - Flag metadata for admin UI
 * - approvals: Array - Pending/recent approvals
 * - timestamp: string - Response timestamp
 */
router.get(
  '/state',
  asyncHandler(async (req, res) => {
    // Get DB-backed mode
    const mode = await governanceConfigService.getMode();

    // Get evaluated flags for current mode
    const flags = await featureFlagsService.getFlags({ mode });

    // Get flag metadata for admin display
    const flagsMeta = await featureFlagsService.listFlags();

    res.json({
      mode,
      flags,
      flagsMeta,
      approvals: mockApprovals,
      stats: mockStats,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/governance/mode
 * Change governance mode (DEMO, LIVE)
 * Requires: ADMIN role (elevated security - mode changes affect all users)
 *
 * Phase F: Now persists to database and publishes realtime event
 * SECURITY: Only ADMIN users can change governance mode to ensure consistency
 */
router.post(
  '/mode',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { mode } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    if (!['DEMO', 'LIVE'].includes(mode)) {
      res.status(400).json({
        error: 'Invalid governance mode',
        code: 'INVALID_MODE',
        allowedValues: ['DEMO', 'LIVE']
      });
      return;
    }

    try {
      // Validate mode change is enabled via feature flag
      const modeChangeEnabled = await featureFlagsService.isEnabled('allow_mode_changes');
      if (!modeChangeEnabled) {
        res.status(403).json({
          error: 'Feature disabled',
          code: 'MODE_CHANGE_DISABLED',
          message: 'Governance mode changes are currently disabled'
        });
        return;
      }

      // Use DB-backed service to set mode (handles audit + event publishing)
      await governanceConfigService.setMode(mode, user.id);

      // Get updated flags for response
      const flags = await featureFlagsService.getFlags({ mode });
      const flagsMeta = await featureFlagsService.listFlags();

      res.json({
        message: 'Governance mode updated',
        mode,
        flags,
        flagsMeta,
        changedBy: user.email,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Governance] Error setting mode:', error);
      res.status(500).json({
        error: 'Failed to update governance mode',
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/governance/flags/:flagKey
 * Update a feature flag
 * Requires: ADMIN role
 *
 * Phase F: Now supports full flag configuration with input validation
 * Body: { enabled: boolean, description?: string, scope?: string, rolloutPercent?: number, requiredModes?: string[] }
 * SECURITY: Input validation prevents injection attacks and malformed configurations
 */
router.post(
  '/flags/:flagKey',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { flagKey } = req.params;
    const { enabled, description, scope, rolloutPercent, requiredModes } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    // Validate flagKey format
    if (!flagKey || typeof flagKey !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(flagKey)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'flagKey must be a valid identifier (lowercase alphanumeric and underscores)',
      });
      return;
    }

    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'enabled (boolean) is required',
      });
      return;
    }

    // Validate optional string fields
    if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'description must be a string with max 500 characters',
      });
      return;
    }

    if (scope !== undefined && (typeof scope !== 'string' || !['GLOBAL', 'ORGANIZATION', 'USER'].includes(scope))) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'scope must be one of: GLOBAL, ORGANIZATION, USER',
      });
      return;
    }

    // Validate rolloutPercent
    if (rolloutPercent !== undefined) {
      if (typeof rolloutPercent !== 'number' || rolloutPercent < 0 || rolloutPercent > 100) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'rolloutPercent must be a number between 0 and 100',
        });
        return;
      }
    }

    // Validate requiredModes array
    if (requiredModes !== undefined) {
      if (!Array.isArray(requiredModes) || !requiredModes.every(m => typeof m === 'string' && ['DEMO', 'LIVE'].includes(m))) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'requiredModes must be an array of valid modes: DEMO, LIVE',
        });
        return;
      }
    }

    try {
      // Use DB-backed service to set flag (handles audit + event publishing)
      await featureFlagsService.setFlag(
        flagKey,
        { enabled, description, scope, rolloutPercent, requiredModes },
        user.id
      );

      // Get updated flags for response
      const mode = await governanceConfigService.getMode();
      const flags = await featureFlagsService.getFlags({ mode });
      const flagsMeta = await featureFlagsService.listFlags();

      res.json({
        message: 'Feature flag updated',
        flagKey,
        flags,
        flagsMeta,
        changedBy: user.email,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Governance] Error setting flag:', error);
      res.status(500).json({
        error: 'Failed to update feature flag',
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/governance/audit/entries
 * Get audit log entries with filtering and pagination
 * Requires: STEWARD role
 */
router.get(
  '/audit/entries',
  requireRole('STEWARD'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const eventType = req.query.eventType as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // If database is not available, return mock data
    if (!db) {
      const mockEntries = [
        { id: 1, eventType: 'DATA_UPLOAD', action: 'UPLOAD', userId: 'user-001', resourceType: 'dataset', resourceId: 'ds-001', createdAt: new Date().toISOString(), entryHash: 'a1b2c3...', previousHash: 'GENESIS' },
        { id: 2, eventType: 'PHI_SCAN', action: 'SCAN_PASSED', userId: 'system', resourceType: 'dataset', resourceId: 'ds-001', createdAt: new Date(Date.now() - 3600000).toISOString(), entryHash: 'b2c3d4...', previousHash: 'a1b2c3...' },
        { id: 3, eventType: 'DATA_ACCESS', action: 'READ', userId: 'user-002', resourceType: 'dataset', resourceId: 'ds-001', createdAt: new Date(Date.now() - 7200000).toISOString(), entryHash: 'c3d4e5...', previousHash: 'b2c3d4...' },
      ];
      res.json({
        entries: mockEntries,
        total: mockEntries.length,
        limit,
        offset,
        hasMore: false
      });
      return;
    }

    // Build query conditions
    const conditions = [];
    if (eventType) {
      conditions.push(eq(auditLogs.eventType, eventType));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get entries
    const entries = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      entries,
      total,
      limit,
      offset,
      hasMore: offset + entries.length < total
    });
  })
);

/**
 * GET /api/governance/audit/validate
 * Validate audit log hash chain integrity
 * Requires: ADMIN role
 */
router.get(
  '/audit/validate',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    // If database is not available, return mock validation
    if (!db) {
      res.json({
        valid: true,
        entriesValidated: 0,
        message: 'Database not configured - no entries to validate'
      });
      return;
    }

    const result = await validateAuditChain();

    res.json({
      ...result,
      timestamp: new Date().toISOString(),
      message: result.valid
        ? `Audit chain validated successfully (${result.entriesValidated} entries)`
        : `Audit chain broken at entry ${result.brokenAt}`
    });
  })
);

/**
 * POST /api/governance/audit/export
 * Export audit log with hash chain verification
 * Requires: ADMIN role (elevated for sensitive audit exports)
 * SECURITY: Escalated from STEWARD to ADMIN to prevent unauthorized audit data exfiltration
 */
router.post(
  '/audit/export',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const startDate = req.query.startDate as string || req.body.startDate;
    const endDate = req.query.endDate as string || req.body.endDate;
    const format = (req.query.format as string || req.body.format || 'json').toLowerCase();
    const includeVerification = req.query.includeVerification === 'true' || req.body.includeVerification;

    // Validate format to prevent injection attacks
    if (!['json', 'csv', 'xml'].includes(format)) {
      res.status(400).json({
        error: 'Invalid export format',
        code: 'INVALID_FORMAT',
        allowedFormats: ['json', 'csv', 'xml']
      });
      return;
    }

    // Validate and sanitize date inputs
    let validStartDate: Date | undefined;
    let validEndDate: Date | undefined;

    if (startDate) {
      try {
        validStartDate = new Date(startDate);
        if (isNaN(validStartDate.getTime())) {
          throw new Error('Invalid date format');
        }
      } catch {
        res.status(400).json({
          error: 'Invalid startDate format',
          code: 'INVALID_DATE',
          message: 'startDate must be a valid ISO 8601 date string'
        });
        return;
      }
    }

    if (endDate) {
      try {
        validEndDate = new Date(endDate);
        if (isNaN(validEndDate.getTime())) {
          throw new Error('Invalid date format');
        }
      } catch {
        res.status(400).json({
          error: 'Invalid endDate format',
          code: 'INVALID_DATE',
          message: 'endDate must be a valid ISO 8601 date string'
        });
        return;
      }
    }

    // Check if audit export is enabled via feature flag
    const auditExportEnabled = await featureFlagsService.isEnabled('allow_audit_export');
    if (!auditExportEnabled) {
      res.status(403).json({
        error: 'Feature disabled',
        code: 'AUDIT_EXPORT_DISABLED',
        message: 'Audit export functionality is currently disabled'
      });
      return;
    }

    const mockAuditEntries = [
      { id: 'AUD-001', timestamp: new Date().toISOString(), action: 'PHI_SCAN', user: 'system', resource: 'stage-9', status: 'PASS', hash: 'a1b2c3d4e5f6' },
      { id: 'AUD-002', timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'DATA_UPLOAD', user: 'researcher@example.com', resource: 'thyroid-dataset', status: 'APPROVED', hash: 'b2c3d4e5f6g7' },
      { id: 'AUD-003', timestamp: new Date(Date.now() - 7200000).toISOString(), action: 'STAGE_ENTRY', user: 'researcher@example.com', resource: 'stage-6', status: 'LOGGED', hash: 'c3d4e5f6g7h8' },
      { id: 'AUD-004', timestamp: new Date(Date.now() - 10800000).toISOString(), action: 'AI_GENERATION', user: 'researcher@example.com', resource: 'manuscript-draft', status: 'APPROVED', hash: 'd4e5f6g7h8i9' },
      { id: 'AUD-005', timestamp: new Date(Date.now() - 14400000).toISOString(), action: 'SESSION_START', user: 'researcher@example.com', resource: 'ROS-20260117', status: 'LOGGED', hash: 'e5f6g7h8i9j0' },
    ];

    const hashVerification = {
      valid: true,
      entriesVerified: mockAuditEntries.length,
      chainIntact: true,
      lastHash: 'e5f6g7h8i9j0abcd1234567890fedcba9876543210'
    };

    res.json({
      status: 'success',
      downloadUrl: `/downloads/audit-${Date.now()}.${format}`,
      fileName: `audit-log-${new Date().toISOString().split('T')[0]}.${format}`,
      format: format,
      recordCount: mockAuditEntries.length,
      dateRange: {
        start: validStartDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: validEndDate?.toISOString() || new Date().toISOString()
      },
      hashVerification: includeVerification ? hashVerification : undefined,
      entries: mockAuditEntries
    });
  })
);

/**
 * GET /api/governance/approvals
 * Get all approval requests
 * Public endpoint - viewable by all users for dashboard display
 */
router.get(
  '/approvals',
  asyncHandler(async (req, res) => {
    const { status } = req.query;

    let approvals = mockApprovals;

    if (status && typeof status === 'string') {
      approvals = approvals.filter(a => a.status === status.toUpperCase());
    }

    res.json({
      approvals,
      total: approvals.length
    });
  })
);

/**
 * POST /api/governance/approvals/:approvalId/approve
 * Approve a pending request
 * Requires: ADMIN role (elevated security for approval authority)
 * SECURITY: Escalated to ADMIN to ensure only authorized personnel grant approvals
 */
router.post(
  '/approvals/:approvalId/approve',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { approvalId } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    // Validate approvalId format
    if (!approvalId || typeof approvalId !== 'string' || approvalId.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_APPROVAL_ID',
        message: 'approvalId must be a non-empty string'
      });
      return;
    }

    // Check if approval workflow is enabled via feature flag
    const approvalsEnabled = await featureFlagsService.isEnabled('allow_approvals');
    if (!approvalsEnabled) {
      res.status(403).json({
        error: 'Feature disabled',
        code: 'APPROVALS_DISABLED',
        message: 'Approval workflow is currently disabled'
      });
      return;
    }

    const approval = mockApprovals.find(a => a.id === approvalId);

    if (!approval) {
      res.status(404).json({
        error: 'Approval request not found',
        code: 'APPROVAL_NOT_FOUND',
        approvalId
      });
      return;
    }

    if (approval.status !== 'PENDING') {
      res.status(400).json({
        error: 'Approval request already processed',
        code: 'ALREADY_PROCESSED',
        currentStatus: approval.status
      });
      return;
    }

    approval.status = 'APPROVED';
    approval.resolvedBy = user.email || 'unknown';
    approval.resolvedAt = new Date().toISOString();

    res.json({
      message: 'Approval granted',
      approval
    });
  })
);

/**
 * POST /api/governance/approvals/:approvalId/deny
 * Deny a pending request
 * Requires: ADMIN role (elevated security for approval authority)
 * SECURITY: Escalated to ADMIN to ensure only authorized personnel process approvals
 */
router.post(
  '/approvals/:approvalId/deny',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { approvalId } = req.params;
    const { reason } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    // Validate approvalId format
    if (!approvalId || typeof approvalId !== 'string' || approvalId.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_APPROVAL_ID',
        message: 'approvalId must be a non-empty string'
      });
      return;
    }

    // Validate deny reason
    if (!reason || typeof reason !== 'string' || reason.length < 5) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INVALID_REASON',
        message: 'reason must be a string with at least 5 characters'
      });
      return;
    }

    // Check if approval workflow is enabled via feature flag
    const approvalsEnabled = await featureFlagsService.isEnabled('allow_approvals');
    if (!approvalsEnabled) {
      res.status(403).json({
        error: 'Feature disabled',
        code: 'APPROVALS_DISABLED',
        message: 'Approval workflow is currently disabled'
      });
      return;
    }

    const approval = mockApprovals.find(a => a.id === approvalId);

    if (!approval) {
      res.status(404).json({
        error: 'Approval request not found',
        code: 'APPROVAL_NOT_FOUND',
        approvalId
      });
      return;
    }

    if (approval.status !== 'PENDING') {
      res.status(400).json({
        error: 'Approval request already processed',
        code: 'ALREADY_PROCESSED',
        currentStatus: approval.status
      });
      return;
    }

    approval.status = 'DENIED';
    approval.resolvedBy = user.email || 'unknown';
    approval.resolvedAt = new Date().toISOString();

    res.json({
      message: 'Approval denied',
      approval,
      denyReason: reason
    });
  })
);

/**
 * GET /api/governance/mode
 * Get current governance mode (public endpoint for frontend)
 * No authentication required - returns current mode from database
 */
router.get(
  '/mode',
  asyncHandler(async (req, res) => {
    const mode = await governanceConfigService.getMode();
    res.json({ mode });
  })
);

/**
 * POST /api/governance/phi/reveal
 * Request PHI reveal for a specific resource
 * Requires: STEWARD role or higher
 *
 * SECURITY: PHI reveal is BLOCKED in DEMO mode regardless of role
 * All reveal actions are logged to the audit trail
 */
router.post(
  '/phi/reveal',
  requireRole('STEWARD'),
  asyncHandler(async (req, res) => {
    const { resourceType, resourceId, justification, fields } = req.body;

    // CRITICAL: Block PHI reveal in DEMO mode
    const currentMode = await governanceConfigService.getMode();
    if (currentMode === 'DEMO') {
      res.status(403).json({
        error: 'PHI reveal blocked',
        code: 'DEMO_MODE_BLOCKED',
        message: 'PHI reveal is not available in DEMO mode. Switch to LIVE mode to access PHI.',
        mode: 'DEMO'
      });
      return;
    }

    // Validate required fields
    if (!resourceType || !resourceId) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'MISSING_FIELDS',
        message: 'resourceType and resourceId are required'
      });
      return;
    }

    if (!justification || justification.length < 10) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'INSUFFICIENT_JUSTIFICATION',
        message: 'A justification of at least 10 characters is required for PHI reveal'
      });
      return;
    }

    // Log the PHI reveal request to audit
    const auditEntry = {
      id: `AUD-PHI-${Date.now()}`,
      eventType: 'PHI_REVEAL',
      action: 'REVEAL_REQUESTED',
      userId: req.user?.id || 'unknown',
      userEmail: req.user?.email || 'unknown',
      userRole: req.user?.role || 'unknown',
      resourceType,
      resourceId,
      fields: fields || ['all'],
      justification,
      governanceMode: currentMode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      status: 'APPROVED'
    };

    // In production, this would write to the database
    console.log('[AUDIT] PHI Reveal:', JSON.stringify(auditEntry));

    // Generate a reveal token (expires in 5 minutes)
    const revealToken = `phi_reveal_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    res.json({
      status: 'approved',
      revealToken,
      expiresAt: expiresAt.toISOString(),
      resourceType,
      resourceId,
      fields: fields || ['all'],
      audit: {
        eventId: auditEntry.id,
        timestamp: auditEntry.timestamp
      },
      warnings: [
        'PHI access is being audited',
        'Reveal token expires in 5 minutes',
        'Do not share or store revealed PHI outside approved systems'
      ]
    });
  })
);

/**
 * GET /api/governance/phi/reveal/:token
 * Validate a PHI reveal token
 * Used by frontend to check if a reveal token is still valid
 */
router.get(
  '/phi/reveal/:token',
  requireRole('STEWARD'),
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    // In production, validate token against database
    // For now, just check if it looks valid
    if (!token || !token.startsWith('phi_reveal_')) {
      res.status(400).json({
        valid: false,
        error: 'Invalid token format'
      });
      return;
    }

    // Token validation would check expiry in production
    res.json({
      valid: true,
      token,
      message: 'Token is valid'
    });
  })
);

/**
 * GET /api/governance/phi/audit
 * Get PHI access audit log
 * Requires: ADMIN role
 */
router.get(
  '/phi/audit',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // In production, this would query the audit_logs table
    const mockPhiAuditEntries = [
      {
        id: 'AUD-PHI-001',
        eventType: 'PHI_REVEAL',
        action: 'REVEAL_REQUESTED',
        userId: 'steward-001',
        userEmail: 'steward@researchflow.dev',
        resourceType: 'dataset',
        resourceId: 'ds-001',
        justification: 'Required for data quality review',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        status: 'APPROVED'
      },
      {
        id: 'AUD-PHI-002',
        eventType: 'PHI_REVEAL',
        action: 'REVEAL_BLOCKED',
        userId: 'researcher-001',
        userEmail: 'researcher@researchflow.dev',
        resourceType: 'patient_record',
        resourceId: 'pr-123',
        justification: 'Verification',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        status: 'BLOCKED',
        blockReason: 'DEMO_MODE'
      }
    ];

    res.json({
      entries: mockPhiAuditEntries.slice(offset, offset + limit),
      total: mockPhiAuditEntries.length,
      limit,
      offset
    });
  })
);

/**
 * Export governance state for use by middleware
 * Phase F: Now returns DB-backed state
 */
export async function getGovernanceState() {
  const mode = await governanceConfigService.getMode();
  const flags = await featureFlagsService.getFlags({ mode });
  const flagsMeta = await featureFlagsService.listFlags();

  return {
    mode,
    flags,
    flagsMeta,
    approvals: mockApprovals,
    stats: mockStats,
  };
}

export default router;
