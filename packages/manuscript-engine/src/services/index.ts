/**
 * Manuscript Engine Services
 * Barrel export for all services
 */

// Phase 1: Data Integration Services
export * from './phi-guard.service';
export * from './data-mapper.service';
export * from './data-tagger.service';
export * from './version-control.service';

// Phase 2: Literature Integration Services
export * from './citation-manager.service';

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
