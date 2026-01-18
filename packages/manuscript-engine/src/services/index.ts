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
