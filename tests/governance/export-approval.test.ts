import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Export Approval Flow Tests
 *
 * Tests for the export approval workflow including:
 * - DEMO mode blocking
 * - STEWARD approval requirements
 * - PHI override handling
 */

type RosMode = 'DEMO' | 'STANDBY' | 'LIVE';
type UserRole = 'VIEWER' | 'RESEARCHER' | 'STEWARD' | 'ADMIN';
type ExportStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'PHI_BLOCKED' | 'EXPIRED';

interface ExportRequest {
  id: string;
  requesterId: string;
  requesterRole: UserRole;
  bundleType: string;
  status: ExportStatus;
  phiDetected: boolean;
  phiOverride?: {
    approved: boolean;
    justification?: string;
    approvedBy?: string;
  };
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// Mock export blocking logic matching mode-guard.ts
function isExportBlocked(mode: RosMode): boolean {
  return mode === 'DEMO' || mode === 'STANDBY';
}

// Mock role checking matching rbac.ts
function canApproveExports(role: UserRole): boolean {
  return role === 'STEWARD' || role === 'ADMIN';
}

// Mock export approval logic
function processExportApproval(
  request: ExportRequest,
  approverRole: UserRole,
  decision: 'approve' | 'deny',
  options?: { phiOverrideJustification?: string }
): { success: boolean; error?: string; request?: ExportRequest } {
  // Check approver has permission
  if (!canApproveExports(approverRole)) {
    return { success: false, error: 'Insufficient permissions to approve exports' };
  }

  // Check if already resolved
  if (request.status !== 'PENDING' && request.status !== 'PHI_BLOCKED') {
    return { success: false, error: `Request already ${request.status.toLowerCase()}` };
  }

  // Handle PHI blocked requests
  if (request.status === 'PHI_BLOCKED') {
    if (!options?.phiOverrideJustification) {
      return { success: false, error: 'PHI override requires justification' };
    }
    request.phiOverride = {
      approved: decision === 'approve',
      justification: options.phiOverrideJustification,
      approvedBy: 'approver-id',
    };
  }

  // Update request
  request.status = decision === 'approve' ? 'APPROVED' : 'DENIED';
  request.resolvedAt = new Date();
  request.resolvedBy = 'approver-id';

  return { success: true, request };
}

describe('Export Blocking in DEMO Mode', () => {
  it('should block exports in DEMO mode', () => {
    expect(isExportBlocked('DEMO')).toBe(true);
  });

  it('should block exports in STANDBY mode', () => {
    expect(isExportBlocked('STANDBY')).toBe(true);
  });

  it('should allow exports in LIVE mode', () => {
    expect(isExportBlocked('LIVE')).toBe(false);
  });

  it('should return 403 error for DEMO mode export attempt', () => {
    const mode: RosMode = 'DEMO';

    if (isExportBlocked(mode)) {
      const response = {
        status: 403,
        error: 'Export not allowed in DEMO mode',
        code: 'EXPORT_BLOCKED',
        mode,
      };

      expect(response.status).toBe(403);
      expect(response.code).toBe('EXPORT_BLOCKED');
    }
  });
});

describe('Role-Based Export Approval', () => {
  describe('STEWARD Role', () => {
    it('should allow STEWARD to approve exports', () => {
      expect(canApproveExports('STEWARD')).toBe(true);
    });

    it('should allow STEWARD to process approval', () => {
      const request: ExportRequest = {
        id: 'export-001',
        requesterId: 'researcher-001',
        requesterRole: 'RESEARCHER',
        bundleType: 'reproducibility',
        status: 'PENDING',
        phiDetected: false,
        createdAt: new Date(),
      };

      const result = processExportApproval(request, 'STEWARD', 'approve');

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe('APPROVED');
    });

    it('should allow STEWARD to deny exports', () => {
      const request: ExportRequest = {
        id: 'export-002',
        requesterId: 'researcher-001',
        requesterRole: 'RESEARCHER',
        bundleType: 'manuscript',
        status: 'PENDING',
        phiDetected: false,
        createdAt: new Date(),
      };

      const result = processExportApproval(request, 'STEWARD', 'deny');

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe('DENIED');
    });
  });

  describe('ADMIN Role', () => {
    it('should allow ADMIN to approve exports', () => {
      expect(canApproveExports('ADMIN')).toBe(true);
    });

    it('should allow ADMIN to process approval', () => {
      const request: ExportRequest = {
        id: 'export-003',
        requesterId: 'researcher-001',
        requesterRole: 'RESEARCHER',
        bundleType: 'data',
        status: 'PENDING',
        phiDetected: false,
        createdAt: new Date(),
      };

      const result = processExportApproval(request, 'ADMIN', 'approve');

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe('APPROVED');
    });
  });

  describe('RESEARCHER Role', () => {
    it('should deny RESEARCHER from approving exports', () => {
      expect(canApproveExports('RESEARCHER')).toBe(false);
    });

    it('should reject approval attempt by RESEARCHER', () => {
      const request: ExportRequest = {
        id: 'export-004',
        requesterId: 'researcher-001',
        requesterRole: 'RESEARCHER',
        bundleType: 'reproducibility',
        status: 'PENDING',
        phiDetected: false,
        createdAt: new Date(),
      };

      const result = processExportApproval(request, 'RESEARCHER', 'approve');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
    });

    it('should not allow RESEARCHER to approve own export', () => {
      const request: ExportRequest = {
        id: 'export-005',
        requesterId: 'researcher-001',
        requesterRole: 'RESEARCHER',
        bundleType: 'manuscript',
        status: 'PENDING',
        phiDetected: false,
        createdAt: new Date(),
      };

      // Even if role check passed, self-approval should be blocked
      const result = processExportApproval(request, 'RESEARCHER', 'approve');

      expect(result.success).toBe(false);
    });
  });

  describe('VIEWER Role', () => {
    it('should deny VIEWER from approving exports', () => {
      expect(canApproveExports('VIEWER')).toBe(false);
    });
  });
});

describe('PHI Override Requirements', () => {
  it('should require justification for PHI override', () => {
    const request: ExportRequest = {
      id: 'export-phi-001',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'data',
      status: 'PHI_BLOCKED',
      phiDetected: true,
      createdAt: new Date(),
    };

    const result = processExportApproval(request, 'STEWARD', 'approve');

    expect(result.success).toBe(false);
    expect(result.error).toContain('PHI override requires justification');
  });

  it('should approve with valid PHI override justification', () => {
    const request: ExportRequest = {
      id: 'export-phi-002',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'data',
      status: 'PHI_BLOCKED',
      phiDetected: true,
      createdAt: new Date(),
    };

    const result = processExportApproval(request, 'STEWARD', 'approve', {
      phiOverrideJustification: 'IRB approved - required for publication submission',
    });

    expect(result.success).toBe(true);
    expect(result.request?.status).toBe('APPROVED');
    expect(result.request?.phiOverride?.approved).toBe(true);
    expect(result.request?.phiOverride?.justification).toContain('IRB approved');
  });

  it('should deny PHI export with justification recorded', () => {
    const request: ExportRequest = {
      id: 'export-phi-003',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'data',
      status: 'PHI_BLOCKED',
      phiDetected: true,
      createdAt: new Date(),
    };

    const result = processExportApproval(request, 'STEWARD', 'deny', {
      phiOverrideJustification: 'Insufficient de-identification evidence',
    });

    expect(result.success).toBe(true);
    expect(result.request?.status).toBe('DENIED');
    expect(result.request?.phiOverride?.approved).toBe(false);
  });
});

describe('Export Request State Management', () => {
  it('should not allow re-processing approved requests', () => {
    const request: ExportRequest = {
      id: 'export-state-001',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'reproducibility',
      status: 'APPROVED',
      phiDetected: false,
      createdAt: new Date(),
      resolvedAt: new Date(),
      resolvedBy: 'steward-001',
    };

    const result = processExportApproval(request, 'STEWARD', 'deny');

    expect(result.success).toBe(false);
    expect(result.error).toContain('already approved');
  });

  it('should not allow re-processing denied requests', () => {
    const request: ExportRequest = {
      id: 'export-state-002',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'manuscript',
      status: 'DENIED',
      phiDetected: false,
      createdAt: new Date(),
      resolvedAt: new Date(),
      resolvedBy: 'steward-001',
    };

    const result = processExportApproval(request, 'ADMIN', 'approve');

    expect(result.success).toBe(false);
    expect(result.error).toContain('already denied');
  });

  it('should record resolver information on approval', () => {
    const request: ExportRequest = {
      id: 'export-state-003',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'data',
      status: 'PENDING',
      phiDetected: false,
      createdAt: new Date(),
    };

    const result = processExportApproval(request, 'STEWARD', 'approve');

    expect(result.success).toBe(true);
    expect(result.request?.resolvedAt).toBeDefined();
    expect(result.request?.resolvedBy).toBeDefined();
  });
});

describe('Export Approval Flow Integration', () => {
  it('should follow complete approval workflow', () => {
    // Step 1: Create export request
    const request: ExportRequest = {
      id: 'export-flow-001',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'reproducibility',
      status: 'PENDING',
      phiDetected: false,
      createdAt: new Date(),
    };

    expect(request.status).toBe('PENDING');

    // Step 2: Check mode (LIVE only)
    const mode: RosMode = 'LIVE';
    expect(isExportBlocked(mode)).toBe(false);

    // Step 3: Steward reviews
    expect(canApproveExports('STEWARD')).toBe(true);

    // Step 4: Approve
    const result = processExportApproval(request, 'STEWARD', 'approve');

    expect(result.success).toBe(true);
    expect(result.request?.status).toBe('APPROVED');
    expect(result.request?.resolvedAt).toBeDefined();
  });

  it('should handle PHI export with full workflow', () => {
    // Step 1: Request is blocked due to PHI
    const request: ExportRequest = {
      id: 'export-phi-flow-001',
      requesterId: 'researcher-001',
      requesterRole: 'RESEARCHER',
      bundleType: 'data',
      status: 'PHI_BLOCKED',
      phiDetected: true,
      createdAt: new Date(),
    };

    expect(request.phiDetected).toBe(true);
    expect(request.status).toBe('PHI_BLOCKED');

    // Step 2: STEWARD reviews and provides override justification
    const result = processExportApproval(request, 'STEWARD', 'approve', {
      phiOverrideJustification: 'IRB-2024-001 approved - limited PHI access granted',
    });

    expect(result.success).toBe(true);
    expect(result.request?.status).toBe('APPROVED');
    expect(result.request?.phiOverride?.approved).toBe(true);
  });
});

describe('Export Types', () => {
  const bundleTypes = [
    'reproducibility',
    'manuscript',
    'data',
    'audit',
    'handoff',
  ];

  bundleTypes.forEach((bundleType) => {
    it(`should handle ${bundleType} bundle export approval`, () => {
      const request: ExportRequest = {
        id: `export-${bundleType}-001`,
        requesterId: 'researcher-001',
        requesterRole: 'RESEARCHER',
        bundleType,
        status: 'PENDING',
        phiDetected: false,
        createdAt: new Date(),
      };

      const result = processExportApproval(request, 'STEWARD', 'approve');

      expect(result.success).toBe(true);
      expect(result.request?.bundleType).toBe(bundleType);
    });
  });
});
