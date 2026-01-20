/**
 * Loading State Components
 *
 * Provides consistent loading indicators across the application.
 * Part of Audit Section 4: Improve error handling and loading states.
 */

import React from 'react';
import { Loader2, RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

/**
 * Simple loading spinner
 */
export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-blue-500', sizeClasses[size])} />
      {label && <span className="ml-2 text-slate-400">{label}</span>}
    </div>
  );
}

interface PageLoaderProps {
  message?: string;
  submessage?: string;
}

/**
 * Full-page loading state
 */
export function PageLoader({ message = 'Loading...', submessage }: PageLoaderProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
      <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
      <p className="text-lg text-white">{message}</p>
      {submessage && <p className="text-sm text-slate-400 mt-1">{submessage}</p>}
    </div>
  );
}

interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
}

/**
 * Skeleton content loader
 */
export function SkeletonLoader({ lines = 3, className }: SkeletonLoaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 bg-slate-700 rounded animate-pulse',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  className?: string;
}

/**
 * Card skeleton loader
 */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <Card className={cn('border-slate-700 bg-slate-800/50', className)}>
      <CardHeader className="space-y-2">
        <div className="h-5 w-1/3 bg-slate-700 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-slate-700 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <SkeletonLoader lines={4} />
      </CardContent>
    </Card>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * Table skeleton loader
 */
export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex space-x-4 p-3 bg-slate-800 rounded-t">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1 h-4 bg-slate-700 rounded animate-pulse" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex space-x-4 p-3 bg-slate-800/50">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className="flex-1 h-4 bg-slate-700 rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface ConnectionStateProps {
  isOnline: boolean;
  isReconnecting?: boolean;
  onRetry?: () => void;
}

/**
 * Connection status indicator
 */
export function ConnectionState({ isOnline, isReconnecting, onRetry }: ConnectionStateProps) {
  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="border-amber-600 bg-amber-900/90 shadow-lg">
        <CardContent className="flex items-center space-x-3 p-4">
          {isReconnecting ? (
            <>
              <RefreshCw className="h-5 w-5 text-amber-400 animate-spin" />
              <span className="text-amber-200">Reconnecting...</span>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-amber-400" />
              <span className="text-amber-200">Connection lost</span>
              {onRetry && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRetry}
                  className="text-amber-200 hover:bg-amber-800"
                >
                  Retry
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Empty state placeholder
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      {icon && (
        <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="bg-blue-600 hover:bg-blue-700">
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error state display
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this content.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="h-16 w-16 rounded-full bg-red-900/50 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 text-center max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} className="bg-blue-600 hover:bg-blue-700">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}

interface InlineLoaderProps {
  className?: string;
}

/**
 * Inline loading indicator (e.g., for buttons)
 */
export function InlineLoader({ className }: InlineLoaderProps) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
    </span>
  );
}

export default {
  LoadingSpinner,
  PageLoader,
  SkeletonLoader,
  CardSkeleton,
  TableSkeleton,
  ConnectionState,
  EmptyState,
  ErrorState,
  InlineLoader,
};
