/**
 * Cost Monitoring Service
 *
 * Phase G - Task 134: Cost Monitoring Integration
 *
 * Tracks and analyzes infrastructure costs:
 * - Real-time cost tracking by service
 * - Cost forecasting and budgeting
 * - Cost anomaly detection
 * - Optimization recommendations
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Schemas
// ============================================================================

export const CostCategorySchema = z.enum([
  'compute',
  'storage',
  'network',
  'database',
  'serverless',
  'monitoring',
  'other',
]);

export const CostEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  service: z.string(),
  category: CostCategorySchema,
  provider: z.string(),
  region: z.string().optional(),
  amount: z.number(),
  currency: z.string().default('USD'),
  usageQuantity: z.number().optional(),
  usageUnit: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

export const CostSummarySchema = z.object({
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  totalCost: z.number(),
  currency: z.string(),
  byCategory: z.record(CostCategorySchema, z.number()),
  byService: z.record(z.string(), z.number()),
  byProvider: z.record(z.string(), z.number()),
  trend: z.enum(['increasing', 'decreasing', 'stable']),
  changePercent: z.number(),
});

export const BudgetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  amount: z.number(),
  currency: z.string().default('USD'),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  scope: z.object({
    services: z.array(z.string()).optional(),
    categories: z.array(CostCategorySchema).optional(),
    providers: z.array(z.string()).optional(),
    tags: z.record(z.string(), z.string()).optional(),
  }).optional(),
  alertThresholds: z.array(z.number()).default([50, 75, 90, 100]),
  currentSpend: z.number(),
  forecastedSpend: z.number().optional(),
  status: z.enum(['on_track', 'warning', 'exceeded']),
  createdAt: z.string().datetime(),
});

export const CostAnomalySchema = z.object({
  id: z.string().uuid(),
  detectedAt: z.string().datetime(),
  service: z.string(),
  category: CostCategorySchema,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  expectedCost: z.number(),
  actualCost: z.number(),
  deviation: z.number(),
  status: z.enum(['open', 'acknowledged', 'resolved', 'false_positive']),
  resolution: z.string().optional(),
});

export const CostOptimizationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: CostCategorySchema,
  estimatedSavings: z.number(),
  savingsPercentage: z.number(),
  effort: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  status: z.enum(['pending', 'in_progress', 'implemented', 'dismissed']),
  actionItems: z.array(z.string()),
  implementedAt: z.string().datetime().optional(),
  actualSavings: z.number().optional(),
});

export const CostForecastSchema = z.object({
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  forecastedCost: z.number(),
  confidenceInterval: z.object({
    low: z.number(),
    high: z.number(),
  }),
  assumptions: z.array(z.string()),
  byService: z.record(z.string(), z.number()),
});

export type CostCategory = z.infer<typeof CostCategorySchema>;
export type CostEntry = z.infer<typeof CostEntrySchema>;
export type CostSummary = z.infer<typeof CostSummarySchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type CostAnomaly = z.infer<typeof CostAnomalySchema>;
export type CostOptimization = z.infer<typeof CostOptimizationSchema>;
export type CostForecast = z.infer<typeof CostForecastSchema>;

// ============================================================================
// Cost Monitoring Service
// ============================================================================

class CostMonitoringService extends EventEmitter {
  private costEntries: CostEntry[] = [];
  private budgets: Map<string, Budget> = new Map();
  private anomalies: CostAnomaly[] = [];
  private optimizations: Map<string, CostOptimization> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeHistoricalData();
    this.initializeBudgets();
    this.initializeOptimizations();
  }

  /**
   * Initialize with historical cost data (simulated)
   */
  private initializeHistoricalData(): void {
    const now = Date.now();
    const services = ['orchestrator', 'worker', 'web', 'redis', 'postgres', 'storage'];
    const categories: CostCategory[] = ['compute', 'storage', 'network', 'database'];
    const providers = ['aws', 'gcp'];

    // Generate 30 days of historical data
    for (let day = 30; day >= 0; day--) {
      const timestamp = new Date(now - day * 86400000);

      for (const service of services) {
        const baseRate = this.getServiceBaseRate(service);
        const dailyVariation = 0.9 + Math.random() * 0.2;
        const amount = baseRate * dailyVariation;

        this.costEntries.push({
          id: crypto.randomUUID(),
          timestamp: timestamp.toISOString(),
          service,
          category: this.getServiceCategory(service),
          provider: providers[Math.floor(Math.random() * providers.length)],
          region: 'us-west-2',
          amount: Math.round(amount * 100) / 100,
          currency: 'USD',
          usageQuantity: Math.round(amount * 10),
          usageUnit: 'hours',
          tags: { environment: 'production', team: 'platform' },
        });
      }
    }
  }

  /**
   * Get base rate for a service
   */
  private getServiceBaseRate(service: string): number {
    const rates: Record<string, number> = {
      orchestrator: 15,
      worker: 45,
      web: 8,
      redis: 12,
      postgres: 25,
      storage: 5,
    };
    return rates[service] || 10;
  }

  /**
   * Get category for a service
   */
  private getServiceCategory(service: string): CostCategory {
    const categories: Record<string, CostCategory> = {
      orchestrator: 'compute',
      worker: 'compute',
      web: 'compute',
      redis: 'database',
      postgres: 'database',
      storage: 'storage',
    };
    return categories[service] || 'other';
  }

  /**
   * Initialize budgets
   */
  private initializeBudgets(): void {
    const budgets: Omit<Budget, 'id' | 'currentSpend' | 'forecastedSpend' | 'status' | 'createdAt'>[] = [
      {
        name: 'Monthly Infrastructure',
        amount: 5000,
        currency: 'USD',
        period: 'monthly',
        alertThresholds: [50, 75, 90, 100],
      },
      {
        name: 'Compute Resources',
        amount: 3000,
        currency: 'USD',
        period: 'monthly',
        scope: { categories: ['compute'] },
        alertThresholds: [75, 90, 100],
      },
      {
        name: 'Database Services',
        amount: 1500,
        currency: 'USD',
        period: 'monthly',
        scope: { categories: ['database'] },
        alertThresholds: [75, 90, 100],
      },
    ];

    for (const budget of budgets) {
      const id = crypto.randomUUID();
      const currentSpend = this.calculateBudgetSpend(budget);
      const forecastedSpend = currentSpend * 1.1;

      this.budgets.set(id, {
        id,
        ...budget,
        currentSpend,
        forecastedSpend,
        status: this.getBudgetStatus(currentSpend, budget.amount),
        createdAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Calculate current spend for a budget
   */
  private calculateBudgetSpend(
    budget: Partial<Budget>
  ): number {
    const now = new Date();
    const periodStart = this.getPeriodStart(budget.period || 'monthly', now);

    let entries = this.costEntries.filter(
      e => new Date(e.timestamp) >= periodStart
    );

    if (budget.scope?.services) {
      entries = entries.filter(e => budget.scope!.services!.includes(e.service));
    }
    if (budget.scope?.categories) {
      entries = entries.filter(e => budget.scope!.categories!.includes(e.category));
    }
    if (budget.scope?.providers) {
      entries = entries.filter(e => budget.scope!.providers!.includes(e.provider));
    }

    return entries.reduce((sum, e) => sum + e.amount, 0);
  }

  /**
   * Get period start date
   */
  private getPeriodStart(period: string, date: Date): Date {
    const start = new Date(date);
    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'quarterly':
        start.setMonth(Math.floor(start.getMonth() / 3) * 3);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    return start;
  }

  /**
   * Get budget status
   */
  private getBudgetStatus(currentSpend: number, amount: number): Budget['status'] {
    const percentage = (currentSpend / amount) * 100;
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 75) return 'warning';
    return 'on_track';
  }

  /**
   * Initialize optimization recommendations
   */
  private initializeOptimizations(): void {
    const optimizations: Omit<CostOptimization, 'id'>[] = [
      {
        title: 'Right-size Worker Pods',
        description: 'Worker pods are using only 45% of allocated CPU on average. Consider reducing CPU requests.',
        category: 'compute',
        estimatedSavings: 450,
        savingsPercentage: 15,
        effort: 'low',
        impact: 'medium',
        status: 'pending',
        actionItems: [
          'Analyze worker CPU utilization metrics',
          'Test with reduced CPU limits in staging',
          'Update deployment configurations',
          'Monitor performance after changes',
        ],
      },
      {
        title: 'Enable Storage Lifecycle Policies',
        description: 'Old artifacts can be moved to cheaper storage tiers or deleted after 30 days.',
        category: 'storage',
        estimatedSavings: 120,
        savingsPercentage: 25,
        effort: 'low',
        impact: 'low',
        status: 'pending',
        actionItems: [
          'Define retention policies for artifacts',
          'Configure lifecycle rules in S3/GCS',
          'Verify backup requirements',
        ],
      },
      {
        title: 'Use Reserved Instances',
        description: 'Switch from on-demand to reserved instances for stable workloads (1-year commitment).',
        category: 'compute',
        estimatedSavings: 800,
        savingsPercentage: 30,
        effort: 'medium',
        impact: 'high',
        status: 'pending',
        actionItems: [
          'Analyze instance usage patterns',
          'Calculate break-even point',
          'Purchase reserved capacity',
          'Update infrastructure as code',
        ],
      },
      {
        title: 'Optimize Database Queries',
        description: 'Several slow queries are causing high database CPU usage. Optimization could reduce DB costs.',
        category: 'database',
        estimatedSavings: 200,
        savingsPercentage: 10,
        effort: 'medium',
        impact: 'medium',
        status: 'in_progress',
        actionItems: [
          'Identify slow queries from logs',
          'Add missing indexes',
          'Optimize query patterns',
          'Consider query caching',
        ],
      },
      {
        title: 'Enable Spot Instances for Workers',
        description: 'Use spot/preemptible instances for fault-tolerant worker jobs.',
        category: 'compute',
        estimatedSavings: 600,
        savingsPercentage: 40,
        effort: 'high',
        impact: 'high',
        status: 'pending',
        actionItems: [
          'Implement job checkpointing',
          'Configure spot instance termination handling',
          'Set up mixed instance groups',
          'Test failover behavior',
        ],
      },
    ];

    for (const opt of optimizations) {
      const id = crypto.randomUUID();
      this.optimizations.set(id, { id, ...opt });
    }
  }

  /**
   * Record a cost entry
   */
  recordCost(entry: Omit<CostEntry, 'id' | 'timestamp'>): CostEntry {
    const costEntry: CostEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.costEntries.push(costEntry);

    // Check for anomalies
    this.detectAnomalies(costEntry);

    // Update budgets
    this.updateBudgets();

    this.emit('cost:recorded', costEntry);
    return costEntry;
  }

  /**
   * Get cost summary for a period
   */
  getCostSummary(
    startDate: Date,
    endDate: Date
  ): CostSummary {
    const entries = this.costEntries.filter(
      e => new Date(e.timestamp) >= startDate && new Date(e.timestamp) <= endDate
    );

    const byCategory: Record<string, number> = {};
    const byService: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let totalCost = 0;

    for (const entry of entries) {
      totalCost += entry.amount;
      byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.amount;
      byService[entry.service] = (byService[entry.service] || 0) + entry.amount;
      byProvider[entry.provider] = (byProvider[entry.provider] || 0) + entry.amount;
    }

    // Calculate trend vs previous period
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
    const prevStart = new Date(startDate.getTime() - periodDays * 86400000);
    const prevEnd = new Date(startDate.getTime() - 1);

    const prevEntries = this.costEntries.filter(
      e => new Date(e.timestamp) >= prevStart && new Date(e.timestamp) <= prevEnd
    );
    const prevTotal = prevEntries.reduce((sum, e) => sum + e.amount, 0);

    const changePercent = prevTotal > 0
      ? ((totalCost - prevTotal) / prevTotal) * 100
      : 0;

    let trend: CostSummary['trend'] = 'stable';
    if (changePercent > 5) trend = 'increasing';
    else if (changePercent < -5) trend = 'decreasing';

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      byCategory: byCategory as Record<CostCategory, number>,
      byService,
      byProvider,
      trend,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  }

  /**
   * Get daily cost breakdown
   */
  getDailyCosts(days: number = 30): Array<{
    date: string;
    total: number;
    byService: Record<string, number>;
  }> {
    const result: Array<{ date: string; total: number; byService: Record<string, number> }> = [];
    const now = new Date();

    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 86400000);
      const dateStr = date.toISOString().split('T')[0];

      const dayEntries = this.costEntries.filter(e => e.timestamp.startsWith(dateStr));

      const byService: Record<string, number> = {};
      let total = 0;

      for (const entry of dayEntries) {
        total += entry.amount;
        byService[entry.service] = (byService[entry.service] || 0) + entry.amount;
      }

      result.push({
        date: dateStr,
        total: Math.round(total * 100) / 100,
        byService,
      });
    }

    return result;
  }

  /**
   * Detect cost anomalies
   */
  private detectAnomalies(entry: CostEntry): void {
    // Get historical average for this service
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const historicalEntries = this.costEntries.filter(
      e => e.service === entry.service &&
        new Date(e.timestamp) >= thirtyDaysAgo &&
        e.id !== entry.id
    );

    if (historicalEntries.length < 7) return; // Not enough data

    const avgCost = historicalEntries.reduce((sum, e) => sum + e.amount, 0) / historicalEntries.length;
    const stdDev = Math.sqrt(
      historicalEntries.reduce((sum, e) => sum + Math.pow(e.amount - avgCost, 2), 0) / historicalEntries.length
    );

    const deviation = (entry.amount - avgCost) / (stdDev || 1);

    // Flag if more than 2 standard deviations
    if (Math.abs(deviation) > 2) {
      const severity = Math.abs(deviation) > 4 ? 'critical' :
        Math.abs(deviation) > 3 ? 'high' :
          Math.abs(deviation) > 2.5 ? 'medium' : 'low';

      const anomaly: CostAnomaly = {
        id: crypto.randomUUID(),
        detectedAt: new Date().toISOString(),
        service: entry.service,
        category: entry.category,
        severity,
        description: `Cost for ${entry.service} is ${deviation > 0 ? 'higher' : 'lower'} than expected`,
        expectedCost: Math.round(avgCost * 100) / 100,
        actualCost: entry.amount,
        deviation: Math.round(deviation * 100) / 100,
        status: 'open',
      };

      this.anomalies.push(anomaly);
      this.emit('anomaly:detected', anomaly);
    }
  }

  /**
   * Get anomalies
   */
  getAnomalies(status?: CostAnomaly['status']): CostAnomaly[] {
    if (status) {
      return this.anomalies.filter(a => a.status === status);
    }
    return [...this.anomalies];
  }

  /**
   * Update anomaly status
   */
  updateAnomalyStatus(
    id: string,
    status: CostAnomaly['status'],
    resolution?: string
  ): CostAnomaly | null {
    const anomaly = this.anomalies.find(a => a.id === id);
    if (!anomaly) return null;

    anomaly.status = status;
    if (resolution) {
      anomaly.resolution = resolution;
    }

    this.emit('anomaly:updated', anomaly);
    return anomaly;
  }

  /**
   * Update all budgets
   */
  private updateBudgets(): void {
    for (const [id, budget] of this.budgets) {
      const currentSpend = this.calculateBudgetSpend(budget);
      const prevStatus = budget.status;

      budget.currentSpend = currentSpend;
      budget.status = this.getBudgetStatus(currentSpend, budget.amount);

      // Check alert thresholds
      const percentage = (currentSpend / budget.amount) * 100;
      for (const threshold of budget.alertThresholds) {
        const prevPercentage = ((currentSpend - 1) / budget.amount) * 100; // Approximate
        if (percentage >= threshold && prevPercentage < threshold) {
          this.emit('budget:threshold', { budget, threshold, percentage });
        }
      }

      if (prevStatus !== budget.status) {
        this.emit('budget:status_changed', { budget, prevStatus });
      }
    }
  }

  /**
   * Get all budgets
   */
  getBudgets(): Budget[] {
    return Array.from(this.budgets.values());
  }

  /**
   * Get budget by ID
   */
  getBudget(id: string): Budget | undefined {
    return this.budgets.get(id);
  }

  /**
   * Create a budget
   */
  createBudget(
    config: Omit<Budget, 'id' | 'currentSpend' | 'forecastedSpend' | 'status' | 'createdAt'>
  ): Budget {
    const id = crypto.randomUUID();
    const currentSpend = this.calculateBudgetSpend(config);

    const budget: Budget = {
      id,
      ...config,
      currentSpend,
      forecastedSpend: currentSpend * 1.1,
      status: this.getBudgetStatus(currentSpend, config.amount),
      createdAt: new Date().toISOString(),
    };

    this.budgets.set(id, budget);
    this.emit('budget:created', budget);
    return budget;
  }

  /**
   * Update a budget
   */
  updateBudget(
    id: string,
    updates: Partial<Omit<Budget, 'id' | 'createdAt'>>
  ): Budget | null {
    const budget = this.budgets.get(id);
    if (!budget) return null;

    Object.assign(budget, updates);
    budget.currentSpend = this.calculateBudgetSpend(budget);
    budget.status = this.getBudgetStatus(budget.currentSpend, budget.amount);

    this.emit('budget:updated', budget);
    return budget;
  }

  /**
   * Delete a budget
   */
  deleteBudget(id: string): boolean {
    return this.budgets.delete(id);
  }

  /**
   * Get optimization recommendations
   */
  getOptimizations(status?: CostOptimization['status']): CostOptimization[] {
    const opts = Array.from(this.optimizations.values());
    if (status) {
      return opts.filter(o => o.status === status);
    }
    return opts;
  }

  /**
   * Update optimization status
   */
  updateOptimizationStatus(
    id: string,
    status: CostOptimization['status'],
    actualSavings?: number
  ): CostOptimization | null {
    const opt = this.optimizations.get(id);
    if (!opt) return null;

    opt.status = status;
    if (status === 'implemented') {
      opt.implementedAt = new Date().toISOString();
      if (actualSavings !== undefined) {
        opt.actualSavings = actualSavings;
      }
    }

    this.emit('optimization:updated', opt);
    return opt;
  }

  /**
   * Get cost forecast
   */
  getForecast(days: number = 30): CostForecast {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 86400000);

    // Use last 30 days average as base
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const recentEntries = this.costEntries.filter(
      e => new Date(e.timestamp) >= thirtyDaysAgo
    );

    const dailyAvg = recentEntries.reduce((sum, e) => sum + e.amount, 0) / 30;
    const forecastedCost = dailyAvg * days;

    // Calculate variance for confidence interval
    const dailyCosts: Record<string, number> = {};
    for (const entry of recentEntries) {
      const date = entry.timestamp.split('T')[0];
      dailyCosts[date] = (dailyCosts[date] || 0) + entry.amount;
    }

    const dailyValues = Object.values(dailyCosts);
    const variance = dailyValues.reduce(
      (sum, v) => sum + Math.pow(v - dailyAvg, 2), 0
    ) / dailyValues.length;
    const stdDev = Math.sqrt(variance);

    // Forecast by service
    const byService: Record<string, number> = {};
    const serviceAvgs = new Map<string, number>();

    for (const entry of recentEntries) {
      const current = serviceAvgs.get(entry.service) || 0;
      serviceAvgs.set(entry.service, current + entry.amount);
    }

    for (const [service, total] of serviceAvgs) {
      byService[service] = Math.round((total / 30) * days * 100) / 100;
    }

    return {
      period: {
        start: now.toISOString(),
        end: endDate.toISOString(),
      },
      forecastedCost: Math.round(forecastedCost * 100) / 100,
      confidenceInterval: {
        low: Math.round((forecastedCost - 2 * stdDev * Math.sqrt(days)) * 100) / 100,
        high: Math.round((forecastedCost + 2 * stdDev * Math.sqrt(days)) * 100) / 100,
      },
      assumptions: [
        'Based on last 30 days of spending',
        'Assumes no major infrastructure changes',
        'Does not account for seasonal variations',
      ],
      byService,
    };
  }

  /**
   * Get cost allocation tags
   */
  getAllTags(): Record<string, string[]> {
    const tags: Record<string, Set<string>> = {};

    for (const entry of this.costEntries) {
      if (entry.tags) {
        for (const [key, value] of Object.entries(entry.tags)) {
          if (!tags[key]) {
            tags[key] = new Set();
          }
          tags[key].add(value);
        }
      }
    }

    const result: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(tags)) {
      result[key] = Array.from(values);
    }
    return result;
  }

  /**
   * Start cost collection
   */
  startCollection(intervalMs: number = 60000): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    this.collectionInterval = setInterval(() => {
      // Simulate new cost entries
      const services = ['orchestrator', 'worker', 'web', 'redis', 'postgres'];
      const service = services[Math.floor(Math.random() * services.length)];
      const baseRate = this.getServiceBaseRate(service) / (24 * 60); // Per-minute rate

      this.recordCost({
        service,
        category: this.getServiceCategory(service),
        provider: 'aws',
        region: 'us-west-2',
        amount: Math.round(baseRate * (0.9 + Math.random() * 0.2) * 100) / 100,
        currency: 'USD',
        tags: { environment: 'production', team: 'platform' },
      });
    }, intervalMs);

    console.log('[CostMonitoring] Started cost collection');
  }

  /**
   * Stop cost collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    console.log('[CostMonitoring] Stopped cost collection');
  }

  /**
   * Get overall statistics
   */
  getStats(): {
    totalSpendThisMonth: number;
    budgetUtilization: number;
    openAnomalies: number;
    potentialSavings: number;
    topSpendingServices: Array<{ service: string; amount: number }>;
  } {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEntries = this.costEntries.filter(
      e => new Date(e.timestamp) >= monthStart
    );

    const totalSpend = monthEntries.reduce((sum, e) => sum + e.amount, 0);

    // Calculate budget utilization
    const mainBudget = Array.from(this.budgets.values()).find(b => b.period === 'monthly' && !b.scope);
    const budgetUtilization = mainBudget
      ? (mainBudget.currentSpend / mainBudget.amount) * 100
      : 0;

    // Count open anomalies
    const openAnomalies = this.anomalies.filter(a => a.status === 'open').length;

    // Calculate potential savings
    const potentialSavings = Array.from(this.optimizations.values())
      .filter(o => o.status === 'pending')
      .reduce((sum, o) => sum + o.estimatedSavings, 0);

    // Get top spending services
    const serviceSpend: Record<string, number> = {};
    for (const entry of monthEntries) {
      serviceSpend[entry.service] = (serviceSpend[entry.service] || 0) + entry.amount;
    }

    const topServices = Object.entries(serviceSpend)
      .map(([service, amount]) => ({ service, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalSpendThisMonth: Math.round(totalSpend * 100) / 100,
      budgetUtilization: Math.round(budgetUtilization * 100) / 100,
      openAnomalies,
      potentialSavings,
      topSpendingServices: topServices,
    };
  }
}

// Export singleton instance
export const costMonitoringService = new CostMonitoringService();

export default costMonitoringService;
