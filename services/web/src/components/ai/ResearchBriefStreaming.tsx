/**
 * ResearchBriefStreaming Component
 *
 * Example component demonstrating streaming integration for research brief generation.
 * Shows real-time progress as brief sections are generated.
 */

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAIStreaming } from '@/hooks/useAIStreaming';
import { Loader2, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

interface ResearchBriefStreamingProps {
  topicDeclarationId: string;
  includeRefinements?: boolean;
  onComplete?: (brief: unknown) => void;
}

export function ResearchBriefStreaming({
  topicDeclarationId,
  includeRefinements = true,
  onComplete,
}: ResearchBriefStreamingProps) {
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

  const handleStartGeneration = async () => {
    await startStream(
      'research_brief',
      {
        topicDeclarationId,
        includeRefinements,
      },
      {
        stageId: 3,
        stageName: 'Research Brief Generation',
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

  // Render error state
  if (error) {
    return (
      <Card className="p-6 bg-destructive/5 border-destructive/20">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-semibold">Research Brief Generation Failed</h3>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={reset} variant="outline">
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // Render success state
  if (result && !isStreaming) {
    return (
      <Card className="p-6 bg-success/5 border-success/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              <h3 className="font-semibold">Research Brief Complete</h3>
            </div>
            <Button onClick={handleReset} variant="outline" size="sm">
              Done
            </Button>
          </div>
          <div className="space-y-2">
            <Badge variant="outline" className="text-xs">
              {tokens.length} tokens generated
            </Badge>
            <div className="prose prose-sm max-w-none p-4 bg-background rounded border max-h-96 overflow-y-auto">
              {tokens.join('')}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Render streaming state
  if (isStreaming) {
    const sections = getBriefSections();
    const currentSection = getCurrentSection(status, sections);

    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <h3 className="font-semibold">Generating Research Brief</h3>
            </div>
            <Button onClick={handleCancel} variant="ghost" size="sm">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>

          {/* Progress bar with status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">{status}</span>
              <span className="text-sm font-semibold">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full h-2" />
          </div>

          {/* Brief sections progress */}
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground font-medium">Brief Sections:</p>
            <div className="space-y-1">
              {sections.map((section, index) => {
                const sectionProgress = (index / sections.length) * 100;
                const isComplete = progress > sectionProgress + (100 / sections.length);
                const isCurrent = currentSection === section;

                return (
                  <div
                    key={section}
                    className={`flex items-center gap-2 text-sm p-2 rounded ${
                      isComplete
                        ? 'text-success bg-success/10'
                        : isCurrent
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2" />
                    )}
                    <span>{section}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time preview */}
          {tokens.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Live Preview</span>
                <Badge variant="outline" className="text-xs">
                  {tokens.length} tokens
                </Badge>
              </div>
              <div className="prose prose-sm max-w-none p-3 bg-muted/30 rounded border max-h-48 overflow-y-auto text-sm">
                {tokens.join('')}
                <span className="inline-block w-1 h-3 bg-primary animate-pulse ml-1" />
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Initial state - ready to start
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI-Powered Research Brief</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate a comprehensive research brief including study objectives, population details,
          candidate endpoints, and refinement suggestions.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              Topic: {topicDeclarationId}
            </Badge>
            {includeRefinements && (
              <Badge variant="outline" className="text-xs">
                With Refinements
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={handleStartGeneration} className="w-full">
          <FileText className="h-4 w-4 mr-2" />
          Generate Research Brief
        </Button>
      </div>
    </Card>
  );
}

/**
 * Get research brief sections
 */
function getBriefSections(): string[] {
  return [
    'Study Objectives',
    'Population & Exposure',
    'Outcomes & Endpoints',
    'Confounders & Variables',
    'Refinement Suggestions',
    'Clarifying Questions',
  ];
}

/**
 * Extract current section from status message
 */
function getCurrentSection(status: string, sections: string[]): string | null {
  const lowerStatus = status.toLowerCase();
  for (const section of sections) {
    if (lowerStatus.includes(section.toLowerCase())) {
      return section;
    }
  }
  return null;
}
