import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { getStage, STAGE_CATEGORIES, type StageId } from '@/workflow/stages';
import { cn } from '@/lib/utils';
import { Shield, Clock, Zap } from 'lucide-react';

/**
 * Stage Tooltip Component (Task 5)
 *
 * Provides informative tooltips for workflow stages with:
 * - Stage name and description
 * - Category badge
 * - PHI requirement indicator
 * - Estimated duration
 * - AI model tier recommendation
 */

interface StageTooltipProps {
  /** Stage ID (1-20) */
  stageId: StageId;
  /** The trigger element */
  children: React.ReactNode;
  /** Tooltip alignment */
  align?: 'start' | 'center' | 'end';
  /** Tooltip side */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Additional class name for the tooltip content */
  className?: string;
  /** Whether to show extended information */
  extended?: boolean;
}

const modelTierColors = {
  NANO: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  MINI: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  FRONTIER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
};

export function StageTooltip({
  stageId,
  children,
  align = 'center',
  side = 'top',
  className,
  extended = false,
}: StageTooltipProps) {
  const { t } = useTranslation();
  const stage = getStage(stageId);
  const category = STAGE_CATEGORIES[stage.category];
  const Icon = stage.icon;

  // Try to get localized name/description, fall back to stage definition
  const name = t(`workflow.stages.${stageId}.name`, { defaultValue: stage.name });
  const description = t(`workflow.stages.${stageId}.description`, { defaultValue: stage.description });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent
        align={align}
        side={side}
        className={cn('max-w-xs p-3', className)}
      >
        <div className="space-y-2">
          {/* Header with icon and name */}
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">
                Stage {stageId}: {name}
              </h4>
              <p className="text-xs text-muted-foreground">{category.name}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{description}</p>

          {/* Extended info */}
          {extended && stage.longDescription && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              {stage.longDescription}
            </p>
          )}

          {/* Metadata badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {/* PHI indicator */}
            {stage.requiresPhiScan && (
              <Badge variant="outline" className="text-xs gap-1">
                <Shield className="h-3 w-3" />
                PHI Scan
              </Badge>
            )}

            {/* Duration */}
            {stage.estimatedDuration && (
              <Badge variant="outline" className="text-xs gap-1">
                <Clock className="h-3 w-3" />
                ~{stage.estimatedDuration}min
              </Badge>
            )}

            {/* Model tier */}
            {stage.recommendedModelTier && (
              <Badge
                className={cn(
                  'text-xs gap-1',
                  modelTierColors[stage.recommendedModelTier]
                )}
              >
                <Zap className="h-3 w-3" />
                {stage.recommendedModelTier}
              </Badge>
            )}

            {/* Optional indicator */}
            {stage.optional && (
              <Badge variant="secondary" className="text-xs">
                Optional
              </Badge>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Simple stage badge with tooltip
 */
export function StageBadge({
  stageId,
  showName = true,
  size = 'default',
  className,
}: {
  stageId: StageId;
  showName?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const stage = getStage(stageId);
  const Icon = stage.icon;

  const sizeClasses = {
    sm: 'h-5 text-xs px-1.5',
    default: 'h-6 text-sm px-2',
    lg: 'h-8 text-base px-3',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <StageTooltip stageId={stageId}>
      <Badge
        variant="outline"
        className={cn(
          'gap-1 cursor-help',
          sizeClasses[size],
          className
        )}
      >
        <Icon className={iconSizes[size]} />
        {showName && <span>Stage {stageId}</span>}
      </Badge>
    </StageTooltip>
  );
}

/**
 * Stage progress indicator with tooltip
 */
export function StageProgress({
  stageId,
  status,
  progress,
  className,
}: {
  stageId: StageId;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  progress?: number;
  className?: string;
}) {
  const stage = getStage(stageId);
  const Icon = stage.icon;

  const statusColors = {
    pending: 'bg-muted text-muted-foreground',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    skipped: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
  };

  return (
    <StageTooltip stageId={stageId} extended>
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-md cursor-help',
          statusColors[status],
          className
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">Stage {stageId}</span>
        {status === 'in_progress' && progress !== undefined && (
          <span className="ml-auto text-xs">{progress}%</span>
        )}
      </div>
    </StageTooltip>
  );
}
