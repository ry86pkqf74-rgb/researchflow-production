/**
 * Governance Console
 *
 * Central dashboard for governance, compliance, and audit management.
 * Only accessible to STEWARD and ADMIN roles.
 *
 * Priority: P0 - CRITICAL
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Settings,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGovernanceMode, GovernanceMode } from '@/hooks/useGovernanceMode';
import {
  ModeIndicator,
  ApprovalLog,
  AuditExport,
  AuditLogViewer,
  DemoModeBanner,
  DemoWatermark
} from '@/components/governance';

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  requiredMode?: GovernanceMode[];
}

const ALLOWED_OPERATIONS: Record<GovernanceMode, string[]> = {
  STANDBY: [
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

export function GovernanceConsole() {
  const { mode, isLoading } = useGovernanceMode();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGovernanceState = async () => {
      try {
        const response = await fetch('/api/governance/state', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setFlags(data.flags || []);
        } else {
          setFlags([
            { name: 'ALLOW_UPLOADS', enabled: true, description: 'Allow dataset uploads to the system' },
            { name: 'ALLOW_EXPORTS', enabled: false, description: 'Allow result exports (requires steward approval)' },
            { name: 'ALLOW_LLM_CALLS', enabled: true, description: 'Allow LLM API calls for draft generation' },
            { name: 'REQUIRE_PHI_SCAN', enabled: true, description: 'Require PHI scanning for all uploaded data' },
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch governance state:', error);
        setFlags([
          { name: 'ALLOW_UPLOADS', enabled: true, description: 'Allow dataset uploads to the system' },
          { name: 'ALLOW_EXPORTS', enabled: false, description: 'Allow result exports (requires steward approval)' },
          { name: 'ALLOW_LLM_CALLS', enabled: true, description: 'Allow LLM API calls for draft generation' },
          { name: 'REQUIRE_PHI_SCAN', enabled: true, description: 'Require PHI scanning for all uploaded data' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchGovernanceState();

    const interval = setInterval(fetchGovernanceState, 30000);
    return () => clearInterval(interval);
  }, []);

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
      <DemoModeBanner />
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
              </div>
            </CardContent>
          </Card>

          <ModeIndicator variant="full" showDetails={true} />

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
