/**
 * @researchflow/manuscript-engine
 * Complete manuscript generation and export engine
 * 
 * @packageDocumentation
 */

// ============================================================================
// PHASE 1: Data Integration & PHI Protection (DEPLOYED ✅)
// ============================================================================

export * from './src/types';

export { PhiGuardService, getPhiGuard, PHIDetectedError, PHIScanFailureError } from './src/services/phi-guard.service';
export { DataMapperService, getDataMapper } from './src/services/data-mapper.service';
export { DataTaggerService, getDataTagger } from './src/services/data-tagger.service';
export { VersionControlService, getVersionControl } from './src/services/version-control.service';

// ============================================================================
// PHASE 2: Literature & Citations (DEPLOYED ✅)
// ============================================================================

export { CitationManagerService, getCitationManager } from './src/services/citation-manager.service';

// ============================================================================
// PHASE 3: Export & Compliance (DEPLOYED ✅)
// ============================================================================

export { ExportService, getExportService } from './src/services/export.service';
export { ComplianceCheckerService, getComplianceChecker } from './src/services/compliance-checker.service';

// ============================================================================
// PHASE 4: AI Writing Assistance (INTEGRATED ✅)
// ============================================================================

export { OpenAIDrafterService } from './src/services/openai-drafter.service';
export { ClaudeWriterService } from './src/services/claude-writer.service';
export { GrammarCheckerService } from './src/services/grammar-checker.service';
export { ClaimVerifierService } from './src/services/claim-verifier.service';
export { TransitionSuggesterService } from './src/services/transition-suggester.service';
export { ToneAdjusterService } from './src/services/tone-adjuster.service';
export { SynonymFinderService } from './src/services/synonym-finder.service';
export { MedicalNLPService } from './src/services/medical-nlp.service';
export { ClarityAnalyzerService } from './src/services/clarity-analyzer.service';
export { ParaphraseService } from './src/services/paraphrase.service';
export { SentenceBuilderService } from './src/services/sentence-builder.service';
export { ReadabilityService } from './src/services/readability.service';
export { AbbreviationService } from './src/services/abbreviation.service';
export { CitationSuggesterService } from './src/services/citation-suggester.service';
export { ClaimHighlighterService } from './src/services/claim-highlighter.service';

// ============================================================================
// Templates & Prompts
// ============================================================================

export * from './src/templates/table-templates';
export * from './src/templates/phrase-library';
export * from './src/prompts/abstract-generator.prompt';

// Section-specific prompts
export * from './src/prompts/section-prompts/abstract.prompt';
export * from './src/prompts/section-prompts/introduction.prompt';
export * from './src/prompts/section-prompts/methods.prompt';
export * from './src/prompts/section-prompts/results.prompt';
export * from './src/prompts/section-prompts/discussion.prompt';

// ============================================================================
// Version & Package Info
// ============================================================================

export const MANUSCRIPT_ENGINE_VERSION = '2.0.0';
export const PHASE_STATUS = {
  phase1: 'DEPLOYED',
  phase2: 'PARTIAL',
  phase3: 'PARTIAL',
  phase4: 'INTEGRATED',
  phase5: 'PLANNED',
};

// ============================================================================
// Quick Start Helper
// ============================================================================

/**
 * Initialize all manuscript engine services
 * @returns Object containing all service instances
 */
export function initializeManuscriptEngine() {
  return {
    // Phase 1: Data
    phiGuard: getPhiGuard(),
    dataMapper: getDataMapper(),
    dataTagger: getDataTagger(),
    versionControl: getVersionControl(),
    
    // Phase 2: Literature
    citationManager: getCitationManager(),
    
    // Phase 3: Export
    exportService: getExportService(),
    complianceChecker: getComplianceChecker(),
    
    // Phase 4: AI Writing
    openaiDrafter: new OpenAIDrafterService(),
    claudeWriter: new ClaudeWriterService(),
    grammarChecker: new GrammarCheckerService(),
    claimVerifier: new ClaimVerifierService(),
    transitionSuggester: new TransitionSuggesterService(),
    toneAdjuster: new ToneAdjusterService(),
    synonymFinder: new SynonymFinderService(),
    medicalNLP: new MedicalNLPService(),
    clarityAnalyzer: new ClarityAnalyzerService(),
    paraphrase: new ParaphraseService(),
    sentenceBuilder: new SentenceBuilderService(),
    readability: new ReadabilityService(),
    abbreviation: new AbbreviationService(),
    citationSuggester: new CitationSuggesterService(),
    claimHighlighter: new ClaimHighlighterService(),
  };
}

/**
 * Default export for convenience
 */
export default initializeManuscriptEngine;
