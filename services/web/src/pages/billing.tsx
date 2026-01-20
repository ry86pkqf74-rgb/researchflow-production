/**
 * Billing Page (Task 84)
 *
 * Subscription management page showing:
 * - Current subscription tier and status
 * - Usage statistics
 * - Upgrade/downgrade options
 * - Billing portal access
 */

import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Users,
  FolderOpen,
  Zap,
  HardDrive,
  ArrowRight,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TierLimits {
  maxMembers: number;
  maxProjects: number;
  aiCallsPerMonth: number;
  storageGb: number;
}

interface Subscription {
  id: string;
  orgId: string;
  tier: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

interface Usage {
  members: { current: number; limit: number; unlimited: boolean };
  projects: { current: number; limit: number; unlimited: boolean };
  aiCalls: { current: number; limit: number; unlimited: boolean };
  storage: { currentGb: number; limit: number; unlimited: boolean };
}

const TIER_FEATURES: Record<string, string[]> = {
  FREE: [
    'Up to 3 team members',
    '5 research projects',
    '100 AI calls per month',
    '1 GB storage',
  ],
  PRO: [
    'Up to 10 team members',
    '50 research projects',
    '1,000 AI calls per month',
    '10 GB storage',
    'Priority support',
  ],
  TEAM: [
    'Up to 50 team members',
    '200 research projects',
    '5,000 AI calls per month',
    '100 GB storage',
    'Priority support',
    'Advanced analytics',
  ],
  ENTERPRISE: [
    'Unlimited team members',
    'Unlimited projects',
    'Unlimited AI calls',
    'Unlimited storage',
    'Dedicated support',
    'Custom integrations',
    'SLA guarantee',
  ],
};

const TIER_PRICES: Record<string, string> = {
  FREE: '$0',
  PRO: '$29',
  TEAM: '$99',
  ENTERPRISE: 'Custom',
};

const TIER_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  PRO: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  TEAM: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  ENTERPRISE: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
};

function UsageCard({
  icon: Icon,
  label,
  current,
  limit,
  unlimited,
}: {
  icon: React.ElementType;
  label: string;
  current: number;
  limit: number;
  unlimited: boolean;
}) {
  const percentage = unlimited ? 0 : (current / limit) * 100;
  const isNearLimit = !unlimited && percentage >= 80;
  const isAtLimit = !unlimited && percentage >= 100;

  return (
    <div className="p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {current} / {unlimited ? '∞' : limit}
        </span>
      </div>
      <Progress
        value={unlimited ? 0 : Math.min(percentage, 100)}
        className={`h-2 ${isAtLimit ? 'bg-red-200' : isNearLimit ? 'bg-yellow-200' : ''}`}
      />
      {isAtLimit && (
        <p className="text-xs text-red-600 mt-1">Limit reached</p>
      )}
    </div>
  );
}

export function Billing() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [allLimits, setAllLimits] = useState<Record<string, TierLimits>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // Get orgId from URL
  const orgId = window.location.pathname.split('/org/')[1]?.split('/')[0] || '';

  useEffect(() => {
    fetchBillingData();
  }, [orgId]);

  const fetchBillingData = async () => {
    if (!orgId) {
      setError('Organization not found');
      setLoading(false);
      return;
    }

    try {
      // Fetch subscription
      const subResponse = await fetch(`/api/billing/${orgId}/subscription`, {
        credentials: 'include',
      });
      if (subResponse.ok) {
        const data = await subResponse.json();
        setSubscription(data.subscription);
        setAllLimits(data.allLimits);
      }

      // Fetch usage
      const usageResponse = await fetch(`/api/billing/${orgId}/usage`, {
        credentials: 'include',
      });
      if (usageResponse.ok) {
        const data = await usageResponse.json();
        setUsage(data.usage);
      }
    } catch (err) {
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    setUpgrading(tier);
    setError(null);

    try {
      const response = await fetch(`/api/billing/${orgId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to checkout
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to start checkout');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await fetch(`/api/billing/${orgId}/portal`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to open billing portal');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentTier = subscription?.tier || 'FREE';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Billing & Subscription
          </h1>
          <p className="text-muted-foreground">
            Manage your subscription plan and billing
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Current Plan
                  <Badge className={TIER_COLORS[currentTier]}>{currentTier}</Badge>
                </CardTitle>
                <CardDescription>
                  {subscription?.status === 'ACTIVE' ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Active
                    </span>
                  ) : subscription?.status === 'PAST_DUE' ? (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      Payment past due
                    </span>
                  ) : (
                    subscription?.status
                  )}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{TIER_PRICES[currentTier]}</p>
                <p className="text-sm text-muted-foreground">/month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subscription?.cancelAtPeriodEnd && (
              <Alert className="mb-4">
                <AlertDescription>
                  Your subscription will be cancelled at the end of the current billing period.
                </AlertDescription>
              </Alert>
            )}

            {currentTier !== 'FREE' && (
              <Button variant="outline" onClick={handleManageBilling}>
                Manage Billing
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        {usage && (
          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>Current usage against your plan limits</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UsageCard
                icon={Users}
                label="Team Members"
                current={usage.members.current}
                limit={usage.members.limit}
                unlimited={usage.members.unlimited}
              />
              <UsageCard
                icon={FolderOpen}
                label="Projects"
                current={usage.projects.current}
                limit={usage.projects.limit}
                unlimited={usage.projects.unlimited}
              />
              <UsageCard
                icon={Zap}
                label="AI Calls"
                current={usage.aiCalls.current}
                limit={usage.aiCalls.limit}
                unlimited={usage.aiCalls.unlimited}
              />
              <UsageCard
                icon={HardDrive}
                label="Storage (GB)"
                current={usage.storage.currentGb}
                limit={usage.storage.limit}
                unlimited={usage.storage.unlimited}
              />
            </CardContent>
          </Card>
        )}

        {/* Available Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(TIER_FEATURES).map(([tier, features]) => {
              const isCurrent = tier === currentTier;
              const tierOrder = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];
              const canUpgrade = tierOrder.indexOf(tier) > tierOrder.indexOf(currentTier);

              return (
                <Card
                  key={tier}
                  className={isCurrent ? 'border-primary border-2' : ''}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge className={TIER_COLORS[tier]}>{tier}</Badge>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="pt-2">
                      <span className="text-2xl font-bold">{TIER_PRICES[tier]}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm">
                      {features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {canUpgrade && tier !== 'ENTERPRISE' && (
                      <Button
                        className="w-full"
                        onClick={() => handleUpgrade(tier)}
                        disabled={!!upgrading}
                      >
                        {upgrading === tier ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Upgrade to {tier}
                      </Button>
                    )}

                    {tier === 'ENTERPRISE' && !isCurrent && (
                      <Button variant="outline" className="w-full" asChild>
                        <a href="mailto:sales@researchflow.io">
                          Contact Sales
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    )}

                    {isCurrent && (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Billing;
