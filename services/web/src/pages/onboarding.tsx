/**
 * Tutorial Wizard / Onboarding Page
 * Task 186: Tutorial wizard onboarding
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronRight, ChevronLeft, Check, BookOpen, Settings, Shield, Rocket, Users } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ResearchFlow',
    description: 'Your AI-powered research orchestration platform',
    icon: Rocket,
    content: (
      <div className="space-y-4">
        <p className="text-lg">
          ResearchFlow helps you manage research projects from data ingestion to publication,
          with built-in PHI protection and governance controls.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { title: 'PHI-Safe', desc: 'Automatic PHI detection and protection' },
            { title: 'AI-Powered', desc: 'Tiered AI for different sensitivity levels' },
            { title: 'Compliant', desc: 'HIPAA-ready governance controls' },
            { title: 'Collaborative', desc: 'Team workflows with RBAC' },
          ].map((item) => (
            <div key={item.title} className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'governance',
    title: 'Understanding Governance',
    description: 'DEMO vs LIVE mode and data protection',
    icon: Shield,
    content: (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">DEMO Mode</h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Uses synthetic data only. No real patient information is processed.
            Perfect for learning and testing workflows.
          </p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="font-semibold text-green-800 dark:text-green-200">LIVE Mode</h3>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            For real research data. Requires authentication and PHI scanning.
            All operations are audited for compliance.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          You can switch between modes, but LIVE mode requires proper authorization and
          data handling agreements.
        </p>
      </div>
    ),
  },
  {
    id: 'pipeline',
    title: 'Research Pipeline',
    description: 'How data flows through the system',
    icon: BookOpen,
    content: (
      <div className="space-y-4">
        <div className="relative">
          {['Upload', 'PHI Scan', 'AI Analysis', 'Review', 'Export'].map((step, i) => (
            <div key={step} className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                {i + 1}
              </div>
              <div className="flex-1 p-3 bg-muted rounded-lg">
                <p className="font-medium">{step}</p>
              </div>
              {i < 4 && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Each step includes automatic checks to ensure data quality and compliance.
        </p>
      </div>
    ),
  },
  {
    id: 'settings',
    title: 'Customize Your Experience',
    description: 'Set up your profile and preferences',
    icon: Settings,
    content: (
      <div className="space-y-4">
        <p>Before you start, consider:</p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Set your specialty tags</p>
              <p className="text-sm text-muted-foreground">
                Help us personalize recommendations for your research area
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Configure notifications</p>
              <p className="text-sm text-muted-foreground">
                Stay updated on job progress and team activity
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Connect integrations</p>
              <p className="text-sm text-muted-foreground">
                Link Notion, Slack, or GitHub for seamless workflows
              </p>
            </div>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'ready',
    title: "You're All Set!",
    description: 'Start your first research project',
    icon: Users,
    content: (
      <div className="space-y-4 text-center">
        <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-full inline-block">
          <Check className="w-16 h-16 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold">Ready to begin!</h3>
        <p className="text-muted-foreground">
          You can always revisit this tutorial from the help menu.
          If you have questions, check out our documentation or community forum.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <a
            href="/pipeline"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Go to Pipeline
          </a>
          <a
            href="/profile"
            className="px-6 py-3 bg-muted rounded-lg hover:bg-muted/80"
          >
            Set Up Profile
          </a>
        </div>
      </div>
    ),
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [, setLocation] = useLocation();

  // Check if onboarding already completed
  useEffect(() => {
    const completed = localStorage.getItem('ros-onboarding-completed');
    if (completed === 'true') {
      // Optionally redirect if already completed
      // setLocation('/');
    }
  }, [setLocation]);

  const handleComplete = () => {
    localStorage.setItem('ros-onboarding-completed', 'true');
    // Also persist to API in LIVE mode
    fetch('/api/users/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingCompleted: true }),
    }).catch(() => {});
    setLocation('/');
  };

  const step = STEPS[currentStep];
  const Icon = step.icon;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
      <div className="max-w-2xl w-full">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`w-3 h-3 rounded-full transition-colors ${
                i === currentStep
                  ? 'bg-primary'
                  : i < currentStep
                  ? 'bg-primary/50'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Icon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{step.title}</h2>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">{step.content}</div>

          {/* Navigation */}
          <div className="p-6 border-t bg-muted/30 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={() => setCurrentStep((s) => s + 1)}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Get Started
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        <div className="text-center mt-4">
          <button
            onClick={handleComplete}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
