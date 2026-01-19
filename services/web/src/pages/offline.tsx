/**
 * Offline Page
 * Task 161: PWA offline fallback page
 */

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-muted rounded-full">
            <WifiOff className="w-12 h-12 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You're offline</h1>
          <p className="text-muted-foreground">
            You can still view cached dashboards and drafts. Some actions require reconnecting.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <p className="text-sm text-muted-foreground">
            Cached data will be synchronized when you're back online.
          </p>
        </div>

        <div className="pt-4 border-t">
          <h2 className="font-medium mb-2">Available offline:</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• View cached pipeline runs</li>
            <li>• Access saved drafts</li>
            <li>• Review governance status</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
