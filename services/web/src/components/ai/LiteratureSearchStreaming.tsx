/**
 * LiteratureSearchStreaming Component
 *
 * Example component demonstrating streaming integration for literature search.
 * Shows real-time progress as databases are queried and results are ranked.
 */

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAIStreaming } from '@/hooks/useAIStreaming';
import { Loader2, Search, X, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';

interface LiteratureSearchStreamingProps {
  query: string;
  databases?: string[];
  maxResults?: number;
  onComplete?: (results: unknown) => void;
}

export function LiteratureSearchStreaming({
  query,
  databases = ['PubMed', 'Embase', 'Cochrane'],
  maxResults = 100,
  onComplete,
}: LiteratureSearchStreamingProps) {
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

  const handleStartSearch = async () => {
    await startStream(
      'literature_search',
      {
        query,
        databases,
        maxResults,
      },
      {
        stageId: 2,
        stageName: 'Literature Search',
        streamTokens: false,
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
            <h3 className="font-semibold">Literature Search Failed</h3>
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
    const resultData = result as { totalResults?: number };
    return (
      <Card className="p-6 bg-success/5 border-success/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              <h3 className="font-semibold">Literature Search Complete</h3>
            </div>
            <Button onClick={handleReset} variant="outline" size="sm">
              Done
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Found {resultData.totalResults || 0} results across {databases.length} databases
            </p>
            <div className="flex gap-2">
              {databases.map((db) => (
                <Badge key={db} variant="outline" className="text-xs">
                  {db}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Render streaming state
  if (isStreaming) {
    const currentDatabase = getCurrentDatabase(status, databases);
    const completedDatabases = getCompletedDatabases(progress, databases);

    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <h3 className="font-semibold">Searching Literature</h3>
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

          {/* Database search progress */}
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground font-medium">Databases:</p>
            <div className="grid grid-cols-3 gap-2">
              {databases.map((db) => {
                const isComplete = completedDatabases.includes(db);
                const isCurrent = currentDatabase === db;

                return (
                  <div
                    key={db}
                    className={`flex items-center gap-2 p-2 rounded border text-sm ${
                      isComplete
                        ? 'bg-success/10 border-success/30 text-success'
                        : isCurrent
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted/30 border-muted text-muted-foreground'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    ) : (
                      <BookOpen className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{db}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Query display */}
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs text-muted-foreground font-medium">Search Query:</p>
            <p className="text-sm bg-muted/30 p-2 rounded font-mono">{query}</p>
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
          <Search className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI-Powered Literature Search</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Search {databases.length} literature databases for relevant publications. The AI will
          rank results by relevance to your research question.
        </p>
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Search Query:</p>
            <p className="text-sm bg-muted/30 p-2 rounded border">{query}</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Databases:</span>
            {databases.map((db) => (
              <Badge key={db} variant="outline" className="text-xs">
                {db}
              </Badge>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Max results: {maxResults}
          </div>
        </div>
        <Button onClick={handleStartSearch} className="w-full">
          <Search className="h-4 w-4 mr-2" />
          Start Literature Search
        </Button>
      </div>
    </Card>
  );
}

/**
 * Extract current database being searched from status message
 */
function getCurrentDatabase(status: string, databases: string[]): string | null {
  for (const db of databases) {
    if (status.toLowerCase().includes(db.toLowerCase())) {
      return db;
    }
  }
  return null;
}

/**
 * Get list of completed databases based on progress
 */
function getCompletedDatabases(progress: number, databases: string[]): string[] {
  const completionThreshold = 80; // 80% of search phase is database queries
  const databaseProgress = (progress / 100) * completionThreshold;
  const progressPerDatabase = completionThreshold / databases.length;
  const completedCount = Math.floor(databaseProgress / progressPerDatabase);
  return databases.slice(0, completedCount);
}
