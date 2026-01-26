/**
 * Community Page (Task 88)
 *
 * Embeds the community forum for discussions and support.
 * Uses an iframe to embed the external forum platform.
 */

import { useState } from 'react';
import { MessageSquare, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const FORUM_URL = import.meta.env.VITE_FORUM_URL || 'https://community.researchflow.io';
const FEATURE_COMMUNITY = import.meta.env.VITE_FEATURE_COMMUNITY !== 'false';

export function Community() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(false);
  };

  if (!FEATURE_COMMUNITY) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Community Coming Soon</h3>
              <p className="text-muted-foreground mt-2">
                The community forum is currently being set up. Check back soon!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Community</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={FORUM_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Loading community forum...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background p-6">
              <Alert variant="destructive" className="max-w-md">
                <AlertDescription>
                  <p>Unable to load the community forum.</p>
                  <Button variant="outline" className="mt-4" onClick={handleRefresh}>
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <iframe
            key={loading ? 'loading' : 'loaded'}
            src={FORUM_URL}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
            title="ResearchFlow Community Forum"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
}

export default Community;
