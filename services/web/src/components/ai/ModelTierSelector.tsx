/**
 * AI Model Tier Selector Component
 * Task 25 - Add model tier selection UI
 * Task 65 - AI routing indicator panel
 * Task 110 - Cost optimization display for AI routing
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  Zap,
  Brain,
  Sparkles,
  DollarSign,
  Clock,
  Shield,
  Info,
  ChevronDown,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// Model tier definitions
export type ModelTier = 'economy' | 'standard' | 'premium';

export interface ModelTierConfig {
  id: ModelTier;
  name: string;
  description: string;
  costPerToken: number;
  maxTokens: number;
  latency: 'low' | 'medium' | 'high';
  quality: 'good' | 'better' | 'best';
  capabilities: string[];
  recommended?: boolean;
  phiCompliant: boolean;
}

export const MODEL_TIERS: Record<ModelTier, ModelTierConfig> = {
  economy: {
    id: 'economy',
    name: 'Economy',
    description: 'Fast and cost-effective for simple tasks',
    costPerToken: 0.0001,
    maxTokens: 4096,
    latency: 'low',
    quality: 'good',
    capabilities: ['Text generation', 'Basic analysis', 'Summarization'],
    phiCompliant: false,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Balanced performance for most research tasks',
    costPerToken: 0.001,
    maxTokens: 32768,
    latency: 'medium',
    quality: 'better',
    capabilities: ['Advanced analysis', 'Code generation', 'Research synthesis'],
    recommended: true,
    phiCompliant: true,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Maximum capability for complex research',
    costPerToken: 0.01,
    maxTokens: 200000,
    latency: 'high',
    quality: 'best',
    capabilities: ['Deep analysis', 'Multi-step reasoning', 'Creative synthesis', 'PHI processing'],
    phiCompliant: true,
  },
};

// Tier icon mapping
const TIER_ICONS: Record<ModelTier, React.ComponentType<{ className?: string }>> = {
  economy: Zap,
  standard: Brain,
  premium: Sparkles,
};

// Simple tier selector dropdown
interface ModelTierSelectProps {
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
  disabled?: boolean;
  requirePhiCompliant?: boolean;
  className?: string;
}

export function ModelTierSelect({
  value,
  onChange,
  disabled,
  requirePhiCompliant,
  className,
}: ModelTierSelectProps) {
  const availableTiers = useMemo(() => {
    return Object.values(MODEL_TIERS).filter(
      (tier) => !requirePhiCompliant || tier.phiCompliant
    );
  }, [requirePhiCompliant]);

  return (
    <Select value={value} onValueChange={(v) => onChange(v as ModelTier)} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select model tier" />
      </SelectTrigger>
      <SelectContent>
        {availableTiers.map((tier) => {
          const Icon = TIER_ICONS[tier.id];
          return (
            <SelectItem key={tier.id} value={tier.id}>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {tier.name}
                {tier.recommended && (
                  <Badge variant="secondary" className="text-xs">
                    Recommended
                  </Badge>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Detailed tier selector with cards
interface ModelTierCardsProps {
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
  requirePhiCompliant?: boolean;
  showCosts?: boolean;
  className?: string;
}

export function ModelTierCards({
  value,
  onChange,
  requirePhiCompliant,
  showCosts = true,
  className,
}: ModelTierCardsProps) {
  const availableTiers = useMemo(() => {
    return Object.values(MODEL_TIERS).filter(
      (tier) => !requirePhiCompliant || tier.phiCompliant
    );
  }, [requirePhiCompliant]);

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
      {availableTiers.map((tier) => {
        const Icon = TIER_ICONS[tier.id];
        const isSelected = value === tier.id;
        const isDisabled = requirePhiCompliant && !tier.phiCompliant;

        return (
          <Card
            key={tier.id}
            className={cn(
              'cursor-pointer transition-all',
              isSelected && 'border-primary ring-2 ring-primary/20',
              isDisabled && 'opacity-50 cursor-not-allowed',
              !isDisabled && !isSelected && 'hover:border-primary/50'
            )}
            onClick={() => !isDisabled && onChange(tier.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{tier.name}</CardTitle>
                </div>
                {isSelected && <Check className="h-5 w-5 text-primary" />}
                {tier.recommended && !isSelected && (
                  <Badge variant="secondary" className="text-xs">
                    Recommended
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {tier.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quality</span>
                <QualityIndicator quality={tier.quality} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Speed</span>
                <LatencyIndicator latency={tier.latency} />
              </div>
              {showCosts && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-mono text-xs">
                    ${tier.costPerToken.toFixed(4)}/token
                  </span>
                </div>
              )}
              {tier.phiCompliant && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  PHI Compliant
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Quality indicator
function QualityIndicator({ quality }: { quality: 'good' | 'better' | 'best' }) {
  const levels = { good: 1, better: 2, best: 3 };
  const level = levels[quality];

  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i <= level ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
}

// Latency indicator
function LatencyIndicator({ latency }: { latency: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'text-green-500',
    medium: 'text-yellow-500',
    high: 'text-orange-500',
  };
  const labels = { low: 'Fast', medium: 'Medium', high: 'Slower' };

  return (
    <span className={cn('text-xs font-medium', colors[latency])}>
      {labels[latency]}
    </span>
  );
}

// AI Routing Indicator (Task 65)
interface AIRoutingIndicatorProps {
  selectedTier: ModelTier;
  estimatedTokens: number;
  stageId?: number;
  governanceMode: 'DEMO' | 'LIVE';
  className?: string;
}

export function AIRoutingIndicator({
  selectedTier,
  estimatedTokens,
  stageId,
  governanceMode,
  className,
}: AIRoutingIndicatorProps) {
  const tier = MODEL_TIERS[selectedTier];
  const estimatedCost = estimatedTokens * tier.costPerToken;
  const Icon = TIER_ICONS[selectedTier];

  const needsPhiCompliance = governanceMode === 'LIVE';
  const isTierCompliant = !needsPhiCompliance || tier.phiCompliant;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{tier.name} Model</p>
            <p className="text-xs text-muted-foreground">{tier.description}</p>
          </div>
        </div>
        <Badge variant={governanceMode === 'LIVE' ? 'default' : 'secondary'}>
          {governanceMode}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Est. Tokens</p>
          <p className="font-mono">{estimatedTokens.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Est. Cost</p>
          <p className="font-mono">${estimatedCost.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Max Tokens</p>
          <p className="font-mono">{tier.maxTokens.toLocaleString()}</p>
        </div>
      </div>

      {!isTierCompliant && (
        <div className="mt-4 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-xs text-yellow-700 dark:text-yellow-300">
            This tier is not PHI compliant. Select Standard or Premium for LIVE mode.
          </span>
        </div>
      )}
    </Card>
  );
}

// Cost Estimation Widget (Task 110)
interface CostEstimationProps {
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  showBreakdown?: boolean;
  className?: string;
}

export function CostEstimation({
  tier,
  inputTokens,
  outputTokens,
  showBreakdown = false,
  className,
}: CostEstimationProps) {
  const config = MODEL_TIERS[tier];
  const inputCost = inputTokens * config.costPerToken;
  const outputCost = outputTokens * config.costPerToken * 1.5; // Output typically costs more
  const totalCost = inputCost + outputCost;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Estimated Cost</span>
        <span className="text-lg font-bold font-mono">${totalCost.toFixed(4)}</span>
      </div>

      {showBreakdown && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Input ({inputTokens.toLocaleString()} tokens)</span>
            <span className="font-mono">${inputCost.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span>Output ({outputTokens.toLocaleString()} tokens)</span>
            <span className="font-mono">${outputCost.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Budget Progress Widget
interface BudgetProgressProps {
  used: number;
  limit: number;
  period: 'daily' | 'weekly' | 'monthly';
  className?: string;
}

export function BudgetProgress({
  used,
  limit,
  period,
  className,
}: BudgetProgressProps) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isOverBudget = used > limit;
  const isNearLimit = percentage >= 80 && !isOverBudget;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium capitalize">{period} Budget</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>AI usage budget for the current {period}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Progress
        value={percentage}
        className={cn(
          'h-2',
          isOverBudget && '[&>div]:bg-red-500',
          isNearLimit && '[&>div]:bg-yellow-500'
        )}
      />

      <div className="flex justify-between mt-2 text-sm">
        <span className={cn(isOverBudget && 'text-red-500 font-medium')}>
          ${used.toFixed(2)} used
        </span>
        <span className="text-muted-foreground">${limit.toFixed(2)} limit</span>
      </div>

      {isOverBudget && (
        <p className="text-xs text-red-500 mt-2">
          Budget exceeded by ${(used - limit).toFixed(2)}
        </p>
      )}
      {isNearLimit && (
        <p className="text-xs text-yellow-600 mt-2">
          Approaching budget limit ({percentage.toFixed(0)}% used)
        </p>
      )}
    </Card>
  );
}

// Compact tier badge for inline display
interface TierBadgeProps {
  tier: ModelTier;
  showCost?: boolean;
  className?: string;
}

export function TierBadge({ tier, showCost, className }: TierBadgeProps) {
  const config = MODEL_TIERS[tier];
  const Icon = TIER_ICONS[tier];

  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {config.name}
      {showCost && (
        <span className="text-muted-foreground ml-1">
          ${config.costPerToken.toFixed(4)}/tok
        </span>
      )}
    </Badge>
  );
}

// Settings panel for AI preferences
interface AISettingsPanelProps {
  defaultTier: ModelTier;
  onDefaultTierChange: (tier: ModelTier) => void;
  budgetLimit: number;
  onBudgetLimitChange: (limit: number) => void;
  autoOptimize: boolean;
  onAutoOptimizeChange: (enabled: boolean) => void;
  className?: string;
}

export function AISettingsPanel({
  defaultTier,
  onDefaultTierChange,
  budgetLimit,
  onBudgetLimitChange,
  autoOptimize,
  onAutoOptimizeChange,
  className,
}: AISettingsPanelProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <Label>Default Model Tier</Label>
        <ModelTierSelect value={defaultTier} onChange={onDefaultTierChange} />
        <p className="text-xs text-muted-foreground">
          The model tier used by default for new requests
        </p>
      </div>

      <div className="space-y-2">
        <Label>Monthly Budget Limit</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <input
            type="number"
            value={budgetLimit}
            onChange={(e) => onBudgetLimitChange(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            min={0}
            step={10}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Set to 0 for unlimited usage
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Auto-optimize Model Selection</Label>
          <p className="text-xs text-muted-foreground">
            Automatically choose the most cost-effective tier based on task complexity
          </p>
        </div>
        <Switch checked={autoOptimize} onCheckedChange={onAutoOptimizeChange} />
      </div>
    </div>
  );
}
