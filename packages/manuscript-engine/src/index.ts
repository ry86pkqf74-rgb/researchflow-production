/**
 * Manuscript Engine
 *
 * Comprehensive manuscript authoring and scientific writing assistance.
 * Supports the full manuscript lifecycle from data integration to submission.
 *
 * Phases:
 * - Phase 1: Data Integration (PHI scanning, data mapping, versioning)
 * - Phase 2: Literature Integration (PubMed, Semantic Scholar, citations)
 * - Phase 3: Structure Building (IMRaD sections, templates)
 * - Phase 4: Writing Assistance (grammar, readability, medical NLP)
 * - Phase 5: Export & Compliance (journal formats, checklists, peer review)
 *
 * @module @researchflow/manuscript-engine
 */

// Export types first (canonical type definitions take precedence)
export * from './types';

// Export services - services that re-export conflicting types will be overwritten by types above
// Note: ChartType (visualization.service), SectionContent & WordCountLimits (word-count-tracker.service)
// are also defined in types/ - the types/ versions are used
export * from './services';

// Export version information
export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@researchflow/manuscript-engine';
