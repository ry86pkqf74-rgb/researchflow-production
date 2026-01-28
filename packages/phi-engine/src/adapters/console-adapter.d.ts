/**
 * Console Override for Development
 *
 * Provides PHI scrubbing for console.log/warn/error methods
 * Useful for development environments to ensure PHI never leaks to console
 */
/**
 * Install console scrubber
 * Overrides console methods to scrub PHI before output
 *
 * Safety: Only works in non-production environments
 *
 * @throws Error if already installed or if in production
 *
 * @example
 * installConsoleScrubber();
 * console.log('Patient SSN: 123-45-6789');
 * // Output: Patient SSN: [REDACTED:SSN]
 */
export declare function installConsoleScrubber(): void;
/**
 * Remove console scrubber and restore original console methods
 *
 * @example
 * removeConsoleScrubber();
 * console.log('Patient SSN: 123-45-6789');
 * // Output: Patient SSN: 123-45-6789 (not scrubbed)
 */
export declare function removeConsoleScrubber(): void;
/**
 * Check if console scrubber is currently installed
 */
export declare function isConsoleScrubberInstalled(): boolean;
