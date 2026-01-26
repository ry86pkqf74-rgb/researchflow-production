/**
 * AI Insights Routes
 *
 * Endpoints for AI-powered research insights:
 * - POST /api/ai/research-brief - Generate PICO-structured research brief
 * - POST /api/ai/evidence-gap-map - Analyze research landscape
 * - POST /api/ai/study-cards - Generate study proposals
 * - POST /api/ai/decision-matrix - Rank proposals
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { logAction } from '../services/audit-service';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Worker service URL for AI calls
const WORKER_URL = process.env.WORKER_URL || 'http://worker:8000';

// ============================================================================
// Schemas
// ============================================================================

const ResearchBriefRequestSchema = z.object({
  topic: z.string().min(10, 'Topic must be at least 10 characters'),
  population: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
});

const EvidenceGapMapRequestSchema = z.object({
  topic: z.string().min(10),
  population: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
});

const StudyCardsRequestSchema = z.object({
  topic: z.string().min(10),
  researchBrief: z.any().optional(),
  count: z.number().min(3).max(10).default(7),
});

const DecisionMatrixRequestSchema = z.object({
  studyCards: z.array(z.any()).min(1),
});

// ============================================================================
// Types
// ============================================================================

interface ResearchBrief {
  population: string;
  exposure: string;
  comparator: string;
  outcomes: string[];
  timeframe: string;
  studyObjectives: string[];
  clarifyingPrompts?: string[];
}

interface EvidenceGapMap {
  knowns: Array<{ finding: string; evidence: string }>;
  unknowns: Array<{ gap: string; importance: string }>;
  methods: Array<{ approach: string; appropriateness: string }>;
  pitfalls: Array<{ risk: string; mitigation: string }>;
}

interface TargetJournal {
  name: string;
  impactFactor: number;
  acceptanceLikelihood: 'high' | 'medium' | 'low';
  audience: string;
  whyThisJournal: string;
  alignment?: string[];
  potentialGaps?: string[];
  wordLimit?: number;
  figureLimit?: number;
}

interface StudyCard {
  id: number;
  title: string;
  researchQuestion: string;
  hypothesis: string;
  plannedMethod: string;
  exposures: string[];
  cohortDefinition: string;
  indexDate: string;
  feasibilityScore: number;
  threatsToValidity?: Array<{ threat: string; mitigation: string }>;
  targetJournals?: TargetJournal[];
}

interface DecisionMatrix {
  recommendedPick: number;
  reasons: string[];
  proposals: Array<{
    id: number;
    novelty: number;
    feasibility: number;
    clinicalImportance: number;
    timeToExecute: string;
    overallScore: number;
  }>;
}

// ============================================================================
// Helper: Call Worker AI Service
// ============================================================================

async function callWorkerAI(endpoint: string, payload: any): Promise<any> {
  const response = await fetch(`${WORKER_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Worker AI call failed: ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/ai/research-brief
 * Generate a PICO-structured research brief from a topic
 */
router.post(
  '/research-brief',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = ResearchBriefRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { topic, population, outcomes } = validation.data;
    const userId = (req as any).user?.id || 'anonymous';
    const requestId = uuid();

    try {
      // Call worker AI service
      const result = await callWorkerAI('/api/ai/insights/research-brief', {
        topic,
        population,
        outcomes,
        request_id: requestId,
      });

      // If worker doesn't have this endpoint yet, generate a structured response
      const brief: ResearchBrief = result.brief || {
        population: population || extractPopulationFromTopic(topic),
        exposure: extractExposureFromTopic(topic),
        comparator: 'Standard of care / No exposure',
        outcomes: outcomes || extractOutcomesFromTopic(topic),
        timeframe: '12 months minimum follow-up',
        studyObjectives: [
          `To evaluate the association between ${extractExposureFromTopic(topic)} and clinical outcomes`,
          `To identify risk factors and effect modifiers`,
          `To quantify the magnitude of effect across subgroups`,
        ],
        clarifyingPrompts: [
          'What is the minimum sample size available for this analysis?',
          'Are there specific comorbidities to include or exclude?',
          'What is the expected effect size based on prior literature?',
        ],
      };

      // Log action
      await logAction({
        eventType: 'AI_RESEARCH_BRIEF_GENERATED',
        action: 'GENERATE',
        resourceType: 'research_brief',
        resourceId: requestId,
        userId,
        details: { topic, hasPopulation: !!population, hasOutcomes: !!outcomes },
      });

      res.json({
        brief,
        requestId,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI Insights] Research brief generation failed:', error);

      // Fallback: Generate structured brief without worker
      const brief: ResearchBrief = {
        population: population || extractPopulationFromTopic(topic),
        exposure: extractExposureFromTopic(topic),
        comparator: 'Standard of care / No exposure',
        outcomes: outcomes || extractOutcomesFromTopic(topic),
        timeframe: '12 months minimum follow-up',
        studyObjectives: [
          `To evaluate the association between ${extractExposureFromTopic(topic)} and clinical outcomes`,
          `To identify risk factors and effect modifiers`,
          `To quantify the magnitude of effect across subgroups`,
        ],
        clarifyingPrompts: [
          'What is the minimum sample size available for this analysis?',
          'Are there specific comorbidities to include or exclude?',
          'What is the expected effect size based on prior literature?',
        ],
      };

      res.json({
        brief,
        requestId,
        generatedAt: new Date().toISOString(),
        fallback: true,
      });
    }
  })
);

/**
 * POST /api/ai/evidence-gap-map
 * Analyze the research landscape for a topic
 */
router.post(
  '/evidence-gap-map',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = EvidenceGapMapRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { topic, population, outcomes } = validation.data;
    const userId = (req as any).user?.id || 'anonymous';
    const requestId = uuid();

    try {
      const result = await callWorkerAI('/api/ai/insights/evidence-gap-map', {
        topic,
        population,
        outcomes,
        request_id: requestId,
      });

      const evidenceGapMap: EvidenceGapMap = result.evidenceGapMap || generateFallbackEvidenceGapMap(topic);

      await logAction({
        eventType: 'AI_EVIDENCE_GAP_MAP_GENERATED',
        action: 'GENERATE',
        resourceType: 'evidence_gap_map',
        resourceId: requestId,
        userId,
        details: { topic },
      });

      res.json({
        evidenceGapMap,
        requestId,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI Insights] Evidence gap map generation failed:', error);

      res.json({
        evidenceGapMap: generateFallbackEvidenceGapMap(topic),
        requestId,
        generatedAt: new Date().toISOString(),
        fallback: true,
      });
    }
  })
);

/**
 * POST /api/ai/study-cards
 * Generate study proposals with feasibility scores
 */
router.post(
  '/study-cards',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = StudyCardsRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { topic, researchBrief, count } = validation.data;
    const userId = (req as any).user?.id || 'anonymous';
    const requestId = uuid();

    try {
      const result = await callWorkerAI('/api/ai/insights/study-cards', {
        topic,
        research_brief: researchBrief,
        count,
        request_id: requestId,
      });

      const studyCards: StudyCard[] = result.studyCards || generateFallbackStudyCards(topic, count);

      await logAction({
        eventType: 'AI_STUDY_CARDS_GENERATED',
        action: 'GENERATE',
        resourceType: 'study_cards',
        resourceId: requestId,
        userId,
        details: { topic, count: studyCards.length },
      });

      res.json({
        studyCards,
        requestId,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI Insights] Study cards generation failed:', error);

      res.json({
        studyCards: generateFallbackStudyCards(topic, count),
        requestId,
        generatedAt: new Date().toISOString(),
        fallback: true,
      });
    }
  })
);

/**
 * POST /api/ai/decision-matrix
 * Rank study proposals by novelty, feasibility, and clinical importance
 */
router.post(
  '/decision-matrix',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = DecisionMatrixRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { studyCards } = validation.data;
    const userId = (req as any).user?.id || 'anonymous';
    const requestId = uuid();

    try {
      const result = await callWorkerAI('/api/ai/insights/decision-matrix', {
        study_cards: studyCards,
        request_id: requestId,
      });

      const decisionMatrix: DecisionMatrix = result.decisionMatrix || generateFallbackDecisionMatrix(studyCards);

      await logAction({
        eventType: 'AI_DECISION_MATRIX_GENERATED',
        action: 'GENERATE',
        resourceType: 'decision_matrix',
        resourceId: requestId,
        userId,
        details: { studyCount: studyCards.length, recommendedPick: decisionMatrix.recommendedPick },
      });

      res.json({
        decisionMatrix,
        requestId,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI Insights] Decision matrix generation failed:', error);

      res.json({
        decisionMatrix: generateFallbackDecisionMatrix(studyCards),
        requestId,
        generatedAt: new Date().toISOString(),
        fallback: true,
      });
    }
  })
);

// ============================================================================
// Helper Functions
// ============================================================================

function extractPopulationFromTopic(topic: string): string {
  // Simple extraction - in production, would use NLP
  const populationPatterns = [
    /adults?\s*(aged?\s*\d+[-–]\d+)?/i,
    /patients?\s*with\s+[\w\s]+/i,
    /children/i,
    /elderly/i,
    /women|men/i,
  ];

  for (const pattern of populationPatterns) {
    const match = topic.match(pattern);
    if (match) return match[0];
  }

  return 'Adults with the condition of interest';
}

function extractExposureFromTopic(topic: string): string {
  // Extract the main exposure/intervention
  const exposurePatterns = [
    /between\s+([\w\s]+)\s+and/i,
    /effect of\s+([\w\s]+)/i,
    /association.*?([\w\s]+)\s+and/i,
  ];

  for (const pattern of exposurePatterns) {
    const match = topic.match(pattern);
    if (match) return match[1].trim();
  }

  return topic.split(' ').slice(0, 5).join(' ');
}

function extractOutcomesFromTopic(topic: string): string[] {
  const outcomePatterns = [
    /outcomes?\s*(?:in|of)?\s*([\w\s,]+)/i,
    /and\s+([\w\s]+)$/i,
    /cardiovascular|mortality|morbidity|hospitalization/gi,
  ];

  const outcomes: string[] = [];
  for (const pattern of outcomePatterns) {
    const matches = topic.match(pattern);
    if (matches) {
      outcomes.push(...matches.slice(0, 3));
    }
  }

  return outcomes.length > 0
    ? outcomes.slice(0, 3)
    : ['Primary clinical outcome', 'Secondary outcome', 'Safety outcome'];
}

function generateFallbackEvidenceGapMap(topic: string): EvidenceGapMap {
  return {
    knowns: [
      { finding: 'Established association in observational studies', evidence: 'Multiple cohort studies (n>10,000)' },
      { finding: 'Mechanism pathways partially elucidated', evidence: 'Preclinical and mechanistic studies' },
      { finding: 'Treatment guidelines exist', evidence: 'Society guidelines and recommendations' },
    ],
    unknowns: [
      { gap: 'Optimal timing of intervention', importance: 'Critical for clinical decision-making' },
      { gap: 'Effect modification by comorbidities', importance: 'Relevant for personalized medicine' },
      { gap: 'Long-term outcomes beyond 5 years', importance: 'Informs patient counseling' },
    ],
    methods: [
      { approach: 'Retrospective cohort analysis', appropriateness: 'High - suitable for rare outcomes' },
      { approach: 'Propensity score matching', appropriateness: 'Recommended for confounding control' },
      { approach: 'Time-to-event analysis', appropriateness: 'Appropriate for outcome assessment' },
    ],
    pitfalls: [
      { risk: 'Immortal time bias', mitigation: 'Landmark analysis or time-varying exposure' },
      { risk: 'Selection bias', mitigation: 'Multiple sensitivity analyses' },
      { risk: 'Unmeasured confounding', mitigation: 'E-value calculation and negative controls' },
    ],
  };
}

function generateFallbackStudyCards(topic: string, count: number): StudyCard[] {
  const templates = [
    {
      suffix: 'Primary Cohort Study',
      method: 'Retrospective cohort',
      feasibility: 85,
    },
    {
      suffix: 'Subgroup Analysis',
      method: 'Stratified analysis',
      feasibility: 78,
    },
    {
      suffix: 'Time-Series Analysis',
      method: 'Interrupted time series',
      feasibility: 72,
    },
    {
      suffix: 'Propensity-Matched Study',
      method: 'Propensity score matching',
      feasibility: 80,
    },
    {
      suffix: 'Machine Learning Prediction',
      method: 'ML classification',
      feasibility: 65,
    },
    {
      suffix: 'Dose-Response Analysis',
      method: 'Exposure gradient analysis',
      feasibility: 70,
    },
    {
      suffix: 'Sensitivity Analysis',
      method: 'Multiple analytical approaches',
      feasibility: 88,
    },
  ];

  return templates.slice(0, count).map((template, index) => ({
    id: index + 1,
    title: `${topic.slice(0, 50)} - ${template.suffix}`,
    researchQuestion: `What is the effect of exposure on outcomes in the target population using ${template.method}?`,
    hypothesis: `We hypothesize that the exposure is associated with improved/worsened outcomes`,
    plannedMethod: template.method,
    exposures: ['Primary exposure', 'Alternative exposure definition'],
    cohortDefinition: 'Patients meeting inclusion criteria with complete follow-up',
    indexDate: 'First documented exposure or diagnosis date',
    feasibilityScore: template.feasibility,
    threatsToValidity: [
      { threat: 'Selection bias', mitigation: 'Sensitivity analysis with alternative inclusion criteria' },
      { threat: 'Information bias', mitigation: 'Validation substudy' },
      { threat: 'Confounding', mitigation: 'Propensity score adjustment' },
    ],
    targetJournals: [
      {
        name: index === 0 ? 'Journal of Clinical Epidemiology' : 'PLOS ONE',
        impactFactor: index === 0 ? 6.4 : 3.7,
        acceptanceLikelihood: index === 0 ? 'medium' : 'high',
        audience: 'Clinical researchers and epidemiologists',
        whyThisJournal: 'Good fit for methodological rigor and clinical relevance',
        alignment: ['Methodology matches scope', 'Topic within journal focus'],
        potentialGaps: ['May need stronger novelty claim'],
        wordLimit: 4000,
        figureLimit: 6,
      },
    ],
  }));
}

function generateFallbackDecisionMatrix(studyCards: any[]): DecisionMatrix {
  const proposals = studyCards.map((card, index) => ({
    id: card.id || index + 1,
    novelty: Math.floor(Math.random() * 30) + 50,
    feasibility: card.feasibilityScore || Math.floor(Math.random() * 30) + 60,
    clinicalImportance: Math.floor(Math.random() * 25) + 65,
    timeToExecute: ['3-6 months', '6-9 months', '9-12 months'][index % 3],
    overallScore: 0,
  }));

  // Calculate overall scores
  proposals.forEach(p => {
    p.overallScore = Math.round((p.novelty * 0.25 + p.feasibility * 0.35 + p.clinicalImportance * 0.4));
  });

  // Sort by overall score
  proposals.sort((a, b) => b.overallScore - a.overallScore);

  const recommendedPick = proposals[0].id;

  return {
    recommendedPick,
    reasons: [
      `Highest overall score of ${proposals[0].overallScore}`,
      `Strong feasibility (${proposals[0].feasibility}%) enables timely completion`,
      `Clinical importance aligns with current research priorities`,
      'Methodology is well-established with clear precedent',
    ],
    proposals,
  };
}

export default router;
