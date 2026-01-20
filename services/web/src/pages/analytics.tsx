/**
 * Analytics Dashboard Page
 * Task 168: System-wide analytics dashboard (admin-only)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Activity, Users, Cpu, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

interface AnalyticsOverview {
  jobs: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    trend: { date: string; count: number }[];
  };
  users: {
    total: number;
    activeToday: number;
    newThisWeek: number;
  };
  ai: {
    totalInvocations: number;
    totalTokens: number;
    estimatedCost: number;
    byTier: { tier: string; count: number }[];
  };
  governance: {
    phiIncidents: number;
    quarantinedManifests: number;
    pendingReviews: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function MetricCard({ title, value, icon: Icon, change, changeType }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${
              changeType === 'positive' ? 'text-green-500' :
              changeType === 'negative' ? 'text-red-500' :
              'text-muted-foreground'
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-full">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch(`/api/admin/analytics/overview?range=${timeRange}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p>Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Analytics</h1>
          <p className="text-muted-foreground">Overview of system performance and usage</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Jobs"
          value={data.jobs.total}
          icon={Activity}
          change={`${data.jobs.completed} completed`}
          changeType="positive"
        />
        <MetricCard
          title="Active Users"
          value={data.users.activeToday}
          icon={Users}
          change={`${data.users.newThisWeek} new this week`}
          changeType="neutral"
        />
        <MetricCard
          title="AI Invocations"
          value={data.ai.totalInvocations.toLocaleString()}
          icon={Cpu}
        />
        <MetricCard
          title="Est. AI Cost"
          value={`$${data.ai.estimatedCost.toFixed(2)}`}
          icon={DollarSign}
        />
      </div>

      {/* Governance Alerts */}
      {(data.governance.phiIncidents > 0 || data.governance.quarantinedManifests > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Governance Alerts</span>
          </div>
          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            {data.governance.phiIncidents > 0 && (
              <p>{data.governance.phiIncidents} PHI incidents detected</p>
            )}
            {data.governance.quarantinedManifests > 0 && (
              <p>{data.governance.quarantinedManifests} manifests quarantined</p>
            )}
            {data.governance.pendingReviews > 0 && (
              <p>{data.governance.pendingReviews} pending reviews</p>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Trend */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">Job Activity Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.jobs.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI Tier Usage */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">AI Tier Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.ai.byTier}
                dataKey="count"
                nameKey="tier"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => entry.tier}
              >
                {data.ai.byTier.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Job Status Breakdown */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Job Status Breakdown</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{data.jobs.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Activity className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{data.jobs.running}</p>
            <p className="text-sm text-muted-foreground">Running</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{data.jobs.failed}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{data.jobs.total - data.jobs.completed - data.jobs.failed - data.jobs.running}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
        </div>
      </div>
    </div>
  );
}
