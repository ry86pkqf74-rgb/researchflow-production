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
export type { PatternDefinition } from './src/patterns';

// Log scrubbing utilities
export { 
  scrubLog, 
  scrubObject, 
  containsPhi, 
  getPhiStats 
} from './src/log-scrubber';

// Logger adapters
export { createScrubbedLogger } from './src/adapters/pino-adapter';
export {
  installConsoleScrubber,
  removeConsoleScrubber,
  isConsoleScrubberInstalled
} from './src/adapters/console-adapter';

// Medical NER (Phase A - Task 47)
export {
  extractMedicalEntities,
  detectMedicalPHI,
  analyzeMedicalText,
  scrubMedicalPHI
} from './src/medical-ner';
export type {
  MedicalEntity,
  MedicalPHIPattern,
  MedicalNERResult
} from './src/medical-ner';

// Version
export const PHI_ENGINE_VERSION = "1.0.0";
