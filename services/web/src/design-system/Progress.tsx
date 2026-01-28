/**
 * Progress Component
 * Based on ResearchFlow Figma Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { colors, borderRadius, spacing } from './tokens';

export interface ProgressProps {
  value: number; // 0-100
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'workflow' | 'error';
}

const sizeStyles = {
  sm: { height: '4px', label: 'text-xs' },
  md: { height: '8px', label: 'text-sm' },
  lg: { height: '12px', label: 'text-base' },
};

const variantColors = {
  primary: colors.primary.DEFAULT,
  success: colors.success.DEFAULT,
  workflow: colors.workflow.DEFAULT,
  error: colors.error.DEFAULT,
};

export function Progress({
  value,
  label,
  showLabel = false,
  size = 'md',
  variant = 'primary',
}: ProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const sizes = sizeStyles[size];
  const barColor = variantColors[variant];

  return (
    <div className="w-full">
      {(label || showLabel) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span
              className={`font-medium ${sizes.label}`}
              style={{ color: colors.text.DEFAULT }}
            >
              {label}
            </span>
          )}
          {showLabel && (
            <span
              className={`font-medium ${sizes.label}`}
              style={{ color: colors.text.secondary }}
            >
              {clampedValue}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full overflow-hidden bg-gray-200"
        style={{
          height: sizes.height,
          borderRadius: borderRadius.full,
        }}
      >
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${clampedValue}%`,
            backgroundColor: barColor,
            borderRadius: borderRadius.full,
          }}
        />
      </div>
    </div>
  );
}

export interface ProgressStepProps {
  steps: string[];
  currentStep: number;
  variant?: 'primary' | 'success' | 'workflow' | 'error';
}

export function ProgressSteps({
  steps,
  currentStep,
  variant = 'primary',
}: ProgressStepProps) {
  const progressValue = ((Math.min(currentStep, steps.length - 1)) / (steps.length - 1)) * 100;
  const barColor = variantColors[variant];

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200"
                  style={{
                    backgroundColor:
                      isComplete || isCurrent ? barColor : colors.border.DEFAULT,
                    color: colors.text.light,
                  }}
                >
                  {isComplete ? '✓' : isCurrent ? index + 1 : index + 1}
                </div>
                <span
                  className="text-xs mt-1 text-center"
                  style={{
                    color: isCurrent ? colors.text.DEFAULT : colors.text.secondary,
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {step}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* Visual progress bar */}
      <div
        className="w-full h-1 bg-gray-200 rounded-full overflow-hidden"
        style={{ borderRadius: borderRadius.full }}
      >
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${progressValue}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}

export default Progress;
