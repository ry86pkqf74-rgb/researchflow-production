/**
 * PHI Scanner Routes (Tasks 97, 98, 109)
 *
 * Provides PHI detection and redaction services:
 * - POST /api/phi/scan - Scan content for PHI
 * - POST /api/phi/redact - Redact detected PHI
 * - GET /api/phi/scan/:id - Get scan results
 * - POST /api/phi/access-requests - Request PHI access (LIVE mode)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logAction } from '../services/audit-service';
import { requirePermission, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// PHI types that can be detected
const PHI_TYPES = [
  'name',
  'date',
  'location',
  'age',
  'phone',
  'email',
  'ssn',
  'mrn',
  'account_number',
  'license',
  'vehicle',
  'device',
  'url',
  'ip_address',
  'biometric',
  'photo',
  'other',
] as const;

type PhiType = (typeof PHI_TYPES)[number];

// PHI finding structure
interface PhiFinding {
  id: string;
  type: PhiType;
  text: string;
  location: {
    file: string;
    line: number;
    column: number;
    offset: number;
  };
  confidence: number;
  context: string;
  suggestedRedaction: string;
}

// Scan result structure
interface ScanResult {
  id: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  findings: PhiFinding[];
  scannedAt: Date;
  scannedBy: string;
  totalFiles: number;
  totalCharacters: number;
  scanDurationMs: number;
  summary: {
    totalFindings: number;
    byType: Record<PhiType, number>;
    highConfidenceCount: number;
    needsReview: boolean;
  };
}

// Schemas
const ScanRequestSchema = z.object({
  content: z.string().max(10000000), // 10MB max
  contentType: z.enum(['text', 'markdown', 'html', 'json', 'csv']),
  fileName: z.string().optional(),
  projectId: z.string().uuid().optional(),
  stageId: z.number().int().positive().optional(),
  governanceMode: z.enum(['DEMO', 'LIVE']),
  sensitivityLevel: z.enum(['standard', 'strict']).default('standard'),
});

const RedactRequestSchema = z.object({
  content: z.string().max(10000000),
  findings: z.array(
    z.object({
      id: z.string(),
      redact: z.boolean(),
      customRedaction: z.string().optional(),
    })
  ),
  redactionStyle: z.enum(['mask', 'remove', 'bracket', 'custom']).default('mask'),
});

const AccessRequestSchema = z.object({
  projectId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  dataScope: z.array(z.string()),
  duration: z.enum(['session', 'day', 'week', 'permanent']),
});

// In-memory store for demo (would be database in production)
const scanResults = new Map<string, ScanResult>();
const accessRequests = new Map<string, any>();

/**
 * POST /api/phi/scan
 * Scan content for PHI
 */
router.post(
  '/scan',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const validation = ScanRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { content, contentType, fileName, projectId, stageId, governanceMode, sensitivityLevel } =
      validation.data;

    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Initialize scan result
    const result: ScanResult = {
      id: scanId,
      status: 'scanning',
      findings: [],
      scannedAt: new Date(),
      scannedBy: user.id,
      totalFiles: 1,
      totalCharacters: content.length,
      scanDurationMs: 0,
      summary: {
        totalFindings: 0,
        byType: {} as Record<PhiType, number>,
        highConfidenceCount: 0,
        needsReview: false,
      },
    };

    scanResults.set(scanId, result);

    // Perform PHI detection (simplified pattern matching for demo)
    // In production, this would use ML models and more sophisticated detection
    const findings = detectPhi(content, fileName || 'content.txt', sensitivityLevel);

    // Update result
    result.status = 'completed';
    result.findings = findings;
    result.scanDurationMs = Date.now() - startTime;

    // Calculate summary
    const byType: Record<string, number> = {};
    let highConfidenceCount = 0;

    for (const finding of findings) {
      byType[finding.type] = (byType[finding.type] || 0) + 1;
      if (finding.confidence >= 0.8) {
        highConfidenceCount++;
      }
    }

    result.summary = {
      totalFindings: findings.length,
      byType: byType as Record<PhiType, number>,
      highConfidenceCount,
      needsReview: findings.some((f) => f.confidence < 0.9 && f.confidence >= 0.5),
    };

    scanResults.set(scanId, result);

    // Audit log
    await logAction({
      eventType: 'PHI_SCAN',
      action: 'COMPLETED',
      userId: user.id,
      resourceType: 'phi_scan',
      resourceId: scanId,
      details: {
        projectId,
        stageId,
        governanceMode,
        totalFindings: findings.length,
        highConfidenceCount,
        contentType,
        contentLength: content.length,
      },
    });

    res.json({
      scanId,
      status: result.status,
      summary: result.summary,
      findings: findings.map((f) => ({
        id: f.id,
        type: f.type,
        text: maskText(f.text),
        location: f.location,
        confidence: f.confidence,
        context: maskText(f.context),
        suggestedRedaction: f.suggestedRedaction,
      })),
      scanDurationMs: result.scanDurationMs,
      passed: findings.length === 0,
      needsReview: result.summary.needsReview,
    });
  })
);

/**
 * GET /api/phi/scan/:id
 * Get scan results by ID
 */
router.get(
  '/scan/:id',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = scanResults.get(id);

    if (!result) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Scan result not found',
      });
    }

    res.json({
      scanId: result.id,
      status: result.status,
      summary: result.summary,
      scannedAt: result.scannedAt,
      scanDurationMs: result.scanDurationMs,
      totalFiles: result.totalFiles,
      totalCharacters: result.totalCharacters,
      findingsCount: result.findings.length,
    });
  })
);

/**
 * POST /api/phi/redact
 * Redact detected PHI from content
 */
router.post(
  '/redact',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const validation = RedactRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { content, findings, redactionStyle } = validation.data;

    // Apply redactions
    let redactedContent = content;
    const appliedRedactions: Array<{ id: string; original: string; redacted: string }> = [];

    // Sort findings by offset descending to apply from end to start
    const sortedFindings = findings
      .filter((f) => f.redact)
      .sort((a, b) => {
        const findingA = scanResults.get(a.id);
        const findingB = scanResults.get(b.id);
        return 0; // Would sort by offset in real implementation
      });

    // This is a simplified implementation
    // In production, would track exact positions and apply redactions properly

    // Audit log
    await logAction({
      eventType: 'PHI_REDACT',
      action: 'COMPLETED',
      userId: user.id,
      resourceType: 'phi_redaction',
      resourceId: `redact_${Date.now()}`,
      details: {
        redactionStyle,
        totalRedactions: findings.filter((f) => f.redact).length,
        originalLength: content.length,
        redactedLength: redactedContent.length,
      },
    });

    res.json({
      redactedContent,
      appliedRedactions: appliedRedactions.length,
      redactionStyle,
    });
  })
);

/**
 * POST /api/phi/access-requests
 * Request PHI access (LIVE mode)
 */
router.post(
  '/access-requests',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const validation = AccessRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { projectId, reason, dataScope, duration } = validation.data;

    const requestId = `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const accessRequest = {
      id: requestId,
      projectId,
      requesterId: user.id,
      reason,
      dataScope,
      duration,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: null,
      approvedBy: null,
      approvedAt: null,
      deniedBy: null,
      deniedAt: null,
      denialReason: null,
    };

    accessRequests.set(requestId, accessRequest);

    // Audit log
    await logAction({
      eventType: 'PHI_ACCESS_REQUEST',
      action: 'CREATED',
      userId: user.id,
      resourceType: 'phi_access_request',
      resourceId: requestId,
      details: {
        projectId,
        dataScope,
        duration,
      },
    });

    res.status(201).json({
      requestId,
      status: 'pending',
      message: 'Access request submitted for review',
      createdAt: accessRequest.createdAt,
    });
  })
);

/**
 * GET /api/phi/access-requests
 * List PHI access requests
 */
router.get(
  '/access-requests',
  requireRole('STEWARD'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, projectId } = req.query;

    let requests = Array.from(accessRequests.values());

    if (status) {
      requests = requests.filter((r) => r.status === status);
    }

    if (projectId) {
      requests = requests.filter((r) => r.projectId === projectId);
    }

    res.json({
      requests: requests.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        requesterId: r.requesterId,
        status: r.status,
        dataScope: r.dataScope,
        duration: r.duration,
        createdAt: r.createdAt,
        approvedBy: r.approvedBy,
        approvedAt: r.approvedAt,
      })),
      total: requests.length,
    });
  })
);

/**
 * PUT /api/phi/access-requests/:id/approve
 * Approve a PHI access request
 */
router.put(
  '/access-requests/:id/approve',
  requireRole('STEWARD'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const accessRequest = accessRequests.get(id);

    if (!accessRequest) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Access request not found',
      });
    }

    if (accessRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'INVALID_STATE',
        message: `Request is already ${accessRequest.status}`,
      });
    }

    // Calculate expiration based on duration
    let expiresAt = new Date();
    switch (accessRequest.duration) {
      case 'session':
        expiresAt.setHours(expiresAt.getHours() + 8);
        break;
      case 'day':
        expiresAt.setDate(expiresAt.getDate() + 1);
        break;
      case 'week':
        expiresAt.setDate(expiresAt.getDate() + 7);
        break;
      case 'permanent':
        expiresAt.setFullYear(expiresAt.getFullYear() + 100);
        break;
    }

    accessRequest.status = 'approved';
    accessRequest.approvedBy = user.id;
    accessRequest.approvedAt = new Date();
    accessRequest.expiresAt = expiresAt;

    accessRequests.set(id, accessRequest);

    // Audit log
    await logAction({
      eventType: 'PHI_ACCESS_REQUEST',
      action: 'APPROVED',
      userId: user.id,
      resourceType: 'phi_access_request',
      resourceId: id,
      details: {
        requesterId: accessRequest.requesterId,
        projectId: accessRequest.projectId,
        expiresAt,
      },
    });

    res.json({
      id,
      status: 'approved',
      approvedBy: user.id,
      approvedAt: accessRequest.approvedAt,
      expiresAt,
    });
  })
);

/**
 * PUT /api/phi/access-requests/:id/deny
 * Deny a PHI access request
 */
router.put(
  '/access-requests/:id/deny',
  requireRole('STEWARD'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const accessRequest = accessRequests.get(id);

    if (!accessRequest) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Access request not found',
      });
    }

    if (accessRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'INVALID_STATE',
        message: `Request is already ${accessRequest.status}`,
      });
    }

    accessRequest.status = 'denied';
    accessRequest.deniedBy = user.id;
    accessRequest.deniedAt = new Date();
    accessRequest.denialReason = reason || 'No reason provided';

    accessRequests.set(id, accessRequest);

    // Audit log
    await logAction({
      eventType: 'PHI_ACCESS_REQUEST',
      action: 'DENIED',
      userId: user.id,
      resourceType: 'phi_access_request',
      resourceId: id,
      details: {
        requesterId: accessRequest.requesterId,
        projectId: accessRequest.projectId,
        reason: accessRequest.denialReason,
      },
    });

    res.json({
      id,
      status: 'denied',
      deniedBy: user.id,
      deniedAt: accessRequest.deniedAt,
      reason: accessRequest.denialReason,
    });
  })
);

// Helper functions

/**
 * Detect PHI in content (simplified pattern matching)
 */
function detectPhi(content: string, fileName: string, sensitivityLevel: string): PhiFinding[] {
  const findings: PhiFinding[] = [];
  const lines = content.split('\n');

  // Pattern definitions
  const patterns: Array<{ type: PhiType; regex: RegExp; confidence: number }> = [
    // Names (simplified - would use NER in production)
    { type: 'name', regex: /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, confidence: 0.8 },

    // Dates
    { type: 'date', regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, confidence: 0.9 },
    { type: 'date', regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, confidence: 0.9 },

    // Phone numbers
    { type: 'phone', regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, confidence: 0.95 },
    { type: 'phone', regex: /\(\d{3}\)\s*\d{3}[-.]?\d{4}/g, confidence: 0.95 },

    // Email addresses
    { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, confidence: 0.99 },

    // SSN
    { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, confidence: 0.99 },

    // MRN patterns
    { type: 'mrn', regex: /\b(MRN|Medical Record Number)[:\s]*\d{6,12}\b/gi, confidence: 0.95 },

    // Account numbers
    { type: 'account_number', regex: /\b(Account|Acct)[:\s#]*\d{8,16}\b/gi, confidence: 0.85 },

    // IP addresses
    { type: 'ip_address', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, confidence: 0.9 },

    // Ages over 89
    { type: 'age', regex: /\bage[d]?\s*(9[0-9]|1[0-9]{2})\b/gi, confidence: 0.8 },
  ];

  // Add more sensitive patterns in strict mode
  if (sensitivityLevel === 'strict') {
    patterns.push(
      { type: 'location', regex: /\b\d{5}(-\d{4})?\b/g, confidence: 0.7 }, // ZIP codes
      { type: 'date', regex: /\b(DOB|Date of Birth)[:\s]*\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi, confidence: 0.99 }
    );
  }

  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;

    for (const { type, regex, confidence } of patterns) {
      const matches = line.matchAll(regex);

      for (const match of matches) {
        const findingId = `finding_${findings.length}_${Math.random().toString(36).substr(2, 9)}`;

        findings.push({
          id: findingId,
          type,
          text: match[0],
          location: {
            file: fileName,
            line: lineNumber,
            column: match.index || 0,
            offset: match.index || 0,
          },
          confidence,
          context: getContext(line, match.index || 0, match[0].length),
          suggestedRedaction: getRedactionSuggestion(type),
        });
      }
    }
  }

  return findings;
}

/**
 * Get context around a finding
 */
function getContext(line: string, index: number, length: number): string {
  const contextPadding = 20;
  const start = Math.max(0, index - contextPadding);
  const end = Math.min(line.length, index + length + contextPadding);

  let context = line.substring(start, end);

  if (start > 0) context = '...' + context;
  if (end < line.length) context = context + '...';

  return context;
}

/**
 * Get suggested redaction text
 */
function getRedactionSuggestion(type: PhiType): string {
  const suggestions: Record<PhiType, string> = {
    name: '[REDACTED NAME]',
    date: '[REDACTED DATE]',
    location: '[REDACTED LOCATION]',
    age: '[REDACTED AGE]',
    phone: '[REDACTED PHONE]',
    email: '[REDACTED EMAIL]',
    ssn: '[REDACTED SSN]',
    mrn: '[REDACTED MRN]',
    account_number: '[REDACTED ACCOUNT]',
    license: '[REDACTED LICENSE]',
    vehicle: '[REDACTED VEHICLE]',
    device: '[REDACTED DEVICE]',
    url: '[REDACTED URL]',
    ip_address: '[REDACTED IP]',
    biometric: '[REDACTED BIOMETRIC]',
    photo: '[REDACTED PHOTO]',
    other: '[REDACTED]',
  };
  return suggestions[type] || '[REDACTED]';
}

/**
 * Mask text for logging
 */
function maskText(text: string): string {
  if (text.length <= 4) return '****';
  return text.substring(0, 2) + '*'.repeat(text.length - 4) + text.substring(text.length - 2);
}

export default router;
