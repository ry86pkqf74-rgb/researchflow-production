import { describe, it, expect, beforeEach } from 'vitest';
import {
  scanForPHI,
  requestPHIOverride,
  getScanResult,
  getOverrideResult,
  type PHIScanResult,
  type PHIOverrideResult
} from '../../apps/api-node/services/phi-scanner';

describe('PHI Scanner', () => {
  describe('SSN Detection', () => {
    it('should detect SSN pattern with dashes (123-45-6789)', () => {
      const content = 'Patient SSN: 123-45-6789';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.length).toBeGreaterThan(0);
      expect(result.detected.some(p => p.category === 'ssn')).toBe(true);
      expect(result.riskLevel).not.toBe('none');
    });

    it('should detect SSN pattern with spaces', () => {
      const content = 'Social Security: 123 45 6789';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'ssn')).toBe(true);
    });

    it('should detect SSN pattern without separators', () => {
      const content = 'SSN: 123456789';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'ssn')).toBe(true);
    });
  });

  describe('MRN Detection', () => {
    it('should detect MRN patterns', () => {
      const content = 'MRN: 847291 is assigned to the patient';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'mrn')).toBe(true);
    });

    it('should detect Medical Record patterns', () => {
      const content = 'Medical Record Number: ABC123456';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'mrn')).toBe(true);
    });

    it('should detect Patient ID patterns', () => {
      const content = 'Patient ID: PAT456789';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'mrn')).toBe(true);
    });
  });

  describe('Name Detection', () => {
    it('should detect names with titles (Dr., Mr., Mrs.)', () => {
      const content = 'Attending physician: Dr. John Smith';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'name')).toBe(true);
    });

    it('should detect patient name patterns', () => {
      const content = 'Patient: Mary Johnson was admitted';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'name')).toBe(true);
    });

    it('should detect subject name patterns', () => {
      const content = 'Subject: Robert Williams enrolled in study';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'name')).toBe(true);
    });
  });

  describe('Clean Data Detection', () => {
    it('should pass clean clinical data without PHI', () => {
      const content = `
        Study Summary:
        - Sample size: 2847 patients
        - Mean age: 54.3 years
        - TSH levels: 4.8 mIU/L (median)
        - Follow-up period: 5 years
        - Outcome: 12% cardiovascular events
      `;
      const result = scanForPHI(content, 'upload');
      
      expect(result.riskLevel).toBe('none');
      expect(result.detected.length).toBe(0);
    });

    it('should pass aggregated statistics', () => {
      const content = `
        Table 1: Baseline Characteristics
        Variable | Mean | SD
        Age (years) | 54.3 | 12.8
        BMI (kg/m²) | 28.4 | 5.6
        HbA1c (%) | 7.2 | 1.1
      `;
      const result = scanForPHI(content, 'upload');
      
      expect(result.riskLevel).toBe('none');
    });

    it('should pass de-identified variable names', () => {
      const content = 'Variables: age, gender, bmi, systolic_bp, diastolic_bp';
      const result = scanForPHI(content, 'upload');
      
      expect(result.riskLevel).toBe('none');
    });
  });

  describe('Phone Number Detection', () => {
    it('should detect standard phone numbers', () => {
      const content = 'Contact: 555-123-4567';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'phone')).toBe(true);
    });

    it('should detect phone with area code in parentheses', () => {
      const content = 'Phone: (555) 123-4567';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'phone')).toBe(true);
    });
  });

  describe('Email Detection', () => {
    it('should detect email addresses', () => {
      const content = 'Patient email: patient@hospital.org';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'email')).toBe(true);
    });
  });

  describe('Date Detection', () => {
    it('should detect dates in MM/DD/YYYY format', () => {
      const content = 'Date of birth: 01/15/1985';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'date')).toBe(true);
    });

    it('should detect dates in Month Day, Year format', () => {
      const content = 'Admitted on January 15, 2024';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'date')).toBe(true);
    });

    it('should detect ISO format dates', () => {
      const content = 'Procedure date: 2024-03-22';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'date')).toBe(true);
    });
  });

  describe('Address Detection', () => {
    it('should detect street addresses', () => {
      const content = 'Address: 123 Main Street, City';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'address')).toBe(true);
    });

    it('should detect ZIP codes', () => {
      const content = 'ZIP: 90210';
      const result = scanForPHI(content, 'upload');
      
      expect(result.detected.some(p => p.category === 'geographic')).toBe(true);
    });
  });

  describe('Risk Level Determination', () => {
    it('should assign none risk for clean data', () => {
      const content = 'TSH level: 4.5 mIU/L, normal range';
      const result = scanForPHI(content, 'upload');
      
      expect(result.riskLevel).toBe('none');
    });

    it('should assign high risk for multiple PHI types', () => {
      const content = `
        Patient: Dr. John Smith
        MRN: 123456
        SSN: 123-45-6789
        Address: 123 Main St
        Phone: 555-123-4567
      `;
      const result = scanForPHI(content, 'upload');
      
      expect(result.riskLevel).toBe('high');
    });

    it('should require override for export context with PHI', () => {
      const content = 'Patient: Dr. John Smith, MRN: 123456';
      const result = scanForPHI(content, 'export');
      
      expect(result.requiresOverride).toBe(true);
    });
  });

  describe('Quarantine State Trigger', () => {
    it('should trigger quarantine state when PHI detected in export', () => {
      const content = 'Patient SSN: 123-45-6789';
      const result = scanForPHI(content, 'export');
      
      expect(result.requiresOverride).toBe(true);
      expect(result.riskLevel).not.toBe('none');
    });

    it('should include scan ID for quarantine tracking', () => {
      const content = 'Patient: Dr. Jane Doe';
      const result = scanForPHI(content, 'upload');
      
      expect(result.scanId).toBeDefined();
      expect(result.scanId.length).toBeGreaterThan(0);
    });
  });

  describe('PHI Override', () => {
    it('should store scan results for retrieval', () => {
      const content = 'Patient SSN: 123-45-6789';
      const scanResult = scanForPHI(content, 'export');
      
      const retrieved = getScanResult(scanResult.scanId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.scanId).toBe(scanResult.scanId);
    });

    it('should approve override with valid justification and role', () => {
      const content = 'Patient SSN: 123-45-6789';
      const scanResult = scanForPHI(content, 'export');
      
      const override = requestPHIOverride({
        scanId: scanResult.scanId,
        justification: 'Required for IRB-approved retrospective analysis with DUA in place',
        approverRole: 'STEWARD'
      });
      
      expect(override.approved).toBe(true);
      expect(override.auditId).toBeDefined();
    });

    it('should reject override with insufficient justification', () => {
      const content = 'Patient SSN: 123-45-6789';
      const scanResult = scanForPHI(content, 'export');
      
      const override = requestPHIOverride({
        scanId: scanResult.scanId,
        justification: 'Need it', // Too short
        approverRole: 'STEWARD'
      });
      
      expect(override.approved).toBe(false);
    });

    it('should reject override from insufficient role', () => {
      const content = 'Patient SSN: 123-45-6789';
      const scanResult = scanForPHI(content, 'export');
      
      const override = requestPHIOverride({
        scanId: scanResult.scanId,
        justification: 'Required for IRB-approved retrospective analysis with DUA in place',
        approverRole: 'VIEWER'
      });
      
      expect(override.approved).toBe(false);
    });

    it('should include conditions in approved override', () => {
      const content = 'Patient SSN: 123-45-6789';
      const scanResult = scanForPHI(content, 'export');
      
      const override = requestPHIOverride({
        scanId: scanResult.scanId,
        justification: 'Required for IRB-approved retrospective analysis with DUA in place',
        approverRole: 'ADMIN'
      });
      
      expect(override.approved).toBe(true);
      expect(override.conditions).toBeDefined();
      expect(override.conditions?.length).toBeGreaterThan(0);
    });

    it('should set expiration time for approved overrides', () => {
      const content = 'Patient SSN: 123-45-6789';
      const scanResult = scanForPHI(content, 'export');
      
      const override = requestPHIOverride({
        scanId: scanResult.scanId,
        justification: 'Required for IRB-approved retrospective analysis with DUA in place',
        approverRole: 'STEWARD'
      });
      
      expect(override.approved).toBe(true);
      expect(override.expiresAt).toBeDefined();
    });
  });

  describe('Scan Summary', () => {
    it('should include category breakdown in summary', () => {
      const content = `
        Patient: Dr. John Smith
        SSN: 123-45-6789
        Phone: 555-123-4567
      `;
      const result = scanForPHI(content, 'upload');
      
      expect(result.summary).toBeDefined();
      expect(result.summary.byCategory).toBeDefined();
      expect(result.summary.totalPatterns).toBeGreaterThan(0);
    });

    it('should count high confidence patterns', () => {
      const content = 'SSN: 123-45-6789, MRN: 847291';
      const result = scanForPHI(content, 'upload');
      
      expect(result.summary.highConfidenceCount).toBeDefined();
    });

    it('should include content length in result', () => {
      const content = 'Test content for PHI scanning';
      const result = scanForPHI(content, 'upload');
      
      expect(result.contentLength).toBe(content.length);
    });
  });

  describe('HIPAA Identifier Mapping', () => {
    it('should include HIPAA identifiers for detected patterns', () => {
      const content = 'SSN: 123-45-6789';
      const result = scanForPHI(content, 'upload');
      
      const ssnPattern = result.detected.find(p => p.category === 'ssn');
      expect(ssnPattern?.hipaaIdentifier).toContain('HIPAA');
    });

    it('should suggest appropriate action for each pattern', () => {
      const content = 'Patient SSN: 123-45-6789';
      const result = scanForPHI(content, 'upload');
      
      result.detected.forEach(pattern => {
        expect(['redact', 'review', 'remove']).toContain(pattern.suggestedAction);
      });
    });
  });
});
