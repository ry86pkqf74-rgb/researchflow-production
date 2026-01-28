/**
 * Manuscript Ideation Stage Routes
 *
 * Live mode endpoints for authenticated manuscript ideation workflow.
 * Includes generation, selection, and persistence.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/governance';
import {
  ManuscriptIdeationInputSchema,
  ManuscriptIdeationOutputSchema,
  ProposalSelectionSchema,
  type ManuscriptProposal
} from '@packages/core/types';

const router = Router();

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8000';

// Simple in-memory storage for demo purposes
// In production, use database
interface StoredOutput {
  projectId: string;
  output: any;
  selectedProposal?: ManuscriptProposal;
  selectedProposalId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const storage = new Map<string, StoredOutput>();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/ros/stages/manuscript_ideation/execute
 * Execute manuscript ideation stage
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { projectId, inputs } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Validate inputs
    const parseResult = ManuscriptIdeationInputSchema.safeParse(inputs);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid inputs',
        details: parseResult.error.flatten(),
      });
    }

    const { researchTopic, researchDomain, targetPopulation, primaryOutcome, refinementNotes, previousProposalId } = parseResult.data;

    // Call worker service
    const workerResponse = await fetch(`${WORKER_URL}/api/manuscript/generate/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: researchTopic,
        domain: researchDomain,
        population: targetPopulation,
        outcome: primaryOutcome,
        refinement_notes: refinementNotes,
        previous_proposal_id: previousProposalId,
        mode: 'live',
      }),
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error('[ManuscriptIdeation] Worker error:', errorText);
      throw new Error(`Worker failed: ${errorText}`);
    }

    const workerData = await workerResponse.json();

    // Validate worker output
    const outputParseResult = ManuscriptIdeationOutputSchema.safeParse({
      status: 'success',
      topic: researchTopic,
      domain: researchDomain,
      proposals: workerData.proposals,
      generatedAt: new Date().toISOString(),
      mode: 'live',
      metadata: workerData.metadata,
    });

    if (!outputParseResult.success) {
      console.error('[ManuscriptIdeation] Output validation failed:', outputParseResult.error);
      throw new Error('Worker returned invalid data');
    }

    const output = outputParseResult.data;

    // Persist stage output
    const stored = storage.get(projectId) || {
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    storage.set(projectId, {
      ...stored,
      output,
      updatedAt: new Date(),
    });

    res.json({
      stageId: 'manuscript_ideation',
      status: 'completed',
      output,
    });

  } catch (error) {
    console.error('[ManuscriptIdeation] Execute error:', error);
    res.status(500).json({ error: 'Failed to execute manuscript ideation' });
  }
});

/**
 * POST /api/ros/stages/manuscript_ideation/select
 * Select a proposal for the project
 */
router.post('/select', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { projectId, selectedProposalId, selectedProposal, selectionReason } = req.body;

    if (!projectId || !selectedProposalId || !selectedProposal) {
      return res.status(400).json({
        error: 'projectId, selectedProposalId, and selectedProposal are required'
      });
    }

    // Validate selection
    const selectionData = {
      projectId,
      selectedProposalId,
      selectedProposal,
      selectionReason,
      selectedAt: new Date().toISOString(),
    };

    const parseResult = ProposalSelectionSchema.safeParse(selectionData);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid selection data',
        details: parseResult.error.flatten(),
      });
    }

    // Update stored data with selection
    const stored = storage.get(projectId);
    if (!stored) {
      return res.status(404).json({ error: 'Project not found - please generate proposals first' });
    }

    storage.set(projectId, {
      ...stored,
      selectedProposal,
      selectedProposalId,
      updatedAt: new Date(),
    });

    res.json({
      status: 'success',
      message: 'Proposal selected successfully',
      selection: selectionData,
    });

  } catch (error) {
    console.error('[ManuscriptIdeation] Select error:', error);
    res.status(500).json({ error: 'Failed to select proposal' });
  }
});

/**
 * GET /api/ros/stages/manuscript_ideation/output/:projectId
 * Get the current ideation output for a project
 */
router.get('/output/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const stored = storage.get(projectId);

    if (!stored) {
      return res.json({
        status: 'not_started',
        output: null,
        selectedProposal: null,
      });
    }

    res.json({
      status: 'completed',
      output: stored.output,
      selectedProposal: stored.selectedProposal || null,
      selectedProposalId: stored.selectedProposalId || null,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    });

  } catch (error) {
    console.error('[ManuscriptIdeation] Get output error:', error);
    res.status(500).json({ error: 'Failed to get ideation output' });
  }
});

export default router;
