/**
 * Literature Components
 *
 * Re-exports all literature-related components for easy importing.
 */

// Types
export * from "./types";

// Components
export { CitationFormatter } from "./citation-formatter";
export { LiteratureReviewPanel } from "./literature-review";
export { GapAnalysisPanel } from "./gap-analysis";
export { ZoteroSyncPanel } from "./zotero-sync";
export { PlagiarismChecker } from "./plagiarism-checker";

// Default exports for lazy loading
export { default as CitationFormatterDefault } from "./citation-formatter";
export { default as LiteratureReviewPanelDefault } from "./literature-review";
export { default as GapAnalysisPanelDefault } from "./gap-analysis";
export { default as ZoteroSyncPanelDefault } from "./zotero-sync";
export { default as PlagiarismCheckerDefault } from "./plagiarism-checker";
