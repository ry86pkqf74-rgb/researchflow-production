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

// Service instances for testing
import { getOpenAIDrafter } from './openai-drafter.service';
import { getClaudeWriter } from './claude-writer.service';
import { getGrammarChecker } from './grammar-checker.service';
import { getClaimVerifier } from './claim-verifier.service';
import { getReadability } from './readability.service';
import { getTransitionSuggester } from './transition-suggester.service';
import { getToneAdjuster } from './tone-adjuster.service';
import { getSynonymFinder } from './synonym-finder.service';
import { getMedicalNLP } from './medical-nlp.service';
import { getClarityAnalyzer } from './clarity-analyzer.service';
import { getSentenceBuilder } from './sentence-builder.service';
import { getParaphrase } from './paraphrase.service';
import { getAbbreviation } from './abbreviation.service';
import { getCitationSuggester } from './citation-suggester.service';
import { getClaimHighlighter } from './claim-highlighter.service';

export const openAIDrafterService = getOpenAIDrafter();
export const claudeWriterService = getClaudeWriter();
export const grammarCheckerService = getGrammarChecker();
export const claimVerifierService = getClaimVerifier();
export const readabilityService = getReadability();
export const transitionSuggesterService = getTransitionSuggester();
export const toneAdjusterService = getToneAdjuster();
export const synonymFinderService = getSynonymFinder();
export const medicalNLPService = getMedicalNLP();
export const clarityAnalyzerService = getClarityAnalyzer();
export const sentenceBuilderService = getSentenceBuilder();
export const paraphraseService = getParaphrase();
export const abbreviationService = getAbbreviation();
export const citationSuggesterService = getCitationSuggester();
export const claimHighlighterService = getClaimHighlighter();
