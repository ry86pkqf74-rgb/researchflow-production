/**
 * IMRaD Structure Types
 * Types specific to IMRaD (Introduction, Methods, Results, Discussion) manuscript structure
 */

import { z } from 'zod';

// Re-export from manuscript.types for backward compatibility
export { IMRaDSection } from './manuscript.types';

// Word count limits type
export interface WordCountLimits {
  abstract?: { min?: number; max: number };
  introduction?: { min?: number; max: number };
  methods?: { min?: number; max: number };
  results?: { min?: number; max: number };
  discussion?: { min?: number; max: number };
  references?: { min?: number; max: number };
  total?: { min?: number; max: number };
  [key: string]: { min?: number; max: number } | undefined;  // Allow other section names
}

// Template Placeholder
export interface TemplatePlaceholder {
  id: string;
  label: string;
  type?: 'text' | 'data' | 'citation' | 'figure' | 'table';
  required: boolean;
  defaultValue?: string;
  helpText?: string;
  description?: string;
  dataBinding?: string;  // For data-bound placeholders
}

// IMRaD Template
export interface IMRaDTemplate {
  name: string;
  type: 'imrad' | 'case_report' | 'systematic_review' | 'meta_analysis';
  journal?: string;
  abstract: {
    structured: boolean;
    sections: string[];
    wordLimit: number;
    placeholders: TemplatePlaceholder[];
  };
  introduction: {
    subsections: string[];
    wordLimit?: number;
    placeholders: TemplatePlaceholder[];
  };
  methods: {
    subsections: string[];
    wordLimit?: number;
    placeholders: TemplatePlaceholder[];
  };
  results: {
    subsections: string[];
    wordLimit?: number;
    placeholders: TemplatePlaceholder[];
  };
  discussion: {
    subsections: string[];
    wordLimit?: number;
    placeholders: TemplatePlaceholder[];
  };
  references: {
    style: string;
    maxCount?: number;
  };
}

// Section-specific types
export interface BackgroundSection {
  context: string;
  currentState: string;
  gaps: string[];
}

export interface RationaleSection {
  gap: string;
  significance: string;
  novelty: string;
}

export interface ObjectivesSection {
  primary: string;
  secondary: string[];
  hypotheses?: string[];
}

export interface IntroductionParts {
  background: BackgroundSection;
  rationale: RationaleSection;
  objectives: ObjectivesSection;
}

export interface MethodsContent {
  studyDesign: string;
  setting: string;
  participants: {
    eligibility: string;
    recruitment: string;
    sampleSize: number;
  };
  variables: {
    name: string;
    definition: string;
    measurement: string;
  }[];
  statisticalAnalysis: {
    software: string;
    tests: string[];
    significance: number;
  };
}

export interface ResultsContent {
  participants: {
    screened: number;
    enrolled: number;
    analyzed: number;
    excluded?: {
      count: number;
      reasons: Record<string, number>;
    };
  };
  demographics: Record<string, unknown>;
  outcomes: {
    primary: {
      outcome: string;
      results: unknown;
      pValue?: number;
    };
    secondary: {
      outcome: string;
      results: unknown;
      pValue?: number;
    }[];
  };
  additionalAnalyses?: unknown[];
}

export interface DiscussionParts {
  mainFindings: {
    summary: string;
    interpretation: string;
  };
  litComparison: {
    consistencies: string[];
    discrepancies: string[];
    novel: string[];
  };
  limitations: {
    limitation: string;
    impact: 'low' | 'medium' | 'high';
    mitigation?: string;
  }[];
  implications: {
    clinical: string[];
    research: string[];
    policy?: string[];
  };
  conclusions: string;
}

// Gap Analysis
export interface GapAnalysis {
  gaps: {
    description: string;
    citations: string[];
    importance: 'low' | 'medium' | 'high';
  }[];
  userContribution: string;
  novelty: string;
}

// Study Design
export interface StudyDesign {
  type: 'rct' | 'cohort' | 'case-control' | 'cross-sectional' | 'case-series' | 'case-report';
  prospective: boolean;
  blinded?: boolean;
  randomized?: boolean;
  controlled?: boolean;
  multisite?: boolean;
}

// Word Count Configuration
export interface WordCountConfig {
  abstract: { min: number; max: number };
  introduction: { max: number };
  methods: { max: number };
  results: { max: number };
  discussion: { max: number };
  total: { max: number };
}

export const DEFAULT_WORD_LIMITS: WordCountConfig = {
  abstract: { min: 150, max: 300 },
  introduction: { max: 1000 },
  methods: { max: 1500 },
  results: { max: 2000 },
  discussion: { max: 2000 },
  total: { max: 5000 },
};

// Section Outline
export interface SectionOutline {
  section: string;
  bulletPoints: string[];
  citations?: string[];
  dataReferences?: string[];
}

// Manuscript Scaffold
export interface ManuscriptScaffold {
  title: string;
  abstract: SectionOutline;
  introduction: SectionOutline;
  methods: SectionOutline;
  results: SectionOutline;
  discussion: SectionOutline;
  references: string[];
}
