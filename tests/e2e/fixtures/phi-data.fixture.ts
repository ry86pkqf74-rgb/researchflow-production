/**
 * E2E PHI (Protected Health Information) Test Data Fixtures
 *
 * Provides mock PHI data for testing redaction and reveal functionality.
 * All data is synthetic and used only for testing purposes.
 */

export type PhiType =
  | 'SSN'
  | 'MRN'
  | 'DOB'
  | 'NAME'
  | 'PHONE'
  | 'EMAIL'
  | 'ADDRESS'
  | 'HEALTH_PLAN';

export interface PhiItem {
  id: string;
  type: PhiType;
  value: string;
  masked: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Mock PHI items for testing redaction display and reveal functionality.
 */
export const MOCK_PHI: Record<string, PhiItem> = {
  ssn: {
    id: 'phi-ssn-001',
    type: 'SSN',
    value: '123-45-6789',
    masked: '***-**-****',
    riskLevel: 'CRITICAL',
  },
  mrn: {
    id: 'phi-mrn-001',
    type: 'MRN',
    value: 'MRN#847291',
    masked: 'MRN#******',
    riskLevel: 'CRITICAL',
  },
  dob: {
    id: 'phi-dob-001',
    type: 'DOB',
    value: '01/15/1985',
    masked: '**/**/****',
    riskLevel: 'HIGH',
  },
  name: {
    id: 'phi-name-001',
    type: 'NAME',
    value: 'John Smith',
    masked: '**** *****',
    riskLevel: 'HIGH',
  },
  phone: {
    id: 'phi-phone-001',
    type: 'PHONE',
    value: '555-123-4567',
    masked: '***-***-****',
    riskLevel: 'MEDIUM',
  },
  email: {
    id: 'phi-email-001',
    type: 'EMAIL',
    value: 'jsmith@hospital.org',
    masked: '******@***.***',
    riskLevel: 'MEDIUM',
  },
  address: {
    id: 'phi-address-001',
    type: 'ADDRESS',
    value: '123 Medical Center Dr, Boston, MA 02115',
    masked: '*** ******* ****** **, ******, ** *****',
    riskLevel: 'HIGH',
  },
  healthPlan: {
    id: 'phi-hp-001',
    type: 'HEALTH_PLAN',
    value: 'BCBS-12345678',
    masked: '****-********',
    riskLevel: 'CRITICAL',
  },
};

/**
 * PHI scan status values matching governance.ts definitions.
 */
export type PhiStatus =
  | 'UNCHECKED'
  | 'SCANNING'
  | 'PASS'
  | 'FAIL'
  | 'QUARANTINED'
  | 'OVERRIDDEN';

/**
 * Mock PHI scan result for testing PHI gate functionality.
 */
export interface PhiScanResult {
  status: PhiStatus;
  detectedItems: PhiItem[];
  scanTimestamp: string;
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Generate a mock PHI scan result.
 */
export function createMockScanResult(
  status: PhiStatus,
  items: PhiItem[] = []
): PhiScanResult {
  const highestRisk = items.reduce<PhiScanResult['riskLevel']>(
    (max, item) => {
      const riskOrder = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      return riskOrder[item.riskLevel] > riskOrder[max] ? item.riskLevel : max;
    },
    'NONE'
  );

  return {
    status,
    detectedItems: items,
    scanTimestamp: new Date().toISOString(),
    riskLevel: items.length === 0 ? 'NONE' : highestRisk,
  };
}

/**
 * Collection of all mock PHI items as an array.
 */
export const ALL_MOCK_PHI: PhiItem[] = Object.values(MOCK_PHI);

/**
 * PHI items that should trigger critical alerts.
 */
export const CRITICAL_PHI: PhiItem[] = ALL_MOCK_PHI.filter(
  (item) => item.riskLevel === 'CRITICAL'
);
