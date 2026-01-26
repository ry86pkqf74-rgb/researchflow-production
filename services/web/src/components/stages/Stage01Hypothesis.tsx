/**
 * Stage 01 - Hypothesis Generation
 * Task 41 - Implement Stage 01 UI
 * AI-assisted hypothesis generation and refinement
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  Lightbulb,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  RefreshCcw,
  ThumbsUp,
  ThumbsDown,
  Copy,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ModelTierSelect, type ModelTier } from '@/components/ai';

// Hypothesis types
export interface Hypothesis {
  id: string;
  statement: string;
  type: 'primary' | 'secondary' | 'exploratory';
  status: 'draft' | 'refined' | 'approved' | 'rejected';
  aiGenerated: boolean;
  refinements: string[];
  feedback?: 'positive' | 'negative';
  createdAt: Date;
  updatedAt: Date;
}

interface Stage01Props {
  hypotheses: Hypothesis[];
  onHypothesesChange: (hypotheses: Hypothesis[]) => void;
  researchContext?: string;
  onContextChange?: (context: string) => void;
  modelTier: ModelTier;
  onModelTierChange: (tier: ModelTier) => void;
  onGenerate?: (context: string) => Promise<Hypothesis[]>;
  onRefine?: (hypothesis: Hypothesis) => Promise<string>;
  isGenerating?: boolean;
  className?: string;
}

export function Stage01Hypothesis({
  hypotheses,
  onHypothesesChange,
  researchContext = '',
  onContextChange,
  modelTier,
  onModelTierChange,
  onGenerate,
  onRefine,
  isGenerating = false,
  className,
}: Stage01Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [localContext, setLocalContext] = useState(researchContext);

  // Add new hypothesis
  const addHypothesis = useCallback(() => {
    const newHypothesis: Hypothesis = {
      id: crypto.randomUUID(),
      statement: '',
      type: 'primary',
      status: 'draft',
      aiGenerated: false,
      refinements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    onHypothesesChange([...hypotheses, newHypothesis]);
    setEditingId(newHypothesis.id);
    setEditText('');
  }, [hypotheses, onHypothesesChange]);

  // Update hypothesis
  const updateHypothesis = useCallback(
    (id: string, updates: Partial<Hypothesis>) => {
      onHypothesesChange(
        hypotheses.map((h) =>
          h.id === id ? { ...h, ...updates, updatedAt: new Date() } : h
        )
      );
    },
    [hypotheses, onHypothesesChange]
  );

  // Delete hypothesis
  const deleteHypothesis = useCallback(
    (id: string) => {
      onHypothesesChange(hypotheses.filter((h) => h.id !== id));
    },
    [hypotheses, onHypothesesChange]
  );

  // Save edit
  const saveEdit = useCallback(() => {
    if (editingId && editText.trim()) {
      updateHypothesis(editingId, { statement: editText.trim() });
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, updateHypothesis]);

  // Cancel edit
  const cancelEdit = useCallback(() => {
    const hypothesis = hypotheses.find((h) => h.id === editingId);
    // Remove if empty (new hypothesis that wasn't filled in)
    if (hypothesis && !hypothesis.statement) {
      deleteHypothesis(editingId!);
    }
    setEditingId(null);
    setEditText('');
  }, [editingId, hypotheses, deleteHypothesis]);

  // Start editing
  const startEdit = useCallback((hypothesis: Hypothesis) => {
    setEditingId(hypothesis.id);
    setEditText(hypothesis.statement);
  }, []);

  // Generate hypotheses using AI
  const handleGenerate = useCallback(async () => {
    if (!onGenerate) return;
    const generated = await onGenerate(localContext);
    onHypothesesChange([...hypotheses, ...generated]);
  }, [onGenerate, localContext, hypotheses, onHypothesesChange]);

  // Refine hypothesis
  const handleRefine = useCallback(
    async (hypothesis: Hypothesis) => {
      if (!onRefine) return;
      const refinement = await onRefine(hypothesis);
      updateHypothesis(hypothesis.id, {
        refinements: [...hypothesis.refinements, refinement],
        status: 'refined',
      });
    },
    [onRefine, updateHypothesis]
  );

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const primaryHypotheses = hypotheses.filter((h) => h.type === 'primary');
  const secondaryHypotheses = hypotheses.filter((h) => h.type === 'secondary');
  const exploratoryHypotheses = hypotheses.filter((h) => h.type === 'exploratory');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Research Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Research Context
          </CardTitle>
          <CardDescription>
            Describe your research area, existing knowledge, and what you want to explore
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter your research context, background information, and areas of interest..."
            value={localContext}
            onChange={(e) => {
              setLocalContext(e.target.value);
              onContextChange?.(e.target.value);
            }}
            rows={4}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Label className="text-xs mb-1">AI Model</Label>
                <ModelTierSelect
                  value={modelTier}
                  onChange={onModelTierChange}
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !localContext.trim()}
            >
              {isGenerating ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Hypotheses
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hypotheses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hypotheses</h2>
          <Button variant="outline" size="sm" onClick={addHypothesis}>
            <Plus className="mr-2 h-4 w-4" />
            Add Hypothesis
          </Button>
        </div>

        {/* Primary Hypotheses */}
        {primaryHypotheses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Primary Hypotheses
            </h3>
            <div className="space-y-2">
              {primaryHypotheses.map((hypothesis) => (
                <HypothesisCard
                  key={hypothesis.id}
                  hypothesis={hypothesis}
                  isEditing={editingId === hypothesis.id}
                  editText={editText}
                  onEditTextChange={setEditText}
                  onStartEdit={() => startEdit(hypothesis)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onDelete={() => deleteHypothesis(hypothesis.id)}
                  onRefine={() => handleRefine(hypothesis)}
                  onTypeChange={(type) => updateHypothesis(hypothesis.id, { type })}
                  onStatusChange={(status) => updateHypothesis(hypothesis.id, { status })}
                  onFeedback={(feedback) => updateHypothesis(hypothesis.id, { feedback })}
                  onCopy={() => copyToClipboard(hypothesis.statement)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Secondary Hypotheses */}
        {secondaryHypotheses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Secondary Hypotheses
            </h3>
            <div className="space-y-2">
              {secondaryHypotheses.map((hypothesis) => (
                <HypothesisCard
                  key={hypothesis.id}
                  hypothesis={hypothesis}
                  isEditing={editingId === hypothesis.id}
                  editText={editText}
                  onEditTextChange={setEditText}
                  onStartEdit={() => startEdit(hypothesis)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onDelete={() => deleteHypothesis(hypothesis.id)}
                  onRefine={() => handleRefine(hypothesis)}
                  onTypeChange={(type) => updateHypothesis(hypothesis.id, { type })}
                  onStatusChange={(status) => updateHypothesis(hypothesis.id, { status })}
                  onFeedback={(feedback) => updateHypothesis(hypothesis.id, { feedback })}
                  onCopy={() => copyToClipboard(hypothesis.statement)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Exploratory Hypotheses */}
        {exploratoryHypotheses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Exploratory Hypotheses
            </h3>
            <div className="space-y-2">
              {exploratoryHypotheses.map((hypothesis) => (
                <HypothesisCard
                  key={hypothesis.id}
                  hypothesis={hypothesis}
                  isEditing={editingId === hypothesis.id}
                  editText={editText}
                  onEditTextChange={setEditText}
                  onStartEdit={() => startEdit(hypothesis)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onDelete={() => deleteHypothesis(hypothesis.id)}
                  onRefine={() => handleRefine(hypothesis)}
                  onTypeChange={(type) => updateHypothesis(hypothesis.id, { type })}
                  onStatusChange={(status) => updateHypothesis(hypothesis.id, { status })}
                  onFeedback={(feedback) => updateHypothesis(hypothesis.id, { feedback })}
                  onCopy={() => copyToClipboard(hypothesis.statement)}
                />
              ))}
            </div>
          </div>
        )}

        {hypotheses.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No hypotheses yet. Add one manually or generate using AI.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Hypothesis Card Component
interface HypothesisCardProps {
  hypothesis: Hypothesis;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onRefine: () => void;
  onTypeChange: (type: Hypothesis['type']) => void;
  onStatusChange: (status: Hypothesis['status']) => void;
  onFeedback: (feedback: 'positive' | 'negative') => void;
  onCopy: () => void;
}

function HypothesisCard({
  hypothesis,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onRefine,
  onTypeChange,
  onStatusChange,
  onFeedback,
  onCopy,
}: HypothesisCardProps) {
  const statusColors: Record<Hypothesis['status'], string> = {
    draft: 'bg-gray-100 text-gray-700',
    refined: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <Card className={cn(hypothesis.status === 'rejected' && 'opacity-60')}>
      <CardContent className="pt-4">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              placeholder="Enter your hypothesis statement..."
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={onSaveEdit}>
                <Check className="mr-1 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm flex-1">{hypothesis.statement || 'Empty hypothesis'}</p>
              <div className="flex items-center gap-1">
                {hypothesis.aiGenerated && (
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI
                  </Badge>
                )}
                <Badge className={cn('text-xs', statusColors[hypothesis.status])}>
                  {hypothesis.status}
                </Badge>
              </div>
            </div>

            {hypothesis.refinements.length > 0 && (
              <div className="pl-4 border-l-2 border-muted space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Refinements:</p>
                {hypothesis.refinements.map((refinement, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    • {refinement}
                  </p>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select
                  value={hypothesis.type}
                  onValueChange={(v) => onTypeChange(v as Hypothesis['type'])}
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="secondary">Secondary</SelectItem>
                    <SelectItem value="exploratory">Exploratory</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={hypothesis.status}
                  onValueChange={(v) => onStatusChange(v as Hypothesis['status'])}
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="refined">Refined</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onFeedback('positive')}
                >
                  <ThumbsUp
                    className={cn(
                      'h-4 w-4',
                      hypothesis.feedback === 'positive' && 'fill-green-500 text-green-500'
                    )}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onFeedback('negative')}
                >
                  <ThumbsDown
                    className={cn(
                      'h-4 w-4',
                      hypothesis.feedback === 'negative' && 'fill-red-500 text-red-500'
                    )}
                  />
                </Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefine}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStartEdit}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Stage01Hypothesis;
