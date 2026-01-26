/**
 * Data Classification Types
 *
 * Defines data sensitivity levels and permitted operations.
 * Critical for PHI protection and governance compliance.
 *
 * Priority: P0 - CRITICAL (Phase 2)
 */

export type DataClassification = 'SYNTHETIC' | 'IDENTIFIED' | 'DEIDENTIFIED' | 'UNKNOWN';

/**
 * Classification rules defining allowed operations per data type
 */
export const CLASSIFICATION_RULES: Record<DataClassification, {
  allowedOperations: string[];
  color: string;
  borderColor: string;
  textColor: string;
  description: string;
  requiresApproval: boolean;
  allowExport: boolean;
  allowAnalysis: boolean;
  allowShare: boolean;
}> = {
  SYNTHETIC: {
    allowedOperations: ['ANALYZE', 'EXPORT', 'SHARE', 'DRAFT', 'PRESENT'],
    color: 'bg-green-100',
    borderColor: 'border-green-500',
    textColor: 'text-green-700',
    description: 'Synthetic data - fully open operations',
    requiresApproval: false,
    allowExport: true,
    allowAnalysis: true,
    allowShare: true
  },
  DEIDENTIFIED: {
    allowedOperations: ['ANALYZE', 'EXPORT', 'DRAFT'],
    color: 'bg-blue-100',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700',
    description: 'De-identified data - analysis and export allowed with approval',
    requiresApproval: true,
    allowExport: true,
    allowAnalysis: true,
    allowShare: false
  },
  IDENTIFIED: {
    allowedOperations: ['VIEW_METADATA_ONLY'],
    color: 'bg-red-100',
    borderColor: 'border-red-500',
    textColor: 'text-red-700',
    description: 'Identified data - metadata only, PHI quarantine required',
    requiresApproval: true,
    allowExport: false,
    allowAnalysis: false,
    allowShare: false
  },
  UNKNOWN: {
    allowedOperations: ['BLOCK_ALL'],
    color: 'bg-gray-100',
    borderColor: 'border-gray-500',
    textColor: 'text-gray-700',
    description: 'Unknown classification - all operations blocked pending review',
    requiresApproval: true,
    allowExport: false,
    allowAnalysis: false,
    allowShare: false
  }
};

/**
 * Dataset metadata with classification
 */
export interface DatasetMetadata {
  /** Dataset unique identifier */
  id: string;

  /** Dataset name */
  name: string;

  /** Data classification level */
  classification: DataClassification;

  /** Number of records */
  recordCount: number;

  /** Upload timestamp */
  uploadedAt: Date;

  /** Uploaded by user */
  uploadedBy: string;

  /** Data steward who approved (if applicable) */
  approvedBy?: string;

  /** Approval timestamp */
  approvedAt?: Date;

  /** PHI scan results */
  phiScanPassed: boolean;

  /** PHI scan timestamp */
  phiScanAt?: Date;

  /** Data source/origin */
  source: string;

  /** IRB approval number (if applicable) */
  irbNumber?: string;

  /** De-identification method used */
  deidentificationMethod?: 'SAFE_HARBOR' | 'EXPERT_DETERMINATION' | 'SYNTHETIC' | 'NONE';

  /** Schema version */
  schemaVersion: string;

  /** File format */
  format: 'CSV' | 'JSON' | 'PARQUET' | 'XLSX' | 'OTHER';

  /** File size in bytes */
  sizeBytes: number;

  /** Column names */
  columns: string[];

  /** Risk assessment score (0-100, higher = more risk) */
  riskScore?: number;
}

/**
 * Check if operation is allowed for classification
 */
export function isOperationAllowed(
  classification: DataClassification,
  operation: string
): boolean {
  const rules = CLASSIFICATION_RULES[classification];
  return rules.allowedOperations.includes(operation);
}

/**
 * Get visual styling for classification
 */
export function getClassificationStyle(classification: DataClassification) {
  const rules = CLASSIFICATION_RULES[classification];
  return {
    color: rules.color,
    borderColor: rules.borderColor,
    textColor: rules.textColor
  };
}

/**
 * Determine classification from dataset characteristics
 */
export function determineClassification(metadata: Partial<DatasetMetadata>): DataClassification {
  // Synthetic data explicitly marked
  if (metadata.deidentificationMethod === 'SYNTHETIC') {
    return 'SYNTHETIC';
  }

  // De-identified if PHI scan passed and method documented
  if (
    metadata.phiScanPassed &&
    (metadata.deidentificationMethod === 'SAFE_HARBOR' ||
     metadata.deidentificationMethod === 'EXPERT_DETERMINATION')
  ) {
    return 'DEIDENTIFIED';
  }

  // Identified if PHI scan failed
  if (metadata.phiScanPassed === false) {
    return 'IDENTIFIED';
  }

  // Unknown if insufficient information
  return 'UNKNOWN';
}

/**
 * Validation error for blocked operations
 */
export class OperationNotAllowedError extends Error {
  constructor(
    public readonly classification: DataClassification,
    public readonly operation: string,
    public readonly datasetId: string
  ) {
    super(
      `Operation "${operation}" not allowed for ${classification} data (dataset: ${datasetId})`
    );
    this.name = 'OperationNotAllowedError';
  }
}

/**
 * Assert that operation is allowed (throws if not)
 */
export function assertOperationAllowed(
  classification: DataClassification,
  operation: string,
  datasetId: string
): void {
  if (!isOperationAllowed(classification, operation)) {
    throw new OperationNotAllowedError(classification, operation, datasetId);
  }
}
