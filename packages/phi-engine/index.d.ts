/**
 * @researchflow/phi-engine
 *
 * PHI detection, scanning, and protection engine
 * Provides pluggable interface for HIPAA 18 identifier detection
 */
export * from './src/types';
export * from './src/scanner';
export { RegexPhiScanner } from './src/regex-scanner';
export { PHI_PATTERNS } from './src/patterns';
export type { PatternDefinition } from './src/patterns';
export { scrubLog, scrubObject, containsPhi, getPhiStats } from './src/log-scrubber';
export { PhiSnippetScanner, createSnippetScanner, type SnippetScanResult, type BatchScanResult, type SnippetScanOptions, type SnippetInput, } from './src/snippet-scanner';
export { createScrubbedLogger } from './src/adapters/pino-adapter';
export { installConsoleScrubber, removeConsoleScrubber, isConsoleScrubberInstalled } from './src/adapters/console-adapter';
export declare const PHI_ENGINE_VERSION = "1.0.0";
