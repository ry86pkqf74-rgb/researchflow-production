/**
 * @researchflow/phi-engine
 *
 * PHI detection, scanning, and protection engine
 * Provides pluggable interface for HIPAA 18 identifier detection
 */
// Core types and interfaces
export * from './src/types';
// Convenience API (recommended for most use cases)
export * from './src/scanner';
// Scanner implementation
export { RegexPhiScanner } from './src/regex-scanner';
// Pattern definitions
export { PHI_PATTERNS } from './src/patterns';
// Log scrubbing utilities
export { scrubLog, scrubObject, containsPhi, getPhiStats } from './src/log-scrubber';
// Snippet scanner for batch processing
export { PhiSnippetScanner, createSnippetScanner, } from './src/snippet-scanner';
// Logger adapters
export { createScrubbedLogger } from './src/adapters/pino-adapter';
export { installConsoleScrubber, removeConsoleScrubber, isConsoleScrubberInstalled } from './src/adapters/console-adapter';
// Version
export const PHI_ENGINE_VERSION = "1.0.0";
//# sourceMappingURL=index.js.map