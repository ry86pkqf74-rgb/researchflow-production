/**
 * Immutable Ledger Service
 *
 * Provides immutable audit anchoring for critical events.
 * Pattern: Write to DB first (immediate), then async submit to ledger.
 *
 * CRITICAL: Never store PHI in ledger - only hashes and metadata.
 * CRITICAL: Never block user requests waiting for ledger writes.
 */

import * as crypto from 'crypto';

/**
 * Ledger entry that will be anchored to the immutable ledger.
 * Contains ONLY hashes and safe metadata - no PHI.
 */
export interface LedgerEntry {
  entryId: string;
  timestamp: string;
  eventType: AuditEventType;
  actorHash: string;          // Hash of user/system ID
  resourceHash: string;       // Hash of resource being acted upon
  actionHash: string;         // Hash of the action details
  previousEntryHash?: string; // For chain integrity
  metadata: {
    governanceMode: 'DEMO' | 'LIVE';
    schemaVersion: string;
    source: string;
  };
}

export type AuditEventType =
  | 'DATA_UPLOAD'
  | 'DATA_CLASSIFICATION'
  | 'PHI_SCAN'
  | 'PHI_REVEAL'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_DENIED'
  | 'EXPORT_REQUESTED'
  | 'EXPORT_COMPLETED'
  | 'MANUSCRIPT_GENERATED'
  | 'RESEARCH_CREATED'
  | 'CONFIG_CHANGED'
  | 'SYSTEM_EVENT';

export type LedgerStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';

export interface LedgerWriteResult {
  entryId: string;
  status: LedgerStatus;
  transactionId?: string;
  blockNumber?: number;
  error?: string;
}

/**
 * Interface for ledger backend implementations.
 * Allows swapping between Hyperledger Fabric, other DLTs, or mock implementations.
 */
export interface LedgerBackend {
  submit(entry: LedgerEntry): Promise<LedgerWriteResult>;
  verify(entryId: string, transactionId: string): Promise<boolean>;
  getStatus(transactionId: string): Promise<LedgerStatus>;
}

/**
 * Hyperledger Fabric implementation stub.
 * In production, this would connect to a Fabric network.
 */
class HyperledgerFabricBackend implements LedgerBackend {
  private connectionProfile: string;
  private channelName: string;
  private chaincodeName: string;

  constructor() {
    this.connectionProfile = process.env.FABRIC_CONNECTION_PROFILE || '';
    this.channelName = process.env.FABRIC_CHANNEL || 'researchflow-audit';
    this.chaincodeName = process.env.FABRIC_CHAINCODE || 'audit-chaincode';
  }

  async submit(entry: LedgerEntry): Promise<LedgerWriteResult> {
    // TODO: Implement actual Hyperledger Fabric integration
    // This would use the fabric-network package to:
    // 1. Connect to the Fabric gateway
    // 2. Get the network/channel
    // 3. Get the contract
    // 4. Submit transaction

    console.log('[Ledger] Would submit to Hyperledger Fabric:', entry.entryId);

    // Stub: Simulate successful submission
    return {
      entryId: entry.entryId,
      status: 'CONFIRMED',
      transactionId: `fabric-tx-${crypto.randomUUID()}`,
      blockNumber: Math.floor(Date.now() / 1000),
    };
  }

  async verify(entryId: string, transactionId: string): Promise<boolean> {
    // TODO: Implement verification against Fabric ledger
    console.log('[Ledger] Would verify:', entryId, transactionId);
    return true;
  }

  async getStatus(transactionId: string): Promise<LedgerStatus> {
    // TODO: Query transaction status from Fabric
    console.log('[Ledger] Would get status for:', transactionId);
    return 'CONFIRMED';
  }
}

/**
 * Mock backend for development and testing.
 * Stores entries in memory (not persistent).
 */
class MockLedgerBackend implements LedgerBackend {
  private entries: Map<string, LedgerEntry & { transactionId: string; blockNumber: number }> = new Map();

  async submit(entry: LedgerEntry): Promise<LedgerWriteResult> {
    const transactionId = `mock-tx-${crypto.randomUUID()}`;
    const blockNumber = this.entries.size + 1;

    this.entries.set(entry.entryId, {
      ...entry,
      transactionId,
      blockNumber,
    });

    console.log('[Mock Ledger] Submitted:', entry.entryId, '-> Block', blockNumber);

    return {
      entryId: entry.entryId,
      status: 'CONFIRMED',
      transactionId,
      blockNumber,
    };
  }

  async verify(entryId: string, transactionId: string): Promise<boolean> {
    const entry = this.entries.get(entryId);
    return entry?.transactionId === transactionId;
  }

  async getStatus(_transactionId: string): Promise<LedgerStatus> {
    return 'CONFIRMED';
  }
}

/**
 * Immutable Ledger Service
 */
export class ImmutableLedgerService {
  private backend: LedgerBackend;
  private lastEntryHash: string | undefined;

  constructor(backend?: LedgerBackend) {
    // Use mock in development/test, Hyperledger in production
    if (backend) {
      this.backend = backend;
    } else if (process.env.NODE_ENV === 'production' && process.env.FABRIC_CONNECTION_PROFILE) {
      this.backend = new HyperledgerFabricBackend();
    } else {
      this.backend = new MockLedgerBackend();
      console.log('[Ledger] Using mock backend (development mode)');
    }
  }

  /**
   * Create a ledger entry from audit event data.
   * CRITICAL: This method hashes all potentially sensitive data.
   */
  createEntry(
    eventType: AuditEventType,
    actorId: string,
    resourceId: string,
    actionDetails: Record<string, unknown>
  ): LedgerEntry {
    const entryId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Hash all potentially identifying information
    const actorHash = this.hash(actorId);
    const resourceHash = this.hash(resourceId);
    const actionHash = this.hash(JSON.stringify(actionDetails));

    const entry: LedgerEntry = {
      entryId,
      timestamp,
      eventType,
      actorHash,
      resourceHash,
      actionHash,
      previousEntryHash: this.lastEntryHash,
      metadata: {
        governanceMode: (process.env.GOVERNANCE_MODE as 'DEMO' | 'LIVE') || 'DEMO',
        schemaVersion: '1.0.0',
        source: 'orchestrator',
      },
    };

    // Update chain link
    this.lastEntryHash = this.hashEntry(entry);

    return entry;
  }

  /**
   * Submit an entry to the immutable ledger.
   * This should be called asynchronously - never block user requests.
   */
  async submitEntry(entry: LedgerEntry): Promise<LedgerWriteResult> {
    try {
      const result = await this.backend.submit(entry);
      console.log(
        `[Ledger] Entry ${entry.entryId} submitted:`,
        result.status,
        result.transactionId ? `tx=${result.transactionId}` : ''
      );
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Ledger] Submit failed:', errorMessage);
      return {
        entryId: entry.entryId,
        status: 'FAILED',
        error: errorMessage,
      };
    }
  }

  /**
   * Verify an entry exists in the ledger.
   */
  async verifyEntry(entryId: string, transactionId: string): Promise<boolean> {
    return this.backend.verify(entryId, transactionId);
  }

  /**
   * Get the status of a ledger transaction.
   */
  async getTransactionStatus(transactionId: string): Promise<LedgerStatus> {
    return this.backend.getStatus(transactionId);
  }

  /**
   * Hash a value using SHA-256.
   */
  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Create a hash of an entire entry for chain integrity.
   */
  private hashEntry(entry: LedgerEntry): string {
    const content = [
      entry.entryId,
      entry.timestamp,
      entry.eventType,
      entry.actorHash,
      entry.resourceHash,
      entry.actionHash,
      entry.previousEntryHash || '',
    ].join('|');

    return this.hash(content);
  }
}

// Singleton instance
let ledgerService: ImmutableLedgerService | null = null;

export function getLedgerService(): ImmutableLedgerService {
  if (!ledgerService) {
    ledgerService = new ImmutableLedgerService();
  }
  return ledgerService;
}

/**
 * Queue an audit event for ledger anchoring.
 * This is the main entry point for other services to use.
 *
 * @param eventType - Type of audit event
 * @param actorId - User or system ID (will be hashed)
 * @param resourceId - Resource being acted upon (will be hashed)
 * @param actionDetails - Details of the action (will be hashed)
 * @returns Entry ID for tracking
 */
export async function queueAuditForLedger(
  eventType: AuditEventType,
  actorId: string,
  resourceId: string,
  actionDetails: Record<string, unknown>
): Promise<string> {
  const service = getLedgerService();
  const entry = service.createEntry(eventType, actorId, resourceId, actionDetails);

  // Submit asynchronously - don't await
  service.submitEntry(entry).catch((error) => {
    console.error('[Ledger] Async submit failed:', error);
  });

  return entry.entryId;
}
