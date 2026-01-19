/**
 * Literature Component Types
 *
 * Type definitions for literature review, citation formatting,
 * gap analysis, Zotero sync, and plagiarism detection components.
 */

// Citation Types
export interface Citation {
  id: string;
  type: 'journal' | 'book' | 'chapter' | 'conference' | 'thesis' | 'website' | 'report';
  title: string;
  authors: Author[];
  year: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  isbn?: string;
  accessDate?: string;
}

export interface Author {
  firstName: string;
  lastName: string;
  suffix?: string;
}

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'harvard' | 'vancouver' | 'ieee' | 'ama';

export interface FormattedCitation {
  style: CitationStyle;
  text: string;
  inTextCitation: string;
}

// Literature Review Types
export interface Paper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  citations?: string[];
  references?: string[];
  keywords?: string[];
}

export interface ReviewSection {
  title: string;
  content: string;
  papers: string[];
  subsections?: ReviewSection[];
}

export interface LiteratureReview {
  title: string;
  query: string;
  generatedAt: string;
  summary: string;
  sections: ReviewSection[];
  keyFindings: string[];
  researchGaps: string[];
  futureDirections: string[];
  methodologyAnalysis: MethodologyAnalysis;
  paperCount: number;
  themes: Theme[];
}

export interface Theme {
  name: string;
  description: string;
  paperCount: number;
  keyTerms: string[];
}

export interface MethodologyAnalysis {
  studyDesigns: Record<string, number>;
  sampleSizes?: Record<string, number>;
  dataTypes?: string[];
  analysisMethods?: string[];
  limitationsNoted?: string[];
  qualityAssessment?: string;
}

// Gap Analysis Types
export interface Gap {
  type: 'topic' | 'methodology' | 'population' | 'temporal' | 'geographic' | 'network';
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string[];
  suggestedResearch: string;
  relatedPapers: string[];
  confidence: number;
}

export interface GapAnalysisResult {
  query: string;
  analyzedAt: string;
  paperCount: number;
  gaps: Gap[];
  topicCoverage: Record<string, number>;
  methodologyDistribution: Record<string, number>;
  temporalTrends: Record<number, number>;
  recommendations: string[];
  networkStats: NetworkStats;
}

export interface NetworkStats {
  totalPapers: number;
  totalCitations: number;
  totalReferences: number;
  avgCitations: number;
  avgReferences: number;
}

// Zotero Types
export interface ZoteroItem {
  key: string;
  itemType: string;
  title: string;
  creators: ZoteroCreator[];
  date?: string;
  abstract?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  tags: string[];
  collections: string[];
  dateAdded?: string;
  dateModified?: string;
}

export interface ZoteroCreator {
  firstName: string;
  lastName: string;
  creatorType: string;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  parentKey?: string;
  itemCount: number;
}

export interface ZoteroSyncResult {
  success: boolean;
  itemsImported: number;
  itemsExported: number;
  itemsUpdated: number;
  errors: string[];
  syncedAt: string;
}

// Plagiarism Types
export interface TextSegment {
  text: string;
  start: number;
  end: number;
  sourceId?: string;
}

export interface SimilarityMatch {
  querySegment: TextSegment;
  sourceSegment: TextSegment;
  sourceId: string;
  sourceTitle: string;
  similarityScore: number;
  matchType: 'exact' | 'near_exact' | 'paraphrase' | 'common_phrase';
  highlightedQuery: string;
  highlightedSource: string;
}

export interface CitationIssue {
  type: 'missing_citation' | 'incorrect_citation' | 'incomplete_citation';
  text: string;
  source: string;
  severity: 'high' | 'medium' | 'low';
}

export interface PlagiarismReport {
  documentId: string;
  analyzedAt: string;
  totalWords: number;
  uniqueWords: number;
  matches: SimilarityMatch[];
  overallSimilarity: number;
  similarityBySource: Record<string, number>;
  flaggedSections: TextSegment[];
  citationIssues: CitationIssue[];
  recommendations: string[];
}

// Component Props
export interface CitationFormatterProps {
  citation?: Citation;
  onFormatted?: (formatted: FormattedCitation[]) => void;
}

export interface LiteratureReviewProps {
  papers: Paper[];
  query: string;
  onReviewGenerated?: (review: LiteratureReview) => void;
}

export interface GapAnalysisProps {
  papers: Paper[];
  query: string;
  onAnalysisComplete?: (result: GapAnalysisResult) => void;
}

export interface ZoteroSyncProps {
  apiKey?: string;
  userId?: string;
  onSyncComplete?: (result: ZoteroSyncResult) => void;
}

export interface PlagiarismCheckerProps {
  text?: string;
  sources?: { id: string; title: string; text: string }[];
  onReportGenerated?: (report: PlagiarismReport) => void;
}
