/**
 * INF-14: Validation Suites (Pandera-style)
 * Main export for validation system
 */

export {
  ArtifactType,
  ValidationRule,
  ValidationSuite,
  ValidationResult,
  ValidationError,
  ManuscriptData,
  DatasetSchemaData,
  ConfigSnapshotData,
  AnalysisResultData,
  REQUIRED_MANUSCRIPT_SECTIONS,
  VALID_COLUMN_TYPES,
  VALID_ENVIRONMENTS,
} from './types';

export {
  invariantNoPHI,
  invariantValidJSON,
  invariantMaxSize,
  invariantNonEmpty,
  invariantValidTimestamp,
  invariantRequiredFields,
  detectPHIPatterns,
  validateJSON,
  validateSize,
  PHIDetectionResult,
  JSONValidationResult,
  SizeValidationResult,
} from './invariants';

export {
  createValidationSuite,
  manuscriptValidationSuite,
  datasetSchemaValidationSuite,
  configSnapshotValidationSuite,
  analysisResultValidationSuite,
  VALIDATION_SUITES,
  getValidationSuite,
  validateArtifact,
  listAvailableSuites,
} from './suites';
