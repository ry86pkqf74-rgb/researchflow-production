/**
 * PHI Scan Persistence Service
 *
 * Provides database-backed persistence for PHI scan results.
 * Replaces in-memory Map storage for production use.
 */

import { db } from '../../db';
import { phiScanResults } from '@researchflow/core/schema';
import { eq } from 'drizzle-orm';

// Types matching the route definitions
interface ScanResult {
  id: string;
  scanId: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  researchId?: string;
  resourceType: string;
  resourceId?: string;
  context: string;
  riskLevel: string;
  findings: any[];
  summary: {
    totalFindings: number;
    byType: Record<string, number>;
    highConfidenceCount: number;
    needsReview: boolean;
  };
  contentLength: number;
  scannedBy: string;
  scannedAt: Date;
  scanDurationMs: number;
}

interface AccessRequest {
  id: string;
  projectId: string;
  requesterId: string;
  reason: string;
  dataScope: string[];
  duration: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: Date;
  expiresAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  deniedBy: string | null;
  deniedAt: Date | null;
  denialReason: string | null;
}

// In-memory fallback for when DB is unavailable
const memoryStore = {
  scans: new Map<string, ScanResult>(),
  accessRequests: new Map<string, AccessRequest>(),
};

/**
 * Save a PHI scan result to the database
 */
export async function saveScanResult(result: ScanResult): Promise<void> {
  if (!db) {
    console.warn('[PHI-Persistence] No database connection, using memory fallback');
    memoryStore.scans.set(result.scanId, result);
    return;
  }

  try {
    await db.insert(phiScanResults).values({
      scanId: result.scanId,
      researchId: result.researchId,
      resourceType: result.resourceType,
      resourceId: result.resourceId,
      context: result.context,
      riskLevel: result.riskLevel,
      detected: result.findings,
      summary: result.summary,
      contentLength: result.contentLength,
      requiresOverride: result.summary.needsReview,
      scannedBy: result.scannedBy,
    }).onConflictDoUpdate({
      target: phiScanResults.scanId,
      set: {
        riskLevel: result.riskLevel,
        detected: result.findings,
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error('[PHI-Persistence] Failed to save scan result:', error);
    // Fallback to memory
    memoryStore.scans.set(result.scanId, result);
  }
}

/**
 * Get a PHI scan result by scan ID
 */
export async function getScanResult(scanId: string): Promise<ScanResult | null> {
  if (!db) {
    return memoryStore.scans.get(scanId) || null;
  }

  try {
    const results = await db
      .select()
      .from(phiScanResults)
      .where(eq(phiScanResults.scanId, scanId))
      .limit(1);

    if (results.length === 0) {
      // Check memory fallback
      return memoryStore.scans.get(scanId) || null;
    }

    const record = results[0];
    return {
      id: record.id,
      scanId: record.scanId,
      status: 'completed',
      researchId: record.researchId || undefined,
      resourceType: record.resourceType,
      resourceId: record.resourceId || undefined,
      context: record.context,
      riskLevel: record.riskLevel,
      findings: record.detected as any[],
      summary: record.summary as ScanResult['summary'],
      contentLength: record.contentLength,
      scannedBy: record.scannedBy || 'unknown',
      scannedAt: record.scannedAt,
      scanDurationMs: 0, // Not stored in DB
    };
  } catch (error) {
    console.error('[PHI-Persistence] Failed to get scan result:', error);
    return memoryStore.scans.get(scanId) || null;
  }
}

/**
 * Save a PHI access request
 * Note: Access requests table doesn't exist yet - uses memory for now
 * TODO: Create phi_access_requests table
 */
export async function saveAccessRequest(request: AccessRequest): Promise<void> {
  // For now, use memory storage
  // In production, this would save to a phi_access_requests table
  memoryStore.accessRequests.set(request.id, request);
}

/**
 * Get an access request by ID
 */
export async function getAccessRequest(id: string): Promise<AccessRequest | null> {
  return memoryStore.accessRequests.get(id) || null;
}

/**
 * Update an access request
 */
export async function updateAccessRequest(id: string, updates: Partial<AccessRequest>): Promise<void> {
  const existing = memoryStore.accessRequests.get(id);
  if (existing) {
    memoryStore.accessRequests.set(id, { ...existing, ...updates });
  }
}

/**
 * List access requests with optional filters
 */
export async function listAccessRequests(filters?: {
  status?: string;
  projectId?: string;
}): Promise<AccessRequest[]> {
  let requests = Array.from(memoryStore.accessRequests.values());

  if (filters?.status) {
    requests = requests.filter(r => r.status === filters.status);
  }

  if (filters?.projectId) {
    requests = requests.filter(r => r.projectId === filters.projectId);
  }

  return requests;
}

/**
 * Check if persistence service is healthy
 */
export async function isHealthy(): Promise<boolean> {
  if (!db) {
    return true; // Memory fallback is always "healthy"
  }

  try {
    // Simple query to check connection
    await db.select().from(phiScanResults).limit(1);
    return true;
  } catch {
    return false;
  }
}
