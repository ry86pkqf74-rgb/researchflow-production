/**
 * PWA Update Banner
 * Task 161: Shows update notification when new version available
 */

import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function PWAUpdateBanner() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const handleNeedRefresh = () => setNeedsRefresh(true);
    const handleOfflineReady = () => {
      setOfflineReady(true);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setOfflineReady(false), 3000);
    };

    window.addEventListener('pwa:need-refresh', handleNeedRefresh);
    window.addEventListener('pwa:offline-ready', handleOfflineReady);

    return () => {
      window.removeEventListener('pwa:need-refresh', handleNeedRefresh);
      window.removeEventListener('pwa:offline-ready', handleOfflineReady);
    };
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (needsRefresh) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-primary text-primary-foreground p-4 rounded-lg shadow-lg flex items-center gap-3">
        <RefreshCw className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Update available</p>
          <p className="text-sm opacity-90">A new version is ready.</p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1 bg-primary-foreground text-primary rounded text-sm font-medium hover:opacity-90"
        >
          Update
        </button>
        <button
          onClick={() => setNeedsRefresh(false)}
          className="p-1 hover:opacity-70"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-green-600 text-white p-4 rounded-lg shadow-lg flex items-center gap-3">
        <div className="flex-1">
          <p className="font-medium">Ready for offline use</p>
          <p className="text-sm opacity-90">Content cached for offline access.</p>
        </div>
        <button
          onClick={() => setOfflineReady(false)}
          className="p-1 hover:opacity-70"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
