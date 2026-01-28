/**
 * Button Component
 * Based on ResearchFlow Figma Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'workflow';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-[#4A7FC1] hover:bg-[#3D6BA8] text-white border-transparent',
  secondary: 'bg-transparent hover:bg-[#E8F0F8] text-[#4A7FC1] border-[#4A7FC1]',
  success: 'bg-[#4CAF50] hover:bg-[#43A047] text-white border-transparent',
  error: 'bg-[#E57373] hover:bg-[#EF5350] text-white border-transparent',
  workflow: 'bg-[#9575CD] hover:bg-[#7E57C2] text-white border-transparent',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-lg border-2 transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A7FC1]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
