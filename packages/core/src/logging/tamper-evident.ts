/**
 * Tamper-Evident Logging System
 *
 * Creates cryptographically signed logs with blockchain-like chaining
 * to ensure immutability and detect tampering.
 *
 * Features:
 * - HMAC-SHA256 signatures
 * - Hash chaining (each entry links to previous)
 * - Timestamp verification
 * - Integrity verification
 * - Audit trail export
 */

import crypto from 'crypto';

export interface SignedLogEntry {
  timestamp: string; // ISO 8601
  data: any; // The actual log data
  signature: string; // HMAC-SHA256 signature
  previousHash?: string; // Hash of previous entry (chain)
  sequenceNumber: number; // Sequential entry number
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  verifiedEntries: number;
  totalEntries: number;
}

/**
 * Tamper-Evident Logger
 */
export class TamperEvidentLogger {
  private secretKey: string;
  private lastHash?: string;
  private sequenceNumber: number = 0;

  constructor(secretKey: string) {
    if (!secretKey || secretKey.length < 32) {
      throw new Error('Secret key must be at least 32 characters');
    }
    this.secretKey = secretKey;
  }

  /**
   * Log an entry with cryptographic signature
   */
  log(data: any): SignedLogEntry {
    const entry = {
      timestamp: new Date().toISOString(),
      data,
      previousHash: this.lastHash,
      sequenceNumber: this.sequenceNumber++
    };

    // Create signature (HMAC-SHA256)
    const message = JSON.stringify(entry);
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');

    const signedEntry: SignedLogEntry = {
      ...entry,
      signature
    };

    // Update chain
    this.lastHash = this._computeHash(signedEntry);

    return signedEntry;
  }

  /**
   * Verify a single entry's signature
   */
  verify(entry: SignedLogEntry): boolean {
    const { signature, ...entryData } = entry;
    const message = JSON.stringify(entryData);

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Verify chain integrity of multiple entries
   */
  verifyChain(entries: SignedLogEntry[]): VerificationResult {
    const errors: string[] = [];
    let verifiedEntries = 0;

    if (entries.length === 0) {
      return {
        valid: true,
        errors: [],
        verifiedEntries: 0,
        totalEntries: 0
      };
    }

    // Verify first entry has no previous hash
    if (entries[0].previousHash !== undefined) {
      errors.push(`Entry 0: First entry should not have previousHash`);
    }

    // Verify each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Verify signature
      if (!this.verify(entry)) {
        errors.push(`Entry ${i}: Invalid signature`);
        continue;
      }

      // Verify sequence number
      if (entry.sequenceNumber !== i) {
        errors.push(`Entry ${i}: Sequence number mismatch (expected ${i}, got ${entry.sequenceNumber})`);
      }

      // Verify chain link (except for first entry)
      if (i > 0) {
        const previous = entries[i - 1];
        const previousHash = this._computeHash(previous);

        if (entry.previousHash !== previousHash) {
          errors.push(`Entry ${i}: Chain broken (previousHash mismatch)`);
        }
      }

      // Verify timestamp is increasing
      if (i > 0) {
        const prevTime = new Date(entries[i - 1].timestamp);
        const currTime = new Date(entry.timestamp);

        if (currTime < prevTime) {
          errors.push(`Entry ${i}: Timestamp decreased (time travel detected)`);
        }
      }

      if (errors.length === 0) {
        verifiedEntries++;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      verifiedEntries,
      totalEntries: entries.length
    };
  }

  /**
   * Export audit trail as JSON
   */
  static exportAuditTrail(entries: SignedLogEntry[]): string {
    return JSON.stringify({
      version: '1.0.0',
      created: new Date().toISOString(),
      entries,
      metadata: {
        totalEntries: entries.length,
        firstTimestamp: entries[0]?.timestamp,
        lastTimestamp: entries[entries.length - 1]?.timestamp
      }
    }, null, 2);
  }

  /**
   * Import audit trail and verify integrity
   */
  static importAndVerify(
    auditTrailJson: string,
    secretKey: string
  ): { data: any; verification: VerificationResult } {
    const data = JSON.parse(auditTrailJson);
    const logger = new TamperEvidentLogger(secretKey);
    const verification = logger.verifyChain(data.entries);

    return { data, verification };
  }

  /**
   * Generate merkle root for batch verification
   */
  static generateMerkleRoot(entries: SignedLogEntry[]): string {
    if (entries.length === 0) return '';
    if (entries.length === 1) return this._staticComputeHash(entries[0]);

    // Build merkle tree
    let hashes = entries.map(e => this._staticComputeHash(e));

    while (hashes.length > 1) {
      const newHashes: string[] = [];

      for (let i = 0; i < hashes.length; i += 2) {
        if (i + 1 < hashes.length) {
          // Pair exists
          const combined = hashes[i] + hashes[i + 1];
          newHashes.push(crypto.createHash('sha256').update(combined).digest('hex'));
        } else {
          // Odd one out
          newHashes.push(hashes[i]);
        }
      }

      hashes = newHashes;
    }

    return hashes[0];
  }

  /**
   * Compute hash of an entry
   */
  private _computeHash(entry: SignedLogEntry): string {
    return TamperEvidentLogger._staticComputeHash(entry);
  }

  private static _staticComputeHash(entry: SignedLogEntry): string {
    const str = JSON.stringify(entry);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Reset logger state (for testing)
   */
  reset(): void {
    this.lastHash = undefined;
    this.sequenceNumber = 0;
  }
}

/**
 * File-based tamper-evident logger
 */
export class FileBasedTamperEvidentLogger extends TamperEvidentLogger {
  private filePath: string;
  private entries: SignedLogEntry[] = [];

  constructor(secretKey: string, filePath: string) {
    super(secretKey);
    this.filePath = filePath;
  }

  /**
   * Log to file (append-only)
   */
  async logToFile(data: any): Promise<SignedLogEntry> {
    const entry = this.log(data);
    this.entries.push(entry);

    // Append to file
    const fs = await import('fs/promises');
    await fs.appendFile(
      this.filePath,
      JSON.stringify(entry) + '\n',
      'utf-8'
    );

    return entry;
  }

  /**
   * Load and verify log file
   */
  async loadAndVerify(): Promise<VerificationResult> {
    const fs = await import('fs/promises');

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.trim().split('\n');

      this.entries = lines.map(line => JSON.parse(line));

      return this.verifyChain(this.entries);
    } catch (error) {
      throw new Error(`Failed to load log file: ${error}`);
    }
  }

  /**
   * Get all entries
   */
  getEntries(): SignedLogEntry[] {
    return [...this.entries];
  }
}

// Example usage
if (require.main === module) {
  (async () => {
    console.log('=== Tamper-Evident Logging Demo ===\n');

    const SECRET_KEY = 'my-super-secret-key-at-least-32-chars-long!!';
    const logger = new TamperEvidentLogger(SECRET_KEY);

    // Log some events
    console.log('Logging events...');
    const entry1 = logger.log({ event: 'user_login', user: 'alice' });
    const entry2 = logger.log({ event: 'data_access', resource: 'patient_123' });
    const entry3 = logger.log({ event: 'data_export', destination: 's3://bucket/data.csv' });

    console.log('✓ Logged 3 events\n');

    // Verify individual entry
    console.log('Verifying individual entry...');
    const valid = logger.verify(entry2);
    console.log(`Entry 2 signature valid: ${valid ? '✓' : '✗'}\n`);

    // Verify chain
    console.log('Verifying chain integrity...');
    const entries = [entry1, entry2, entry3];
    const result = logger.verifyChain(entries);

    console.log(`Chain valid: ${result.valid ? '✓' : '✗'}`);
    console.log(`Verified entries: ${result.verifiedEntries}/${result.totalEntries}`);

    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    // Test tampering detection
    console.log('\n=== Tampering Detection Test ===\n');

    const tamperedEntries = [...entries];
    tamperedEntries[1].data.resource = 'TAMPERED';

    const tamperedResult = logger.verifyChain(tamperedEntries);
    console.log(`Tampered chain valid: ${tamperedResult.valid ? '✓ (FAILED!)' : '✗ (DETECTED!)'}`);

    if (!tamperedResult.valid) {
      console.log('Tampering detected:');
      tamperedResult.errors.forEach(err => console.log(`  - ${err}`));
    }

    // Merkle root
    console.log('\n=== Merkle Root ===');
    const merkleRoot = TamperEvidentLogger.generateMerkleRoot(entries);
    console.log(`Merkle root: ${merkleRoot.substring(0, 16)}...`);

    // Export audit trail
    console.log('\n=== Audit Trail Export ===');
    const auditTrail = TamperEvidentLogger.exportAuditTrail(entries);
    console.log(`Exported ${entries.length} entries`);

    // Re-import and verify
    const imported = TamperEvidentLogger.importAndVerify(auditTrail, SECRET_KEY);
    console.log(`Imported verification: ${imported.verification.valid ? '✓' : '✗'}`);
  })();
}
