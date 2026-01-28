/**
 * Badge Component
 * Based on ResearchFlow Figma Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { colors, borderRadius } from './tokens';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'success' | 'workflow' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary: {
    bg: colors.primary.light,
    text: colors.primary.DEFAULT,
    border: colors.primary.DEFAULT,
  },
  success: {
    bg: colors.success.light,
    text: colors.success.DEFAULT,
    border: colors.success.DEFAULT,
  },
  workflow: {
    bg: colors.workflow.light,
    text: colors.workflow.DEFAULT,
    border: colors.workflow.DEFAULT,
  },
  error: {
    bg: colors.error.light,
    text: colors.error.DEFAULT,
    border: colors.error.DEFAULT,
  },
  outline: {
    bg: 'transparent',
    text: colors.text.DEFAULT,
    border: colors.border.DEFAULT,
  },
};

const sizeStyles = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function Badge({
  variant = 'primary',
  size = 'md',
  className,
  icon,
  children,
  ...props
}: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-semibold rounded-md border-2 transition-all duration-200',
        sizeStyles[size],
        className
      )}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        borderColor: styles.border,
      }}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </div>
  );
}

export interface BadgeGroupProps {
  badges: Array<{ label: string; variant?: BadgeProps['variant'] }>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BadgeGroup({
  badges,
  size = 'md',
  className,
}: BadgeGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {badges.map((badge, index) => (
        <Badge key={index} variant={badge.variant} size={size}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

export default Badge;
