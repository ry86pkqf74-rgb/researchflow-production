/**
 * @researchflow/manuscript-engine
 * Clinical data integration and manuscript generation engine
 *
 * @packageDocumentation
 */

// Types
export * from './src/types';

// Services
export { PhiGuardService, getPhiGuard, PHIDetectedError, PHIScanFailureError } from './src/services/phi-guard.service';
export { DataMapperService, getDataMapper } from './src/services/data-mapper.service';
export { DataTaggerService, getDataTagger } from './src/services/data-tagger.service';
export { VersionControlService, getVersionControl } from './src/services/version-control.service';

// Templates
export * from './src/templates/table-templates';

// Prompts
export * from './src/prompts/abstract-generator.prompt';

// Version
export const MANUSCRIPT_ENGINE_VERSION = '1.0.0';
