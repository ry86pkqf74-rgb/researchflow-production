/**
 * Alert Component
 * Based on ResearchFlow Figma Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { colors, borderRadius, shadows } from './tokens';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'error' | 'workflow' | 'info';
  icon?: React.ReactNode;
  title?: string;
  closable?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

const variantStyles = {
  default: {
    bg: colors.background.DEFAULT,
    border: colors.border.DEFAULT,
    text: colors.text.DEFAULT,
    icon: colors.primary.DEFAULT,
  },
  success: {
    bg: colors.success.light,
    border: colors.success.DEFAULT,
    text: colors.success.DEFAULT,
    icon: colors.success.DEFAULT,
  },
  error: {
    bg: colors.error.light,
    border: colors.error.DEFAULT,
    text: colors.error.DEFAULT,
    icon: colors.error.DEFAULT,
  },
  workflow: {
    bg: colors.workflow.light,
    border: colors.workflow.DEFAULT,
    text: colors.workflow.DEFAULT,
    icon: colors.workflow.DEFAULT,
  },
  info: {
    bg: colors.primary.light,
    border: colors.primary.DEFAULT,
    text: colors.primary.DEFAULT,
    icon: colors.primary.DEFAULT,
  },
};

export function Alert({
  variant = 'default',
  icon,
  title,
  closable = false,
  onClose,
  className,
  children,
  ...props
}: AlertProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  const styles = variantStyles[variant];

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg border-2 transition-all duration-200',
        className
      )}
      style={{
        backgroundColor: styles.bg,
        borderColor: styles.border,
      }}
      {...props}
    >
      {icon && (
        <div
          className="flex-shrink-0 mt-0.5"
          style={{ color: styles.icon }}
        >
          {icon}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {title && (
          <h4
            className="font-semibold text-sm mb-1"
            style={{ color: styles.text }}
          >
            {title}
          </h4>
        )}
        <div
          className="text-sm"
          style={{ color: styles.text }}
        >
          {children}
        </div>
      </div>

      {closable && (
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 hover:bg-black/5 rounded transition-colors"
          aria-label="Close alert"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: styles.icon }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export interface AlertsProps {
  alerts: Array<Omit<AlertProps, 'onClose'>>;
  className?: string;
}

export function Alerts({ alerts, className }: AlertsProps) {
  const [visibleAlerts, setVisibleAlerts] = React.useState<Set<number>>(
    new Set(alerts.map((_, i) => i))
  );

  const handleClose = (index: number) => {
    setVisibleAlerts((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  return (
    <div className={cn('space-y-2', className)}>
      {alerts.map((alert, index) =>
        visibleAlerts.has(index) ? (
          <Alert
            key={index}
            {...alert}
            onClose={() => handleClose(index)}
          />
        ) : null
      )}
    </div>
  );
}

export default Alert;
