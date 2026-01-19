/**
 * Usage Analytics Dashboard
 * Task 168: Usage analytics dashboard
 */

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, FileText, Activity, Clock } from 'lucide-react';

interface UsageMetrics {
  totalResearch: number;
  completedResearch: number;
  activeUsers: number;
  avgCompletionTime: number;
  weeklyTrend: number[];
  topSources: { name: string; count: number }[];
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, icon }: MetricCardProps) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground">{icon}</div>
        {change !== undefined && (
          <span
            className={`text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}
          >
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}

function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((value, index) => (
        <div
          key={index}
          className="flex-1 bg-primary rounded-t"
          style={{ height: `${(value / max) * 100}%` }}
          title={`${value}`}
        />
      ))}
    </div>
  );
}

export function UsageDashboard() {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/usage?range=${timeRange}`);
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load analytics data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Usage Analytics</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Research"
          value={metrics.totalResearch}
          change={12}
          icon={<FileText className="w-5 h-5" />}
        />
        <MetricCard
          title="Completed"
          value={metrics.completedResearch}
          change={8}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Active Users"
          value={metrics.activeUsers}
          change={15}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Avg. Completion"
          value={`${metrics.avgCompletionTime}h`}
          change={-5}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Weekly Activity
          </h3>
          <MiniBarChart data={metrics.weeklyTrend} />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Top Sources</h3>
          <div className="space-y-3">
            {metrics.topSources.map((source, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-muted-foreground w-6">{index + 1}.</span>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span>{source.name}</span>
                    <span className="text-muted-foreground">{source.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded mt-1">
                    <div
                      className="h-full bg-primary rounded"
                      style={{
                        width: `${(source.count / metrics.topSources[0].count) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </h3>
        <div className="space-y-3">
          {metrics.recentActivity.map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-3 py-2 border-b last:border-0"
            >
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="flex-1">
                <p>{activity.description}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
