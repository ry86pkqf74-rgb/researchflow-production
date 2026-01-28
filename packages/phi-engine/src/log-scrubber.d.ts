/**
 * Log Scrubbing Utility
 *
 * Sanitizes PHI from log messages and objects before they are written.
 * Ensures HIPAA compliance for all application logging.
 *
 * Performance: Optimized to handle 10k+ logs/sec using cached regex patterns.
 */
/**
 * Scrub a single string message, replacing PHI with redaction markers
 *
 * @param message - The log message to scrub
 * @returns Scrubbed message with PHI replaced
 *
 * @example
 * scrubLog("Patient SSN: 123-45-6789")
 * // Returns: "Patient SSN: [REDACTED:SSN]"
 */
export declare function scrubLog(message: string): string;
/**
 * Scrub an object recursively, replacing PHI in all string values
 * Handles nested objects, arrays, and circular references
 *
 * @param obj - The object to scrub
 * @param visited - WeakSet to track visited objects (prevents infinite loops)
 * @returns Scrubbed object with PHI replaced
 *
 * @example
 * scrubObject({ patient: { ssn: "123-45-6789", name: "John" }})
 * // Returns: { patient: { ssn: "[REDACTED:SSN]", name: "John" }}
 */
export declare function scrubObject<T = Record<string, unknown>>(obj: T, visited?: WeakSet<object>): T;
/**
 * Check if a message contains any PHI without performing scrubbing
 * Useful for quick validation
 *
 * @param message - The message to check
 * @returns True if PHI detected, false otherwise
 */
export declare function containsPhi(message: string): boolean;
/**
 * Get statistics about PHI found in a message
 * Useful for monitoring and auditing
 *
 * @param message - The message to analyze
 * @returns Object with counts of each PHI type found
 */
export declare function getPhiStats(message: string): Record<string, number>;
