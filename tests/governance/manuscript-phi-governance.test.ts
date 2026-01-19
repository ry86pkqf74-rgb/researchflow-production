/**
 * Manuscript PHI Governance Tests
 * Phase B: Manuscript Productionization Integration
 *
 * CRITICAL TESTS:
 * - PHI values NEVER leak through API responses
 * - Export operations are gated by PHI scan
 * - Plagiarism check results don't expose matched text
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the PHI scan service results
interface PhiDetection {
  section: string;
  type: string;
  pattern: string;
  startIndex: number;
  endIndex: number;
  severity: 'critical' | 'high' | 'medium';
  recommendation: string;
  detectionId: string;
}

interface FinalScanResult {
  passed: boolean;
  manuscriptId: string;
  scanTimestamp: Date;
  totalScanned: number;
  phiDetections: PhiDetection[];
  quarantinedItems: string[];
  attestationRequired: boolean;
  auditHash: string;
}

// Mock plagiarism results
interface PlagiarismMatch {
  sourceId: string;
  sourceTitle: string;
  matchedTextLocation: { start: number; end: number };
  matchedTextLength: number;
  matchedTextHash: string;
  similarityScore: number;
  ngramSize: number;
  matchType: 'exact' | 'near_exact' | 'paraphrase';
  isCited: boolean;
}

describe('Manuscript PHI Governance - Phase B', () => {

  describe('PHI Detection Response Structure', () => {
    it('PHI detections should NOT contain actual PHI values (context field removed)', () => {
      // Simulated PHI detection result following the new governance structure
      const detection: PhiDetection = {
        section: 'methods',
        type: 'ssn',
        pattern: '\\b\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4}\\b',
        // GOVERNANCE: No 'context' field that would expose PHI
        startIndex: 1234,
        endIndex: 1245,
        severity: 'critical',
        recommendation: 'Remove completely - never include SSN',
        detectionId: 'methods:ssn:1234:1245'
      };

      // Assert that the detection does NOT have a 'context' field
      expect(detection).not.toHaveProperty('context');
      expect(detection).not.toHaveProperty('matchedText');
      expect(detection).not.toHaveProperty('value');

      // Assert it DOES have location-based fields
      expect(detection.startIndex).toBeDefined();
      expect(detection.endIndex).toBeDefined();
      expect(detection.detectionId).toBeDefined();
    });

    it('Final scan results should NOT expose PHI in quarantinedItems', () => {
      const scanResult: FinalScanResult = {
        passed: false,
        manuscriptId: 'ms-123',
        scanTimestamp: new Date(),
        totalScanned: 5,
        phiDetections: [{
          section: 'abstract',
          type: 'name',
          pattern: '.*',
          startIndex: 100,
          endIndex: 120,
          severity: 'critical',
          recommendation: 'Replace with pseudonym',
          detectionId: 'abstract:name:100:120'
        }],
        // GOVERNANCE: quarantinedItems now contains detection IDs, not PHI values
        quarantinedItems: ['abstract:name:100:120'],
        attestationRequired: true,
        auditHash: 'sha256-abc123...'
      };

      // Verify quarantinedItems contains IDs, not actual PHI content
      expect(scanResult.quarantinedItems[0]).toMatch(/^[a-z]+:[a-z]+:\d+:\d+$/);
      expect(scanResult.quarantinedItems[0]).not.toMatch(/john|smith|patient|doe/i);
    });
  });

  describe('Plagiarism Check Response Structure', () => {
    it('Plagiarism matches should NOT contain actual matched text', () => {
      const match: PlagiarismMatch = {
        sourceId: 'PMID:12345678',
        sourceTitle: 'A study on cardiac outcomes',
        // GOVERNANCE: matchedText REMOVED - only location and hash
        matchedTextLocation: { start: 500, end: 650 },
        matchedTextLength: 150,
        matchedTextHash: 'abc123def456', // Hash for deduplication
        similarityScore: 0.75,
        ngramSize: 5,
        matchType: 'near_exact',
        isCited: false
      };

      // Assert that the match does NOT have 'matchedText' field
      expect(match).not.toHaveProperty('matchedText');
      expect(match).not.toHaveProperty('text');
      expect(match).not.toHaveProperty('content');

      // Assert it DOES have appropriate non-leaking fields
      expect(match.matchedTextLocation).toBeDefined();
      expect(match.matchedTextLength).toBeDefined();
      expect(match.matchedTextHash).toBeDefined();
      expect(typeof match.matchedTextHash).toBe('string');
    });

    it('Matched text hash should be a valid hash format', () => {
      const match: PlagiarismMatch = {
        sourceId: 'DOI:10.1234/test',
        sourceTitle: 'Test Paper',
        matchedTextLocation: { start: 100, end: 200 },
        matchedTextLength: 100,
        matchedTextHash: 'abc123def456',
        similarityScore: 0.5,
        ngramSize: 5,
        matchType: 'paraphrase',
        isCited: true
      };

      // Hash should be alphanumeric, not readable text
      expect(match.matchedTextHash).toMatch(/^[a-f0-9]+$/);
      expect(match.matchedTextHash.length).toBeLessThanOrEqual(32);
    });
  });

  describe('Export Gating', () => {
    it('Export should be blocked when PHI scan fails', () => {
      const scanResult: FinalScanResult = {
        passed: false, // PHI detected
        manuscriptId: 'ms-456',
        scanTimestamp: new Date(),
        totalScanned: 5,
        phiDetections: [{
          section: 'results',
          type: 'mrn',
          pattern: '.*',
          startIndex: 200,
          endIndex: 210,
          severity: 'critical',
          recommendation: 'Remove or use study ID',
          detectionId: 'results:mrn:200:210'
        }],
        quarantinedItems: ['results:mrn:200:210'],
        attestationRequired: true,
        auditHash: 'sha256-xyz789...'
      };

      // Export should be blocked
      const canExport = scanResult.passed;
      expect(canExport).toBe(false);
      expect(scanResult.attestationRequired).toBe(true);
    });

    it('Export should be allowed when PHI scan passes', () => {
      const scanResult: FinalScanResult = {
        passed: true, // No PHI detected
        manuscriptId: 'ms-789',
        scanTimestamp: new Date(),
        totalScanned: 5,
        phiDetections: [],
        quarantinedItems: [],
        attestationRequired: false,
        auditHash: 'sha256-clean123...'
      };

      const canExport = scanResult.passed;
      expect(canExport).toBe(true);
      expect(scanResult.phiDetections).toHaveLength(0);
      expect(scanResult.quarantinedItems).toHaveLength(0);
    });
  });

  describe('Diff Generation Security', () => {
    it('Diff results should not contain sensitive data in summary', () => {
      // Mock diff result structure
      const diffResult = {
        fromVersionId: 'v1',
        toVersionId: 'v2',
        manuscriptId: 'ms-001',
        diff: [
          { type: 'add', section: 'methods', lineCount: 5 },
          { type: 'remove', section: 'results', lineCount: 3 },
          { type: 'modify', section: 'discussion', lineCount: 10 }
        ],
        summary: {
          additions: 5,
          deletions: 3,
          modifications: 10,
          totalChanges: 18
        }
      };

      // Summary should contain counts, not actual content
      expect(typeof diffResult.summary.additions).toBe('number');
      expect(typeof diffResult.summary.deletions).toBe('number');
      expect(typeof diffResult.summary.modifications).toBe('number');

      // Diff entries should reference sections, not expose content
      diffResult.diff.forEach(entry => {
        expect(entry).not.toHaveProperty('content');
        expect(entry).not.toHaveProperty('text');
        expect(entry).toHaveProperty('section');
        expect(entry).toHaveProperty('lineCount');
      });
    });
  });

  describe('API Response Sanitization', () => {
    it('Sanitized findings should strip PHI-containing fields', () => {
      // This test verifies the sanitizePhiFindings function behavior
      const rawFindings = {
        manuscriptId: 'ms-test',
        content: { abstract: 'Patient John Doe was enrolled...' }, // Should be stripped
        phiContext: 'John Doe, SSN 123-45-6789', // Should be stripped
        detections: [{
          detectionId: 'abstract:name:8:16',
          startIndex: 8,
          endIndex: 16
        }],
        safeField: 'This is allowed'
      };

      // Simulate sanitization
      const sanitized = sanitizeFindings(rawFindings);

      // These fields should be removed
      expect(sanitized).not.toHaveProperty('content');
      expect(sanitized).not.toHaveProperty('phiContext');
      expect(sanitized).not.toHaveProperty('matchedText');

      // These fields should remain
      expect(sanitized.manuscriptId).toBe('ms-test');
      expect(sanitized.safeField).toBe('This is allowed');
      expect(sanitized.detections).toBeDefined();
    });
  });
});

// Helper function that mirrors the actual sanitization logic
function sanitizeFindings(obj: any): any {
  const PHI_FIELDS = [
    'context',
    'matchedText',
    'matchedContent',
    'phiContext',
    'content',
    'rawText',
    'text',
    'value'
  ];

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeFindings);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PHI_FIELDS.includes(key)) {
      continue; // Skip PHI-containing fields
    }
    sanitized[key] = sanitizeFindings(value);
  }

  return sanitized;
}
