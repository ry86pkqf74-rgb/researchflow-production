/**
 * Tutorial Player Component (Task 108: Inline Tutorials)
 *
 * Interactive tutorial component with modal and tooltip display modes.
 * Features: step navigation, DOM targeting, video embeds, accessibility.
 */

import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTutorial } from '@/hooks/useTutorial';

export interface TutorialPlayerProps {
  tutorialKey: string;
  isOpen?: boolean;
  mode?: 'modal' | 'tooltip';
  autoStart?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function TutorialPlayer({
  tutorialKey,
  isOpen: controlledOpen,
  mode = 'modal',
  autoStart = false,
  onClose,
  onComplete,
  onDismiss,
}: TutorialPlayerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const {
    tutorial,
    progress,
    currentStep,
    isLoading,
    error,
    start,
    nextStep,
    prevStep,
    complete,
    dismiss,
  } = useTutorial(tutorialKey);

  // Auto-start tutorial
  useEffect(() => {
    if (autoStart && tutorial && !progress?.started) {
      start();
      if (!isControlled) {
        setInternalOpen(true);
      }
    }
  }, [autoStart, tutorial, progress, start, isControlled]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowRight':
          handleNext();
          e.preventDefault();
          break;
        case 'ArrowLeft':
          handlePrev();
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, tutorial]);

  const handleClose = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const handleNext = () => {
    if (!tutorial) return;

    if (currentStep === tutorial.steps.length - 1) {
      // Last step - complete tutorial
      complete();
      onComplete?.();
      handleClose();
    } else {
      nextStep();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      prevStep();
    }
  };

  const handleDismiss = () => {
    dismiss();
    onDismiss?.();
    handleClose();
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !tutorial) {
    return null; // Silently fail if tutorial not available
  }

  const step = tutorial.steps[currentStep];
  const progressPercent = ((currentStep + 1) / tutorial.steps.length) * 100;

  if (mode === 'tooltip') {
    return (
      <TooltipMode
        tutorial={tutorial}
        step={step}
        currentStep={currentStep}
        isOpen={isOpen}
        progressPercent={progressPercent}
        onNext={handleNext}
        onPrev={handlePrev}
        onClose={handleClose}
        onDismiss={handleDismiss}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-content"
      >
        <DialogHeader>
          <DialogTitle id="tutorial-title">
            {tutorial.title}: Step {currentStep + 1} of {tutorial.steps.length}
          </DialogTitle>
          <Progress value={progressPercent} className="mt-2" />
        </DialogHeader>

        {/* Screen reader announcement for step changes */}
        <div role="status" aria-live="polite" className="sr-only">
          Now on step {currentStep + 1} of {tutorial.steps.length}: {step.title}
        </div>

        <div className="space-y-4 py-4">
          {/* Step video */}
          {step.videoUrl && (
            <div className="aspect-video rounded-md overflow-hidden bg-muted">
              <iframe
                src={getEmbedUrl(step.videoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${step.title} video`}
              />
            </div>
          )}

          {/* Tutorial-level video (if no step video) */}
          {!step.videoUrl && tutorial.videoUrl && currentStep === 0 && (
            <div className="aspect-video rounded-md overflow-hidden bg-muted">
              <iframe
                src={getEmbedUrl(tutorial.videoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${tutorial.title} video`}
              />
            </div>
          )}

          {/* Step content */}
          <div id="tutorial-content">
            <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
            <div className="prose prose-sm max-w-none">
              <p>{step.content}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="mr-auto"
            aria-label="Don't show this tutorial again"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Don't Show Again
          </Button>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              aria-label={`Previous step (${currentStep} of ${tutorial.steps.length})`}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              aria-label={
                currentStep === tutorial.steps.length - 1
                  ? 'Finish tutorial'
                  : `Next step (${currentStep + 2} of ${tutorial.steps.length})`
              }
            >
              {currentStep === tutorial.steps.length - 1 ? (
                'Finish'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tooltip Mode Component (DOM-targeted tutorials)
 */
interface TooltipModeProps {
  tutorial: any;
  step: any;
  currentStep: number;
  isOpen: boolean;
  progressPercent: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onDismiss: () => void;
}

function TooltipMode({
  tutorial,
  step,
  currentStep,
  isOpen,
  progressPercent,
  onNext,
  onPrev,
  onClose,
  onDismiss,
}: TooltipModeProps) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [elementRect, setElementRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isOpen || !step.targetSelector) {
      setTargetElement(null);
      setElementRect(null);
      return;
    }

    // Find target element
    const element = document.querySelector(step.targetSelector) as HTMLElement;
    if (element) {
      setTargetElement(element);
      const rect = element.getBoundingClientRect();
      setElementRect(rect);

      // Scroll into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Element not found - fallback to modal
      console.warn(`Tutorial target element not found: ${step.targetSelector}`);
      setTargetElement(null);
      setElementRect(null);
    }
  }, [isOpen, step, currentStep]);

  if (!isOpen) return null;

  // Fallback to modal if no target selector or element not found
  if (!step.targetSelector || !targetElement || !elementRect) {
    return null; // Parent will handle modal fallback
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Element highlight */}
      <div
        className="fixed border-4 border-primary rounded-md animate-pulse pointer-events-none"
        style={{
          top: elementRect.top - 4,
          left: elementRect.left - 4,
          width: elementRect.width + 8,
          height: elementRect.height + 8,
          zIndex: 51,
        }}
        aria-hidden="true"
      />

      {/* Tooltip popover */}
      <div
        className="fixed bg-background border shadow-lg rounded-lg p-4 max-w-sm"
        style={{
          top: elementRect.bottom + 12,
          left: Math.max(16, Math.min(elementRect.left, window.innerWidth - 400)),
          zIndex: 52,
        }}
        role="dialog"
        aria-labelledby="tooltip-title"
        aria-describedby="tooltip-content"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h4 id="tooltip-title" className="font-semibold text-sm">
            Step {currentStep + 1} of {tutorial.steps.length}: {step.title}
          </h4>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={progressPercent} className="mb-3" />

        <div id="tooltip-content" className="text-sm mb-4">
          {step.content}
        </div>

        <div className="flex justify-between items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Don't Show
          </Button>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="ghost" size="sm" onClick={onPrev}>
                <ChevronLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            )}

            <Button size="sm" onClick={onNext}>
              {currentStep === tutorial.steps.length - 1 ? 'Finish' : 'Next'}
              {currentStep < tutorial.steps.length - 1 && (
                <ChevronRight className="h-3 w-3 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Convert video URLs to embed format
 */
function getEmbedUrl(url: string): string {
  // YouTube
  if (url.includes('youtube.com/watch')) {
    const videoId = new URL(url).searchParams.get('v');
    return `https://www.youtube.com/embed/${videoId}`;
  }

  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Vimeo
  if (url.includes('vimeo.com/')) {
    const videoId = url.split('vimeo.com/')[1].split('?')[0];
    return `https://player.vimeo.com/video/${videoId}`;
  }

  // Self-hosted or already embed format
  return url;
}
