/**
 * Stage 00 - Manuscript Ideation
 *
 * First stage in the workflow pipeline.
 * Uses ManuscriptIdeationPanel in live mode.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ManuscriptIdeationPanel } from '@/components/manuscript-ideation';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle } from 'lucide-react';
import type { ManuscriptIdeationInput, ManuscriptProposal } from '@packages/core/types';

interface Stage00Props {
  projectId: string;
  onStageComplete?: () => void;
  className?: string;
}

export function Stage00ManuscriptIdeation({ projectId, onStageComplete, className }: Stage00Props) {
  const queryClient = useQueryClient();

  // Fetch existing output
  const { data: existingOutput, isLoading: isLoadingOutput } = useQuery({
    queryKey: ['manuscript-ideation', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/ros/stages/manuscript_ideation/output/${projectId}`);
      return response.json();
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (inputs: ManuscriptIdeationInput): Promise<ManuscriptProposal[]> => {
      const response = await apiRequest('POST', '/api/ros/stages/manuscript_ideation/execute', {
        projectId,
        inputs,
      });
      const data = await response.json();
      return data.output.proposals;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manuscript-ideation', projectId] });
    },
  });

  // Select mutation
  const selectMutation = useMutation({
    mutationFn: async (proposal: ManuscriptProposal): Promise<void> => {
      await apiRequest('POST', '/api/ros/stages/manuscript_ideation/select', {
        projectId,
        selectedProposalId: proposal.id,
        selectedProposal: proposal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manuscript-ideation', projectId] });
      onStageComplete?.();
    },
  });

  // Refine mutation
  const refineMutation = useMutation({
    mutationFn: async ({ proposal, notes }: { proposal: ManuscriptProposal; notes: string }): Promise<ManuscriptProposal[]> => {
      const response = await apiRequest('POST', '/api/ros/stages/manuscript_ideation/execute', {
        projectId,
        inputs: {
          researchTopic: existingOutput?.output?.topic || '',
          researchDomain: existingOutput?.output?.domain,
          refinementNotes: notes,
          previousProposalId: proposal.id,
        },
      });
      const data = await response.json();
      return data.output.proposals;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manuscript-ideation', projectId] });
    },
  });

  if (isLoadingOutput) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Stage Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Stage 0: Manuscript Ideation</h2>
        <p className="text-muted-foreground">
          Define your research topic and generate manuscript proposals.
        </p>
      </div>

      {/* Completion Status */}
      {existingOutput?.selectedProposal && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <strong>Stage Complete:</strong> You have selected "{existingOutput.selectedProposal.title}"
          </AlertDescription>
        </Alert>
      )}

      {/* Ideation Panel */}
      <ManuscriptIdeationPanel
        mode="live"
        projectId={projectId}
        initialInputs={existingOutput?.output ? {
          researchTopic: existingOutput.output.topic,
          researchDomain: existingOutput.output.domain,
        } : undefined}
        onGenerate={generateMutation.mutateAsync}
        onSelectProposal={selectMutation.mutateAsync}
        onRefine={(proposal, notes) => refineMutation.mutateAsync({ proposal, notes })}
        selectedProposal={existingOutput?.selectedProposal}
      />
    </div>
  );
}

export default Stage00ManuscriptIdeation;
