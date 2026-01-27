/**
 * AI API Module
 *
 * Client-side API for AI endpoints (research brief, evidence gap map, etc.)
 */

import { apiRequest } from '../lib/queryClient';

// API base URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface ResearchBriefInput {
  topic: string;
  depth?: 'brief' | 'standard' | 'comprehensive';
}

export interface ResearchBriefResponse {
  brief: string;
  keyFindings: string[];
  suggestedNextSteps: string[];
}

export interface EvidenceGapMapInput {
  topic: string;
  existingStudies?: string[];
}

export interface EvidenceGapMapResponse {
  gapMap: {
    category: string;
    gaps: string[];
    opportunities: string[];
  }[];
  summary: string;
}

export interface StudyCardsInput {
  pmids?: string[];
  searchQuery?: string;
}

export interface StudyCard {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  summary: string;
  keyFindings: string[];
}

export interface DecisionMatrixInput {
  criteria: string[];
  options: string[];
  weights?: number[];
}

export interface DecisionMatrixResponse {
  matrix: {
    option: string;
    scores: Record<string, number>;
    totalScore: number;
  }[];
  recommendation: string;
}

/**
 * Generate a research brief on a topic
 */
export async function generateResearchBrief(
  input: ResearchBriefInput
): Promise<ResearchBriefResponse> {
  const response = await apiRequest('POST', `${API_BASE}/api/ai/research-brief`, input);
  return response.json();
}

/**
 * Generate evidence gap map
 */
export async function generateEvidenceGapMap(
  input: EvidenceGapMapInput
): Promise<EvidenceGapMapResponse> {
  const response = await apiRequest('POST', `${API_BASE}/api/ai/evidence-gap-map`, input);
  return response.json();
}

/**
 * Generate study cards
 */
export async function generateStudyCards(
  input: StudyCardsInput
): Promise<{ cards: StudyCard[] }> {
  const response = await apiRequest('POST', `${API_BASE}/api/ai/study-cards`, input);
  return response.json();
}

/**
 * Generate decision matrix
 */
export async function generateDecisionMatrix(
  input: DecisionMatrixInput
): Promise<DecisionMatrixResponse> {
  const response = await apiRequest('POST', `${API_BASE}/api/ai/decision-matrix`, input);
  return response.json();
}
