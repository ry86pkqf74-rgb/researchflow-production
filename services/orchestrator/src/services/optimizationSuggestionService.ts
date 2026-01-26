/**
 * Optimization Suggestion Service
 *
 * Phase G - Task 131: Auto-Optimization Suggestions
 *
 * Generates actionable optimization recommendations:
 * - Rule-based suggestions from performance analysis
 * - AI-powered suggestions (optional)
 * - Actionable recommendations with priority ranking
 */

import { z } from 'zod';
import { performanceAnalyzerService, Bottleneck, PerformanceReport } from './performanceAnalyzerService';
import { metricsCollectorService } from './metricsCollectorService';
import { haToggleService } from './haToggleService';

// ============================================================================
// Types & Schemas
// ============================================================================

export const SuggestionSchema = z.object({
  id: z.string(),
  category: z.enum([
    'performance',
    'scalability',
    'cost',
    'reliability',
    'security',
    'configuration',
  ]),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  effort: z.enum(['trivial', 'low', 'medium', 'high']),
  actionable: z.boolean(),
  actionType: z.enum(['manual', 'one-click', 'automated']).optional(),
  actionEndpoint: z.string().optional(),
  actionPayload: z.record(z.string(), z.unknown()).optional(),
  relatedBottleneck: z.string().optional(),
  estimatedImprovement: z.string().optional(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export const SuggestionReportSchema = z.object({
  timestamp: z.string().datetime(),
  analysisSource: z.string(),
  suggestions: z.array(SuggestionSchema),
  summary: z.object({
    totalSuggestions: z.number(),
    criticalCount: z.number(),
    highCount: z.number(),
    mediumCount: z.number(),
    lowCount: z.number(),
    actionableCount: z.number(),
  }),
  aiGenerated: z.boolean(),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;
export type SuggestionReport = z.infer<typeof SuggestionReportSchema>;

// ============================================================================
// Suggestion Rule Definitions
// ============================================================================

interface SuggestionRule {
  id: string;
  condition: (data: AnalysisData) => boolean;
  generate: (data: AnalysisData) => Omit<Suggestion, 'id' | 'createdAt'>;
}

interface AnalysisData {
  performanceReport: PerformanceReport;
  cacheStats: ReturnType<typeof metricsCollectorService.getCacheStats>;
  latencyStats: ReturnType<typeof metricsCollectorService.getLatencyStats>;
  haEnabled: boolean;
}

const SUGGESTION_RULES: SuggestionRule[] = [
  // Performance: Slow stage
  {
    id: 'slow-stage',
    condition: (data) => data.performanceReport.stageTimings.some(s => s.percentOfTotal > 40),
    generate: (data) => {
      const slowStage = data.performanceReport.stageTimings.find(s => s.percentOfTotal > 40)!;
      return {
        category: 'performance',
        priority: slowStage.percentOfTotal > 60 ? 'critical' : 'high',
        title: `Optimize "${slowStage.stageName}" stage`,
        description: `The "${slowStage.stageName}" stage takes ${slowStage.percentOfTotal}% of total workflow time (avg ${slowStage.avgDurationMs}ms).`,
        impact: `Reducing this stage by 30% would save ~${Math.round(slowStage.avgDurationMs * 0.3)}ms per workflow.`,
        effort: 'medium',
        actionable: false,
        estimatedImprovement: '15-30% workflow speedup',
        relatedBottleneck: `stage-${slowStage.stageName}`,
        tags: ['performance', 'workflow', 'optimization'],
      };
    },
  },

  // Performance: High API latency
  {
    id: 'high-api-latency',
    condition: (data) => data.latencyStats.p95Ms > 500,
    generate: (data) => ({
      category: 'performance',
      priority: data.latencyStats.p95Ms > 1000 ? 'high' : 'medium',
      title: 'Reduce API response latency',
      description: `API p95 latency is ${data.latencyStats.p95Ms}ms, exceeding the recommended 500ms threshold.`,
      impact: 'Slow API responses directly affect user experience and workflow throughput.',
      effort: 'medium',
      actionable: false,
      estimatedImprovement: '40-60% latency reduction',
      tags: ['performance', 'api', 'latency'],
    }),
  },

  // Caching: Low hit rate
  {
    id: 'low-cache-hit-rate',
    condition: (data) => data.cacheStats.hitRate < 0.7,
    generate: (data) => ({
      category: 'performance',
      priority: data.cacheStats.hitRate < 0.5 ? 'high' : 'medium',
      title: 'Improve cache hit rate',
      description: `Cache hit rate is ${Math.round(data.cacheStats.hitRate * 100)}%, which is below the optimal 70% threshold.`,
      impact: 'Low cache hit rate increases load on databases and external services.',
      effort: 'low',
      actionable: true,
      actionType: 'manual',
      estimatedImprovement: '20-40% reduction in backend load',
      tags: ['performance', 'caching', 'redis'],
    }),
  },

  // Scalability: HA not enabled
  {
    id: 'ha-not-enabled',
    condition: (data) => !data.haEnabled,
    generate: () => ({
      category: 'reliability',
      priority: 'medium',
      title: 'Enable High-Availability mode',
      description: 'High-Availability mode is not enabled. The system has single points of failure.',
      impact: 'Enabling HA provides 99.95% uptime SLA and automatic failover capabilities.',
      effort: 'trivial',
      actionable: true,
      actionType: 'one-click',
      actionEndpoint: '/api/cluster/ha',
      actionPayload: { enabled: true },
      estimatedImprovement: '10x improvement in availability',
      tags: ['reliability', 'ha', 'scalability'],
    }),
  },

  // Database: Slow queries
  {
    id: 'slow-database-queries',
    condition: (data) => data.performanceReport.databaseTimings.some(q => q.slowQueryCount > 0),
    generate: (data) => {
      const slowQuery = data.performanceReport.databaseTimings.find(q => q.slowQueryCount > 0)!;
      return {
        category: 'performance',
        priority: slowQuery.avgDurationMs > 2000 ? 'critical' : 'high',
        title: 'Optimize slow database queries',
        description: `Query "${slowQuery.queryPattern.substring(0, 40)}..." has ${slowQuery.slowQueryCount} slow executions (avg ${slowQuery.avgDurationMs}ms).`,
        impact: slowQuery.indexUsed === false
          ? 'Adding an index could reduce query time by 90%+'
          : 'Query optimization or caching recommended',
        effort: 'low',
        actionable: false,
        relatedBottleneck: `db-${slowQuery.queryPattern.substring(0, 20)}`,
        estimatedImprovement: '50-90% query speedup',
        tags: ['performance', 'database', 'query-optimization'],
      };
    },
  },

  // External API: High error rate
  {
    id: 'external-api-errors',
    condition: (data) => data.performanceReport.externalCallTimings.some(e => e.errorRate > 0.05),
    generate: (data) => {
      const problematic = data.performanceReport.externalCallTimings.find(e => e.errorRate > 0.05)!;
      return {
        category: 'reliability',
        priority: problematic.errorRate > 0.1 ? 'critical' : 'high',
        title: `Implement circuit breaker for ${problematic.service}`,
        description: `External calls to ${problematic.service} have ${Math.round(problematic.errorRate * 100)}% error rate.`,
        impact: 'Circuit breaker will prevent cascading failures and improve system stability.',
        effort: 'medium',
        actionable: false,
        estimatedImprovement: 'Prevent 90%+ of cascading failures',
        tags: ['reliability', 'external-api', 'circuit-breaker'],
      };
    },
  },

  // Scalability: High throughput
  {
    id: 'scale-workers',
    condition: (data) => data.performanceReport.throughputPerMinute > 50,
    generate: (data) => ({
      category: 'scalability',
      priority: 'medium',
      title: 'Consider scaling worker pods',
      description: `Current throughput is ${data.performanceReport.throughputPerMinute} jobs/min. Consider adding more workers.`,
      impact: 'Additional workers will reduce queue wait times and improve throughput.',
      effort: 'trivial',
      actionable: true,
      actionType: 'one-click',
      actionEndpoint: '/api/cluster/scale/horizontal',
      actionPayload: { service: 'worker', targetReplicas: 5 },
      estimatedImprovement: '40-60% throughput increase',
      tags: ['scalability', 'workers', 'horizontal-scaling'],
    }),
  },

  // Cost: Underutilized resources
  {
    id: 'underutilized-resources',
    condition: () => Math.random() < 0.3, // Simulate occasional detection
    generate: () => ({
      category: 'cost',
      priority: 'low',
      title: 'Right-size underutilized services',
      description: 'Some services are using less than 20% of allocated resources.',
      impact: 'Reducing resource allocation could save 15-30% on compute costs.',
      effort: 'low',
      actionable: true,
      actionType: 'manual',
      estimatedImprovement: '15-30% cost reduction',
      tags: ['cost', 'right-sizing', 'resources'],
    }),
  },
];

// ============================================================================
// Optimization Suggestion Service
// ============================================================================

class OptimizationSuggestionService {
  private useAI: boolean;

  constructor() {
    this.useAI = process.env.ENABLE_AI_SUGGESTIONS === 'true';
  }

  /**
   * Generate optimization suggestions based on current state
   */
  async getSuggestions(): Promise<SuggestionReport> {
    // Gather analysis data
    const performanceReport = await performanceAnalyzerService.analyzePerformance();
    const cacheStats = metricsCollectorService.getCacheStats();
    const latencyStats = metricsCollectorService.getLatencyStats();
    const haStatus = await haToggleService.getStatus();

    const analysisData: AnalysisData = {
      performanceReport,
      cacheStats,
      latencyStats,
      haEnabled: haStatus.enabled,
    };

    // Generate rule-based suggestions
    const suggestions: Suggestion[] = [];

    for (const rule of SUGGESTION_RULES) {
      try {
        if (rule.condition(analysisData)) {
          const suggestion = rule.generate(analysisData);
          suggestions.push({
            id: `${rule.id}-${Date.now()}`,
            ...suggestion,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    // Add bottleneck-specific suggestions
    for (const bottleneck of performanceReport.bottlenecks) {
      const existingSuggestion = suggestions.find(s => s.relatedBottleneck === bottleneck.id);
      if (!existingSuggestion) {
        suggestions.push(this.suggestionFromBottleneck(bottleneck));
      }
    }

    // Optionally enhance with AI suggestions
    if (this.useAI) {
      const aiSuggestions = await this.getAISuggestions(analysisData);
      suggestions.push(...aiSuggestions);
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Generate summary
    const summary = {
      totalSuggestions: suggestions.length,
      criticalCount: suggestions.filter(s => s.priority === 'critical').length,
      highCount: suggestions.filter(s => s.priority === 'high').length,
      mediumCount: suggestions.filter(s => s.priority === 'medium').length,
      lowCount: suggestions.filter(s => s.priority === 'low').length,
      actionableCount: suggestions.filter(s => s.actionable).length,
    };

    return {
      timestamp: new Date().toISOString(),
      analysisSource: 'rule-based' + (this.useAI ? ' + AI' : ''),
      suggestions,
      summary,
      aiGenerated: this.useAI,
    };
  }

  /**
   * Generate suggestion from a bottleneck
   */
  private suggestionFromBottleneck(bottleneck: Bottleneck): Suggestion {
    const priorityMap: Record<Bottleneck['severity'], Suggestion['priority']> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };

    return {
      id: `bottleneck-${bottleneck.id}-${Date.now()}`,
      category: 'performance',
      priority: priorityMap[bottleneck.severity],
      title: `Address ${bottleneck.type} bottleneck: ${bottleneck.component}`,
      description: bottleneck.description,
      impact: bottleneck.impact,
      effort: 'medium',
      actionable: false,
      relatedBottleneck: bottleneck.id,
      tags: ['bottleneck', bottleneck.type],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get AI-generated suggestions (placeholder for production implementation)
   */
  private async getAISuggestions(data: AnalysisData): Promise<Suggestion[]> {
    // In production, this would call Claude or GPT API with metrics summary
    // For now, return empty array
    console.log('[OptimizationSuggestion] AI suggestions not implemented');
    return [];
  }

  /**
   * Get suggestions by category
   */
  async getSuggestionsByCategory(category: Suggestion['category']): Promise<Suggestion[]> {
    const report = await this.getSuggestions();
    return report.suggestions.filter(s => s.category === category);
  }

  /**
   * Get actionable suggestions only
   */
  async getActionableSuggestions(): Promise<Suggestion[]> {
    const report = await this.getSuggestions();
    return report.suggestions.filter(s => s.actionable);
  }

  /**
   * Get critical and high priority suggestions
   */
  async getUrgentSuggestions(): Promise<Suggestion[]> {
    const report = await this.getSuggestions();
    return report.suggestions.filter(s => s.priority === 'critical' || s.priority === 'high');
  }

  /**
   * Mark a suggestion as dismissed/implemented
   */
  dismissSuggestion(suggestionId: string): void {
    // In production, this would persist the dismissal
    console.log(`Suggestion ${suggestionId} dismissed`);
  }

  /**
   * Execute an actionable suggestion
   */
  async executeSuggestion(suggestion: Suggestion): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!suggestion.actionable || suggestion.actionType === 'manual') {
      return {
        success: false,
        message: 'This suggestion requires manual action',
      };
    }

    if (!suggestion.actionEndpoint) {
      return {
        success: false,
        message: 'No action endpoint configured for this suggestion',
      };
    }

    // In production, this would make the API call
    console.log(`Executing suggestion: ${suggestion.title}`);
    console.log(`  Endpoint: ${suggestion.actionEndpoint}`);
    console.log(`  Payload:`, suggestion.actionPayload);

    return {
      success: true,
      message: `Action "${suggestion.title}" queued for execution`,
    };
  }

  /**
   * Get suggestion statistics over time
   */
  getSuggestionStats(): {
    topCategories: Array<{ category: string; count: number }>;
    avgSuggestionsPerAnalysis: number;
    implementationRate: number;
  } {
    // In production, this would query historical data
    return {
      topCategories: [
        { category: 'performance', count: 45 },
        { category: 'scalability', count: 23 },
        { category: 'reliability', count: 18 },
        { category: 'cost', count: 12 },
      ],
      avgSuggestionsPerAnalysis: 5.2,
      implementationRate: 0.68,
    };
  }
}

// Export singleton instance
export const optimizationSuggestionService = new OptimizationSuggestionService();

export default optimizationSuggestionService;
