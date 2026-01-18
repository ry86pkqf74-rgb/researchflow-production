/**
 * PHI Engine Type Definitions
 *
 * Defines the core interfaces for the pluggable PHI scanning system.
 * Supports HIPAA 18 identifier detection with confidence scoring.
 */

/**
 * Represents a single PHI finding in scanned text
 */
export interface PhiFinding {
  /** PHI type detected */
  type: 'SSN' | 'MRN' | 'DOB' | 'PHONE' | 'EMAIL' | 'NAME' | 'ADDRESS'
       | 'ZIP_CODE' | 'IP_ADDRESS' | 'URL' | 'ACCOUNT' | 'HEALTH_PLAN'
       | 'LICENSE' | 'DEVICE_ID' | 'AGE_OVER_89';
  /** The matched text value */
  value: string;
  /** Start position in the source text */
  startIndex: number;
  /** End position in the source text */
  endIndex: number;
  /** Confidence score between 0 and 1 */
  confidence: number;
}

/**
 * Core PHI scanner interface
 * Implement this interface to create custom PHI scanners
 */
export interface PhiScanner {
  /** Scan text and return all PHI findings */
  scan(text: string): PhiFinding[];
  /** Redact PHI from text, replacing with [REDACTED-TYPE] tags */
  redact(text: string): string;
  /** Quick check if text contains any PHI */
  hasPhi(text: string): boolean;
}

/**
 * Risk level for PHI detection results
 */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Context in which PHI scanning is performed
 */
export type ScanContext = 'upload' | 'export' | 'llm';
