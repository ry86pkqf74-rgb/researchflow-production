/**
 * Log Scrubbing Utility
 *
 * Sanitizes PHI from log messages and objects before they are written.
 * Ensures HIPAA compliance for all application logging.
 *
 * Performance: Optimized to handle 10k+ logs/sec using cached regex patterns.
 */
import { PHI_PATTERNS } from './patterns';
/**
 * Cached compiled patterns for performance
 * Patterns are compiled once and reused for all scrubbing operations
 */
const COMPILED_PATTERNS = PHI_PATTERNS.map(pattern => ({
    type: pattern.type,
    regex: pattern.regex,
    description: pattern.description
}));
/**
 * Redaction format for PHI findings
 */
function formatRedaction(type) {
    return `[REDACTED:${type}]`;
}
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
export function scrubLog(message) {
    if (!message || typeof message !== 'string') {
        return message;
    }
    let scrubbedMessage = message;
    // Apply all patterns sequentially
    for (const pattern of COMPILED_PATTERNS) {
        // Reset regex lastIndex to avoid issues with global flag
        pattern.regex.lastIndex = 0;
        scrubbedMessage = scrubbedMessage.replace(pattern.regex, formatRedaction(pattern.type));
    }
    return scrubbedMessage;
}
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
export function scrubObject(obj, visited = new WeakSet()) {
    // Handle primitives
    if (obj === null || obj === undefined) {
        return obj;
    }
    // Handle strings
    if (typeof obj === 'string') {
        return scrubLog(obj);
    }
    // Handle non-objects (numbers, booleans, etc.)
    if (typeof obj !== 'object') {
        return obj;
    }
    // Handle circular references
    if (visited.has(obj)) {
        return '[Circular Reference]';
    }
    visited.add(obj);
    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => scrubObject(item, visited));
    }
    // Handle dates (preserve as-is, they're not PHI by themselves)
    if (obj instanceof Date) {
        return obj;
    }
    // Handle regular objects
    const scrubbedObj = {};
    for (const [key, value] of Object.entries(obj)) {
        // Scrub the key as well (might contain PHI)
        const scrubbedKey = scrubLog(key);
        // Recursively scrub the value
        scrubbedObj[scrubbedKey] = scrubObject(value, visited);
    }
    return scrubbedObj;
}
/**
 * Check if a message contains any PHI without performing scrubbing
 * Useful for quick validation
 *
 * @param message - The message to check
 * @returns True if PHI detected, false otherwise
 */
export function containsPhi(message) {
    if (!message || typeof message !== 'string') {
        return false;
    }
    for (const pattern of COMPILED_PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(message)) {
            return true;
        }
    }
    return false;
}
/**
 * Get statistics about PHI found in a message
 * Useful for monitoring and auditing
 *
 * @param message - The message to analyze
 * @returns Object with counts of each PHI type found
 */
export function getPhiStats(message) {
    const stats = {};
    if (!message || typeof message !== 'string') {
        return stats;
    }
    for (const pattern of COMPILED_PATTERNS) {
        pattern.regex.lastIndex = 0;
        const matches = message.match(pattern.regex);
        if (matches && matches.length > 0) {
            stats[pattern.type] = (stats[pattern.type] || 0) + matches.length;
        }
    }
    return stats;
}
//# sourceMappingURL=log-scrubber.js.map