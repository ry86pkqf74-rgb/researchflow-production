/**
 * ManuscriptDraftStreaming Component
 *
 * Example component demonstrating streaming integration for manuscript drafting.
 * Shows real-time progress, status updates, and token-by-token text generation.
 */

import { Button } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAIStreaming } from '@/hooks/useAIStreaming';
import { Loader2, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface ManuscriptDraftStreamingProps {
  researchId: string;
  style?: 'IMRAD' | 'narrative' | 'structured';
  onComplete?: (manuscript: unknown) => void;
}

export function ManuscriptDraftStreaming({
  researchId,
  style = 'IMRAD',
  onComplete,
}: ManuscriptDraftStreamingProps) {
  const {
    isStreaming,
    status,
    progress,
    tokens,
    result,
    error,
    startStream,
    cancelStream,
    reset,
  } = useAIStreaming();

  const handleStartDraft = async () => {
    await startStream(
      'manuscript_draft',
      {
        researchId,
        style,
      },
      {
        stageId: 14,
        stageName: 'Manuscript Drafting',
        streamTokens: true,
      }
    );
  };

  const handleCancel = () => {
    cancelStream();
  };

  const handleReset = () => {
    reset();
    if (onComplete && result) {
      onComplete(result);
    }
  };

  // Render different states
  if (error) {
    return (
      <div className="space-y-4 p-6 border rounded-lg bg-destructive/5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Manuscript Drafting Failed</h3>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={reset} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (result && !isStreaming) {
    return (
      <div className="space-y-4 p-6 border rounded-lg bg-success/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <h3 className="font-semibold">Manuscript Draft Complete</h3>
          </div>
          <Button onClick={handleReset} variant="outline" size="sm">
            Done
          </Button>
        </div>
        <div className="space-y-2">
          <Badge variant="outline" className="text-xs">
            {tokens.length} tokens generated
          </Badge>
          <div className="prose prose-sm max-w-none p-4 bg-background rounded border">
            {tokens.join('')}
          </div>
        </div>
      </div>
    );
  }

  if (isStreaming) {
    return (
      <div className="space-y-4 p-6 border rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <h3 className="font-semibold">Generating Manuscript Draft</h3>
          </div>
          <Button onClick={handleCancel} variant="ghost" size="sm">
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{status}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        {/* Real-time text generation */}
        {tokens.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Draft Preview</span>
              <Badge variant="outline" className="text-xs">
                {tokens.length} tokens
              </Badge>
            </div>
            <div className="prose prose-sm max-w-none p-4 bg-muted/30 rounded border max-h-96 overflow-y-auto">
              {tokens.join('')}
              <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-1" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Initial state - ready to start
  return (
    <div className="space-y-4 p-6 border rounded-lg">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">AI-Powered Manuscript Drafting</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Generate a complete manuscript draft using {style} structure. The AI will analyze your
        research data and create introduction, methods, results, and discussion sections.
      </p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            Research ID: {researchId}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Style: {style}
          </Badge>
        </div>
      </div>
      <Button onClick={handleStartDraft} className="w-full">
        <FileText className="h-4 w-4 mr-2" />
        Start Manuscript Drafting
      </Button>
    </div>
  );
}
