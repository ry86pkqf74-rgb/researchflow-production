/**
 * Core Types Index
 *
 * Exports all shared types for the ResearchFlow platform.
 */

// Job Specification Types (Task 199)
export type {
  JobSpec,
  JobThresholds,
  JobRetryPolicy,
  JobPriority,
  JobSpecValidationResult,
} from './jobSpec';
export { validateJobThresholds } from './jobSpec';

// Manifest Types (Tasks 172, 179, 186, 191)
export type {
  Manifest,
  ManifestSnapshot,
  ManifestQuarantine,
  ManifestProvenance,
  ManifestSecurity,
  ManifestQuality,
  FieldUncertainty,
  RedactionSummary,
  CarbonMetrics,
} from './manifest';
export { calculateManifestHash, shouldQuarantine } from './manifest';

// Integration Types
export type {
  OAuthTokenSet,
  ProviderIdentity,
  IntegrationProviderClient,
  OAuthConnection,
  IntegrationSyncResult,
} from './integration';

// Workflow Event Types
export type {
  WorkflowEvent,
  WorkflowEventType,
  WorkflowMetrics,
} from './workflow';
