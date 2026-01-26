/**
 * @researchflow/manuscript-engine
 * Complete manuscript generation and export engine
 *
 * @packageDocumentation
 */
// Import getter functions for initialization
import { getPhiGuard } from './src/services/phi-guard.service';
import { getDataMapper } from './src/services/data-mapper.service';
import { getDataTagger } from './src/services/data-tagger.service';
import { getVersionControl } from './src/services/version-control.service';
import { getCitationManager } from './src/services/citation-manager.service';
import { getExportService } from './src/services/export.service';
import { getComplianceChecker } from './src/services/compliance-checker.service';
// Import Phase 4 service classes
import { OpenAIDrafterService } from './src/services/openai-drafter.service';
import { ClaudeWriterService } from './src/services/claude-writer.service';
import { GrammarCheckerService } from './src/services/grammar-checker.service';
import { ClaimVerifierService } from './src/services/claim-verifier.service';
import { TransitionSuggesterService } from './src/services/transition-suggester.service';
import { ToneAdjusterService } from './src/services/tone-adjuster.service';
import { SynonymFinderService } from './src/services/synonym-finder.service';
import { MedicalNLPService } from './src/services/medical-nlp.service';
import { ClarityAnalyzerService } from './src/services/clarity-analyzer.service';
import { ParaphraseService } from './src/services/paraphrase.service';
import { SentenceBuilderService } from './src/services/sentence-builder.service';
import { ReadabilityService } from './src/services/readability.service';
import { AbbreviationService } from './src/services/abbreviation.service';
import { CitationSuggesterService } from './src/services/citation-suggester.service';
import { ClaimHighlighterService } from './src/services/claim-highlighter.service';
// ============================================================================
// PHASE 1: Data Integration & PHI Protection (DEPLOYED ✅)
// ============================================================================
export * from './src/types';
export * from './src/services/phi-guard.service';
export * from './src/services/data-mapper.service';
export * from './src/services/data-tagger.service';
export * from './src/services/version-control.service';
// ============================================================================
// PHASE 2: Literature & Citations (DEPLOYED ✅)
// ============================================================================
export * from './src/services/citation-manager.service';
// ============================================================================
// PHASE 3: Export & Compliance (DEPLOYED ✅)
// ============================================================================
export * from './src/services/export.service';
export * from './src/services/compliance-checker.service';
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
 * @param config - Optional configuration for services that require it
 * @returns Object containing all service instances
 */
export function initializeManuscriptEngine(config) {
    const services = {
        // Phase 4: AI Writing (Always available - no external deps)
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
    // Optionally include Phase 1-3 services if config provided
    if (config?.includePhase1 && config?.phiGuardConfig) {
        try {
            services.phiGuard = getPhiGuard(config.phiGuardConfig);
            services.dataMapper = getDataMapper();
            services.dataTagger = getDataTagger();
            services.versionControl = getVersionControl();
        }
        catch (error) {
            console.warn('Phase 1 services not available:', error);
        }
    }
    if (config?.includePhase2) {
        try {
            services.citationManager = getCitationManager();
        }
        catch (error) {
            console.warn('Phase 2 services not available:', error);
        }
    }
    if (config?.includePhase3) {
        try {
            services.exportService = getExportService();
            services.complianceChecker = getComplianceChecker();
        }
        catch (error) {
            console.warn('Phase 3 services not available:', error);
        }
    }
    return services;
}
/**
 * Default export for convenience
 */
export default initializeManuscriptEngine;
//# sourceMappingURL=index.js.map