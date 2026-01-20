/**
 * Onboarding Tour Component
 * Task 27 - First-run onboarding wizard with step-by-step guidance
 * Task 138 - Build onboarding wizard for new users
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Play,
  Settings,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Tour step definition
export interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for highlight
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'navigate' | 'input';
  actionTarget?: string;
  navigateTo?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

// Tour configuration
export interface TourConfig {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  completionMessage?: string;
}

// Default onboarding tour
export const DEFAULT_ONBOARDING_TOUR: TourConfig = {
  id: 'onboarding',
  name: 'Welcome to ResearchFlow',
  description: 'Learn the basics of the research workflow platform',
  completionMessage: 'You\'re all set! Start your first research project.',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to ResearchFlow',
      description: 'ResearchFlow is your AI-powered research workflow platform. This tour will guide you through the key features.',
      placement: 'center',
      icon: Sparkles,
    },
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      description: 'The dashboard gives you a quick view of your projects, recent activity, and system status. You can monitor runs, view costs, and track progress here.',
      target: '[data-tour="dashboard"]',
      placement: 'bottom',
      navigateTo: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'workflow',
      title: 'Research Workflow',
      description: 'The workflow consists of 20 stages from hypothesis generation to conference preparation. Each stage builds on the previous one.',
      target: '[data-tour="workflow"]',
      placement: 'right',
      navigateTo: '/workflow',
      icon: FlaskConical,
    },
    {
      id: 'governance',
      title: 'Governance Modes',
      description: 'ResearchFlow supports DEMO mode (synthetic data, relaxed rules) and LIVE mode (real data, strict PHI compliance). Your current mode determines what actions are available.',
      target: '[data-tour="governance"]',
      placement: 'bottom',
      icon: Shield,
    },
    {
      id: 'start-project',
      title: 'Starting a Project',
      description: 'Click "New Project" to begin. You\'ll select a governance mode, configure settings, and then start working through the workflow stages.',
      target: '[data-tour="new-project"]',
      placement: 'bottom',
      icon: Play,
    },
    {
      id: 'settings',
      title: 'Settings & Preferences',
      description: 'Customize your experience in Settings. You can change language, theme, keyboard shortcuts, and configure integrations.',
      target: '[data-tour="settings"]',
      placement: 'left',
      navigateTo: '/settings',
      icon: Settings,
    },
  ],
};

// Tour context
interface TourContextValue {
  activeTour: TourConfig | null;
  currentStep: number;
  isOpen: boolean;
  startTour: (tour: TourConfig) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  skipTour: () => void;
  completedTours: string[];
  markTourComplete: (tourId: string) => void;
}

const TourContext = React.createContext<TourContextValue | null>(null);

export function useTour() {
  const context = React.useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

// Storage key for completed tours
const COMPLETED_TOURS_KEY = 'researchflow_completed_tours';

// Tour Provider
export function TourProvider({ children }: { children: React.ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourConfig | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [completedTours, setCompletedTours] = useState<string[]>([]);
  const [, navigate] = useLocation();

  // Load completed tours from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COMPLETED_TOURS_KEY);
      if (stored) {
        setCompletedTours(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const markTourComplete = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const updated = [...prev, tourId];
      try {
        localStorage.setItem(COMPLETED_TOURS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  const startTour = useCallback((tour: TourConfig) => {
    setActiveTour(tour);
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const endTour = useCallback(() => {
    if (activeTour) {
      markTourComplete(activeTour.id);
    }
    setActiveTour(null);
    setCurrentStep(0);
    setIsOpen(false);
  }, [activeTour, markTourComplete]);

  const skipTour = useCallback(() => {
    setActiveTour(null);
    setCurrentStep(0);
    setIsOpen(false);
  }, []);

  const nextStep = useCallback(() => {
    if (!activeTour) return;

    const nextIndex = currentStep + 1;
    if (nextIndex >= activeTour.steps.length) {
      endTour();
      return;
    }

    const nextStepData = activeTour.steps[nextIndex];
    if (nextStepData.navigateTo) {
      navigate(nextStepData.navigateTo);
    }

    setCurrentStep(nextIndex);
  }, [activeTour, currentStep, endTour, navigate]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const prevStepData = activeTour?.steps[currentStep - 1];
      if (prevStepData?.navigateTo) {
        navigate(prevStepData.navigateTo);
      }
      setCurrentStep(currentStep - 1);
    }
  }, [activeTour, currentStep, navigate]);

  const goToStep = useCallback((index: number) => {
    if (!activeTour) return;
    if (index >= 0 && index < activeTour.steps.length) {
      const stepData = activeTour.steps[index];
      if (stepData.navigateTo) {
        navigate(stepData.navigateTo);
      }
      setCurrentStep(index);
    }
  }, [activeTour, navigate]);

  const value: TourContextValue = {
    activeTour,
    currentStep,
    isOpen,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
    completedTours,
    markTourComplete,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourDialog />
    </TourContext.Provider>
  );
}

// Tour Dialog Component
function TourDialog() {
  const { activeTour, currentStep, isOpen, nextStep, prevStep, skipTour, endTour } = useTour();

  if (!activeTour || !isOpen) return null;

  const step = activeTour.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === activeTour.steps.length - 1;
  const progress = ((currentStep + 1) / activeTour.steps.length) * 100;
  const Icon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && skipTour()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="mb-2">
              Step {currentStep + 1} of {activeTour.steps.length}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={skipTour}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            {step.title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Progress value={progress} className="h-2" />
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={isFirstStep}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={skipTour}>
              Skip Tour
            </Button>
            <Button onClick={isLastStep ? endTour : nextStep}>
              {isLastStep ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Onboarding Welcome Card
interface OnboardingWelcomeProps {
  onStartTour: () => void;
  onSkip: () => void;
  className?: string;
}

export function OnboardingWelcome({
  onStartTour,
  onSkip,
  className,
}: OnboardingWelcomeProps) {
  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Welcome to ResearchFlow
        </CardTitle>
        <CardDescription>
          Get started with a quick tour of the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          ResearchFlow guides you through the research process with AI assistance,
          from hypothesis generation to conference preparation. Take a quick tour
          to learn the basics.
        </p>
        <div className="flex gap-2">
          <Button onClick={onStartTour}>
            <Play className="mr-2 h-4 w-4" />
            Start Tour
          </Button>
          <Button variant="outline" onClick={onSkip}>
            Skip for Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook to check if onboarding should be shown
export function useOnboardingStatus() {
  const { completedTours, startTour } = useTour();
  const [dismissed, setDismissed] = useState(false);

  const shouldShowOnboarding = !completedTours.includes('onboarding') && !dismissed;

  const startOnboarding = useCallback(() => {
    startTour(DEFAULT_ONBOARDING_TOUR);
  }, [startTour]);

  const dismissOnboarding = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem('researchflow_onboarding_dismissed', 'true');
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Check if previously dismissed
  useEffect(() => {
    try {
      const wasDismissed = localStorage.getItem('researchflow_onboarding_dismissed');
      if (wasDismissed === 'true') {
        setDismissed(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    shouldShowOnboarding,
    startOnboarding,
    dismissOnboarding,
  };
}

// Tour step indicator dots
interface TourStepIndicatorProps {
  totalSteps: number;
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function TourStepIndicator({
  totalSteps,
  currentStep,
  onStepClick,
  className,
}: TourStepIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <button
          key={index}
          onClick={() => onStepClick?.(index)}
          disabled={!onStepClick}
          className={cn(
            'h-2 w-2 rounded-full transition-all',
            index === currentStep
              ? 'bg-primary w-4'
              : index < currentStep
                ? 'bg-primary/50'
                : 'bg-muted',
            onStepClick && 'cursor-pointer hover:bg-primary/70'
          )}
        />
      ))}
    </div>
  );
}

// Quick start checklist
interface QuickStartItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  action?: () => void;
  href?: string;
}

interface QuickStartChecklistProps {
  items: QuickStartItem[];
  className?: string;
}

export function QuickStartChecklist({
  items,
  className,
}: QuickStartChecklistProps) {
  const completedCount = items.filter((item) => item.completed).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Quick Start</CardTitle>
        <CardDescription>
          {completedCount} of {items.length} completed
        </CardDescription>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg transition-colors',
              item.completed
                ? 'bg-muted/50'
                : 'hover:bg-muted/50 cursor-pointer'
            )}
            onClick={() => !item.completed && item.action?.()}
          >
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border',
                item.completed
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground'
              )}
            >
              {item.completed ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {items.indexOf(item) + 1}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium',
                  item.completed && 'line-through text-muted-foreground'
                )}
              >
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {item.description}
              </p>
            </div>
            {!item.completed && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
