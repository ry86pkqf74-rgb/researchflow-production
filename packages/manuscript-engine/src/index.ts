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

// Export all services
export * from './services';

// Export types
export * from './types';

// Note: All types are already exported via './types' barrel export
// The types include: ManuscriptStatus, TemplateType, BibliographyStyle, IMRaDSection, etc.

// Export version information
export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@researchflow/manuscript-engine';
