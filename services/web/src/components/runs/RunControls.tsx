/**
 * Run Control Buttons Component (Phase 4C - RUN-006)
 *
 * Control buttons for run execution: Retry, Resume, Pause, Fork.
 * Buttons are disabled based on current run state.
 *
 * Features:
 * - State-aware button enabling/disabling
 * - Run control callbacks
 * - Loading states with spinners
 * - Keyboard shortcuts support
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  RotateCcw,
  Copy,
  Loader2,
} from 'lucide-react';

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

interface RunControlsProps {
  status: RunStatus;
  onResume?: () => void | Promise<void>;
  onPause?: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  onFork?: () => void | Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function RunControls({
  status,
  onResume,
  onPause,
  onRetry,
  onFork,
  isLoading = false,
  className,
}: RunControlsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [showForkConfirm, setShowForkConfirm] = useState(false);

  // Determine which actions are available based on current status
  const canResume = ['paused', 'failed'].includes(status);
  const canPause = ['running'].includes(status);
  const canRetry = ['failed'].includes(status);
  const canFork = !['pending', 'cancelled'].includes(status);

  const handleResume = async () => {
    if (!canResume || !onResume) return;
    setLoadingAction('resume');
    try {
      await onResume();
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePause = async () => {
    if (!canPause || !onPause) return;
    setLoadingAction('pause');
    try {
      await onPause();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRetry = async () => {
    if (!canRetry || !onRetry) return;
    setLoadingAction('retry');
    try {
      await onRetry();
      setShowRetryConfirm(false);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFork = async () => {
    if (!canFork || !onFork) return;
    setLoadingAction('fork');
    try {
      await onFork();
      setShowForkConfirm(false);
    } finally {
      setLoadingAction(null);
    }
  };

  const isActionLoading = loadingAction !== null || isLoading;

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        {/* Resume Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleResume}
          disabled={!canResume || isActionLoading}
          className={cn(
            canResume && 'hover:bg-green-50 hover:text-green-700 hover:border-green-300'
          )}
        >
          {loadingAction === 'resume' && (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          )}
          <Play className="h-4 w-4 mr-1" />
          Resume
        </Button>

        {/* Pause Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          disabled={!canPause || isActionLoading}
          className={cn(
            canPause && 'hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300'
          )}
        >
          {loadingAction === 'pause' && (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          )}
          <Pause className="h-4 w-4 mr-1" />
          Pause
        </Button>

        {/* Retry Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRetryConfirm(true)}
          disabled={!canRetry || isActionLoading}
          className={cn(
            canRetry && 'hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300'
          )}
        >
          {loadingAction === 'retry' && (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          )}
          <RotateCcw className="h-4 w-4 mr-1" />
          Retry
        </Button>

        {/* Fork Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForkConfirm(true)}
          disabled={!canFork || isActionLoading}
          className={cn(
            canFork && 'hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'
          )}
        >
          {loadingAction === 'fork' && (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          )}
          <Copy className="h-4 w-4 mr-1" />
          Fork Run
        </Button>
      </div>

      {/* Retry Confirmation Dialog */}
      <AlertDialog open={showRetryConfirm} onOpenChange={setShowRetryConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Failed Stage?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restart the failed stage from the beginning. Any previous outputs from this
              stage will be discarded. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRetry}
              disabled={isActionLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loadingAction === 'retry' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Retry Stage
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fork Confirmation Dialog */}
      <AlertDialog open={showForkConfirm} onOpenChange={setShowForkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fork This Run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new run with the same configuration and inputs as the current run.
              The new run will start from the beginning. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFork}
              disabled={isActionLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loadingAction === 'fork' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Fork Run
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default RunControls;
