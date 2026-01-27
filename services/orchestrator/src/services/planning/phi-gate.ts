/**
 * PHI Gate Service
 *
 * Enforces PHI protection when sending data to external AI services.
 * In LIVE mode, PHI is never sent to external AI (metadata-only planning).
 * In DEMO mode, PHI is sanitized and warnings are issued.
 */

import { scanForPHI, redactPHI, isPHIScanEnabled, getGovernanceMode } from '../../utils/phi-scanner';

export interface PHIGateResult {
  allowed: boolean;
  phiDetected: boolean;
  patterns: string[];
  sanitizedContent?: string;
  mode: 'LIVE' | 'DEMO';
}

export interface DatasetMetadata {
  name: string;
  rowCount?: number;
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    cardinality?: number;
  }>;
}

export class PHIGate {
  /**
   * Check if content can be sent to external AI.
   * In LIVE mode + PHI detected = BLOCK (fail-closed).
   * In DEMO mode + PHI detected = WARN but allow (with sanitization).
   */
  checkForExternalAI(content: string): PHIGateResult {
    const mode = getGovernanceMode() as 'LIVE' | 'DEMO';

    if (!isPHIScanEnabled()) {
      return { allowed: true, phiDetected: false, patterns: [], mode };
    }

    const scanResult = scanForPHI(content);

    if (!scanResult.hasPHI) {
      return { allowed: true, phiDetected: false, patterns: [], mode };
    }

    if (mode === 'LIVE') {
      // FAIL-CLOSED: Block the request in LIVE mode
      return {
        allowed: false,
        phiDetected: true,
        patterns: scanResult.detectedPatterns,
        mode,
      };
    }

    // DEMO mode: warn but allow with sanitization
    return {
      allowed: true,
      phiDetected: true,
      patterns: scanResult.detectedPatterns,
      sanitizedContent: redactPHI(content),
      mode,
    };
  }

  /**
   * Prepare dataset metadata for external AI (PHI-safe).
   * Only sends column names, types, and aggregate statistics.
   * NEVER sends actual data values.
   */
  prepareMetadataForAI(dataset: DatasetMetadata): string {
    // PHI-safe metadata only - no actual data values
    const safeMetadata = {
      datasetName: dataset.name,
      rowCount: dataset.rowCount,
      columns: dataset.columns.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        approximateCardinality: col.cardinality,
      })),
    };

    return JSON.stringify(safeMetadata, null, 2);
  }

  /**
   * Check if research question contains PHI.
   */
  checkResearchQuestion(question: string): PHIGateResult {
    return this.checkForExternalAI(question);
  }

  /**
   * Prepare a user prompt for external AI.
   * Checks for PHI and sanitizes if needed.
   */
  preparePromptForAI(prompt: string): {
    content: string;
    phiResult: PHIGateResult;
  } {
    const phiResult = this.checkForExternalAI(prompt);

    if (!phiResult.allowed) {
      throw new Error(
        `PHI detected in prompt. Cannot send to external AI in LIVE mode. ` +
          `Detected patterns: ${phiResult.patterns.join(', ')}`
      );
    }

    return {
      content: phiResult.sanitizedContent || prompt,
      phiResult,
    };
  }

  /**
   * Validate that a SQL query is SELECT-only.
   * Returns false if the query contains modification statements.
   */
  validateSelectOnlyQuery(query: string): boolean {
    const normalized = query.toUpperCase().trim();

    // Must start with SELECT or WITH (for CTEs)
    if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
      return false;
    }

    // Block modification keywords
    const blockedKeywords = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'CREATE',
      'ALTER',
      'TRUNCATE',
      'GRANT',
      'REVOKE',
      'EXECUTE',
      'EXEC',
    ];

    for (const keyword of blockedKeywords) {
      // Check for keyword as a whole word (not part of identifier)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(normalized)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add row limit to a SELECT query if not present.
   */
  ensureRowLimit(query: string, maxRows: number = 100000): string {
    const normalized = query.toUpperCase().trim();

    // If already has LIMIT, return as-is
    if (/\bLIMIT\s+\d+/i.test(normalized)) {
      return query;
    }

    // Add LIMIT to the end
    return `${query.trim()} LIMIT ${maxRows}`;
  }
}

export const phiGate = new PHIGate();
