import crypto from 'crypto';

export type GovernanceEventType = 
  | 'PHI_SCAN_STARTED'
  | 'PHI_SCAN_COMPLETED'
  | 'PHI_DETECTED'
  | 'PHI_QUARANTINED'
  | 'PHI_REMEDIATED'
  | 'PHI_OVERRIDE_REQUESTED'
  | 'PHI_OVERRIDE_APPROVED'
  | 'PHI_OVERRIDE_DENIED'
  | 'PHI_GATE_PASSED'
  | 'PHI_GATE_BLOCKED'
  | 'EXPORT_REQUESTED'
  | 'EXPORT_APPROVED'
  | 'EXPORT_DENIED'
  | 'EXPORT_COMPLETED'
  | 'AI_CALL_REQUESTED'
  | 'AI_CALL_APPROVED'
  | 'AI_CALL_DENIED'
  | 'AI_CALL_COMPLETED'
  | 'STAGE_ENTERED'
  | 'STAGE_COMPLETED'
  | 'STAGE_BLOCKED'
  | 'MODE_CHANGED'
  | 'ROLE_GRANTED'
  | 'ROLE_REVOKED'
  | 'DATA_ACCESSED'
  | 'TOPIC_VERSIONED'
  | 'SAP_APPROVED'
  | 'SAP_EXECUTED';

export type SeverityLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface GovernanceLogEntry {
  id: string;
  eventType: GovernanceEventType;
  severity: SeverityLevel;
  timestamp: string;
  userId?: string;
  userRole?: string;
  resourceType?: string;
  resourceId?: string;
  researchId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  details?: Record<string, any>;
  previousHash?: string;
  entryHash: string;
  immutable: boolean;
}

export interface PHIOverrideLogEntry extends GovernanceLogEntry {
  eventType: 'PHI_OVERRIDE_APPROVED' | 'PHI_OVERRIDE_DENIED';
  details: {
    scanId: string;
    findings: Array<{
      category: string;
      confidence: number;
      redactedValue: string;
    }>;
    justification: string;
    conditions?: string[];
    expiresAt?: string;
  };
}

let previousHash: string | null = null;
const logStore: GovernanceLogEntry[] = [];

function generateEntryHash(entry: Omit<GovernanceLogEntry, 'entryHash'>): string {
  const content = JSON.stringify({
    eventType: entry.eventType,
    timestamp: entry.timestamp,
    userId: entry.userId,
    action: entry.action,
    details: entry.details,
    previousHash: entry.previousHash
  });
  
  return crypto.createHash('sha256').update(content).digest('hex');
}

function redactPHIFromDetails(details: Record<string, any>): Record<string, any> {
  const redacted = { ...details };
  
  if (redacted.findings && Array.isArray(redacted.findings)) {
    redacted.findings = redacted.findings.map((f: any) => ({
      ...f,
      value: undefined,
      matchedText: undefined,
      redactedValue: f.matchedText ? maskValue(f.matchedText) : '[REDACTED]'
    }));
  }
  
  if (redacted.content) {
    redacted.content = '[CONTENT_REDACTED]';
  }
  
  return redacted;
}

function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
}

function determineSeverity(eventType: GovernanceEventType): SeverityLevel {
  const criticalEvents: GovernanceEventType[] = [
    'PHI_DETECTED',
    'PHI_OVERRIDE_APPROVED',
    'EXPORT_COMPLETED'
  ];
  
  const warningEvents: GovernanceEventType[] = [
    'PHI_QUARANTINED',
    'PHI_GATE_BLOCKED',
    'EXPORT_DENIED',
    'AI_CALL_DENIED',
    'STAGE_BLOCKED'
  ];
  
  const errorEvents: GovernanceEventType[] = [
    'PHI_OVERRIDE_DENIED'
  ];

  if (criticalEvents.includes(eventType)) return 'CRITICAL';
  if (errorEvents.includes(eventType)) return 'ERROR';
  if (warningEvents.includes(eventType)) return 'WARNING';
  return 'INFO';
}

export function createGovernanceLogEntry(
  eventType: GovernanceEventType,
  action: string,
  options: {
    userId?: string;
    userRole?: string;
    resourceType?: string;
    resourceId?: string;
    researchId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
    immutable?: boolean;
  } = {}
): GovernanceLogEntry {
  const sanitizedDetails = options.details 
    ? redactPHIFromDetails(options.details)
    : undefined;

  const entryBase = {
    id: crypto.randomUUID(),
    eventType,
    severity: determineSeverity(eventType),
    timestamp: new Date().toISOString(),
    userId: options.userId,
    userRole: options.userRole,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    researchId: options.researchId,
    sessionId: options.sessionId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    action,
    details: sanitizedDetails,
    previousHash: previousHash || undefined,
    immutable: options.immutable ?? isImmutableEvent(eventType)
  };

  const entryHash = generateEntryHash(entryBase);
  const entry: GovernanceLogEntry = {
    ...entryBase,
    entryHash
  };

  previousHash = entryHash;
  logStore.push(entry);

  return entry;
}

function isImmutableEvent(eventType: GovernanceEventType): boolean {
  const immutableEvents: GovernanceEventType[] = [
    'PHI_OVERRIDE_APPROVED',
    'PHI_OVERRIDE_DENIED',
    'EXPORT_APPROVED',
    'EXPORT_COMPLETED',
    'AI_CALL_APPROVED',
    'SAP_APPROVED',
    'SAP_EXECUTED'
  ];
  
  return immutableEvents.includes(eventType);
}

export function logPhiOverride(
  scanId: string,
  approved: boolean,
  justification: string,
  findings: Array<{
    category: string;
    confidence: number;
    matchedText: string;
  }>,
  options: {
    userId: string;
    userRole: string;
    conditions?: string[];
    expiresAt?: string;
    researchId?: string;
    sessionId?: string;
    ipAddress?: string;
  }
): PHIOverrideLogEntry {
  const eventType = approved ? 'PHI_OVERRIDE_APPROVED' : 'PHI_OVERRIDE_DENIED';
  
  const entry = createGovernanceLogEntry(
    eventType,
    approved ? 'PHI override approved with conditions' : 'PHI override denied',
    {
      userId: options.userId,
      userRole: options.userRole,
      resourceType: 'phi_scan',
      resourceId: scanId,
      researchId: options.researchId,
      sessionId: options.sessionId,
      ipAddress: options.ipAddress,
      details: {
        scanId,
        findings: findings.map(f => ({
          category: f.category,
          confidence: f.confidence,
          redactedValue: maskValue(f.matchedText)
        })),
        justification,
        conditions: options.conditions,
        expiresAt: options.expiresAt
      },
      immutable: true
    }
  );

  return entry as PHIOverrideLogEntry;
}

export function logExportEvent(
  eventType: 'EXPORT_REQUESTED' | 'EXPORT_APPROVED' | 'EXPORT_DENIED' | 'EXPORT_COMPLETED',
  resourceId: string,
  options: {
    userId: string;
    userRole: string;
    researchId?: string;
    exportType?: string;
    fileCount?: number;
    reason?: string;
    approvedBy?: string;
    sessionId?: string;
    ipAddress?: string;
  }
): GovernanceLogEntry {
  return createGovernanceLogEntry(
    eventType,
    `Export ${eventType.replace('EXPORT_', '').toLowerCase()}`,
    {
      userId: options.userId,
      userRole: options.userRole,
      resourceType: 'export',
      resourceId,
      researchId: options.researchId,
      sessionId: options.sessionId,
      ipAddress: options.ipAddress,
      details: {
        exportType: options.exportType,
        fileCount: options.fileCount,
        reason: options.reason,
        approvedBy: options.approvedBy
      },
      immutable: eventType === 'EXPORT_COMPLETED' || eventType === 'EXPORT_APPROVED'
    }
  );
}

export function logStageEvent(
  eventType: 'STAGE_ENTERED' | 'STAGE_COMPLETED' | 'STAGE_BLOCKED',
  stageId: number,
  stageName: string,
  options: {
    userId: string;
    userRole: string;
    researchId: string;
    reason?: string;
    topicVersion?: string;
    phiStatus?: string;
    sessionId?: string;
  }
): GovernanceLogEntry {
  return createGovernanceLogEntry(
    eventType,
    `Stage ${stageId} (${stageName}) ${eventType.replace('STAGE_', '').toLowerCase()}`,
    {
      userId: options.userId,
      userRole: options.userRole,
      resourceType: 'workflow_stage',
      resourceId: stageId.toString(),
      researchId: options.researchId,
      sessionId: options.sessionId,
      details: {
        stageId,
        stageName,
        reason: options.reason,
        topicVersion: options.topicVersion,
        phiStatus: options.phiStatus
      }
    }
  );
}

export function validateAuditChain(): {
  valid: boolean;
  entriesChecked: number;
  brokenAt?: string;
  message?: string;
} {
  if (logStore.length === 0) {
    return { valid: true, entriesChecked: 0 };
  }

  for (let i = 1; i < logStore.length; i++) {
    const current = logStore[i];
    const previous = logStore[i - 1];
    
    if (current.previousHash !== previous.entryHash) {
      return {
        valid: false,
        entriesChecked: i + 1,
        brokenAt: current.id,
        message: `Hash chain broken at entry ${current.id}. Expected ${previous.entryHash}, got ${current.previousHash}`
      };
    }
  }

  return {
    valid: true,
    entriesChecked: logStore.length
  };
}

export function getRecentLogs(limit: number = 100): GovernanceLogEntry[] {
  return logStore.slice(-limit);
}

export function getLogsByEventType(eventType: GovernanceEventType): GovernanceLogEntry[] {
  return logStore.filter(entry => entry.eventType === eventType);
}

export function getLogsByResource(resourceType: string, resourceId: string): GovernanceLogEntry[] {
  return logStore.filter(
    entry => entry.resourceType === resourceType && entry.resourceId === resourceId
  );
}

export function getImmutableLogs(): GovernanceLogEntry[] {
  return logStore.filter(entry => entry.immutable);
}

export function exportAuditTrail(options: {
  startDate?: string;
  endDate?: string;
  eventTypes?: GovernanceEventType[];
  userId?: string;
  researchId?: string;
}): GovernanceLogEntry[] {
  let filtered = [...logStore];

  if (options.startDate) {
    filtered = filtered.filter(e => e.timestamp >= options.startDate!);
  }
  if (options.endDate) {
    filtered = filtered.filter(e => e.timestamp <= options.endDate!);
  }
  if (options.eventTypes && options.eventTypes.length > 0) {
    filtered = filtered.filter(e => options.eventTypes!.includes(e.eventType));
  }
  if (options.userId) {
    filtered = filtered.filter(e => e.userId === options.userId);
  }
  if (options.researchId) {
    filtered = filtered.filter(e => e.researchId === options.researchId);
  }

  return filtered;
}
