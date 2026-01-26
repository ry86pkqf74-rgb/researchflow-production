/**
 * PHI Scanner Tests
 *
 * Tests for PHI-safe scanning - ensures no raw PHI in scan results.
 * CRITICAL: These tests verify HIPAA compliance of scan outputs.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the phi-engine module
vi.mock('@researchflow/phi-engine', () => ({
  PHI_PATTERNS: [
    {
      type: 'SSN',
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      description: 'Social Security Number',
      baseConfidence: 0.9,
      hipaaCategory: '164.514(b)(2)(i)(A)',
    },
    {
      type: 'EMAIL',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      description: 'Email Address',
      baseConfidence: 0.85,
      hipaaCategory: '164.514(b)(2)(i)(F)',
    },
    {
      type: 'PHONE',
      regex: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      description: 'Phone Number',
      baseConfidence: 0.8,
      hipaaCategory: '164.514(b)(2)(i)(D)',
    },
    {
      type: 'MRN',
      regex: /\bMRN[-:\s]?\d{5,}\b/gi,
      description: 'Medical Record Number',
      baseConfidence: 0.95,
      hipaaCategory: '164.514(b)(2)(i)(E)',
    },
  ],
}));

// Import after mocking
import { scanForPHI, type PHIPattern, type PHIScanResult } from '../../../../services/orchestrator/services/phi-scanner';

describe('PHI Scanner Safety', () => {
  describe('scanForPHI - Hash-only Output', () => {
    it('should return matchHash instead of matchedText', () => {
      const testContent = 'Patient SSN is 123-45-6789';
      const result = scanForPHI(testContent, 'upload');

      expect(result.detected.length).toBeGreaterThan(0);

      for (const finding of result.detected) {
        // CRITICAL: matchedText must NOT exist
        expect(finding).not.toHaveProperty('matchedText');

        // matchHash must exist and be 12 hex chars
        expect(finding).toHaveProperty('matchHash');
        expect(finding.matchHash).toHaveLength(12);
        expect(finding.matchHash).toMatch(/^[a-f0-9]{12}$/);

        // matchLength must exist
        expect(finding).toHaveProperty('matchLength');
        expect(finding.matchLength).toBeGreaterThan(0);
      }
    });

    it('should not expose raw SSN in any field', () => {
      const ssn = '123-45-6789';
      const testContent = `Patient SSN is ${ssn}`;
      const result = scanForPHI(testContent, 'upload');

      // Serialize the entire result and check for SSN
      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw SSN must not appear anywhere in output
      expect(resultJson).not.toContain(ssn);
      expect(resultJson).not.toContain('123-45-6789');
    });

    it('should not expose raw email in any field', () => {
      const email = 'patient@hospital.com';
      const testContent = `Contact: ${email}`;
      const result = scanForPHI(testContent, 'upload');

      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw email must not appear anywhere in output
      expect(resultJson).not.toContain(email);
      expect(resultJson).not.toContain('patient@hospital.com');
    });

    it('should not expose raw phone number in any field', () => {
      const phone = '555-123-4567';
      const testContent = `Call ${phone} for results`;
      const result = scanForPHI(testContent, 'upload');

      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw phone must not appear anywhere in output
      expect(resultJson).not.toContain(phone);
    });

    it('should not expose raw MRN in any field', () => {
      const mrn = 'MRN-12345678';
      const testContent = `Patient ${mrn} admitted`;
      const result = scanForPHI(testContent, 'upload');

      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw MRN must not appear anywhere in output
      expect(resultJson).not.toContain('12345678');
    });

    it('should preserve position information', () => {
      const testContent = 'SSN: 123-45-6789 at position 5';
      const result = scanForPHI(testContent, 'upload');

      expect(result.detected.length).toBeGreaterThan(0);

      for (const finding of result.detected) {
        expect(finding.position).toBeDefined();
        expect(typeof finding.position.start).toBe('number');
        expect(typeof finding.position.end).toBe('number');
        expect(finding.position.end).toBeGreaterThan(finding.position.start);
      }
    });

    it('should produce consistent hashes for same input', () => {
      const testContent = 'SSN is 123-45-6789';

      const result1 = scanForPHI(testContent, 'upload');
      const result2 = scanForPHI(testContent, 'upload');

      // Same content should produce same hash (deterministic)
      // Note: scanIds will differ but matchHash should be same
      expect(result1.detected[0].matchHash).toBe(result2.detected[0].matchHash);
    });

    it('should produce different hashes for different inputs', () => {
      const content1 = 'SSN: 123-45-6789';
      const content2 = 'SSN: 987-65-4321';

      const result1 = scanForPHI(content1, 'upload');
      const result2 = scanForPHI(content2, 'upload');

      expect(result1.detected[0].matchHash).not.toBe(result2.detected[0].matchHash);
    });
  });

  describe('scanForPHI - Summary Stats', () => {
    it('should include summary without raw PHI', () => {
      const testContent = 'Patient 123-45-6789 email patient@test.com phone 555-123-4567';
      const result = scanForPHI(testContent, 'upload');

      expect(result.summary).toBeDefined();
      expect(result.summary.totalPatterns).toBeGreaterThanOrEqual(3);
      expect(result.summary.byCategory).toBeDefined();

      // Summary should not contain raw PHI
      const summaryJson = JSON.stringify(result.summary);
      expect(summaryJson).not.toContain('123-45-6789');
      expect(summaryJson).not.toContain('patient@test.com');
      expect(summaryJson).not.toContain('555-123-4567');
    });
  });

  describe('PHIPattern interface', () => {
    it('should have matchHash and matchLength, not matchedText', () => {
      const testContent = 'Test 123-45-6789';
      const result = scanForPHI(testContent, 'upload');

      if (result.detected.length > 0) {
        const pattern = result.detected[0];

        // Verify interface shape
        const keys = Object.keys(pattern);
        expect(keys).toContain('matchHash');
        expect(keys).toContain('matchLength');
        expect(keys).not.toContain('matchedText');
        expect(keys).not.toContain('value');
      }
    });
  });
});

describe('PHI Scanner Risk Assessment', () => {
  it('should calculate risk level based on findings', () => {
    const highRiskContent = `
      Patient: John Smith
      SSN: 123-45-6789
      MRN: MRN-12345678
      DOB: 01/15/1980
      Phone: 555-123-4567
      Email: john.smith@hospital.com
    `;

    const result = scanForPHI(highRiskContent, 'upload');

    // Should have multiple findings
    expect(result.detected.length).toBeGreaterThanOrEqual(3);

    // Risk level should be elevated
    expect(['medium', 'high']).toContain(result.riskLevel);
  });

  it('should return none risk for clean content', () => {
    const cleanContent = 'This is a normal sentence without any identifiers.';
    const result = scanForPHI(cleanContent, 'upload');

    expect(result.detected.length).toBe(0);
    expect(result.riskLevel).toBe('none');
  });
});
