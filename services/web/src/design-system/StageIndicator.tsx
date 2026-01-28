/**
 * Stage Indicator Component
 * Based on ResearchFlow Figma Design System
 * Shows workflow progress through research stages
 */

import React from 'react';
import { cn } from '@/lib/utils';

export type Stage = 'planning' | 'data-collection' | 'analysis' | 'writing' | 'review' | 'complete';

export interface StageIndicatorProps {
  currentStage: Stage;
  stages?: Stage[];
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

const defaultStages: Stage[] = ['planning', 'data-collection', 'analysis', 'writing', 'review', 'complete'];

const stageLabels: Record<Stage, string> = {
  'planning': 'Planning',
  'data-collection': 'Data Collection',
  'analysis': 'Analysis',
  'writing': 'Writing',
  'review': 'Review',
  'complete': 'Complete',
};

const stageColors: Record<Stage, string> = {
  'planning': 'bg-[#9575CD]', // Workflow purple
  'data-collection': 'bg-[#4A7FC1]', // Primary blue
  'analysis': 'bg-[#4CAF50]', // Success green
  'writing': 'bg-[#FF9800]', // Orange
  'review': 'bg-[#E57373]', // Error red
  'complete': 'bg-[#4CAF50]', // Success green
};

const sizeStyles = {
  sm: { dot: 'w-3 h-3', line: 'h-0.5', text: 'text-xs' },
  md: { dot: 'w-4 h-4', line: 'h-1', text: 'text-sm' },
  lg: { dot: 'w-6 h-6', line: 'h-1.5', text: 'text-base' },
};

export function StageIndicator({
  currentStage,
  stages = defaultStages,
  size = 'md',
  showLabels = false,
}: StageIndicatorProps) {
  const currentIndex = stages.indexOf(currentStage);
  const styles = sizeStyles[size];

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <React.Fragment key={stage}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  styles.dot,
                  'rounded-full transition-all duration-300',
                  isComplete && stageColors[stage],
                  isCurrent && `${stageColors[stage]} ring-2 ring-offset-2 ring-[#4A7FC1]`,
                  isPending && 'bg-[#E0E0E0]'
                )}
                title={stageLabels[stage]}
              />
              {showLabels && (
                <span
                  className={cn(
                    styles.text,
                    'mt-1 whitespace-nowrap',
                    isCurrent ? 'text-[#212121] font-medium' : 'text-[#757575]'
                  )}
                >
                  {stageLabels[stage]}
                </span>
              )}
            </div>
            {index < stages.length - 1 && (
              <div
                className={cn(
                  styles.line,
                  'flex-1 min-w-[20px] rounded-full transition-all duration-300',
                  index < currentIndex ? 'bg-[#4A7FC1]' : 'bg-[#E0E0E0]'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default StageIndicator;
