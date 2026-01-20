/**
 * Prometheus Metrics Exporter
 *
 * Provides Prometheus-compatible metrics for ResearchFlow orchestrator.
 * Metrics can be scraped by Prometheus at /api/metrics/prometheus
 *
 * Metrics:
 * - ros_stage_executions_total{stage_id, status} - Counter for stage executions
 * - ros_stage_duration_seconds{stage_id} - Histogram for stage duration
 * - ros_active_workflows - Gauge for currently active workflows
 * - ros_phi_redactions_total - Counter for PHI redactions triggered
 * - ros_export_generations_total{format} - Counter for export generations
 */

export type StageStatus = 'started' | 'completed' | 'failed' | 'skipped';
export type ExportFormat = 'pdf' | 'docx' | 'json' | 'bundle' | 'unknown';

/**
 * Histogram bucket boundaries for stage duration (in seconds)
 */
const DURATION_BUCKETS = [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300];

/**
 * Counter metric implementation
 */
class Counter {
  private values: Map<string, number> = new Map();
  private name: string;
  private help: string;
  private labels: string[];

  constructor(name: string, help: string, labels: string[] = []) {
    this.name = name;
    this.help = help;
    this.labels = labels;
  }

  /**
   * Create a label key from label values
   */
  private makeKey(labelValues: Record<string, string>): string {
    if (this.labels.length === 0) return '';
    return this.labels.map(l => `${l}="${labelValues[l] || ''}"`).join(',');
  }

  /**
   * Increment the counter
   */
  inc(labelValues: Record<string, string> = {}, value = 1): void {
    const key = this.makeKey(labelValues);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  /**
   * Get current value for labels
   */
  get(labelValues: Record<string, string> = {}): number {
    const key = this.makeKey(labelValues);
    return this.values.get(key) || 0;
  }

  /**
   * Format as Prometheus text format
   */
  toPrometheus(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} counter`);

    if (this.values.size === 0) {
      // No data yet - output a zero value
      if (this.labels.length === 0) {
        lines.push(`${this.name} 0`);
      }
    } else {
      this.values.forEach((value, key) => {
        if (key) {
          lines.push(`${this.name}{${key}} ${value}`);
        } else {
          lines.push(`${this.name} ${value}`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Reset the counter (for testing)
   */
  reset(): void {
    this.values.clear();
  }

  /**
   * Get all values as JSON
   */
  toJSON(): Record<string, number> {
    const result: Record<string, number> = {};
    this.values.forEach((value, key) => {
      result[key || '_total'] = value;
    });
    return result;
  }
}

/**
 * Gauge metric implementation
 */
class Gauge {
  private value: number = 0;
  private name: string;
  private help: string;

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  /**
   * Set the gauge value
   */
  set(value: number): void {
    this.value = value;
  }

  /**
   * Increment the gauge
   */
  inc(value = 1): void {
    this.value += value;
  }

  /**
   * Decrement the gauge
   */
  dec(value = 1): void {
    this.value -= value;
    if (this.value < 0) this.value = 0;
  }

  /**
   * Get current value
   */
  get(): number {
    return this.value;
  }

  /**
   * Format as Prometheus text format
   */
  toPrometheus(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} gauge`);
    lines.push(`${this.name} ${this.value}`);
    return lines.join('\n');
  }

  /**
   * Reset the gauge (for testing)
   */
  reset(): void {
    this.value = 0;
  }
}

/**
 * Histogram metric implementation
 */
class Histogram {
  private counts: Map<string, number[]> = new Map();
  private sums: Map<string, number> = new Map();
  private totals: Map<string, number> = new Map();
  private name: string;
  private help: string;
  private labels: string[];
  private buckets: number[];

  constructor(name: string, help: string, labels: string[] = [], buckets: number[] = DURATION_BUCKETS) {
    this.name = name;
    this.help = help;
    this.labels = labels;
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  /**
   * Create a label key from label values
   */
  private makeKey(labelValues: Record<string, string>): string {
    if (this.labels.length === 0) return '';
    return this.labels.map(l => `${l}="${labelValues[l] || ''}"`).join(',');
  }

  /**
   * Observe a value
   */
  observe(labelValues: Record<string, string>, value: number): void {
    const key = this.makeKey(labelValues);

    // Initialize if needed
    if (!this.counts.has(key)) {
      this.counts.set(key, new Array(this.buckets.length).fill(0));
      this.sums.set(key, 0);
      this.totals.set(key, 0);
    }

    // Update bucket counts
    const counts = this.counts.get(key)!;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        counts[i]++;
      }
    }

    // Update sum and total
    this.sums.set(key, (this.sums.get(key) || 0) + value);
    this.totals.set(key, (this.totals.get(key) || 0) + 1);
  }

  /**
   * Start a timer that returns a function to observe the duration
   */
  startTimer(labelValues: Record<string, string>): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const durationNs = Number(end - start);
      const durationSeconds = durationNs / 1e9;
      this.observe(labelValues, durationSeconds);
    };
  }

  /**
   * Format as Prometheus text format
   */
  toPrometheus(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} histogram`);

    this.counts.forEach((counts, key) => {
      const labelPrefix = key ? `${key},` : '';
      const sum = this.sums.get(key) || 0;
      const total = this.totals.get(key) || 0;

      // Output bucket values (cumulative)
      let cumulative = 0;
      for (let i = 0; i < this.buckets.length; i++) {
        cumulative += counts[i];
        const le = this.buckets[i];
        lines.push(`${this.name}_bucket{${labelPrefix}le="${le}"} ${cumulative}`);
      }
      // +Inf bucket
      lines.push(`${this.name}_bucket{${labelPrefix}le="+Inf"} ${total}`);

      // Sum and count
      if (key) {
        lines.push(`${this.name}_sum{${key}} ${sum}`);
        lines.push(`${this.name}_count{${key}} ${total}`);
      } else {
        lines.push(`${this.name}_sum ${sum}`);
        lines.push(`${this.name}_count ${total}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Reset the histogram (for testing)
   */
  reset(): void {
    this.counts.clear();
    this.sums.clear();
    this.totals.clear();
  }

  /**
   * Get summary statistics as JSON
   */
  toJSON(): Record<string, { count: number; sum: number; avg: number }> {
    const result: Record<string, { count: number; sum: number; avg: number }> = {};
    this.totals.forEach((count, key) => {
      const sum = this.sums.get(key) || 0;
      result[key || '_total'] = {
        count,
        sum,
        avg: count > 0 ? sum / count : 0,
      };
    });
    return result;
  }
}

/**
 * Prometheus Metrics Registry
 */
class MetricsRegistry {
  // Stage execution counter
  public stageExecutions: Counter;

  // Stage duration histogram
  public stageDuration: Histogram;

  // Active workflows gauge
  public activeWorkflows: Gauge;

  // PHI redactions counter
  public phiRedactions: Counter;

  // Export generations counter
  public exportGenerations: Counter;

  // Error counter by type
  public errors: Counter;

  constructor() {
    this.stageExecutions = new Counter(
      'ros_stage_executions_total',
      'Total number of stage executions',
      ['stage_id', 'status']
    );

    this.stageDuration = new Histogram(
      'ros_stage_duration_seconds',
      'Duration of stage executions in seconds',
      ['stage_id'],
      DURATION_BUCKETS
    );

    this.activeWorkflows = new Gauge(
      'ros_active_workflows',
      'Number of currently active workflows'
    );

    this.phiRedactions = new Counter(
      'ros_phi_redactions_total',
      'Total number of PHI redaction events',
      ['stage_id']
    );

    this.exportGenerations = new Counter(
      'ros_export_generations_total',
      'Total number of export generations',
      ['format']
    );

    this.errors = new Counter(
      'ros_errors_total',
      'Total number of errors by type',
      ['type', 'stage_id']
    );
  }

  /**
   * Record a stage execution
   */
  recordStageExecution(stageId: string, status: StageStatus): void {
    this.stageExecutions.inc({ stage_id: stageId, status });
  }

  /**
   * Start timing a stage execution
   * Returns a function to call when the stage completes
   */
  startStageTiming(stageId: string): () => void {
    return this.stageDuration.startTimer({ stage_id: stageId });
  }

  /**
   * Record a stage execution with timing
   */
  recordStageWithDuration(stageId: string, status: StageStatus, durationSeconds: number): void {
    this.recordStageExecution(stageId, status);
    this.stageDuration.observe({ stage_id: stageId }, durationSeconds);
  }

  /**
   * Increment active workflows
   */
  workflowStarted(): void {
    this.activeWorkflows.inc();
  }

  /**
   * Decrement active workflows
   */
  workflowCompleted(): void {
    this.activeWorkflows.dec();
  }

  /**
   * Record a PHI redaction event
   */
  recordPhiRedaction(stageId: string): void {
    this.phiRedactions.inc({ stage_id: stageId });
  }

  /**
   * Record an export generation
   */
  recordExportGeneration(format: ExportFormat): void {
    this.exportGenerations.inc({ format });
  }

  /**
   * Record an error
   */
  recordError(type: string, stageId: string = 'unknown'): void {
    this.errors.inc({ type, stage_id: stageId });
  }

  /**
   * Get all metrics in Prometheus text format
   */
  toPrometheus(): string {
    const metrics = [
      this.stageExecutions.toPrometheus(),
      this.stageDuration.toPrometheus(),
      this.activeWorkflows.toPrometheus(),
      this.phiRedactions.toPrometheus(),
      this.exportGenerations.toPrometheus(),
      this.errors.toPrometheus(),
    ];

    return metrics.filter(m => m).join('\n\n') + '\n';
  }

  /**
   * Get all metrics as JSON
   */
  toJSON(): {
    stageExecutions: Record<string, number>;
    stageDuration: Record<string, { count: number; sum: number; avg: number }>;
    activeWorkflows: number;
    phiRedactions: Record<string, number>;
    exportGenerations: Record<string, number>;
    errors: Record<string, number>;
  } {
    return {
      stageExecutions: this.stageExecutions.toJSON(),
      stageDuration: this.stageDuration.toJSON(),
      activeWorkflows: this.activeWorkflows.get(),
      phiRedactions: this.phiRedactions.toJSON(),
      exportGenerations: this.exportGenerations.toJSON(),
      errors: this.errors.toJSON(),
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.stageExecutions.reset();
    this.stageDuration.reset();
    this.activeWorkflows.reset();
    this.phiRedactions.reset();
    this.exportGenerations.reset();
    this.errors.reset();
  }
}

// Singleton instance
let metricsInstance: MetricsRegistry | null = null;

/**
 * Get the metrics registry singleton
 */
export function getMetrics(): MetricsRegistry {
  if (!metricsInstance) {
    metricsInstance = new MetricsRegistry();
  }
  return metricsInstance;
}

/**
 * Reset the metrics registry (for testing)
 */
export function resetMetrics(): void {
  if (metricsInstance) {
    metricsInstance.reset();
  }
}

// Export classes for testing
export { Counter, Gauge, Histogram, MetricsRegistry };
