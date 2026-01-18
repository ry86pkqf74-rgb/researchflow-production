import { createHash } from 'crypto';
import { db } from '../../db';
import { auditLogs } from '@researchflow/core/schema';
import { desc } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';

interface AuditLogEntry {
  eventType: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  researchId?: string;
}

/**
 * Log an auditable action with hash chaining for tamper detection
 */
export async function logAction(entry: AuditLogEntry): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Get the most recent audit log entry for hash chaining
  const [previousEntry] = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.id))
    .limit(1);

  const previousHash = previousEntry?.entryHash || 'GENESIS';

  // Create hash of current entry
  const entryData = JSON.stringify({
    ...entry,
    previousHash,
    timestamp: new Date().toISOString()
  });

  const entryHash = createHash('sha256')
    .update(entryData)
    .digest('hex');

  // Insert audit log with hash chain
  await db.insert(auditLogs).values({
    ...entry,
    previousHash,
    entryHash,
    details: entry.details ? entry.details : undefined
  });
}

/**
 * Verify integrity of audit chain
 * Returns true if chain is intact, false if tampered
 */
export async function verifyAuditChain(): Promise<{
  valid: boolean;
  brokenAt?: number;
  totalEntries: number;
}> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const entries = await db
    .select()
    .from(auditLogs)
    .orderBy(auditLogs.id);

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  let previousHash = 'GENESIS';

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        brokenAt: entry.id,
        totalEntries: entries.length
      };
    }

    // Recompute hash to verify
    const entryData = JSON.stringify({
      eventType: entry.eventType,
      userId: entry.userId,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      action: entry.action,
      details: entry.details,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      sessionId: entry.sessionId,
      researchId: entry.researchId,
      previousHash: entry.previousHash,
      timestamp: entry.createdAt?.toISOString()
    });

    const computedHash = createHash('sha256')
      .update(entryData)
      .digest('hex');

    if (computedHash !== entry.entryHash) {
      return {
        valid: false,
        brokenAt: entry.id,
        totalEntries: entries.length
      };
    }

    previousHash = entry.entryHash!;
  }

  return { valid: true, totalEntries: entries.length };
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsForResource(
  resourceType: string,
  resourceId: string
) {
  if (!db) {
    throw new Error('Database not initialized');
  }

  return await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.resourceType, resourceType),
        eq(auditLogs.resourceId, resourceId)
      )
    )
    .orderBy(desc(auditLogs.createdAt));
}
