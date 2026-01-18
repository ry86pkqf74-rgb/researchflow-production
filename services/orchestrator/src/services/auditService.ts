import crypto from "crypto";
import { db } from "../../db";
import { auditLogs, AuditLog, InsertAuditLog } from "@researchflow/core/schema";
import { desc } from "drizzle-orm";

type AuditDetails = Record<string, unknown> | null | undefined;

/**
 * Calculates SHA-256 hash for an audit entry
 * This creates a cryptographic fingerprint of the audit entry for the hash chain
 * 
 * @param entry - Object containing audit entry details (eventType, userId, action, details, resourceType, resourceId, createdAt, previousHash)
 * @returns SHA-256 hash as hex string
 */
export function calculateAuditHash(entry: {
  eventType: string;
  userId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  resourceType?: string | null;
  resourceId?: string | null;
  createdAt: Date;
  previousHash?: string | null;
}): string {
  // Create a canonical JSON representation for consistent hashing
  const payload = {
    eventType: entry.eventType,
    userId: entry.userId || null,
    action: entry.action,
    details: entry.details || null,
    resourceType: entry.resourceType || null,
    resourceId: entry.resourceId || null,
    createdAt: entry.createdAt.toISOString(),
    previousHash: entry.previousHash || null,
  };

  // Sort keys for consistent ordering
  const jsonString = JSON.stringify(payload, Object.keys(payload).sort());

  // Calculate SHA-256 hash
  return crypto.createHash("sha256").update(jsonString).digest("hex");
}

/**
 * Creates a new audit log entry with hash chain validation
 * Fetches the previous entry's hash and links it to maintain an immutable chain
 * 
 * @param entry - Audit log entry data (without id, createdAt, hashes)
 * @returns Created audit log entry with hashes
 */
export async function createAuditEntry(
  entry: Omit<InsertAuditLog, "previousHash" | "entryHash">
): Promise<AuditLog> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Get the last audit entry to link the hash chain
  const lastEntry = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  const previousHash = lastEntry.length > 0 ? lastEntry[0].entryHash : "GENESIS";

  // Create timestamp for consistency
  const createdAt = new Date();

  // Calculate the entry hash using all audit data
  const entryHash = calculateAuditHash({
    eventType: entry.eventType,
    userId: entry.userId,
    action: entry.action,
    details: entry.details as AuditDetails,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    createdAt,
    previousHash,
  });

  // Insert the new audit entry with hash chain
  const result = await db
    .insert(auditLogs)
    .values({
      ...entry,
      previousHash,
      entryHash,
      createdAt,
    })
    .returning();

  return result[0];
}

/**
 * Validates the entire audit log hash chain for integrity
 * Recalculates hashes for all entries and verifies they form a valid chain
 * 
 * @returns Object containing validation result
 *   - valid: true if chain is unbroken, false if tampering detected
 *   - entriesValidated: number of entries checked
 *   - brokenAt: id of entry where chain broke (if valid=false)
 */
export async function validateAuditChain(): Promise<{
  valid: boolean;
  entriesValidated: number;
  brokenAt?: number;
}> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Fetch all audit entries in chronological order
  const entries = await db
    .select()
    .from(auditLogs)
    .orderBy(auditLogs.createdAt);

  if (entries.length === 0) {
    return {
      valid: true,
      entriesValidated: 0,
    };
  }

  let previousHash = "GENESIS";
  let entriesValidated = 0;

  for (const entry of entries) {
    entriesValidated++;

    // Verify the previousHash matches the expected chain
    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        entriesValidated,
        brokenAt: entry.id,
      };
    }

    // Recalculate the entry hash
    const calculatedHash = calculateAuditHash({
      eventType: entry.eventType,
      userId: entry.userId,
      action: entry.action,
      details: entry.details as AuditDetails,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      createdAt: entry.createdAt,
      previousHash: entry.previousHash,
    });

    // Verify the stored hash matches the calculated hash
    if (entry.entryHash !== calculatedHash) {
      return {
        valid: false,
        entriesValidated,
        brokenAt: entry.id,
      };
    }

    // Update previousHash for next iteration
    previousHash = entry.entryHash;
  }

  return {
    valid: true,
    entriesValidated,
  };
}

/**
 * Gets the hash of the most recent audit log entry
 * Used as the starting point for new entries in the hash chain
 * 
 * @returns entryHash of the most recent entry, or 'GENESIS' if no entries exist
 */
export async function getLastAuditHash(): Promise<string> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const lastEntry = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  if (lastEntry.length === 0) {
    return "GENESIS";
  }

  return lastEntry[0].entryHash || "GENESIS";
}
