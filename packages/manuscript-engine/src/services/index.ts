/**
 * Manuscript Engine Services
 * Barrel export for all services
 */

// Phase 1: Data Integration Services
export * from './phi-guard.service';
export * from './data-mapper.service';
export * from './data-tagger.service';
export * from './version-control.service';
export * from './visualization.service';
export * from './data-citation.service';
export * from './data-lineage.service';
export * from './chart-embed.service';
export * from './pre-draft-validator.service';
export * from './comparison-importer.service';
export * from './data-sync.service';
export * from './quarantine.service';
export * from './data-search.service';

// Phase 2: Literature Integration Services
export * from './citation-manager.service';
export * from './pubmed.service';
export * from './semantic-scholar.service';
export * from './lit-review.service';
export * from './arxiv.service';
export * from './lit-matrix.service';
export * from './plagiarism-check.service';
export * from './lit-watcher.service';
export * from './lit-summary-embed.service';
export * from './conflict-detector.service';
export * from './zotero.service';
export * from './citation-formatter.service';
export * from './relevance-scorer.service';

// Phase 3: Structure Building Services
export * from './abstract-generator.service';
export * from './introduction-builder.service';
export * from './methods-populator.service';
export * from './results-scaffold.service';
export * from './discussion-builder.service';
export * from './references-builder.service';
export * from './acknowledgments.service';
export * from './word-count-tracker.service';
export * from './outline-expander.service';
export * from './keyword-generator.service';
export * from './coi-disclosure.service';
export * from './appendices-builder.service';
export * from './title-generator.service';
export * from './author-manager.service';
export * from './branch-manager.service';

// Phase 4: Writing Assistance Services
export * from './abbreviation.service';
export * from './citation-suggester.service';
export * from './claim-highlighter.service';
export * from './claim-verifier.service';
export * from './clarity-analyzer.service';
export * from './claude-writer.service';
export * from './grammar-checker.service';
export * from './medical-nlp.service';
export * from './openai-drafter.service';
export * from './paraphrase.service';
export * from './readability.service';
export * from './sentence-builder.service';
export * from './synonym-finder.service';
export * from './tone-adjuster.service';
export * from './transition-suggester.service';

// Phase 5: Export & Compliance Services
export * from './export.service';
export * from './compliance-checker.service';
export * from './peer-review.service';
export * from './final-phi-scan.service';

// ============================================
// Singleton Instance Exports for Convenience
// ============================================

// Import classes for singleton exports
import { ExportService } from './export.service';
import { ComplianceCheckerService } from './compliance-checker.service';
import { PeerReviewService } from './peer-review.service';
import { FinalPhiScanService } from './final-phi-scan.service';
import { OpenAIDrafterService } from './openai-drafter.service';
import { ClaudeWriterService } from './claude-writer.service';
import { GrammarCheckerService } from './grammar-checker.service';
import { ClaimVerifierService } from './claim-verifier.service';
import { ReadabilityService } from './readability.service';
import { TransitionSuggesterService } from './transition-suggester.service';
import { ToneAdjusterService } from './tone-adjuster.service';
import { SynonymFinderService } from './synonym-finder.service';
import { MedicalNLPService } from './medical-nlp.service';
import { ClarityAnalyzerService } from './clarity-analyzer.service';
import { SentenceBuilderService } from './sentence-builder.service';
import { ParaphraseService } from './paraphrase.service';
import { AbbreviationService } from './abbreviation.service';
import { CitationSuggesterService } from './citation-suggester.service';
import { ClaimHighlighterService } from './claim-highlighter.service';

// Phase 4: Writing Service Instances
export const openAIDrafterService = new OpenAIDrafterService();
export const claudeWriterService = new ClaudeWriterService();
export const grammarCheckerService = new GrammarCheckerService();
export const claimVerifierService = new ClaimVerifierService();
export const readabilityService = new ReadabilityService();
export const transitionSuggesterService = new TransitionSuggesterService();
export const toneAdjusterService = new ToneAdjusterService();
export const synonymFinderService = new SynonymFinderService();
export const medicalNLPService = new MedicalNLPService();
export const clarityAnalyzerService = new ClarityAnalyzerService();
export const sentenceBuilderService = new SentenceBuilderService();
export const paraphraseService = new ParaphraseService();
export const abbreviationService = new AbbreviationService();
export const citationSuggesterService = new CitationSuggesterService();
export const claimHighlighterService = new ClaimHighlighterService();

// Phase 5: Export & Compliance Service Instances
export const exportService = ExportService.getInstance();
export const complianceCheckerService = ComplianceCheckerService.getInstance();
export const peerReviewService = new PeerReviewService();
export const finalPhiScanService = new FinalPhiScanService();
