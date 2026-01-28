/**
 * Governance Console
 *
 * Central dashboard for governance, compliance, and audit management.
 * Only accessible to STEWARD and ADMIN roles.
 *
 * Uses SSE for realtime updates with polling fallback.
 *
 * Priority: P0 - CRITICAL
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Settings,
  Link as LinkIcon,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGovernanceMode, GovernanceMode } from '@/hooks/useGovernanceMode';
import {
  GovernanceModeControl,
  ApprovalLog,
  AuditExport,
  AuditLogViewer,
  DemoWatermark
} from '@/components/governance';
import { useGovernanceStore, type FlagMeta, type ServerGovernanceState } from '@/stores/governance-store';

// Use FlagMeta from store instead of local interface
type FeatureFlag = FlagMeta;

const ALLOWED_OPERATIONS: Record<GovernanceMode, string[]> = {
  OFFLINE: [
    'View documentation',
    'View governance console',
    'View audit logs (read-only)',
    'Configure settings'
  ],
  DEMO: [
    'View data (synthetic only)',
    'Run analyses (synthetic data)',
    'Generate drafts (watermarked)',
    'LLM calls (rate limited)',
    'View all features'
  ],
  LIVE: [
    'Upload data (with approval)',
    'Run full analyses',
    'Generate manuscripts',
    'Export results (with approval)',
    'LLM calls (tracked)',
    'Full feature access'
  ]
};

function FlagsPanel({ flags }: { flags: FeatureFlag[] }) {
  return (
    <Card data-testid="feature-flags-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          Feature Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {flags.map(flag => (
          <div
            key={flag.name}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            data-testid={`flag-${flag.name.toLowerCase()}`}
          >
            <div className="flex-1">
              <div className="font-medium text-sm">{flag.name}</div>
              <div className="text-xs text-muted-foreground">{flag.description}</div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {flag.enabled ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Disabled
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AllowedOperationsTable({ mode }: { mode: GovernanceMode }) {
  const operations = ALLOWED_OPERATIONS[mode];

  return (
    <Card data-testid="allowed-operations">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Allowed Operations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Operations permitted in <span className="font-medium">{mode}</span> mode:
        </p>
        <ul className="space-y-2">
          {operations.map(op => (
            <li key={op} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <span>{op}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function QuickLinks() {
  return (
    <Card data-testid="quick-links">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LinkIcon className="h-5 w-5 text-primary" />
          Quick Links
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" className="w-full justify-start" asChild>
          <a href="/phi-status" data-testid="link-phi-status">PHI Status Dashboard</a>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <a href="/pipeline" data-testid="link-workflow">Research Workflow</a>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <a href="/artifacts" data-testid="link-artifacts">Artifact Vault</a>
        </Button>
      </CardContent>
    </Card>
  );
}

// Default flags for fallback
const DEFAULT_FLAGS: FeatureFlag[] = [
  { name: 'ALLOW_UPLOADS', enabled: true, description: 'Allow dataset uploads to the system' },
  { name: 'ALLOW_EXPORTS', enabled: false, description: 'Allow result exports (requires steward approval)' },
  { name: 'ALLOW_LLM_CALLS', enabled: true, description: 'Allow LLM API calls for draft generation' },
  { name: 'REQUIRE_PHI_SCAN', enabled: true, description: 'Require PHI scanning for all uploaded data' },
];

/**
 * Custom hook for SSE connection with polling fallback
 */
function useGovernanceSSE() {
  const { hydrateFromServer, setSseConnected, sseConnected, flagsMeta } = useGovernanceStore();
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch governance state (used for initial load and polling fallback)
  const fetchGovernanceState = useCallback(async () => {
    try {
      const response = await fetch('/api/governance/state', {
        credentials: 'include'
      });
      if (response.ok) {
        const data: ServerGovernanceState = await response.json();
        hydrateFromServer(data);
      }
    } catch (error) {
      console.error('[GovernanceConsole] Failed to fetch governance state:', error);
    } finally {
      setLoading(false);
    }
  }, [hydrateFromServer]);

  // Start polling fallback (30s interval)
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    console.log('[GovernanceConsole] Starting polling fallback');
    pollingIntervalRef.current = setInterval(fetchGovernanceState, 30000);
  }, [fetchGovernanceState]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Connect to SSE
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/stream?topic=governance');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[GovernanceConsole] SSE connected');
        setSseConnected(true);
        stopPolling(); // Stop polling when SSE connects
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different event types
          if (data.type === 'hello') {
            // Initial state from server
            if (data.state) {
              hydrateFromServer(data.state);
              setLoading(false);
            }
          } else if (data.type === 'governance.mode_changed') {
            // Mode changed event
            hydrateFromServer({
              mode: data.newMode,
              flags: flagsMeta,
              timestamp: new Date().toISOString(),
            });
          } else if (data.type === 'governance.flag_changed') {
            // Flag changed - refetch full state for consistency
            fetchGovernanceState();
          }
        } catch (error) {
          console.error('[GovernanceConsole] SSE parse error:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[GovernanceConsole] SSE error:', error);
        setSseConnected(false);
        eventSource.close();

        // Start polling fallback
        startPolling();

        // Try to reconnect SSE after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[GovernanceConsole] Attempting SSE reconnect...');
          connectSSE();
        }, 5000);
      };
    } catch (error) {
      console.error('[GovernanceConsole] Failed to create EventSource:', error);
      setSseConnected(false);
      startPolling();
    }
  }, [hydrateFromServer, setSseConnected, stopPolling, startPolling, fetchGovernanceState, flagsMeta]);

  // Initialize on mount
  useEffect(() => {
    // Initial fetch
    fetchGovernanceState();

    // Try SSE connection
    connectSSE();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      stopPolling();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchGovernanceState, connectSSE, stopPolling]);

  return { loading, sseConnected };
}

export function GovernanceConsole() {
  const { mode, isLoading } = useGovernanceMode();
  const { flagsMeta } = useGovernanceStore();
  const { loading, sseConnected } = useGovernanceSSE();

  // Use flagsMeta from store, fallback to defaults
  const flags = flagsMeta.length > 0 ? flagsMeta : DEFAULT_FLAGS;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading governance console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GovernanceModeControl variant="banner" dismissible={true} />
      <DemoWatermark />

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card data-testid="governance-header">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Shield className="h-8 w-8 text-primary" />
                    Governance Console
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    System governance, compliance monitoring, and audit management
                  </p>
                </div>
                {/* SSE Connection Status Indicator */}
                <div className="flex items-center gap-2">
                  {sseConnected ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 gap-1">
                      <Wifi className="h-3 w-3" />
                      Live Updates
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 gap-1">
                      <WifiOff className="h-3 w-3" />
                      Polling
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <GovernanceModeControl variant="indicator" showDetails={true} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <FlagsPanel flags={flags} />
              <AllowedOperationsTable mode={mode} />
              <QuickLinks />
            </div>

            <div className="space-y-6">
              <ApprovalLog pageSize={5} />
              <AuditLogViewer pageSize={5} />
              <AuditExport variant="card" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GovernanceConsole;
