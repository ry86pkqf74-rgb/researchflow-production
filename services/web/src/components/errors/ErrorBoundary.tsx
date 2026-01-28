/**
 * Error Boundary Components
 * Task 126 - Add error boundary components around stages
 * Provides graceful error handling with recovery options
 */

import * as React from 'react';
import { Component, ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  Bug,
  Home,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Error types
export type ErrorSeverity = 'warning' | 'error' | 'fatal';

export interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  severity: ErrorSeverity;
  code?: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

// Props for error boundary
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: ErrorDetails, reset: () => void) => ReactNode);
  onError?: (error: ErrorDetails) => void;
  showDetails?: boolean;
  severity?: ErrorSeverity;
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: ErrorDetails | null;
}

// Main Error Boundary Component
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error: {
        message: error.message,
        stack: error.stack,
        severity: 'error',
        timestamp: new Date(),
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
      severity: this.props.severity || 'error',
      timestamp: new Date(),
      context: this.props.context ? { location: this.props.context } : undefined,
    };

    this.setState({ error: errorDetails });
    this.props.onError?.(errorDetails);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.reset);
        }
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.reset}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

// Default Error Fallback UI
interface ErrorFallbackProps {
  error: ErrorDetails;
  onReset?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ErrorFallback({
  error,
  onReset,
  showDetails = true,
  className,
}: ErrorFallbackProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyErrorDetails = React.useCallback(() => {
    const details = [
      `Error: ${error.message}`,
      `Time: ${error.timestamp.toISOString()}`,
      error.code ? `Code: ${error.code}` : '',
      error.stack ? `\nStack trace:\n${error.stack}` : '',
      error.componentStack ? `\nComponent stack:\n${error.componentStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [error]);

  const severityStyles = {
    warning: {
      border: 'border-yellow-500/50',
      bg: 'bg-yellow-500/10',
      icon: 'text-yellow-500',
    },
    error: {
      border: 'border-red-500/50',
      bg: 'bg-red-500/10',
      icon: 'text-red-500',
    },
    fatal: {
      border: 'border-red-700/50',
      bg: 'bg-red-700/10',
      icon: 'text-red-700',
    },
  };

  const styles = severityStyles[error.severity];

  return (
    <Card className={cn('max-w-lg mx-auto', styles.border, className)}>
      <CardHeader className={styles.bg}>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className={cn('h-5 w-5', styles.icon)} />
          Something went wrong
        </CardTitle>
        <CardDescription>
          {error.severity === 'fatal'
            ? 'A critical error occurred. Please refresh the page.'
            : 'An error occurred while rendering this component.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>

        {showDetails && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Technical Details
                </span>
                {detailsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
                {error.stack || 'No stack trace available'}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={copyErrorDetails}
              >
                <Copy className="mr-2 h-3 w-3" />
                {copied ? 'Copied!' : 'Copy Details'}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {onReset && (
          <Button onClick={onReset} variant="default">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => window.location.href = '/'}
        >
          <Home className="mr-2 h-4 w-4" />
          Go Home
        </Button>
      </CardFooter>
    </Card>
  );
}

// Stage-specific Error Boundary
interface StageErrorBoundaryProps extends Omit<ErrorBoundaryProps, 'context'> {
  stageId: number;
  stageName: string;
}

export function StageErrorBoundary({
  stageId,
  stageName,
  children,
  ...props
}: StageErrorBoundaryProps) {
  const handleError = React.useCallback(
    (error: ErrorDetails) => {
      // Log stage-specific error
      console.error(`Error in Stage ${stageId} (${stageName}):`, error);
      props.onError?.(error);
    },
    [stageId, stageName, props]
  );

  return (
    <ErrorBoundary
      {...props}
      context={`Stage ${stageId}: ${stageName}`}
      onError={handleError}
      fallback={(error, reset) => (
        <StageFallback
          stageId={stageId}
          stageName={stageName}
          error={error}
          onReset={reset}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

// Stage-specific Fallback
interface StageFallbackProps {
  stageId: number;
  stageName: string;
  error: ErrorDetails;
  onReset: () => void;
}

function StageFallback({ stageId, stageName, error, onReset }: StageFallbackProps) {
  return (
    <div className="p-6">
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Stage {stageId} Error</AlertTitle>
        <AlertDescription>
          An error occurred in "{stageName}". Your progress has been saved.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <div className="flex gap-2">
            <Button onClick={onReset}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry Stage
            </Button>
            <Button variant="outline" asChild>
              <a href={`/workflow/stage/${stageId - 1}`}>
                Go to Previous Stage
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <a
                href="https://github.com/researchflow/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Report Issue
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Network Error Alert
interface NetworkErrorAlertProps {
  onRetry?: () => void;
  className?: string;
}

export function NetworkErrorAlert({ onRetry, className }: NetworkErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>Unable to connect to the server. Please check your connection.</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCcw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Loading Error
interface LoadingErrorProps {
  resource: string;
  onRetry?: () => void;
  className?: string;
}

export function LoadingError({ resource, onRetry, className }: LoadingErrorProps) {
  return (
    <div className={cn('text-center py-8', className)}>
      <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="font-semibold mb-2">Failed to load {resource}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        There was a problem loading this content.
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}

// Hook for error handling in components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((err: Error) => {
    setError(err);
    console.error('Component error:', err);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const throwError = React.useCallback((err: Error) => {
    throw err;
  }, []);

  return {
    error,
    handleError,
    clearError,
    throwError,
    hasError: error !== null,
  };
}

// Async error boundary wrapper
interface AsyncBoundaryProps {
  children: ReactNode;
  loading?: ReactNode;
  error?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
}

export function AsyncBoundary({ children, loading, error }: AsyncBoundaryProps) {
  return (
    <React.Suspense fallback={loading || <DefaultLoadingFallback />}>
      <ErrorBoundary
        fallback={
          typeof error === 'function'
            ? (err, reset) => error(new Error(err.message), reset)
            : error
        }
      >
        {children}
      </ErrorBoundary>
    </React.Suspense>
  );
}

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode | ((error: ErrorDetails, reset: () => void) => ReactNode),
  props?: Omit<ErrorBoundaryProps, 'children' | 'fallback'>
) {
  return function WithErrorBoundaryWrapper(componentProps: P) {
    return (
      <ErrorBoundary fallback={fallback} {...props}>
        <WrappedComponent {...componentProps} />
      </ErrorBoundary>
    );
  };
}
