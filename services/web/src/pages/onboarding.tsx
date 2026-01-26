/**
 * Onboarding Page (Task 89)
 *
 * Multi-step wizard for new user onboarding.
 * Guides users through initial setup and configuration.
 */

import { useState } from 'react';
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Users,
  FolderOpen,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ResearchFlow',
    description: 'Get started with your research workflow',
    icon: Sparkles,
  },
  {
    id: 'organization',
    title: 'Create Organization',
    description: 'Set up your organization',
    icon: Building2,
  },
  {
    id: 'invite',
    title: 'Invite Team Members',
    description: 'Collaborate with your team',
    icon: Users,
  },
  {
    id: 'project',
    title: 'Create First Project',
    description: 'Start your first research project',
    icon: FolderOpen,
  },
];

export function Onboarding() {
  const { accessToken } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Form state
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [projectTitle, setProjectTitle] = useState('');

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  };

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    setError(null); // Clear error when user changes input
    if (!orgSlug || orgSlug === generateSlug(orgName)) {
      setOrgSlug(generateSlug(value));
    }
  };

  const handleOrgSlugChange = (value: string) => {
    setOrgSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    setError(null); // Clear error when user changes input
  };

  const handleNext = async () => {
    setError(null);

    // Validate current step
    if (step.id === 'organization') {
      // Organization creation is now optional - user can skip to continue
      if (orgName.trim() && orgSlug.trim()) {
        setLoading(true);
        try {
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };
          if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
          }

          const response = await fetch('/api/org', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              name: orgName,
              slug: orgSlug,
              description: orgDescription,
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to create organization');
          }

          setCompletedSteps([...completedSteps, step.id]);
        } catch (err: any) {
          setError(err.message);
          return;
        } finally {
          setLoading(false);
        }
      }
    }

    if (step.id === 'invite' && inviteEmails.trim()) {
      // Invite is optional, just mark as complete if emails provided
      setCompletedSteps([...completedSteps, step.id]);
    }

    if (step.id === 'project') {
      // Project creation is optional
      setCompletedSteps([...completedSteps, step.id]);
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleSkip = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };

  const completeOnboarding = async () => {
    try {
      const headers: HeadersInit = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      await fetch('/api/user/onboarding/complete', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      // Redirect to workflows page where user can create and execute pipelines
      window.location.href = '/workflows';
    } catch (err) {
      // If API fails, still redirect - onboarding is complete
      window.location.href = '/workflows';
    }
  };

  const renderStepContent = () => {
    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="p-4 rounded-full bg-primary/10 w-20 h-20 mx-auto flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Welcome to ResearchFlow Canvas</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                The intelligent research workflow platform that helps you accelerate your research
                from data preparation to publication.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <Card className="text-left">
                <CardContent className="pt-4">
                  <Building2 className="h-6 w-6 text-primary mb-2" />
                  <h4 className="font-medium">Organizations</h4>
                  <p className="text-sm text-muted-foreground">
                    Collaborate with your team in a secure workspace
                  </p>
                </CardContent>
              </Card>
              <Card className="text-left">
                <CardContent className="pt-4">
                  <FolderOpen className="h-6 w-6 text-primary mb-2" />
                  <h4 className="font-medium">Research Projects</h4>
                  <p className="text-sm text-muted-foreground">
                    Organize your research with structured workflows
                  </p>
                </CardContent>
              </Card>
              <Card className="text-left">
                <CardContent className="pt-4">
                  <Sparkles className="h-6 w-6 text-primary mb-2" />
                  <h4 className="font-medium">AI Assistance</h4>
                  <p className="text-sm text-muted-foreground">
                    Get AI-powered insights and manuscript drafting
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'organization':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold">Create Your Organization (Optional)</h2>
              <p className="text-muted-foreground mt-2">
                Set up your team's workspace for research collaboration, or skip to continue
              </p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="My Research Lab"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgSlug">URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">/org/</span>
                  <Input
                    id="orgSlug"
                    placeholder="my-research-lab"
                    value={orgSlug}
                    onChange={(e) => handleOrgSlugChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgDescription">Description (Optional)</Label>
                <Textarea
                  id="orgDescription"
                  placeholder="Describe your organization..."
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 'invite':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold">Invite Team Members</h2>
              <p className="text-muted-foreground mt-2">
                Add collaborators to your organization (optional)
              </p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="inviteEmails">Email Addresses</Label>
                <Textarea
                  id="inviteEmails"
                  placeholder="Enter email addresses, one per line"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  You can always invite more team members later from organization settings.
                </p>
              </div>
            </div>
          </div>
        );

      case 'project':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <FolderOpen className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold">Create Your First Project</h2>
              <p className="text-muted-foreground mt-2">
                Start your first research project (optional)
              </p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="projectTitle">Project Title</Label>
                <Input
                  id="projectTitle"
                  placeholder="My Research Project"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You can create and manage projects from the pipeline dashboard.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {STEPS.map((s, idx) => (
                <div
                  key={s.id}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    idx < currentStep || completedSteps.includes(s.id)
                      ? 'bg-primary text-primary-foreground'
                      : idx === currentStep
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx < currentStep || completedSteps.includes(s.id) ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {renderStepContent()}

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0 || loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              {step.id !== 'welcome' && (
                <Button variant="ghost" onClick={handleSkip} disabled={loading}>
                  Skip
                </Button>
              )}
              <Button onClick={handleNext} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {currentStep === STEPS.length - 1 ? 'Complete' : 'Continue'}
                {currentStep < STEPS.length - 1 && (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Onboarding;
