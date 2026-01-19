/**
 * Literature Services
 *
 * Unified exports for literature search clients.
 */

export { PubMedClient, type PubMedArticle, type PubMedSearchOptions } from './pubmed.client.js';
export { SemanticScholarClient, type SemanticScholarPaper, type SemanticScholarSearchOptions } from './semantic_scholar.client.js';
export { ArxivClient, type ArxivPaper, type ArxivSearchOptions } from './arxiv.client.js';
export { ClinicalTrialsClient, type ClinicalTrial, type ClinicalTrialsSearchOptions } from './clinicaltrials.client.js';

// Union type for all literature results
export type LiteratureResult =
  | import('./pubmed.client.js').PubMedArticle
  | import('./semantic_scholar.client.js').SemanticScholarPaper
  | import('./arxiv.client.js').ArxivPaper
  | import('./clinicaltrials.client.js').ClinicalTrial;

export type LiteratureSource = 'pubmed' | 'semantic_scholar' | 'arxiv' | 'clinicaltrials';
