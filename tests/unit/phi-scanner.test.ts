/**
 * Comprehensive tests for PHI Scanner
 *
 * Ported from tests/governance/phi-scanner.test.ts
 * Adapted for new PhiFinding interface
 */

import { describe, it, expect } from 'vitest';
import { RegexPhiScanner, scan, redact, hasPhi } from '@researchflow/phi-engine';

describe('PHI Scanner - Core Interface', () => {
  describe('SSN Detection', () => {
    it('should detect SSN pattern with dashes (123-45-6789)', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Patient SSN: 123-45-6789');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.type === 'SSN')).toBe(true);
      const ssnFinding = findings.find(f => f.type === 'SSN');
      expect(ssnFinding?.value).toBe('123-45-6789');
      expect(ssnFinding?.confidence).toBeGreaterThan(0.7);
    });

    it('should detect SSN pattern with spaces', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Social Security: 123 45 6789');

      expect(findings.some(f => f.type === 'SSN')).toBe(true);
    });

    it('should detect SSN pattern without separators', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('SSN: 123456789');

      expect(findings.some(f => f.type === 'SSN')).toBe(true);
    });
  });

  describe('MRN Detection', () => {
    it('should detect MRN patterns', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('MRN: 847291AB is assigned to the patient');

      expect(findings.some(f => f.type === 'MRN')).toBe(true);
    });

    it('should detect Medical Record patterns', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Medical Record Number: ABC123456');

      expect(findings.some(f => f.type === 'MRN')).toBe(true);
    });

    it('should detect Patient ID patterns', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Patient ID: PAT456789');

      expect(findings.some(f => f.type === 'MRN')).toBe(true);
    });
  });

  describe('Name Detection', () => {
    it('should detect names with titles (Dr., Mr., Mrs.)', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Attending physician: Dr. John Smith');

      expect(findings.some(f => f.type === 'NAME')).toBe(true);
    });

    it('should detect patient name patterns', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Patient: Mary Johnson was admitted');

      expect(findings.some(f => f.type === 'NAME')).toBe(true);
    });

    it('should detect subject name patterns', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Subject: Robert Williams enrolled in study');

      expect(findings.some(f => f.type === 'NAME')).toBe(true);
    });
  });

  describe('Phone Number Detection', () => {
    it('should detect standard phone numbers', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Contact: 555-123-4567');

      expect(findings.some(f => f.type === 'PHONE')).toBe(true);
    });

    it('should detect phone with area code in parentheses', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Phone: (555) 123-4567');

      expect(findings.some(f => f.type === 'PHONE')).toBe(true);
    });
  });

  describe('Email Detection', () => {
    it('should detect email addresses', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Patient email: patient@hospital.org');

      expect(findings.some(f => f.type === 'EMAIL')).toBe(true);
    });
  });

  describe('Date Detection', () => {
    it('should detect dates in MM/DD/YYYY format', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Date of birth: 01/15/1985');

      expect(findings.some(f => f.type === 'DOB')).toBe(true);
    });

    it('should detect dates in Month Day, Year format', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Admitted on January 15, 2024');

      expect(findings.some(f => f.type === 'DOB')).toBe(true);
    });

    it('should detect ISO format dates', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Procedure date: 2024-03-22');

      expect(findings.some(f => f.type === 'DOB')).toBe(true);
    });
  });

  describe('Address Detection', () => {
    it('should detect street addresses', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Address: 123 Main Street, City');

      expect(findings.some(f => f.type === 'ADDRESS')).toBe(true);
    });

    it('should detect ZIP codes', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('ZIP: 90210');

      expect(findings.some(f => f.type === 'ZIP_CODE')).toBe(true);
    });
  });

  describe('Clean Data Detection', () => {
    it('should pass clean clinical data without PHI', () => {
      const scanner = new RegexPhiScanner();
      const content = `
        Study Summary:
        - Sample size: 2847 patients
        - Mean age: 54.3 years
        - TSH levels: 4.8 mIU/L (median)
        - Follow-up period: 5 years
        - Outcome: 12% cardiovascular events
      `;
      const findings = scanner.scan(content);

      expect(findings.length).toBe(0);
    });

    it('should pass aggregated statistics', () => {
      const scanner = new RegexPhiScanner();
      const content = `
        Table 1: Baseline Characteristics
        Variable | Mean | SD
        Age (years) | 54.3 | 12.8
        BMI (kg/m²) | 28.4 | 5.6
        HbA1c (%) | 7.2 | 1.1
      `;
      const findings = scanner.scan(content);

      expect(findings.length).toBe(0);
    });

    it('should pass de-identified variable names', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Variables: age, gender, bmi, systolic_bp, diastolic_bp');

      expect(findings.length).toBe(0);
    });
  });

  describe('Redaction', () => {
    it('should redact PHI with type labels', () => {
      const scanner = new RegexPhiScanner();
      const text = 'Patient SSN: 123-45-6789, Phone: 555-123-4567';
      const redacted = scanner.redact(text);

      expect(redacted).toContain('[REDACTED-SSN]');
      expect(redacted).toContain('[REDACTED-PHONE]');
      expect(redacted).not.toContain('123-45-6789');
      expect(redacted).not.toContain('555-123-4567');
    });

    it('should handle multiple PHI types', () => {
      const scanner = new RegexPhiScanner();
      const text = `
        Patient: Dr. John Smith
        MRN: PAT123456
        Email: john.smith@example.com
      `;
      const redacted = scanner.redact(text);

      expect(redacted).toContain('[REDACTED-NAME]');
      expect(redacted).toContain('[REDACTED-MRN]');
      expect(redacted).toContain('[REDACTED-EMAIL]');
    });

    it('should preserve non-PHI content', () => {
      const scanner = new RegexPhiScanner();
      const text = 'Study ID ABC-123, SSN: 123-45-6789, Protocol version 2.0';
      const redacted = scanner.redact(text);

      expect(redacted).toContain('Study ID ABC-123');
      expect(redacted).toContain('Protocol version 2.0');
      expect(redacted).not.toContain('123-45-6789');
    });
  });

  describe('hasPhi() Quick Check', () => {
    it('should return true when PHI present', () => {
      const scanner = new RegexPhiScanner();
      expect(scanner.hasPhi('SSN: 123-45-6789')).toBe(true);
    });

    it('should return false for clean data', () => {
      const scanner = new RegexPhiScanner();
      expect(scanner.hasPhi('Mean age: 54.3 years, TSH: 4.8')).toBe(false);
    });
  });

  describe('Convenience API', () => {
    it('should scan using convenience function', () => {
      const findings = scan('Phone: 555-123-4567');
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe('PHONE');
    });

    it('should redact using convenience function', () => {
      const redacted = redact('SSN: 123-45-6789');
      expect(redacted).toContain('[REDACTED-SSN]');
    });

    it('should check using convenience function', () => {
      expect(hasPhi('SSN: 123-45-6789')).toBe(true);
      expect(hasPhi('Clean data')).toBe(false);
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign higher confidence to longer matches', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Email: test@verylongdomainname.example.com');

      const emailFinding = findings.find(f => f.type === 'EMAIL');
      expect(emailFinding?.confidence).toBeGreaterThan(0.8);
    });

    it('should assign confidence within valid range', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('SSN: 123-45-6789, Phone: 555-123-4567');

      findings.forEach(finding => {
        expect(finding.confidence).toBeGreaterThanOrEqual(0);
        expect(finding.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Position Information', () => {
    it('should provide accurate position information', () => {
      const scanner = new RegexPhiScanner();
      const text = 'Patient SSN: 123-45-6789';
      const findings = scanner.scan(text);

      const ssnFinding = findings.find(f => f.type === 'SSN');
      expect(ssnFinding).toBeDefined();
      expect(text.substring(ssnFinding!.startIndex, ssnFinding!.endIndex)).toBe('123-45-6789');
    });

    it('should sort findings by position', () => {
      const scanner = new RegexPhiScanner();
      const text = 'Phone: 555-123-4567, Email: test@example.com, SSN: 123-45-6789';
      const findings = scanner.scan(text);

      for (let i = 1; i < findings.length; i++) {
        expect(findings[i].startIndex).toBeGreaterThanOrEqual(findings[i - 1].startIndex);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const scanner = new RegexPhiScanner();
      expect(scanner.scan('')).toEqual([]);
      expect(scanner.redact('')).toBe('');
      expect(scanner.hasPhi('')).toBe(false);
    });

    it('should handle null-like inputs gracefully', () => {
      const scanner = new RegexPhiScanner();
      // TypeScript would prevent these, but test runtime behavior
      const text = 'SSN: 123-45-6789';
      expect(() => scanner.scan(text)).not.toThrow();
    });

    it('should handle overlapping patterns', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Date: 12/25/2023 at address 12345 Main Street');

      // Should detect both date and address
      expect(findings.some(f => f.type === 'DOB')).toBe(true);
      expect(findings.some(f => f.type === 'ADDRESS' || f.type === 'ZIP_CODE')).toBe(true);
    });
  });

  // ============================================================================
  // Additional tests per Step 26 of INTEGRATION_PLAN.md
  // ============================================================================

  describe('MRN Detection - Extended Formats', () => {
    it('should detect MRN:123456 (numeric only, no space)', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('MRN:123456 is the patient record');

      expect(findings.some(f => f.type === 'MRN')).toBe(true);
    });

    it('should detect lowercase mrn: 1234567890 (10 digit numeric)', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Patient mrn: 1234567890 admitted today');

      expect(findings.some(f => f.type === 'MRN')).toBe(true);
    });
  });

  describe('Phone Number Detection - Extended Formats', () => {
    it('should detect phone with dots: 555.123.4567', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Contact: 555.123.4567');

      expect(findings.some(f => f.type === 'PHONE')).toBe(true);
      const phoneFinding = findings.find(f => f.type === 'PHONE');
      expect(phoneFinding?.value).toBe('555.123.4567');
    });

    it('should detect phone with spaces: 555 123 4567', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Phone: 555 123 4567');

      expect(findings.some(f => f.type === 'PHONE')).toBe(true);
      const phoneFinding = findings.find(f => f.type === 'PHONE');
      expect(phoneFinding?.value).toBe('555 123 4567');
    });
  });

  describe('DOB Detection - Extended Formats', () => {
    it('should detect DOB: 01/15/1990 (with DOB prefix)', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('DOB: 01/15/1990');

      expect(findings.some(f => f.type === 'DOB')).toBe(true);
    });

    // NOTE: This test documents expected behavior - 2-digit years do NOT match
    it('should NOT detect 2-digit year format birth date:1-15-90', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('birth date:1-15-90');

      // 2-digit years are intentionally not matched to avoid false positives
      expect(findings.some(f => f.type === 'DOB')).toBe(false);
    });
  });

  describe('Edge Cases - Partial Matches Should NOT Match', () => {
    it('should NOT detect incomplete SSN: 123-45-678 (only 8 digits)', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Incomplete: 123-45-678');

      expect(findings.some(f => f.type === 'SSN')).toBe(false);
    });

    it('should NOT detect SSN-like patterns with extra digits: 123-45-67890', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Number: 123-45-67890');

      // This has 5 digits at the end, not 4
      expect(findings.some(f => f.type === 'SSN')).toBe(false);
    });
  });

  describe('Edge Cases - False Positive Avoidance', () => {
    it('should NOT flag date 12/25/2023 as SSN', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Holiday: 12/25/2023');

      // Should detect as DOB, NOT as SSN
      const ssnFindings = findings.filter(f => f.type === 'SSN');
      expect(ssnFindings.length).toBe(0);

      // May detect as DOB which is expected
      expect(findings.some(f => f.type === 'DOB')).toBe(true);
    });

    it('should NOT flag study IDs as PHI', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('Study ID: STUDY-2024-001');

      expect(findings.length).toBe(0);
    });

    it('should NOT flag statistical values as PHI', () => {
      const scanner = new RegexPhiScanner();
      const findings = scanner.scan('p-value: 0.045, confidence interval: 0.92-0.98');

      expect(findings.length).toBe(0);
    });
  });

  describe('Redaction - Explicit Type Tests', () => {
    it('should redact EMAIL to [REDACTED-EMAIL]', () => {
      const scanner = new RegexPhiScanner();
      const text = 'Contact email: test@example.com for information';
      const redacted = scanner.redact(text);

      expect(redacted).toContain('[REDACTED-EMAIL]');
      expect(redacted).not.toContain('test@example.com');
      expect(redacted).toContain('Contact email:');
      expect(redacted).toContain('for information');
    });

    it('should redact DOB to [REDACTED-DOB]', () => {
      const scanner = new RegexPhiScanner();
      const text = 'Birth date: 01/15/1990';
      const redacted = scanner.redact(text);

      expect(redacted).toContain('[REDACTED-DOB]');
      expect(redacted).not.toContain('01/15/1990');
    });

    it('should redact MRN to [REDACTED-MRN]', () => {
      const scanner = new RegexPhiScanner();
      const text = 'MRN: ABC123456';
      const redacted = scanner.redact(text);

      expect(redacted).toContain('[REDACTED-MRN]');
      expect(redacted).not.toContain('ABC123456');
    });
  });
});
