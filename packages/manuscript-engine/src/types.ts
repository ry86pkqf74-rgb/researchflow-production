/**
 * Manuscript Engine Type Definitions
 *
 * Defines interfaces for AI-powered writing assistance tools.
 */

import { z } from 'zod';
import type { AIRouterRequest, AIRouterResponse } from '@researchflow/ai-router';

/**
 * Section types for manuscript
 */
export type ManuscriptSection =
  | 'title'
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'conclusion'
  | 'references';

/**
 * Writing tone options
 */
export type WritingTone = 'formal' | 'semi-formal' | 'clinical' | 'conversational';

/**
 * Readability metrics
 */
export interface ReadabilityMetrics {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  gunningFogIndex: number;
  colemanLiauIndex: number;
  smogIndex: number;
  automatedReadabilityIndex: number;
  averageSentenceLength: number;
  averageWordLength: number;
  complexWordPercentage: number;
  recommendation: string;
}

/**
 * Grammar check result
 */
export interface GrammarCheckResult {
  passed: boolean;
  issues: GrammarIssue[];
  correctedText?: string;
  score: number;
}

export interface GrammarIssue {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  severity: 'error' | 'warning' | 'info';
  category: string;
  rule: string;
  suggestions: string[];
  context: {
    text: string;
    offset: number;
    length: number;
  };
}

/**
 * Claim verification result
 */
export interface ClaimVerificationResult {
  claim: string;
  verified: boolean;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  recommendation: 'accept' | 'revise' | 'citation_needed' | 'remove';
  reasoning: string;
}

/**
 * Transition suggestion
 */
export interface TransitionSuggestion {
  position: number;
  currentText: string;
  suggestedTransition: string;
  reasoning: string;
  coherenceScore: number;
}

/**
 * Tone adjustment result
 */
export interface ToneAdjustmentResult {
  originalText: string;
  adjustedText: string;
  targetTone: WritingTone;
  currentTone: WritingTone;
  adjustmentsMade: string[];
  confidence: number;
}

/**
 * Synonym suggestion
 */
export interface SynonymSuggestion {
  word: string;
  synonyms: Array<{
    term: string;
    medicallyPreferred: boolean;
    context: string;
    similarity: number;
  }>;
}

/**
 * Medical NLP result
 */
export interface MedicalNLPResult {
  entities: MedicalEntity[];
  standardizedText: string;
  terminologyIssues: TerminologyIssue[];
}

export interface MedicalEntity {
  text: string;
  start: number;
  end: number;
  type: 'disease' | 'drug' | 'procedure' | 'symptom' | 'anatomy' | 'biomarker';
  standardizedTerm?: string;
  cui?: string; // UMLS Concept Unique Identifier
  confidence: number;
}

export interface TerminologyIssue {
  original: string;
  suggested: string;
  reason: string;
  position: number;
}

/**
 * Clarity analysis result
 */
export interface ClarityAnalysis {
  overallScore: number;
  issues: ClarityIssue[];
  suggestions: string[];
  strengths: string[];
}

export interface ClarityIssue {
  sentence: string;
  position: number;
  issueType: 'passive_voice' | 'complex_sentence' | 'jargon' | 'ambiguity' | 'wordiness';
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

/**
 * Paraphrase result
 */
export interface ParaphraseResult {
  originalText: string;
  paraphrasedText: string;
  similarityScore: number;
  originalityScore: number;
  preservedKeyTerms: string[];
  changes: ParaphraseChange[];
}

export interface ParaphraseChange {
  type: 'structure' | 'vocabulary' | 'grammar';
  description: string;
}

/**
 * Sentence construction request
 */
export interface SentenceConstructionRequest {
  data: Record<string, unknown>;
  context: string;
  targetSection: ManuscriptSection;
  tone: WritingTone;
  maxLength?: number;
}

/**
 * Abbreviation management
 */
export interface AbbreviationAnalysis {
  abbreviations: AbbreviationEntry[];
  suggestedDefinitions: AbbreviationDefinition[];
  consistencyIssues: AbbreviationIssue[];
}

export interface AbbreviationEntry {
  abbreviation: string;
  firstOccurrence: number;
  occurrences: number[];
  definedAt?: number;
  expandedForm?: string;
}

export interface AbbreviationDefinition {
  abbreviation: string;
  expandedForm: string;
  position: number;
  confidence: number;
}

export interface AbbreviationIssue {
  abbreviation: string;
  issueType: 'undefined' | 'multiple_definitions' | 'inconsistent_usage';
  positions: number[];
  recommendation: string;
}

/**
 * Citation suggestion
 */
export interface CitationSuggestion {
  claim: string;
  position: number;
  suggestedCitations: SuggestedCitation[];
  confidence: number;
  reasoning: string;
}

export interface SuggestedCitation {
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  relevanceScore: number;
  excerpt?: string;
}

/**
 * Claim highlighting result
 */
export interface ClaimHighlightResult {
  claims: HighlightedClaim[];
  substantiationRate: number;
  unreferencedClaimCount: number;
}

export interface HighlightedClaim {
  text: string;
  start: number;
  end: number;
  hasEvidence: boolean;
  evidenceType?: 'citation' | 'data' | 'inference';
  strength: 'strong' | 'moderate' | 'weak';
  recommendation: string;
}

/**
 * Phrase library entry
 */
export interface PhraseTemplate {
  category: string;
  section: ManuscriptSection;
  pattern: string;
  example: string;
  variables: string[];
}

/**
 * Section-specific prompt context
 */
export interface SectionPromptContext {
  section: ManuscriptSection;
  studyType: string;
  keyFindings?: string[];
  methodology?: string;
  objective?: string;
  existingContent?: string;
}

// Zod validation schemas
export const ManuscriptSectionSchema = z.enum([
  'title',
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'references',
]);

export const WritingToneSchema = z.enum(['formal', 'semi-formal', 'clinical', 'conversational']);

export const SentenceConstructionRequestSchema = z.object({
  data: z.record(z.unknown()),
  context: z.string(),
  targetSection: ManuscriptSectionSchema,
  tone: WritingToneSchema,
  maxLength: z.number().optional(),
});

export const SectionPromptContextSchema = z.object({
  section: ManuscriptSectionSchema,
  studyType: z.string(),
  keyFindings: z.array(z.string()).optional(),
  methodology: z.string().optional(),
  objective: z.string().optional(),
  existingContent: z.string().optional(),
});

// Re-export all types from the types/ directory for backward compatibility
export * from './types/index';
