/**
 * ManuscriptIdeationPanel - Reusable component for manuscript ideation
 *
 * Used in:
 * - Landing page (demo mode) - /api/demo/generate-proposals
 * - Workflow stage (live mode) - /api/ros/stages/manuscript_ideation/execute
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, Loader2, Star, Building2, ChevronDown, ChevronUp,
  Lightbulb, Target, FlaskConical, Check, RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ManuscriptIdeationInput, ManuscriptProposal } from '@packages/core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ManuscriptIdeationPanelProps {
  /** Mode determines API endpoint and behavior */
  mode: 'demo' | 'live';

  /** Initial form values */
  initialInputs?: Partial<ManuscriptIdeationInput>;

  /** Project ID (required for live mode) */
  projectId?: string;

  /** Callback when generate is clicked */
  onGenerate: (inputs: ManuscriptIdeationInput) => Promise<ManuscriptProposal[]>;

  /** Callback when a proposal is selected (live mode only) */
  onSelectProposal?: (proposal: ManuscriptProposal) => Promise<void>;

  /** Callback when refine is clicked */
  onRefine?: (proposal: ManuscriptProposal, notes: string) => Promise<ManuscriptProposal[]>;

  /** Previously selected proposal (for display) */
  selectedProposal?: ManuscriptProposal | null;

  /** Custom class name */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RESEARCH_DOMAINS = [
  'Cardiology',
  'Oncology',
  'Neurology',
  'Endocrinology',
  'Pulmonology',
  'Rheumatology',
  'Nephrology',
  'Gastroenterology',
  'Infectious Disease',
  'Pediatrics',
  'General Medicine',
  'Epidemiology',
  'Public Health',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ManuscriptIdeationPanel({
  mode,
  initialInputs = {},
  projectId,
  onGenerate,
  onSelectProposal,
  onRefine,
  selectedProposal,
  className,
}: ManuscriptIdeationPanelProps) {
  // Form state
  const [topic, setTopic] = useState(initialInputs.researchTopic || '');
  const [domain, setDomain] = useState(initialInputs.researchDomain || '');
  const [population, setPopulation] = useState(initialInputs.targetPopulation || '');
  const [outcome, setOutcome] = useState(initialInputs.primaryOutcome || '');
  const [refinementNotes, setRefinementNotes] = useState('');

  // UI state
  const [proposals, setProposals] = useState<ManuscriptProposal[]>([]);
  const [expandedProposalId, setExpandedProposalId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRefineInput, setShowRefineInput] = useState<number | null>(null);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const inputs: ManuscriptIdeationInput = {
        researchTopic: topic,
        researchDomain: domain || undefined,
        targetPopulation: population || undefined,
        primaryOutcome: outcome || undefined,
      };

      const result = await onGenerate(inputs);
      setProposals(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposals');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectProposal = async (proposal: ManuscriptProposal) => {
    if (mode === 'demo' || !onSelectProposal) return;

    setIsSelecting(true);
    try {
      await onSelectProposal(proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select proposal');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleRefine = async (proposal: ManuscriptProposal) => {
    if (!onRefine || !refinementNotes.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await onRefine(proposal, refinementNotes);
      setProposals(result);
      setRefinementNotes('');
      setShowRefineInput(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine proposal');
    } finally {
      setIsGenerating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 80) return 'bg-blue-100';
    if (score >= 70) return 'bg-amber-100';
    return 'bg-red-100';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`grid lg:grid-cols-5 gap-8 ${className}`}>
      {/* LEFT COLUMN - Input Form */}
      <div className="lg:col-span-2">
        <Card className="p-6 sticky top-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Define Your Research</h3>
              {mode === 'demo' && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                  Demo Mode
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Research Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic">Research Topic *</Label>
              <Textarea
                id="topic"
                placeholder="e.g., Impact of GLP-1 receptor agonists on cardiovascular outcomes in Type 2 Diabetes"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Research Domain */}
            <div className="space-y-2">
              <Label htmlFor="domain">Research Domain</Label>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a domain" />
                </SelectTrigger>
                <SelectContent>
                  {RESEARCH_DOMAINS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Population */}
            <div className="space-y-2">
              <Label htmlFor="population">Target Population</Label>
              <Input
                id="population"
                placeholder="e.g., Adults 40-75 with established cardiovascular disease"
                value={population}
                onChange={(e) => setPopulation(e.target.value)}
              />
            </div>

            {/* Primary Outcome */}
            <div className="space-y-2">
              <Label htmlFor="outcome">Primary Outcome</Label>
              <Input
                id="outcome"
                placeholder="e.g., Major adverse cardiovascular events (MACE)"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!topic.trim() || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Ideas...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Manuscript Ideas
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN - Results */}
      <div className="lg:col-span-3">
        {/* Empty State */}
        {proposals.length === 0 && !isGenerating && (
          <Card className="p-12 text-center border-dashed">
            <FlaskConical className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Enter your research topic on the left and click generate to see AI-powered manuscript proposals.
            </p>
          </Card>
        )}

        {/* Loading State */}
        {isGenerating && proposals.length === 0 && (
          <Card className="p-12 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-4"
            >
              <Sparkles className="h-16 w-16 text-blue-600" />
            </motion.div>
            <h3 className="text-lg font-medium mb-2">Analyzing Your Topic...</h3>
            <p className="text-muted-foreground">
              Generating tailored manuscript proposals based on your research criteria.
            </p>
          </Card>
        )}

        {/* Proposals List */}
        {proposals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Generated Proposals</h3>
                <p className="text-sm text-muted-foreground">
                  {proposals.length} manuscript ideas for "{topic}"
                </p>
              </div>
              <Badge className={mode === 'live' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                {mode === 'live' ? 'Live Mode' : 'Demo Mode'}
              </Badge>
            </div>

            <AnimatePresence mode="popLayout">
              {proposals.map((proposal, index) => (
                <motion.div
                  key={proposal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className={`p-5 cursor-pointer transition-all ${
                      expandedProposalId === proposal.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                    } ${selectedProposal?.id === proposal.id ? 'border-green-500 bg-green-50/50' : ''}`}
                    onClick={() => setExpandedProposalId(
                      expandedProposalId === proposal.id ? null : proposal.id
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            Proposal #{proposal.id}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Star className={`h-3 w-3 ${getScoreColor(proposal.relevanceScore)}`} />
                            <span className={`text-xs font-medium ${getScoreColor(proposal.relevanceScore)}`}>
                              {proposal.relevanceScore}% relevant
                            </span>
                          </div>
                          {selectedProposal?.id === proposal.id && (
                            <Badge className="bg-green-600 text-white text-xs">
                              <Check className="h-3 w-3 mr-1" /> Selected
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold mb-2">{proposal.title}</h4>
                        <p className={`text-sm text-muted-foreground ${
                          expandedProposalId === proposal.id ? '' : 'line-clamp-2'
                        }`}>
                          {proposal.abstract}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {expandedProposalId === proposal.id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {expandedProposalId === proposal.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-4 pt-4 border-t"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Scores */}
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className={`p-3 rounded-lg ${getScoreBgColor(proposal.relevanceScore)}`}>
                              <div className="text-xs text-muted-foreground mb-1">Relevance</div>
                              <div className={`text-2xl font-bold ${getScoreColor(proposal.relevanceScore)}`}>
                                {proposal.relevanceScore}%
                              </div>
                            </div>
                            <div className={`p-3 rounded-lg ${getScoreBgColor(proposal.noveltyScore)}`}>
                              <div className="text-xs text-muted-foreground mb-1">Novelty</div>
                              <div className={`text-2xl font-bold ${getScoreColor(proposal.noveltyScore)}`}>
                                {proposal.noveltyScore}%
                              </div>
                            </div>
                            <div className={`p-3 rounded-lg ${getScoreBgColor(proposal.feasibilityScore)}`}>
                              <div className="text-xs text-muted-foreground mb-1">Feasibility</div>
                              <div className={`text-2xl font-bold ${getScoreColor(proposal.feasibilityScore)}`}>
                                {proposal.feasibilityScore}%
                              </div>
                            </div>
                          </div>

                          {/* Methodology */}
                          <div className="mb-4">
                            <h5 className="text-sm font-medium mb-1 flex items-center gap-2">
                              <Target className="h-4 w-4" /> Methodology
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              {proposal.methodology}
                            </p>
                          </div>

                          {/* Expected Outcome */}
                          <div className="mb-4">
                            <h5 className="text-sm font-medium mb-1">Expected Outcome</h5>
                            <p className="text-sm text-muted-foreground">
                              {proposal.expectedOutcome}
                            </p>
                          </div>

                          {/* Journals */}
                          {proposal.suggestedJournals.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Building2 className="h-4 w-4" /> Target Journals
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {proposal.suggestedJournals.map((journal, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {journal}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Keywords */}
                          {proposal.keywords.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium mb-2">Keywords</h5>
                              <div className="flex flex-wrap gap-2">
                                {proposal.keywords.map((keyword, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Refine Input (shown when "Refine Further" is clicked) */}
                          {showRefineInput === proposal.id && (
                            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                              <Label htmlFor={`refine-${proposal.id}`} className="text-sm font-medium">
                                Refinement Notes
                              </Label>
                              <Textarea
                                id={`refine-${proposal.id}`}
                                placeholder="e.g., Focus more on cost-effectiveness, consider Medicare population..."
                                value={refinementNotes}
                                onChange={(e) => setRefinementNotes(e.target.value)}
                                className="mt-2 min-h-[60px]"
                              />
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleRefine(proposal)}
                                  disabled={!refinementNotes.trim() || isGenerating}
                                >
                                  {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply Refinement'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShowRefineInput(null);
                                    setRefinementNotes('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            {mode === 'live' && onSelectProposal && (
                              <Button
                                onClick={() => handleSelectProposal(proposal)}
                                disabled={isSelecting || selectedProposal?.id === proposal.id}
                                className={selectedProposal?.id === proposal.id ? 'bg-green-600' : ''}
                              >
                                {isSelecting ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : selectedProposal?.id === proposal.id ? (
                                  <Check className="h-4 w-4 mr-2" />
                                ) : null}
                                {selectedProposal?.id === proposal.id ? 'Selected' : 'Select This Proposal'}
                              </Button>
                            )}
                            {onRefine && showRefineInput !== proposal.id && (
                              <Button
                                variant="outline"
                                onClick={() => setShowRefineInput(proposal.id)}
                              >
                                <RefreshCcw className="h-4 w-4 mr-2" />
                                Refine Further
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManuscriptIdeationPanel;
