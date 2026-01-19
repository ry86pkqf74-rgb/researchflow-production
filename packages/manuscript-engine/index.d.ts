/**
 * @researchflow/manuscript-engine
 * Complete manuscript generation and export engine
 *
 * @packageDocumentation
 */
export * from './src/types';
export * from './src/services/phi-guard.service';
export * from './src/services/data-mapper.service';
export * from './src/services/data-tagger.service';
export * from './src/services/version-control.service';
export * from './src/services/citation-manager.service';
export * from './src/services/export.service';
export * from './src/services/compliance-checker.service';
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
export * from './src/templates/table-templates';
export * from './src/templates/phrase-library';
export * from './src/prompts/abstract-generator.prompt';
export * from './src/prompts/section-prompts/abstract.prompt';
export * from './src/prompts/section-prompts/introduction.prompt';
export * from './src/prompts/section-prompts/methods.prompt';
export * from './src/prompts/section-prompts/results.prompt';
export * from './src/prompts/section-prompts/discussion.prompt';
export declare const MANUSCRIPT_ENGINE_VERSION = "2.0.0";
export declare const PHASE_STATUS: {
    phase1: string;
    phase2: string;
    phase3: string;
    phase4: string;
    phase5: string;
};
/**
 * Initialize all manuscript engine services
 * @param config - Optional configuration for services that require it
 * @returns Object containing all service instances
 */
export declare function initializeManuscriptEngine(config?: {
    phiGuardConfig?: any;
    includePhase1?: boolean;
    includePhase2?: boolean;
    includePhase3?: boolean;
}): any;
/**
 * Default export for convenience
 */
export default initializeManuscriptEngine;
//# sourceMappingURL=index.d.ts.map