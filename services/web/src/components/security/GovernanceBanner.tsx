/**
 * Governance Banner Component
 * Task 96 - DEMO mode UI restrictions
 * Task 104 - PR guardrails reflected in UI
 * Displays governance mode and restrictions prominently
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  Info,
  Lock,
  Unlock,
  FlaskConical,
  Database,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Governance mode types
export type GovernanceMode = 'DEMO' | 'LIVE';

export interface GovernanceRestriction {
  id: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  actionBlocked: string;
  reason: string;
}

export interface GovernanceState {
  mode: GovernanceMode;
  dataClassification: 'SYNTHETIC' | 'DEIDENTIFIED' | 'IDENTIFIED';
  restrictions: GovernanceRestriction[];
  phiAccessApproved: boolean;
  exportAllowed: boolean;
  aiEnabled: boolean;
}

// Default restrictions per mode
const DEMO_RESTRICTIONS: GovernanceRestriction[] = [
  {
    id: 'demo_upload',
    description: 'Real data upload is disabled',
    severity: 'info',
    actionBlocked: 'Upload real/PHI data',
    reason: 'DEMO mode only supports synthetic data',
  },
  {
    id: 'demo_export',
    description: 'Exports are watermarked as DEMO',
    severity: 'info',
    actionBlocked: 'Export without watermark',
    reason: 'All DEMO outputs are clearly marked',
  },
  {
    id: 'demo_phi',
    description: 'PHI processing is simulated',
    severity: 'info',
    actionBlocked: 'Process real PHI',
    reason: 'Use LIVE mode for PHI processing',
  },
];

const LIVE_RESTRICTIONS: GovernanceRestriction[] = [
  {
    id: 'live_phi_scan',
    description: 'PHI scan required before export',
    severity: 'warning',
    actionBlocked: 'Export without PHI scan',
    reason: 'HIPAA compliance requires PHI scanning',
  },
  {
    id: 'live_approval',
    description: 'Approval required for sensitive exports',
    severity: 'warning',
    actionBlocked: 'Export without approval',
    reason: 'Data steward approval required',
  },
  {
    id: 'live_audit',
    description: 'All actions are audited',
    severity: 'info',
    actionBlocked: 'None',
    reason: 'Compliance audit trail maintained',
  },
];

// Governance Banner Props
interface GovernanceBannerProps {
  state: GovernanceState;
  onModeChange?: (mode: GovernanceMode) => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export function GovernanceBanner({
  state,
  onModeChange,
  onDismiss,
  showDetails = true,
  compact = false,
  className,
}: GovernanceBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isDemoMode = state.mode === 'DEMO';

  const modeConfig = {
    DEMO: {
      icon: FlaskConical,
      label: 'DEMO Mode',
      description: 'Using synthetic data for exploration',
      color: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
      badgeVariant: 'secondary' as const,
    },
    LIVE: {
      icon: Database,
      label: 'LIVE Mode',
      description: 'Processing real research data',
      color: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200',
      badgeVariant: 'default' as const,
    },
  };

  const config = modeConfig[state.mode];
  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.badgeVariant} className={cn('cursor-help', className)}>
              <Icon className="mr-1 h-3 w-3" />
              {state.mode}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{config.label}</p>
            <p className="text-xs">{config.description}</p>
            {state.restrictions.length > 0 && (
              <p className="text-xs mt-1 text-muted-foreground">
                {state.restrictions.length} active restrictions
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('rounded-lg border p-4', config.color, className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{config.label}</h3>
              <Badge variant={config.badgeVariant} className="text-xs">
                {state.dataClassification}
              </Badge>
              {state.phiAccessApproved && (
                <Badge variant="outline" className="text-xs">
                  <Unlock className="mr-1 h-3 w-3" />
                  PHI Access
                </Badge>
              )}
            </div>
            <p className="text-sm mt-1">{config.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onModeChange && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onModeChange(isDemoMode ? 'LIVE' : 'DEMO')}
            >
              Switch to {isDemoMode ? 'LIVE' : 'DEMO'}
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {showDetails && state.restrictions.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {state.restrictions.length} Active Restrictions
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {state.restrictions.map((restriction) => (
              <RestrictionItem key={restriction.id} restriction={restriction} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// Restriction item component
function RestrictionItem({ restriction }: { restriction: GovernanceRestriction }) {
  const severityConfig = {
    info: { icon: Info, color: 'text-blue-600' },
    warning: { icon: AlertTriangle, color: 'text-amber-600' },
    error: { icon: Lock, color: 'text-red-600' },
  };

  const config = severityConfig[restriction.severity];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 p-2 rounded bg-background/50">
      <Icon className={cn('h-4 w-4 mt-0.5', config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{restriction.description}</p>
        <p className="text-xs text-muted-foreground">{restriction.reason}</p>
      </div>
    </div>
  );
}

// Inline governance indicator for forms/buttons
interface GovernanceIndicatorProps {
  isBlocked: boolean;
  reason?: string;
  mode: GovernanceMode;
  className?: string;
}

export function GovernanceIndicator({
  isBlocked,
  reason,
  mode,
  className,
}: GovernanceIndicatorProps) {
  if (!isBlocked) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-1', className)}>
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Disabled in {mode}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{reason || `This action is not available in ${mode} mode`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Hook to check if an action is allowed
export function useGovernanceCheck(
  state: GovernanceState,
  requiredConditions: {
    requirePhiApproval?: boolean;
    requireLiveMode?: boolean;
    requireDemoMode?: boolean;
    requireExportAllowed?: boolean;
    requireAiEnabled?: boolean;
  }
) {
  const {
    requirePhiApproval,
    requireLiveMode,
    requireDemoMode,
    requireExportAllowed,
    requireAiEnabled,
  } = requiredConditions;

  const isAllowed =
    (!requirePhiApproval || state.phiAccessApproved) &&
    (!requireLiveMode || state.mode === 'LIVE') &&
    (!requireDemoMode || state.mode === 'DEMO') &&
    (!requireExportAllowed || state.exportAllowed) &&
    (!requireAiEnabled || state.aiEnabled);

  const blockReason = !isAllowed
    ? [
        requirePhiApproval && !state.phiAccessApproved && 'PHI access not approved',
        requireLiveMode && state.mode !== 'LIVE' && 'Requires LIVE mode',
        requireDemoMode && state.mode !== 'DEMO' && 'Only available in DEMO mode',
        requireExportAllowed && !state.exportAllowed && 'Export not allowed',
        requireAiEnabled && !state.aiEnabled && 'AI features disabled',
      ]
        .filter(Boolean)
        .join('; ')
    : null;

  return { isAllowed, blockReason };
}

// Governance-aware button wrapper
interface GovernanceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  governanceState: GovernanceState;
  requirePhiApproval?: boolean;
  requireLiveMode?: boolean;
  requireDemoMode?: boolean;
  requireExportAllowed?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function GovernanceButton({
  governanceState,
  requirePhiApproval,
  requireLiveMode,
  requireDemoMode,
  requireExportAllowed,
  children,
  variant = 'default',
  ...props
}: GovernanceButtonProps) {
  const { isAllowed, blockReason } = useGovernanceCheck(governanceState, {
    requirePhiApproval,
    requireLiveMode,
    requireDemoMode,
    requireExportAllowed,
  });

  if (!isAllowed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant={variant} disabled {...props}>
                <Lock className="mr-2 h-4 w-4" />
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{blockReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button variant={variant} {...props}>
      {children}
    </Button>
  );
}

// Mode switch confirmation dialog content
interface ModeSwitchConfirmProps {
  fromMode: GovernanceMode;
  toMode: GovernanceMode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ModeSwitchConfirm({
  fromMode,
  toMode,
  onConfirm,
  onCancel,
}: ModeSwitchConfirmProps) {
  const isToLive = toMode === 'LIVE';

  return (
    <div className="space-y-4">
      <Alert variant={isToLive ? 'destructive' : 'default'}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>
          Switch to {toMode} Mode?
        </AlertTitle>
        <AlertDescription>
          {isToLive ? (
            <>
              Switching to LIVE mode enables processing of real research data.
              All actions will be audited and PHI compliance rules will be enforced.
            </>
          ) : (
            <>
              Switching to DEMO mode will use synthetic data only.
              Any unsaved work with real data should be exported first.
            </>
          )}
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">What changes:</h4>
        <ul className="text-sm space-y-1">
          {isToLive ? (
            <>
              <li className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-500" />
                PHI scanning will be required for exports
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-500" />
                Approval workflows will be enforced
              </li>
              <li className="flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-500" />
                All actions will be audit logged
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-blue-500" />
                Only synthetic data will be used
              </li>
              <li className="flex items-center gap-2">
                <Unlock className="h-4 w-4 text-blue-500" />
                Approval requirements relaxed
              </li>
              <li className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                Exports will be watermarked
              </li>
            </>
          )}
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={isToLive ? 'destructive' : 'default'}
          onClick={onConfirm}
        >
          Switch to {toMode}
        </Button>
      </div>
    </div>
  );
}

// Export default restrictions for use elsewhere
export { DEMO_RESTRICTIONS, LIVE_RESTRICTIONS };
