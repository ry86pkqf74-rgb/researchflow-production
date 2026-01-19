/**
 * Final PHI Scan Service Unit Tests
 * Task T97: CRITICAL - Test PHI detection before export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinalPhiScanService } from '../final-phi-scan.service';
import type { FinalScanResult, PhiDetection } from '../final-phi-scan.service';

describe('FinalPhiScanService', () => {
  let service: FinalPhiScanService;
  const mockManuscriptId = 'manuscript-test-001';
  const mockUserId = 'user-test-001';

  beforeEach(() => {
    service = new FinalPhiScanService();
    vi.clearAllMocks();
  });

  const cleanManuscript = {
    title: 'Exercise and Blood Pressure: A Study',
    abstract: 'Background: Hypertension common. Methods: RCT with 200 adults. Results: BP decreased 12 mmHg.',
    methods: 'IRB approval obtained. Participants: adults 40-70 years with hypertension.',
    results: 'Primary outcome: SBP decreased (95% CI: -13.8 to -6.6, p<0.001).',
    discussion: 'Exercise reduces blood pressure. Limitations: single-center study.'
  };

  describe('performFinalScan - Clean Content', () => {
    it('should pass scan for clean manuscript', async () => {
      const result = await service.performFinalScan(
        mockManuscriptId,
        cleanManuscript,
        mockUserId
      );

      expect(result.passed).toBe(true);
      expect(result.phiDetections.length).toBe(0);
      expect(result.quarantinedItems.length).toBe(0);
      expect(result.attestationRequired).toBe(false);
    });

    it('should return valid scan result structure', async () => {
      const result = await service.performFinalScan(
        mockManuscriptId,
        cleanManuscript,
        mockUserId
      );

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('manuscriptId');
      expect(result).toHaveProperty('scanTimestamp');
      expect(result).toHaveProperty('totalScanned');
      expect(result).toHaveProperty('phiDetections');
      expect(result).toHaveProperty('quarantinedItems');
      expect(result).toHaveProperty('attestationRequired');
      expect(result).toHaveProperty('auditHash');
    });

    it('should count scanned sections correctly', async () => {
      const result = await service.performFinalScan(
        mockManuscriptId,
        cleanManuscript,
        mockUserId
      );

      expect(result.totalScanned).toBe(5); // title, abstract, methods, results, discussion
      expect(result.manuscriptId).toBe(mockManuscriptId);
    });

    it('should generate SHA-256 audit hash', async () => {
      const result = await service.performFinalScan(
        mockManuscriptId,
        cleanManuscript,
        mockUserId
      );

      expect(result.auditHash).toBeDefined();
      expect(result.auditHash.length).toBe(64); // SHA-256 produces 64 hex characters
      expect(/^[a-f0-9]{64}$/.test(result.auditHash)).toBe(true);
    });

    it('should skip empty sections', async () => {
      const sparseManuscript = {
        title: 'Test Study',
        abstract: '',
        methods: 'Some methods',
        results: '',
        discussion: ''
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        sparseManuscript,
        mockUserId
      );

      expect(result.totalScanned).toBe(2); // Only title and methods
    });
  });

  describe('PHI Detection - Names', () => {
    it('should detect patient names with Mr.', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: cleanManuscript.methods + ' Patient Mr. John Smith enrolled.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      expect(result.phiDetections.length).toBeGreaterThan(0);

      const nameDetection = result.phiDetections.find(d => d.type === 'name');
      expect(nameDetection).toBeDefined();
      expect(nameDetection?.severity).toBe('critical');
      expect(nameDetection?.section).toBe('methods');
    });

    it('should detect names with Dr. prefix', async () => {
      const contaminated = {
        ...cleanManuscript,
        discussion: 'Dr. Jane Doe reviewed the results.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const nameDetection = result.phiDetections.find(d => d.type === 'name');
      expect(nameDetection).toBeDefined();
    });

    it('should detect names with Mrs. prefix', async () => {
      const contaminated = {
        ...cleanManuscript,
        results: 'Mrs. Mary Johnson completed the study.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const nameDetection = result.phiDetections.find(d => d.type === 'name');
      expect(nameDetection).toBeDefined();
    });

    it('should provide recommendation for names', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Mr. Test Patient was enrolled.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      const nameDetection = result.phiDetections.find(d => d.type === 'name');
      expect(nameDetection?.recommendation).toContain('Patient A');
    });
  });

  describe('PHI Detection - Date of Birth', () => {
    it('should detect DOB with explicit label', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient enrolled, DOB: 05/15/1980.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const dobDetection = result.phiDetections.find(d => d.type === 'dob');
      expect(dobDetection).toBeDefined();
      expect(dobDetection?.severity).toBe('critical');
    });

    it('should detect birth date format', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient born 01/15/1975 enrolled.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const dobDetection = result.phiDetections.find(d => d.type === 'dob');
      expect(dobDetection).toBeDefined();
    });
  });

  describe('PHI Detection - SSN', () => {
    it('should detect SSN with dashes', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient SSN: 123-45-6789 recorded.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const ssnDetection = result.phiDetections.find(d => d.type === 'ssn');
      expect(ssnDetection).toBeDefined();
      expect(ssnDetection?.severity).toBe('critical');
    });

    it('should detect SSN with spaces', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'SSN 123 45 6789 on file.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const ssnDetection = result.phiDetections.find(d => d.type === 'ssn');
      expect(ssnDetection).toBeDefined();
    });

    it('should detect SSN without separators', async () => {
      const contaminated = {
        ...cleanManuscript,
        results: 'ID 123456789 excluded from analysis.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const ssnDetection = result.phiDetections.find(d => d.type === 'ssn');
      expect(ssnDetection).toBeDefined();
    });
  });

  describe('PHI Detection - MRN', () => {
    it('should detect medical record number', async () => {
      const contaminated = {
        ...cleanManuscript,
        results: 'Patient MRN: 12345678 excluded.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const mrnDetection = result.phiDetections.find(d => d.type === 'mrn');
      expect(mrnDetection).toBeDefined();
      expect(mrnDetection?.severity).toBe('critical');
    });

    it('should detect medical record label variations', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'medical record #98765432 reviewed.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const mrnDetection = result.phiDetections.find(d => d.type === 'mrn');
      expect(mrnDetection).toBeDefined();
    });
  });

  describe('PHI Detection - Phone Numbers', () => {
    it('should detect phone with parentheses', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Contact: (555) 123-4567 for follow-up.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const phoneDetection = result.phiDetections.find(d => d.type === 'phone');
      expect(phoneDetection).toBeDefined();
      expect(phoneDetection?.severity).toBe('high');
    });

    it('should detect phone with dashes', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Phone: 555-123-4567 provided.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const phoneDetection = result.phiDetections.find(d => d.type === 'phone');
      expect(phoneDetection).toBeDefined();
    });

    it('should detect phone with country code', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient phone: +1 555-123-4567.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const phoneDetection = result.phiDetections.find(d => d.type === 'phone');
      expect(phoneDetection).toBeDefined();
    });
  });

  describe('PHI Detection - Email', () => {
    it('should detect email addresses', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Contact patient at john.doe@example.com.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const emailDetection = result.phiDetections.find(d => d.type === 'email');
      expect(emailDetection).toBeDefined();
      expect(emailDetection?.severity).toBe('high');
    });
  });

  describe('PHI Detection - Address', () => {
    it('should detect street addresses', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient resides at 123 Main Street.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const addressDetection = result.phiDetections.find(d => d.type === 'address');
      expect(addressDetection).toBeDefined();
      expect(addressDetection?.severity).toBe('high');
    });

    it('should detect Avenue addresses', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Address: 456 Oak Avenue provided.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const addressDetection = result.phiDetections.find(d => d.type === 'address');
      expect(addressDetection).toBeDefined();
    });
  });

  describe('PHI Detection - ZIP Code', () => {
    it('should detect 5-digit ZIP codes', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient from ZIP 12345.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const zipDetection = result.phiDetections.find(d => d.type === 'zip');
      expect(zipDetection).toBeDefined();
      expect(zipDetection?.severity).toBe('medium');
    });

    it('should detect ZIP+4 format', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Location: ZIP 12345-6789.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const zipDetection = result.phiDetections.find(d => d.type === 'zip');
      expect(zipDetection).toBeDefined();
    });
  });

  describe('PHI Detection - Account Numbers', () => {
    it('should detect account numbers', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Billing account: 98765432.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const accountDetection = result.phiDetections.find(d => d.type === 'account');
      expect(accountDetection).toBeDefined();
      expect(accountDetection?.severity).toBe('high');
    });
  });

  describe('PHI Detection - Other Identifiers', () => {
    it('should detect license numbers', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Driver license: ABC123456.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const licenseDetection = result.phiDetections.find(d => d.type === 'license');
      expect(licenseDetection).toBeDefined();
    });

    it('should detect vehicle identifiers', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'VIN: 1HGBH41JXMN109186 recorded.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const vehicleDetection = result.phiDetections.find(d => d.type === 'vehicle');
      expect(vehicleDetection).toBeDefined();
    });

    it('should detect device identifiers', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Device ID: DEV-12345-67890.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const deviceDetection = result.phiDetections.find(d => d.type === 'device');
      expect(deviceDetection).toBeDefined();
    });

    it('should detect URLs with patient IDs', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Record: https://hospital.com/patient?id=12345.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const urlDetection = result.phiDetections.find(d => d.type === 'url');
      expect(urlDetection).toBeDefined();
    });

    it('should detect IP addresses', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Device IP: 192.168.1.100 monitored.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const ipDetection = result.phiDetections.find(d => d.type === 'ip');
      expect(ipDetection).toBeDefined();
    });

    it('should detect biometric references', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Fingerprint: 12345678 captured.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const biometricDetection = result.phiDetections.find(d => d.type === 'biometric');
      expect(biometricDetection).toBeDefined();
      expect(biometricDetection?.severity).toBe('critical');
    });

    it('should detect photo references', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Photograph of patient showing lesion.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const photoDetection = result.phiDetections.find(d => d.type === 'photo');
      expect(photoDetection).toBeDefined();
      expect(photoDetection?.severity).toBe('critical');
    });
  });

  describe('Attestation and Quarantine', () => {
    it('should require attestation for critical PHI', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Mr. John Smith, SSN 123-45-6789 enrolled.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.attestationRequired).toBe(true);
    });

    it('should require attestation for high severity PHI', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient phone: (555) 123-4567.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.attestationRequired).toBe(true);
    });

    it('should not require attestation for medium severity only', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient from ZIP 12345.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      // Medium severity alone doesn't require attestation
      const hasCriticalOrHigh = result.phiDetections.some(
        d => d.severity === 'critical' || d.severity === 'high'
      );
      expect(result.attestationRequired).toBe(hasCriticalOrHigh);
    });

    it('should quarantine critical PHI items', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient Mr. John Doe, SSN: 123-45-6789.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.quarantinedItems.length).toBeGreaterThan(0);

      // Should include context of critical items
      const criticalDetections = result.phiDetections.filter(d => d.severity === 'critical');
      expect(result.quarantinedItems.length).toBe(criticalDetections.length);
    });
  });

  describe('Context Extraction', () => {
    it('should provide context around detections', async () => {
      // GOVERNANCE: Context field was removed to prevent PHI exposure
      // Instead, we provide location indices for secure tracking
      const contaminated = {
        ...cleanManuscript,
        methods: 'The patient, Mr. John Smith, was enrolled in the study and provided informed consent.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      const nameDetection = result.phiDetections.find(d => d.type === 'name');
      // Check that we have location info instead of context (security improvement)
      expect(nameDetection?.startIndex).toBeDefined();
      expect(nameDetection?.endIndex).toBeDefined();
      expect(nameDetection?.detectionId).toBeDefined();
    });

    it('should include start and end indices', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient SSN: 123-45-6789 recorded.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      const ssnDetection = result.phiDetections.find(d => d.type === 'ssn');
      expect(ssnDetection?.startIndex).toBeDefined();
      expect(ssnDetection?.endIndex).toBeDefined();
      expect(ssnDetection!.endIndex).toBeGreaterThan(ssnDetection!.startIndex);
    });
  });

  describe('Multiple PHI Detections', () => {
    it('should detect multiple PHI types in same manuscript', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Mr. John Smith (SSN: 123-45-6789, phone: 555-123-4567) enrolled.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);
      expect(result.phiDetections.length).toBeGreaterThanOrEqual(3);

      const types = result.phiDetections.map(d => d.type);
      expect(types).toContain('name');
      expect(types).toContain('ssn');
      expect(types).toContain('phone');
    });

    it('should detect PHI across multiple sections', async () => {
      const contaminated = {
        ...cleanManuscript,
        methods: 'Patient Mr. John Smith enrolled.',
        results: 'SSN 123-45-6789 excluded from final analysis.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result.passed).toBe(false);

      const methodsDetection = result.phiDetections.find(d => d.section === 'methods');
      const resultsDetection = result.phiDetections.find(d => d.section === 'results');

      expect(methodsDetection).toBeDefined();
      expect(resultsDetection).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    it('should provide remediation recommendation for each type', async () => {
      const phiTypes = [
        { text: 'Mr. John Smith', type: 'name' },
        { text: 'DOB: 01/15/1980', type: 'dob' },
        { text: 'SSN: 123-45-6789', type: 'ssn' },
        { text: 'MRN: 12345678', type: 'mrn' },
        { text: 'Phone: 555-123-4567', type: 'phone' }
      ];

      for (const phi of phiTypes) {
        const contaminated = {
          ...cleanManuscript,
          methods: `Patient data: ${phi.text}.`
        };

        const result = await service.performFinalScan(
          mockManuscriptId,
          contaminated,
          mockUserId
        );

        const detection = result.phiDetections.find(d => d.type === phi.type);
        expect(detection?.recommendation).toBeDefined();
        expect(detection?.recommendation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Audit Trail', () => {
    it('should generate unique hashes for different manuscripts', async () => {
      const result1 = await service.performFinalScan(
        'manuscript-001',
        cleanManuscript,
        mockUserId
      );

      const result2 = await service.performFinalScan(
        'manuscript-002',
        cleanManuscript,
        mockUserId
      );

      expect(result1.auditHash).not.toBe(result2.auditHash);
    });

    it('should generate different hashes for different detection counts', async () => {
      const result1 = await service.performFinalScan(
        mockManuscriptId,
        cleanManuscript,
        mockUserId
      );

      const contaminated = {
        ...cleanManuscript,
        methods: 'Mr. John Smith enrolled.'
      };

      const result2 = await service.performFinalScan(
        mockManuscriptId,
        contaminated,
        mockUserId
      );

      expect(result1.auditHash).not.toBe(result2.auditHash);
    });

    it('should include timestamp in scan result', async () => {
      const before = new Date();

      const result = await service.performFinalScan(
        mockManuscriptId,
        cleanManuscript,
        mockUserId
      );

      const after = new Date();

      expect(result.scanTimestamp).toBeDefined();
      expect(result.scanTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.scanTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty manuscript', async () => {
      const emptyManuscript = {};

      const result = await service.performFinalScan(
        mockManuscriptId,
        emptyManuscript,
        mockUserId
      );

      expect(result.passed).toBe(true);
      expect(result.totalScanned).toBe(0);
      expect(result.phiDetections.length).toBe(0);
    });

    it('should handle very long sections', async () => {
      const longSection = 'This is a long section. '.repeat(1000);
      const manuscript = {
        ...cleanManuscript,
        methods: longSection
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        manuscript,
        mockUserId
      );

      expect(result).toBeDefined();
      expect(result.passed).toBe(true);
    });

    it('should handle sections with only whitespace', async () => {
      const manuscript = {
        title: '   ',
        abstract: '\n\n',
        methods: '\t\t'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        manuscript,
        mockUserId
      );

      expect(result.totalScanned).toBe(0);
    });

    it('should handle special characters in content', async () => {
      const manuscript = {
        ...cleanManuscript,
        methods: 'Study with émojis 🔬 and spëcial çharacters.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        manuscript,
        mockUserId
      );

      expect(result).toBeDefined();
    });

    it('should not false positive on legitimate numbers', async () => {
      const manuscript = {
        ...cleanManuscript,
        results: 'Sample size: 200 participants. Statistical power: 0.80. Alpha: 0.05.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        manuscript,
        mockUserId
      );

      // Should not detect these as SSN or other PHI
      expect(result.passed).toBe(true);
    });

    it('should not false positive on protocol numbers', async () => {
      const manuscript = {
        ...cleanManuscript,
        methods: 'IRB Protocol #2021-0456 approved.'
      };

      const result = await service.performFinalScan(
        mockManuscriptId,
        manuscript,
        mockUserId
      );

      // Protocol numbers should not trigger PHI detection
      expect(result.passed).toBe(true);
    });
  });
});
