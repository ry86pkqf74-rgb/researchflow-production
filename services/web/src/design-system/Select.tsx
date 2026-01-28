/**
 * Select Component
 * Based on ResearchFlow Figma Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { colors, borderRadius } from './tokens';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
}

export function Select({
  options,
  label,
  error,
  helperText,
  placeholder,
  className,
  disabled,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium mb-1" style={{ color: colors.text.DEFAULT }}>
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full px-4 py-2 rounded-lg border-2 font-body transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 appearance-none',
          !error && `border-[${colors.border.DEFAULT}] focus:border-[${colors.border.focus}] focus:ring-[${colors.primary.DEFAULT}]`,
          error && `border-[${colors.error.DEFAULT}] focus:border-[${colors.error.DEFAULT}] focus:ring-[${colors.error.DEFAULT}]`,
          disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
          'bg-white',
          className
        )}
        disabled={disabled}
        style={{
          borderColor: error ? colors.error.DEFAULT : colors.border.DEFAULT,
          borderRadius: borderRadius.md,
          paddingRight: '2.5rem',
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23${colors.text.secondary.slice(1)}' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.5rem center',
          backgroundSize: '1.5em 1.5em',
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

export default Select;
