/**
 * Console Override for Development
 * 
 * Provides PHI scrubbing for console.log/warn/error methods
 * Useful for development environments to ensure PHI never leaks to console
 */

import { scrubLog } from '../log-scrubber';

// Store original console methods
let originalConsole: {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
  info: typeof console.info;
  debug: typeof console.debug;
} | null = null;

let isInstalled = false;

/**
 * Check if we're in a production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Format console arguments, scrubbing any PHI
 */
function scrubArguments(args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return scrubLog(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      // For objects, convert to string representation and scrub
      try {
        const jsonStr = JSON.stringify(arg, null, 2);
        const scrubbed = scrubLog(jsonStr);
        // Try to parse back to object if possible
        try {
          return JSON.parse(scrubbed);
        } catch {
          return scrubbed;
        }
      } catch {
        // If stringify fails (circular refs, etc), convert to string
        return scrubLog(String(arg));
      }
    }
    return arg;
  });
}

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
export function installConsoleScrubber(): void {
  if (isInstalled) {
    console.warn('Console scrubber is already installed');
    return;
  }

  if (isProduction()) {
    throw new Error(
      'Console scrubber should not be installed in production. ' +
      'Use createScrubbedLogger for production logging.'
    );
  }

  // Store original methods
  originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };

  // Override console methods
  console.log = function (...args: any[]) {
    const scrubbed = scrubArguments(args);
    originalConsole!.log.apply(console, scrubbed);
  };

  console.info = function (...args: any[]) {
    const scrubbed = scrubArguments(args);
    originalConsole!.log.apply(console, scrubbed);
  };

  console.warn = function (...args: any[]) {
    const scrubbed = scrubArguments(args);
    originalConsole!.warn.apply(console, scrubbed);
  };

  console.error = function (...args: any[]) {
    const scrubbed = scrubArguments(args);
    originalConsole!.error.apply(console, scrubbed);
  };

  console.debug = function (...args: any[]) {
    const scrubbed = scrubArguments(args);
    originalConsole!.debug.apply(console, scrubbed);
  };

  isInstalled = true;

  console.log('[PHI Engine] Console scrubber installed');
}

/**
 * Remove console scrubber and restore original console methods
 * 
 * @example
 * removeConsoleScrubber();
 * console.log('Patient SSN: 123-45-6789');
 * // Output: Patient SSN: 123-45-6789 (not scrubbed)
 */
export function removeConsoleScrubber(): void {
  if (!isInstalled || !originalConsole) {
    console.warn('Console scrubber is not installed');
    return;
  }

  // Restore original methods
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;

  isInstalled = false;
  originalConsole = null;

  console.log('[PHI Engine] Console scrubber removed');
}

/**
 * Check if console scrubber is currently installed
 */
export function isConsoleScrubberInstalled(): boolean {
  return isInstalled;
}
