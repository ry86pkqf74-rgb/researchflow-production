/**
 * PHI Protection Service Tests
 *
 * Tests for PHI-safe detection - ensures no raw PHI in detection results.
 * CRITICAL: These tests verify HIPAA compliance of detection outputs.
 */

import { describe, it, expect } from 'vitest';

import {
  scanForPhi,
  redactPhiInData,
  detectPhiFields,
  type PhiIdentifier,
  type PhiDetectionResult,
} from '../../../../services/orchestrator/src/services/phi-protection';

describe('PHI Protection Safety', () => {
  describe('scanForPhi - Hash-only Output', () => {
    it('should return valueHash instead of value', () => {
      const testText = 'Patient SSN is 123-45-6789';
      const result = scanForPhi(testText);

      expect(result.detected).toBe(true);
      expect(result.identifiers.length).toBeGreaterThan(0);

      for (const identifier of result.identifiers) {
        // CRITICAL: value must NOT exist
        expect(identifier).not.toHaveProperty('value');

        // valueHash must exist and be 12 hex chars
        expect(identifier).toHaveProperty('valueHash');
        expect(identifier.valueHash).toHaveLength(12);
        expect(identifier.valueHash).toMatch(/^[a-f0-9]{12}$/);

        // valueLength must exist
        expect(identifier).toHaveProperty('valueLength');
        expect(identifier.valueLength).toBeGreaterThan(0);
      }
    });

    it('should not expose raw SSN in any field', () => {
      const ssn = '123-45-6789';
      const testText = `SSN: ${ssn}`;
      const result = scanForPhi(testText);

      // Serialize the entire result and check for SSN
      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw SSN must not appear anywhere in output
      expect(resultJson).not.toContain(ssn);
    });

    it('should not expose raw email in any field', () => {
      const email = 'john.doe@hospital.com';
      const testText = `Email: ${email}`;
      const result = scanForPhi(testText);

      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw email must not appear anywhere
      expect(resultJson).not.toContain(email);
    });

    it('should not expose raw phone number in any field', () => {
      const phone = '555-867-5309';
      const testText = `Call ${phone}`;
      const result = scanForPhi(testText);

      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw phone must not appear anywhere
      expect(resultJson).not.toContain(phone);
    });

    it('should not expose raw MRN in any field', () => {
      const testText = 'MRN: 12345678901';
      const result = scanForPhi(testText);

      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw MRN must not appear anywhere
      expect(resultJson).not.toContain('12345678901');
    });

    it('should not expose raw IP address in any field', () => {
      const ip = '192.168.1.100';
      const testText = `Server IP: ${ip}`;
      const result = scanForPhi(testText);

      const resultJson = JSON.stringify(result);

      // CRITICAL: Raw IP must not appear anywhere
      expect(resultJson).not.toContain(ip);
    });

    it('should preserve position information', () => {
      const testText = 'Patient email: test@example.com';
      const result = scanForPhi(testText);

      for (const identifier of result.identifiers) {
        expect(identifier.position).toBeDefined();
        expect(typeof identifier.position.start).toBe('number');
        expect(typeof identifier.position.end).toBe('number');
        expect(identifier.position.end).toBeGreaterThan(identifier.position.start);
      }
    });

    it('should produce consistent hashes for same input', () => {
      const testText = 'SSN: 123-45-6789';

      const result1 = scanForPhi(testText);
      const result2 = scanForPhi(testText);

      // Same content should produce same hash
      expect(result1.identifiers[0].valueHash).toBe(result2.identifiers[0].valueHash);
    });

    it('should produce different hashes for different inputs', () => {
      const result1 = scanForPhi('SSN: 123-45-6789');
      const result2 = scanForPhi('SSN: 987-65-4321');

      expect(result1.identifiers[0].valueHash).not.toBe(result2.identifiers[0].valueHash);
    });
  });

  describe('PhiIdentifier interface', () => {
    it('should have valueHash and valueLength, not value', () => {
      const testText = 'Email: test@test.com';
      const result = scanForPhi(testText);

      if (result.identifiers.length > 0) {
        const identifier = result.identifiers[0];

        // Verify interface shape
        const keys = Object.keys(identifier);
        expect(keys).toContain('valueHash');
        expect(keys).toContain('valueLength');
        expect(keys).not.toContain('value');
      }
    });
  });

  describe('redactPhiInData', () => {
    it('should redact PHI using position data (not stored value)', () => {
      const testText = 'Contact: john@example.com or 555-123-4567';
      const redacted = redactPhiInData(testText);

      // Original values should be replaced
      expect(redacted).not.toContain('john@example.com');
      expect(redacted).not.toContain('555-123-4567');

      // Should contain redaction markers
      expect(redacted).toContain('_REDACTED]');
    });

    it('should not alter clean text', () => {
      const cleanText = 'This is clean text without PHI.';
      const result = redactPhiInData(cleanText);

      expect(result).toBe(cleanText);
    });
  });

  describe('detectPhiFields', () => {
    it('should identify fields containing PHI', () => {
      const data = {
        name: 'John Doe',
        email: 'john@hospital.com',
        notes: 'Patient has SSN 123-45-6789',
        cleanField: 'No PHI here',
      };

      const phiFields = detectPhiFields(data);

      expect(phiFields).toContain('name');
      expect(phiFields).toContain('email');
      expect(phiFields).toContain('notes');
      expect(phiFields).not.toContain('cleanField');
    });

    it('should detect suspicious field names', () => {
      const data = {
        patient_ssn: '000-00-0000', // Field name triggers
        medical_record_number: 'ABC123',
        date_of_birth: '1990-01-01',
        normal_field: 'Normal value',
      };

      const phiFields = detectPhiFields(data);

      expect(phiFields).toContain('patient_ssn');
      // Note: 'medical_record_number' contains 'medical_record' but not exact match
      // 'date_of_birth' matches 'date_of_birth' pattern
      expect(phiFields).toContain('date_of_birth');
      expect(phiFields).not.toContain('normal_field');
    });
  });
});

describe('PHI Protection Risk Assessment', () => {
  it('should return CRITICAL for SSN', () => {
    const testText = 'SSN: 123-45-6789';
    const result = scanForPhi(testText);

    expect(result.riskLevel).toBe('CRITICAL');
  });

  it('should return CRITICAL for MRN', () => {
    const testText = 'MRN: 1234567890';
    const result = scanForPhi(testText);

    expect(result.riskLevel).toBe('CRITICAL');
  });

  it('should return NONE for clean text', () => {
    const cleanText = 'This is completely clean text.';
    const result = scanForPhi(cleanText);

    expect(result.detected).toBe(false);
    expect(result.riskLevel).toBe('NONE');
  });
});
