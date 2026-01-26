/**
 * Static Data Module Index
 *
 * Exports all static data modules extracted from the monolithic routes.ts
 * for better modularity and maintainability.
 *
 * @module data
 */

export * from './workflowStages';
export * from './researchDatasets';

// Re-export defaults for convenience
export { default as workflowStageGroups } from './workflowStages';
export { default as researchDatasets } from './researchDatasets';
