/**
 * Demo Routes
 *
 * Public endpoints for demo mode functionality.
 * No authentication required.
 * Returns simulated/stub data OR calls worker with demo flag.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  ManuscriptIdeationInputSchema,
  ManuscriptProposalSchema,
  type ManuscriptProposal
} from '@packages/core/types';

const router = Router();

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8000';
const USE_REAL_GENERATION_IN_DEMO = process.env.DEMO_USE_REAL_GENERATION === 'true';

/**
 * Generate stub proposals for demo mode
 */
function generateStubProposals(topic: string, domain?: string): ManuscriptProposal[] {
  const baseProposals: ManuscriptProposal[] = [
    {
      id: 1,
      title: `Systematic Review: ${topic}`,
      abstract: `A comprehensive systematic review examining the current evidence on ${topic}. This review will synthesize findings from randomized controlled trials and observational studies to provide evidence-based recommendations for clinical practice.`,
      relevanceScore: 94,
      noveltyScore: 78,
      feasibilityScore: 88,
      methodology: 'Systematic review following PRISMA guidelines with meta-analysis of primary outcomes.',
      expectedOutcome: 'Evidence synthesis with clinical practice recommendations and identification of research gaps.',
      suggestedJournals: ['JAMA', 'BMJ', 'Annals of Internal Medicine'],
      keywords: ['systematic review', 'meta-analysis', 'evidence synthesis', domain || 'clinical medicine'].filter(Boolean),
    },
    {
      id: 2,
      title: `Retrospective Cohort Study: Real-World Outcomes in ${topic}`,
      abstract: `A retrospective cohort study utilizing electronic health records to evaluate real-world outcomes related to ${topic}. This study will provide insights into effectiveness and safety in routine clinical practice.`,
      relevanceScore: 89,
      noveltyScore: 85,
      feasibilityScore: 92,
      methodology: 'Retrospective cohort analysis using propensity score matching to control for confounding.',
      expectedOutcome: 'Real-world evidence on effectiveness and safety with subgroup analyses.',
      suggestedJournals: ['JAMA Network Open', 'BMJ Open', 'PLoS Medicine'],
      keywords: ['real-world evidence', 'retrospective cohort', 'electronic health records', domain || 'outcomes research'].filter(Boolean),
    },
    {
      id: 3,
      title: `Machine Learning Prediction Model for ${topic}`,
      abstract: `Development and validation of a machine learning model to predict outcomes related to ${topic}. This study will compare multiple algorithms and provide a clinically applicable risk prediction tool.`,
      relevanceScore: 86,
      noveltyScore: 92,
      feasibilityScore: 75,
      methodology: 'Development cohort with external validation. Comparison of logistic regression, random forest, and gradient boosting models.',
      expectedOutcome: 'Validated prediction model with web-based calculator for clinical use.',
      suggestedJournals: ['Lancet Digital Health', 'NPJ Digital Medicine', 'JAMIA'],
      keywords: ['machine learning', 'prediction model', 'clinical decision support', domain || 'digital health'].filter(Boolean),
    },
    {
      id: 4,
      title: `Cost-Effectiveness Analysis of Interventions for ${topic}`,
      abstract: `A cost-effectiveness analysis comparing current treatment strategies for ${topic}. This analysis will inform healthcare policy and resource allocation decisions.`,
      relevanceScore: 82,
      noveltyScore: 76,
      feasibilityScore: 84,
      methodology: 'Markov model with probabilistic sensitivity analysis using healthcare system perspective.',
      expectedOutcome: 'Cost-effectiveness ratios and budget impact analysis for policymakers.',
      suggestedJournals: ['Value in Health', 'Pharmacoeconomics', 'Health Affairs'],
      keywords: ['cost-effectiveness', 'health economics', 'policy analysis', domain || 'health policy'].filter(Boolean),
    },
    {
      id: 5,
      title: `Qualitative Study: Patient Perspectives on ${topic}`,
      abstract: `A qualitative study exploring patient experiences and perspectives regarding ${topic}. This research will capture the patient voice to inform patient-centered care approaches.`,
      relevanceScore: 79,
      noveltyScore: 88,
      feasibilityScore: 90,
      methodology: 'Semi-structured interviews with thematic analysis following COREQ guidelines.',
      expectedOutcome: 'Rich understanding of patient experiences to inform shared decision-making.',
      suggestedJournals: ['Patient Education and Counseling', 'BMC Health Services Research', 'Qualitative Health Research'],
      keywords: ['qualitative research', 'patient perspectives', 'patient-centered care', domain || 'health services'].filter(Boolean),
    },
  ];

  return baseProposals;
}

/**
 * POST /api/demo/generate-proposals
 * Generate manuscript proposals in demo mode
 */
router.post('/generate-proposals', async (req: Request, res: Response) => {
  try {
    // Validate input
    const parseResult = ManuscriptIdeationInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.flatten(),
      });
    }

    const { researchTopic, researchDomain, targetPopulation, primaryOutcome } = parseResult.data;

    // Option 1: Use stub data (default for demo)
    if (!USE_REAL_GENERATION_IN_DEMO) {
      const proposals = generateStubProposals(researchTopic, researchDomain);

      return res.json({
        status: 'success',
        topic: researchTopic,
        domain: researchDomain || 'General',
        proposals,
        generatedAt: new Date().toISOString(),
        mode: 'demo',
      });
    }

    // Option 2: Call worker with demo flag (for testing real generation)
    const workerResponse = await fetch(`${WORKER_URL}/api/manuscript/generate/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: researchTopic,
        domain: researchDomain,
        population: targetPopulation,
        outcome: primaryOutcome,
        mode: 'demo',
      }),
    });

    if (!workerResponse.ok) {
      console.error('[Demo] Worker error:', await workerResponse.text());
      // Fallback to stub data
      const proposals = generateStubProposals(researchTopic, researchDomain);
      return res.json({
        status: 'success',
        topic: researchTopic,
        domain: researchDomain || 'General',
        proposals,
        generatedAt: new Date().toISOString(),
        mode: 'demo',
        fallback: true,
      });
    }

    const workerData = await workerResponse.json();

    res.json({
      status: 'success',
      topic: researchTopic,
      domain: researchDomain || 'General',
      proposals: workerData.proposals,
      generatedAt: new Date().toISOString(),
      mode: 'demo',
    });

  } catch (error) {
    console.error('[Demo] Generate proposals error:', error);
    res.status(500).json({ error: 'Failed to generate proposals' });
  }
});

export default router;
