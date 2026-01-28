/**
 * PHI Pattern Definitions
 *
 * Consolidated patterns from existing implementations:
 * - apps/api-node/services/phi-scanner.ts (16 patterns)
 * - apps/api-node/src/services/phi-protection.ts (13 patterns)
 *
 * Includes HIPAA 164.514(b)(2) identifier mappings for compliance.
 */
import type { PhiFinding } from './types';
/**
 * Pattern definition for PHI detection
 */
export interface PatternDefinition {
    /** PHI type this pattern detects */
    type: PhiFinding['type'];
    /** Regular expression for matching */
    regex: RegExp;
    /** HIPAA Safe Harbor identifier reference */
    hipaaCategory: string;
    /** Human-readable description */
    description: string;
    /** Base confidence score (0-1) */
    baseConfidence: number;
}
/**
 * Comprehensive PHI pattern library
 * Consolidated from both existing scanners with de-duplication
 */
export declare const PHI_PATTERNS: PatternDefinition[];
