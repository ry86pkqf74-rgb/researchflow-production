/**
 * Approval Gate Service
 * Phase 5.1: Governance gates for manuscript workflow
 * 
 * Gate Types:
 * - AI_USAGE: Approval for AI-assisted content generation
 * - PHI_OVERRIDE: Approval to proceed despite PHI warnings
 * - EXPORT: Approval to export/download manuscript
 * - SUBMISSION: Final approval for journal submission
 */

import { db } from '../../db';
import { logAction } from '../services/audit-service';
import { EventEmitter } from 'events';

export type GateType = 'AI_USAGE' | 'PHI_OVERRIDE' | 'EXPORT' | 'SUBMISSION';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalRequest {
  id?: string;
  manuscriptId: string;
  gateType: GateType;
  requestedBy: string;
  justification: string;
  context?: Record<string, any>;
  expiresAt?: Date;
}

export interface ApprovalDecision {
  approved: boolean;
  decidedBy: string;
  decidedAt?: Date;
  comments?: string;
  conditions?: string[];
}

export interface ApprovalRecord {
  id: string;
  manuscriptId: string;
  gateType: GateType;
  status: ApprovalStatus;
  requestedBy: string;
  justification: string;
  context?: Record<string, any>;
  decidedBy?: string;
  decidedAt?: Date;
  comments?: string;
  conditions?: string[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GateConfig {
  gateType: GateType;
  requiredRoles: string[];
  autoApproveRoles?: string[];
  expirationHours: number;
  requireJustification: boolean;
  notifyOnRequest: string[];
  notifyOnDecision: string[];
}

/**
 * Default gate configurations
 */
export const DEFAULT_GATE_CONFIGS: Record<GateType, GateConfig> = {
  AI_USAGE: {
    gateType: 'AI_USAGE',
    requiredRoles: ['researcher', 'pi', 'admin'],
    autoApproveRoles: ['pi', 'admin'],
    expirationHours: 168, // 7 days
    requireJustification: true,
    notifyOnRequest: ['pi'],
    notifyOnDecision: ['requester']
  },
  PHI_OVERRIDE: {
    gateType: 'PHI_OVERRIDE',
    requiredRoles: ['pi', 'compliance_officer', 'admin'],
    autoApproveRoles: [],
    expirationHours: 24,
    requireJustification: true,
    notifyOnRequest: ['compliance_officer', 'pi'],
    notifyOnDecision: ['requester', 'compliance_officer']
  },
  EXPORT: {
    gateType: 'EXPORT',
    requiredRoles: ['researcher', 'pi', 'admin'],
    autoApproveRoles: ['pi', 'admin'],
    expirationHours: 72,
    requireJustification: false,
    notifyOnRequest: ['pi'],
    notifyOnDecision: ['requester']
  },
  SUBMISSION: {
    gateType: 'SUBMISSION',
    requiredRoles: ['pi', 'admin'],
    autoApproveRoles: [],
    expirationHours: 168,
    requireJustification: true,
    notifyOnRequest: ['all_authors', 'compliance_officer'],
    notifyOnDecision: ['all_authors', 'compliance_officer']
  }
};

/**
 * Approval Gate Service
 */
export class ApprovalGateService extends EventEmitter {
  private static instance: ApprovalGateService;
  private gateConfigs: Map<GateType, GateConfig>;
  
  private constructor() {
    super();
    this.gateConfigs = new Map(
      Object.entries(DEFAULT_GATE_CONFIGS) as [GateType, GateConfig][]
    );
  }
  
  static getInstance(): ApprovalGateService {
    if (!this.instance) {
      this.instance = new ApprovalGateService();
    }
    return this.instance;
  }
  
  /**
   * Request approval for a gate
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalRecord> {
    const config = this.gateConfigs.get(request.gateType);
    if (!config) {
      throw new Error(`Unknown gate type: ${request.gateType}`);
    }
    
    if (config.requireJustification && !request.justification) {
      throw new Error(`Justification required for ${request.gateType} gate`);
    }
    
    // Check for existing pending request
    const existing = await this.getPendingRequest(
      request.manuscriptId, 
      request.gateType
    );
    if (existing) {
      throw new Error(`Pending ${request.gateType} request already exists`);
    }
    
    // Calculate expiration
    const expiresAt = request.expiresAt || new Date(
      Date.now() + config.expirationHours * 60 * 60 * 1000
    );
    
    // Create request
    const result = await db.query(`
      INSERT INTO approval_requests 
        (manuscript_id, gate_type, status, requested_by, justification, context, expires_at)
      VALUES ($1, $2, 'pending', $3, $4, $5, $6)
      RETURNING *
    `, [
      request.manuscriptId,
      request.gateType,
      request.requestedBy,
      request.justification,
      JSON.stringify(request.context || {}),
      expiresAt
    ]);
    
    const record = this.mapRecord(result.rows[0]);
    
    // Log action
    await logAction({
      eventType: 'APPROVAL_REQUESTED',
      action: 'CREATE',
      resourceType: 'APPROVAL_REQUEST',
      resourceId: record.id,
      userId: request.requestedBy,
      details: { gateType: request.gateType, manuscriptId: request.manuscriptId }
    });
    
    // Emit event for notifications
    this.emit('approval:requested', record, config);
    
    return record;
  }
  
  /**
   * Record approval decision
   */
  async recordDecision(
    requestId: string, 
    decision: ApprovalDecision
  ): Promise<ApprovalRecord> {
    // Get existing request
    const request = await this.getRequest(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }
    
    if (request.status !== 'pending') {
      throw new Error(`Request already ${request.status}`);
    }
    
    // Check expiration
    if (request.expiresAt && new Date() > request.expiresAt) {
      await this.expireRequest(requestId);
      throw new Error('Approval request has expired');
    }
    
    const status: ApprovalStatus = decision.approved ? 'approved' : 'rejected';
    const decidedAt = decision.decidedAt || new Date();
    
    const result = await db.query(`
      UPDATE approval_requests
      SET status = $1,
          decided_by = $2,
          decided_at = $3,
          comments = $4,
          conditions = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [
      status,
      decision.decidedBy,
      decidedAt,
      decision.comments,
      decision.conditions || [],
      requestId
    ]);
    
    const record = this.mapRecord(result.rows[0]);
    
    // Log action
    await logAction({
      eventType: decision.approved ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
      action: 'UPDATE',
      resourceType: 'APPROVAL_REQUEST',
      resourceId: requestId,
      userId: decision.decidedBy,
      details: { 
        gateType: record.gateType, 
        manuscriptId: record.manuscriptId,
        comments: decision.comments
      }
    });
    
    // Emit event
    this.emit('approval:decided', record);
    
    return record;
  }
  
  /**
   * Check if gate is approved for manuscript
   */
  async checkApproval(
    manuscriptId: string, 
    gateType: GateType
  ): Promise<{ approved: boolean; record?: ApprovalRecord; reason?: string }> {
    const result = await db.query(`
      SELECT * FROM approval_requests
      WHERE manuscript_id = $1 
        AND gate_type = $2 
        AND status = 'approved'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY decided_at DESC
      LIMIT 1
    `, [manuscriptId, gateType]);
    
    if (result.rows.length === 0) {
      // Check for pending
      const pending = await this.getPendingRequest(manuscriptId, gateType);
      if (pending) {
        return { approved: false, reason: 'Approval pending' };
      }
      return { approved: false, reason: 'No approval request found' };
    }
    
    const record = this.mapRecord(result.rows[0]);
    
    // Check conditions if any
    if (record.conditions && record.conditions.length > 0) {
      return { 
        approved: true, 
        record,
        reason: `Approved with conditions: ${record.conditions.join(', ')}`
      };
    }
    
    return { approved: true, record };
  }
  
  /**
   * Require approval before proceeding
   * Throws if not approved
   */
  async requireApproval(
    manuscriptId: string, 
    gateType: GateType
  ): Promise<ApprovalRecord> {
    const check = await this.checkApproval(manuscriptId, gateType);
    
    if (!check.approved) {
      throw new Error(
        `${gateType} approval required. ${check.reason || 'Please request approval.'}`
      );
    }
    
    return check.record!;
  }
  
  /**
   * Get pending request
   */
  async getPendingRequest(
    manuscriptId: string, 
    gateType: GateType
  ): Promise<ApprovalRecord | null> {
    const result = await db.query(`
      SELECT * FROM approval_requests
      WHERE manuscript_id = $1 
        AND gate_type = $2 
        AND status = 'pending'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 1
    `, [manuscriptId, gateType]);
    
    if (result.rows.length === 0) return null;
    return this.mapRecord(result.rows[0]);
  }
  
  /**
   * Get request by ID
   */
  async getRequest(requestId: string): Promise<ApprovalRecord | null> {
    const result = await db.query(
      'SELECT * FROM approval_requests WHERE id = $1',
      [requestId]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapRecord(result.rows[0]);
  }
  
  /**
   * List requests for manuscript
   */
  async listRequests(
    manuscriptId: string,
    options?: { gateType?: GateType; status?: ApprovalStatus }
  ): Promise<ApprovalRecord[]> {
    const conditions = ['manuscript_id = $1'];
    const values: any[] = [manuscriptId];
    let paramIndex = 2;
    
    if (options?.gateType) {
      conditions.push(`gate_type = $${paramIndex++}`);
      values.push(options.gateType);
    }
    
    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(options.status);
    }
    
    const result = await db.query(`
      SELECT * FROM approval_requests
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `, values);
    
    return result.rows.map(this.mapRecord);
  }
  
  /**
   * List pending requests for approver
   */
  async listPendingForApprover(
    approverRole: string,
    limit = 50
  ): Promise<ApprovalRecord[]> {
    // Get gate types this role can approve
    const gateTypes: GateType[] = [];
    for (const [type, config] of this.gateConfigs) {
      if (config.requiredRoles.includes(approverRole)) {
        gateTypes.push(type);
      }
    }
    
    if (gateTypes.length === 0) return [];
    
    const result = await db.query(`
      SELECT * FROM approval_requests
      WHERE gate_type = ANY($1)
        AND status = 'pending'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at ASC
      LIMIT $2
    `, [gateTypes, limit]);
    
    return result.rows.map(this.mapRecord);
  }
  
  /**
   * Expire old requests
   */
  async expireRequest(requestId: string): Promise<void> {
    await db.query(`
      UPDATE approval_requests
      SET status = 'expired', updated_at = NOW()
      WHERE id = $1
    `, [requestId]);
    
    await logAction({
      eventType: 'APPROVAL_EXPIRED',
      action: 'UPDATE',
      resourceType: 'APPROVAL_REQUEST',
      resourceId: requestId
    });
  }
  
  /**
   * Run expiration check (call periodically)
   */
  async expireOldRequests(): Promise<number> {
    const result = await db.query(`
      UPDATE approval_requests
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' AND expires_at < NOW()
      RETURNING id
    `);
    
    for (const row of result.rows) {
      await logAction({
        eventType: 'APPROVAL_EXPIRED',
        action: 'UPDATE',
        resourceType: 'APPROVAL_REQUEST',
        resourceId: row.id
      });
    }
    
    return result.rows.length;
  }
  
  /**
   * Get gate configuration
   */
  getGateConfig(gateType: GateType): GateConfig | undefined {
    return this.gateConfigs.get(gateType);
  }
  
  /**
   * Update gate configuration
   */
  setGateConfig(gateType: GateType, config: Partial<GateConfig>): void {
    const existing = this.gateConfigs.get(gateType) || DEFAULT_GATE_CONFIGS[gateType];
    this.gateConfigs.set(gateType, { ...existing, ...config });
  }
  
  // Helper
  private mapRecord(row: any): ApprovalRecord {
    return {
      id: row.id,
      manuscriptId: row.manuscript_id,
      gateType: row.gate_type,
      status: row.status,
      requestedBy: row.requested_by,
      justification: row.justification,
      context: row.context,
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
      comments: row.comments,
      conditions: row.conditions,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const approvalGateService = ApprovalGateService.getInstance();
export default approvalGateService;
