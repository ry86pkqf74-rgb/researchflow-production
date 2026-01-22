/**
 * StatisticalAnalysisStreaming Component
 *
 * Example component demonstrating streaming integration for statistical analysis.
 * Shows real-time progress as analysis steps execute.
 */

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAIStreaming } from '@/hooks/useAIStreaming';
import { Loader2, BarChart3, X, CheckCircle, AlertCircle } from 'lucide-react';

interface StatisticalAnalysisStreamingProps {
  datasetId: string;
  analysisType?: 'descriptive' | 'regression' | 'comparative';
  onComplete?: (results: unknown) => void;
}

export function StatisticalAnalysisStreaming({
  datasetId,
  analysisType = 'descriptive',
  onComplete,
}: StatisticalAnalysisStreamingProps) {
  const {
    isStreaming,
    status,
    progress,
    result,
    error,
    startStream,
    cancelStream,
    reset,
  } = useAIStreaming();

  const handleStartAnalysis = async () => {
    await startStream(
      'statistical_analysis',
      {
        datasetId,
        analysisType,
      },
      {
        stageId: 13,
        stageName: 'Statistical Analysis',
        streamTokens: false, // Analysis doesn't need token streaming
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
            <h3 className="font-semibold">Statistical Analysis Failed</h3>
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
              <h3 className="font-semibold">Statistical Analysis Complete</h3>
            </div>
            <Button onClick={handleReset} variant="outline" size="sm">
              Done
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Analysis completed successfully. Results are ready for review.
            </p>
            {/* Add result visualization here */}
          </div>
        </div>
      </Card>
    );
  }

  // Render streaming state
  if (isStreaming) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <h3 className="font-semibold">Running Statistical Analysis</h3>
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

          {/* Analysis steps checklist */}
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground font-medium">Analysis Steps:</p>
            <div className="space-y-1">
              {getAnalysisSteps(analysisType).map((step, index) => {
                const stepProgress = (index / getAnalysisSteps(analysisType).length) * 100;
                const isComplete = progress > stepProgress;
                const isCurrent = progress >= stepProgress && progress < stepProgress + (100 / getAnalysisSteps(analysisType).length);

                return (
                  <div
                    key={index}
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
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Initial state - ready to start
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI-Powered Statistical Analysis</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Run comprehensive {analysisType} analysis on your dataset. The AI will compute statistics,
          run tests, and generate visualizations.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              Dataset: {datasetId}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Type: {analysisType}
            </Badge>
          </div>
        </div>
        <Button onClick={handleStartAnalysis} className="w-full">
          <BarChart3 className="h-4 w-4 mr-2" />
          Start Statistical Analysis
        </Button>
      </div>
    </Card>
  );
}

/**
 * Get analysis steps based on type
 */
function getAnalysisSteps(type: string): string[] {
  switch (type) {
    case 'descriptive':
      return [
        'Loading dataset',
        'Computing summary statistics',
        'Generating distributions',
        'Creating visualizations',
      ];
    case 'regression':
      return [
        'Loading dataset',
        'Fitting regression model',
        'Computing coefficients',
        'Running diagnostics',
        'Generating plots',
      ];
    case 'comparative':
      return [
        'Loading dataset',
        'Computing group statistics',
        'Running comparison tests',
        'Calculating effect sizes',
        'Creating comparison plots',
      ];
    default:
      return ['Processing data', 'Running analysis', 'Generating results'];
  }
}
