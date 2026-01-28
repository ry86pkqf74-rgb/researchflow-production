import { z } from 'zod';

// ============================================================================
// MANUSCRIPT IDEATION SHARED TYPES
// Used by: Frontend, Orchestrator, Worker
// ============================================================================

/**
 * Input schema for manuscript ideation
 */
export const ManuscriptIdeationInputSchema = z.object({
  researchTopic: z.string().min(10, 'Research topic must be at least 10 characters'),
  researchDomain: z.string().optional(),
  targetPopulation: z.string().optional(),
  primaryOutcome: z.string().optional(),
  refinementNotes: z.string().optional(), // For "Refine further" functionality
  previousProposalId: z.number().optional(), // If refining a specific proposal
});

export type ManuscriptIdeationInput = z.infer<typeof ManuscriptIdeationInputSchema>;

/**
 * Single proposal schema
 */
export const ManuscriptProposalSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  abstract: z.string().min(1),
  relevanceScore: z.number().min(0).max(100),
  noveltyScore: z.number().min(0).max(100),
  feasibilityScore: z.number().min(0).max(100),
  methodology: z.string(),
  expectedOutcome: z.string(),
  suggestedJournals: z.array(z.string()),
  keywords: z.array(z.string()),
});

export type ManuscriptProposal = z.infer<typeof ManuscriptProposalSchema>;

/**
 * Output schema for manuscript ideation
 */
export const ManuscriptIdeationOutputSchema = z.object({
  status: z.enum(['success', 'error']),
  topic: z.string(),
  domain: z.string().optional(),
  proposals: z.array(ManuscriptProposalSchema).min(1).max(10),
  generatedAt: z.string().datetime(),
  mode: z.enum(['demo', 'live']),
  metadata: z.object({
    modelUsed: z.string().optional(),
    tokensUsed: z.number().optional(),
    latencyMs: z.number().optional(),
  }).optional(),
});

export type ManuscriptIdeationOutput = z.infer<typeof ManuscriptIdeationOutputSchema>;

/**
 * Selection schema for persisting chosen proposal
 */
export const ProposalSelectionSchema = z.object({
  projectId: z.string().uuid(),
  selectedProposalId: z.number().int().positive(),
  selectedProposal: ManuscriptProposalSchema,
  selectionReason: z.string().optional(),
  selectedAt: z.string().datetime(),
});

export type ProposalSelection = z.infer<typeof ProposalSelectionSchema>;
