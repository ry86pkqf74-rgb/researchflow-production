/**
 * Power BI Embed Component
 * Task 191: Power BI embed
 */

import { useState, useEffect, useRef } from 'react';
import { BarChart3, ExternalLink, AlertTriangle, Settings } from 'lucide-react';

interface PowerBIEmbedProps {
  reportId?: string;
  workspaceId?: string;
  embedUrl?: string;
  accessToken?: string;
  height?: string | number;
  width?: string | number;
  className?: string;
}

// Environment-based config (never hardcode tokens)
const POWERBI_EMBED_URL = import.meta.env.VITE_POWERBI_EMBED_URL;
const POWERBI_WORKSPACE_ID = import.meta.env.VITE_POWERBI_WORKSPACE_ID;

export function PowerBIEmbed({
  reportId,
  workspaceId = POWERBI_WORKSPACE_ID,
  embedUrl = POWERBI_EMBED_URL,
  accessToken,
  height = 600,
  width = '100%',
  className = '',
}: PowerBIEmbedProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(accessToken || null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch embed token from backend if not provided
  useEffect(() => {
    if (accessToken) {
      setToken(accessToken);
      return;
    }

    if (!embedUrl) {
      setLoading(false);
      return;
    }

    async function fetchEmbedToken() {
      try {
        const response = await fetch('/api/integrations/powerbi/embed-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, workspaceId }),
        });

        if (!response.ok) {
          throw new Error('Failed to get embed token');
        }

        const data = await response.json();
        setToken(data.token);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEmbedToken();
  }, [accessToken, reportId, workspaceId, embedUrl]);

  // Not configured
  if (!embedUrl && !reportId) {
    return (
      <div className={`bg-card border rounded-lg p-8 text-center ${className}`}>
        <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Power BI Integration</h3>
        <p className="text-muted-foreground mb-4">
          Power BI embed is not configured. Contact your administrator to set up the integration.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Settings className="w-4 h-4" />
          <span>Configure in Environment Settings</span>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div
        className={`bg-card border rounded-lg flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Power BI report...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div
        className={`bg-card border rounded-lg flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Failed to load report</h3>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Build embed URL with token
  const fullEmbedUrl = token
    ? `${embedUrl}?accessToken=${encodeURIComponent(token)}`
    : embedUrl;

  return (
    <div className={`bg-card border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <span className="font-medium">Power BI Report</span>
        </div>
        {fullEmbedUrl && (
          <a
            href={fullEmbedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Open in Power BI
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Embed */}
      <iframe
        ref={iframeRef}
        src={fullEmbedUrl || ''}
        style={{ height, width, border: 0 }}
        allowFullScreen
        title="Power BI Report"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
