/**
 * Input Component
 * Based on ResearchFlow Figma Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { colors, spacing, borderRadius } from './tokens';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className,
  disabled,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium mb-1" style={{ color: colors.text.DEFAULT }}>
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full px-4 py-2 rounded-lg border-2 font-body transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          !error && `border-[${colors.border.DEFAULT}] focus:border-[${colors.border.focus}] focus:ring-[${colors.primary.DEFAULT}]`,
          error && `border-[${colors.error.DEFAULT}] focus:border-[${colors.error.DEFAULT}] focus:ring-[${colors.error.DEFAULT}]`,
          disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
          className
        )}
        disabled={disabled}
        style={{
          borderColor: error ? colors.error.DEFAULT : colors.border.DEFAULT,
          borderRadius: borderRadius.md,
        }}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm" style={{ color: colors.error.DEFAULT }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm" style={{ color: colors.text.secondary }}>
          {helperText}
        </p>
      )}
    </div>
  );
}

export default Input;
