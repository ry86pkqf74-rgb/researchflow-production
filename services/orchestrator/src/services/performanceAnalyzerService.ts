/**
 * Performance Analyzer Service
 *
 * Phase G - Task 125: Performance Bottleneck Analyzer
 *
 * Analyzes workflow and system performance to identify bottlenecks:
 * - Stage timing analysis for workflows
 * - Database query performance tracking
 * - External API call latency monitoring
 * - Critical path analysis
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const StageTimingSchema = z.object({
  stageName: z.string(),
  avgDurationMs: z.number(),
  minDurationMs: z.number(),
  maxDurationMs: z.number(),
  p95DurationMs: z.number(),
  percentOfTotal: z.number(),
  sampleCount: z.number(),
  trend: z.enum(['improving', 'stable', 'degrading']).optional(),
});

export const QueryTimingSchema = z.object({
  queryPattern: z.string(),
  tableName: z.string().optional(),
  avgDurationMs: z.number(),
  maxDurationMs: z.number(),
  callCount: z.number(),
  slowQueryCount: z.number(),
  indexUsed: z.boolean().optional(),
});

export const ExternalCallTimingSchema = z.object({
  service: z.string(),
  endpoint: z.string().optional(),
  avgDurationMs: z.number(),
  p95DurationMs: z.number(),
  callCount: z.number(),
  errorRate: z.number(),
  timeoutCount: z.number(),
});

export const BottleneckSchema = z.object({
  id: z.string(),
  type: z.enum(['stage', 'database', 'external_api', 'cpu', 'memory', 'network']),
  component: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  impact: z.string(),
  metrics: z.record(z.string(), z.number()),
  detectedAt: z.string().datetime(),
});

export const PerformanceReportSchema = z.object({
  timestamp: z.string().datetime(),
  analysisWindow: z.string(),
  overallHealthScore: z.number().min(0).max(100),
  stageTimings: z.array(StageTimingSchema),
  databaseTimings: z.array(QueryTimingSchema),
  externalCallTimings: z.array(ExternalCallTimingSchema),
  bottlenecks: z.array(BottleneckSchema),
  criticalPath: z.array(z.string()),
  totalWorkflowAvgMs: z.number(),
  throughputPerMinute: z.number(),
});

export type StageTiming = z.infer<typeof StageTimingSchema>;
export type QueryTiming = z.infer<typeof QueryTimingSchema>;
export type ExternalCallTiming = z.infer<typeof ExternalCallTimingSchema>;
export type Bottleneck = z.infer<typeof BottleneckSchema>;
export type PerformanceReport = z.infer<typeof PerformanceReportSchema>;

// ============================================================================
// In-Memory Performance Data Storage
// ============================================================================

interface StageTimingRecord {
  stageName: string;
  durationMs: number;
  timestamp: Date;
  jobId?: string;
}

interface QueryTimingRecord {
  queryPattern: string;
  tableName?: string;
  durationMs: number;
  timestamp: Date;
  indexUsed?: boolean;
}

interface ExternalCallRecord {
  service: string;
  endpoint?: string;
  durationMs: number;
  timestamp: Date;
  success: boolean;
  timeout: boolean;
}

const stageTimings: StageTimingRecord[] = [];
const queryTimings: QueryTimingRecord[] = [];
const externalCallRecords: ExternalCallRecord[] = [];

const MAX_RECORDS = 10000;
const SLOW_QUERY_THRESHOLD_MS = 1000;

// ============================================================================
// Performance Analyzer Service
// ============================================================================

class PerformanceAnalyzerService {
  /**
   * Record a stage timing
   */
  recordStageTiming(stageName: string, durationMs: number, jobId?: string): void {
    stageTimings.push({
      stageName,
      durationMs,
      timestamp: new Date(),
      jobId,
    });

    // Trim to max records
    if (stageTimings.length > MAX_RECORDS) {
      stageTimings.splice(0, stageTimings.length - MAX_RECORDS);
    }
  }

  /**
   * Record a database query timing
   */
  recordQueryTiming(queryPattern: string, durationMs: number, options?: {
    tableName?: string;
    indexUsed?: boolean;
  }): void {
    queryTimings.push({
      queryPattern,
      durationMs,
      timestamp: new Date(),
      tableName: options?.tableName,
      indexUsed: options?.indexUsed,
    });

    if (queryTimings.length > MAX_RECORDS) {
      queryTimings.splice(0, queryTimings.length - MAX_RECORDS);
    }
  }

  /**
   * Record an external API call timing
   */
  recordExternalCall(service: string, durationMs: number, options?: {
    endpoint?: string;
    success?: boolean;
    timeout?: boolean;
  }): void {
    externalCallRecords.push({
      service,
      durationMs,
      timestamp: new Date(),
      endpoint: options?.endpoint,
      success: options?.success ?? true,
      timeout: options?.timeout ?? false,
    });

    if (externalCallRecords.length > MAX_RECORDS) {
      externalCallRecords.splice(0, externalCallRecords.length - MAX_RECORDS);
    }
  }

  /**
   * Analyze performance and generate report
   */
  async analyzePerformance(windowMinutes: number = 60): Promise<PerformanceReport> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

    // If no data, generate mock data for demo
    if (stageTimings.length === 0) {
      this.generateMockData();
    }

    // Analyze stage timings
    const stageAnalysis = this.analyzeStageTimings(cutoff);

    // Analyze database queries
    const dbAnalysis = this.analyzeQueryTimings(cutoff);

    // Analyze external calls
    const externalAnalysis = this.analyzeExternalCalls(cutoff);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(stageAnalysis, dbAnalysis, externalAnalysis);

    // Calculate overall metrics
    const totalAvgMs = stageAnalysis.reduce((sum, s) => sum + s.avgDurationMs, 0);
    const throughput = this.calculateThroughput(cutoff);

    // Determine critical path
    const criticalPath = this.identifyCriticalPath(stageAnalysis);

    // Calculate health score
    const healthScore = this.calculateHealthScore(bottlenecks, stageAnalysis);

    return {
      timestamp: new Date().toISOString(),
      analysisWindow: `${windowMinutes} minutes`,
      overallHealthScore: healthScore,
      stageTimings: stageAnalysis,
      databaseTimings: dbAnalysis,
      externalCallTimings: externalAnalysis,
      bottlenecks,
      criticalPath,
      totalWorkflowAvgMs: totalAvgMs,
      throughputPerMinute: throughput,
    };
  }

  /**
   * Analyze stage timings
   */
  private analyzeStageTimings(cutoff: Date): StageTiming[] {
    const relevantTimings = stageTimings.filter(t => t.timestamp >= cutoff);
    const byStage = new Map<string, number[]>();

    for (const timing of relevantTimings) {
      const durations = byStage.get(timing.stageName) || [];
      durations.push(timing.durationMs);
      byStage.set(timing.stageName, durations);
    }

    const totalDuration = Array.from(byStage.values())
      .flat()
      .reduce((sum, d) => sum + d, 0);

    const results: StageTiming[] = [];

    for (const [stageName, durations] of byStage) {
      const sorted = [...durations].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const avg = sum / sorted.length;

      results.push({
        stageName,
        avgDurationMs: Math.round(avg),
        minDurationMs: sorted[0],
        maxDurationMs: sorted[sorted.length - 1],
        p95DurationMs: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
        percentOfTotal: totalDuration > 0 ? Math.round((sum / totalDuration) * 100) : 0,
        sampleCount: sorted.length,
        trend: this.determineTrend(durations),
      });
    }

    // Sort by percent of total (descending)
    return results.sort((a, b) => b.percentOfTotal - a.percentOfTotal);
  }

  /**
   * Analyze query timings
   */
  private analyzeQueryTimings(cutoff: Date): QueryTiming[] {
    const relevantTimings = queryTimings.filter(t => t.timestamp >= cutoff);
    const byPattern = new Map<string, QueryTimingRecord[]>();

    for (const timing of relevantTimings) {
      const records = byPattern.get(timing.queryPattern) || [];
      records.push(timing);
      byPattern.set(timing.queryPattern, records);
    }

    const results: QueryTiming[] = [];

    for (const [queryPattern, records] of byPattern) {
      const durations = records.map(r => r.durationMs);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      const slowCount = durations.filter(d => d > SLOW_QUERY_THRESHOLD_MS).length;

      results.push({
        queryPattern,
        tableName: records[0]?.tableName,
        avgDurationMs: Math.round(avg),
        maxDurationMs: max,
        callCount: records.length,
        slowQueryCount: slowCount,
        indexUsed: records.some(r => r.indexUsed),
      });
    }

    return results.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
  }

  /**
   * Analyze external API calls
   */
  private analyzeExternalCalls(cutoff: Date): ExternalCallTiming[] {
    const relevantCalls = externalCallRecords.filter(c => c.timestamp >= cutoff);
    const byService = new Map<string, ExternalCallRecord[]>();

    for (const call of relevantCalls) {
      const records = byService.get(call.service) || [];
      records.push(call);
      byService.set(call.service, records);
    }

    const results: ExternalCallTiming[] = [];

    for (const [service, records] of byService) {
      const durations = records.map(r => r.durationMs).sort((a, b) => a - b);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95 = durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1];
      const errorCount = records.filter(r => !r.success).length;
      const timeoutCount = records.filter(r => r.timeout).length;

      results.push({
        service,
        avgDurationMs: Math.round(avg),
        p95DurationMs: p95,
        callCount: records.length,
        errorRate: records.length > 0 ? errorCount / records.length : 0,
        timeoutCount,
      });
    }

    return results.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(
    stages: StageTiming[],
    queries: QueryTiming[],
    external: ExternalCallTiming[]
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Stage bottlenecks
    for (const stage of stages) {
      if (stage.percentOfTotal > 40) {
        bottlenecks.push({
          id: `stage-${stage.stageName}`,
          type: 'stage',
          component: stage.stageName,
          severity: stage.percentOfTotal > 60 ? 'critical' : 'high',
          description: `Stage "${stage.stageName}" takes ${stage.percentOfTotal}% of total workflow time`,
          impact: `Optimizing this stage could reduce workflow time by up to ${Math.round(stage.avgDurationMs * 0.3)}ms`,
          metrics: {
            avgDurationMs: stage.avgDurationMs,
            percentOfTotal: stage.percentOfTotal,
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Database bottlenecks
    for (const query of queries) {
      if (query.slowQueryCount > 0 || query.avgDurationMs > 500) {
        bottlenecks.push({
          id: `db-${query.queryPattern.substring(0, 20)}`,
          type: 'database',
          component: query.tableName || 'Unknown table',
          severity: query.avgDurationMs > 2000 ? 'critical' : query.avgDurationMs > 1000 ? 'high' : 'medium',
          description: `Query "${query.queryPattern.substring(0, 50)}..." has ${query.slowQueryCount} slow executions`,
          impact: query.indexUsed === false
            ? 'Consider adding an index to improve query performance'
            : 'Query optimization or caching may help',
          metrics: {
            avgDurationMs: query.avgDurationMs,
            maxDurationMs: query.maxDurationMs,
            slowQueryCount: query.slowQueryCount,
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // External API bottlenecks
    for (const call of external) {
      if (call.p95DurationMs > 1000 || call.errorRate > 0.05) {
        bottlenecks.push({
          id: `external-${call.service}`,
          type: 'external_api',
          component: call.service,
          severity: call.errorRate > 0.1 ? 'critical' : call.p95DurationMs > 2000 ? 'high' : 'medium',
          description: `External calls to ${call.service} have ${Math.round(call.errorRate * 100)}% error rate and ${call.p95DurationMs}ms p95 latency`,
          impact: 'Consider caching responses or implementing circuit breaker',
          metrics: {
            avgDurationMs: call.avgDurationMs,
            p95DurationMs: call.p95DurationMs,
            errorRate: call.errorRate * 100,
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return bottlenecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Identify the critical path (longest chain of dependent operations)
   */
  private identifyCriticalPath(stages: StageTiming[]): string[] {
    // Return stages sorted by duration (assuming sequential execution)
    return stages
      .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
      .slice(0, 5)
      .map(s => s.stageName);
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(bottlenecks: Bottleneck[], stages: StageTiming[]): number {
    let score = 100;

    // Deduct for bottlenecks
    for (const bottleneck of bottlenecks) {
      switch (bottleneck.severity) {
        case 'critical': score -= 20; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
      }
    }

    // Deduct for degrading trends
    const degradingStages = stages.filter(s => s.trend === 'degrading').length;
    score -= degradingStages * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine performance trend from recent samples
   */
  private determineTrend(durations: number[]): 'improving' | 'stable' | 'degrading' {
    if (durations.length < 10) return 'stable';

    const recent = durations.slice(-10);
    const older = durations.slice(-20, -10);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent > 10) return 'degrading';
    if (changePercent < -10) return 'improving';
    return 'stable';
  }

  /**
   * Calculate throughput (jobs per minute)
   */
  private calculateThroughput(cutoff: Date): number {
    const relevantTimings = stageTimings.filter(t => t.timestamp >= cutoff);
    const uniqueJobs = new Set(relevantTimings.filter(t => t.jobId).map(t => t.jobId));
    const windowMinutes = (Date.now() - cutoff.getTime()) / (60 * 1000);

    return windowMinutes > 0 ? Math.round(uniqueJobs.size / windowMinutes) : 0;
  }

  /**
   * Generate mock data for demo
   */
  private generateMockData(): void {
    const stages = ['DataLoading', 'Preprocessing', 'FeatureExtraction', 'ModelTraining', 'Validation', 'Export'];
    const queries = ['SELECT * FROM experiments', 'SELECT * FROM artifacts', 'INSERT INTO results'];
    const services = ['PubMed', 'OpenAI', 'Anthropic'];

    for (let i = 0; i < 100; i++) {
      // Stage timings
      for (const stage of stages) {
        const baseDuration = stage === 'ModelTraining' ? 5000 : stage === 'DataLoading' ? 2000 : 500;
        this.recordStageTiming(stage, baseDuration + Math.random() * baseDuration * 0.5, `job-${i}`);
      }

      // Query timings
      for (const query of queries) {
        this.recordQueryTiming(query, 50 + Math.random() * 200, {
          tableName: query.includes('experiments') ? 'experiments' : 'artifacts',
          indexUsed: Math.random() > 0.3,
        });
      }

      // External calls
      for (const service of services) {
        this.recordExternalCall(service, 200 + Math.random() * 600, {
          success: Math.random() > 0.05,
          timeout: Math.random() < 0.02,
        });
      }
    }
  }

  /**
   * Get top N bottlenecks
   */
  async getTopBottlenecks(n: number = 5): Promise<Bottleneck[]> {
    const report = await this.analyzePerformance();
    return report.bottlenecks.slice(0, n);
  }

  /**
   * Clear all recorded data
   */
  clearData(): void {
    stageTimings.length = 0;
    queryTimings.length = 0;
    externalCallRecords.length = 0;
  }
}

// Export singleton instance
export const performanceAnalyzerService = new PerformanceAnalyzerService();

export default performanceAnalyzerService;
