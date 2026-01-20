/**
 * Similar Artifacts Component (Task 107: Semantic Search)
 *
 * Displays similar artifacts in artifact detail views using semantic search.
 * Shows similarity percentages and links to related artifacts.
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { Loader2, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SimilarArtifact {
  artifactId: string;
  filename: string;
  artifactType: string;
  similarity: number;
  createdAt: string;
}

interface SimilarArtifactsResponse {
  artifactId: string;
  similar: SimilarArtifact[];
  count: number;
}

interface SimilarArtifactsProps {
  artifactId: string;
  limit?: number;
}

export function SimilarArtifacts({ artifactId, limit = 5 }: SimilarArtifactsProps) {
  const { data, isLoading, error } = useQuery<SimilarArtifactsResponse>({
    queryKey: ['similar-artifacts', artifactId, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/search/similar/${artifactId}?limit=${limit}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch similar artifacts');
      }

      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Similar Artifacts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
              <div className="w-12 h-6 bg-muted rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state - silently fail if feature not available (403) or artifact not indexed (404)
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Don't show error for common cases (feature disabled, not indexed yet)
    if (
      errorMessage.includes('403') ||
      errorMessage.includes('disabled') ||
      errorMessage.includes('404') ||
      errorMessage.includes('not found')
    ) {
      return null;
    }

    // Show error for other cases
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Similar Artifacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no similar artifacts
  if (!data?.similar || data.similar.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Similar Artifacts
          <Badge variant="outline" className="ml-auto">
            {data.count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.similar.map((item) => (
          <Link key={item.artifactId} href={`/artifacts/${item.artifactId}`}>
            <div className="flex items-center justify-between hover:bg-accent p-3 rounded-lg cursor-pointer transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate group-hover:text-primary transition-colors">
                  {item.filename}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {item.artifactType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="ml-3 flex-shrink-0">
                {Math.round(item.similarity * 100)}%
              </Badge>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
