/**
 * Prometheus Metrics Service for ResearchFlow
 *
 * Exposes metrics for AI routing, caching, and system health.
 * CRITICAL: Never expose PHI values in metrics - only aggregate counts/stats.
 */

import CacheService from './cache.service';

// Metric types
interface Counter {
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

interface Gauge {
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

interface Histogram {
  name: string;
  help: string;
  labels: string[];
  buckets: number[];
  values: Map<string, { count: number; sum: number; buckets: Map<number, number> }>;
}

class MetricsRegistry {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  registerCounter(name: string, help: string, labels: string[] = []): void {
    this.counters.set(name, { name, help, labels, values: new Map() });
  }

  registerGauge(name: string, help: string, labels: string[] = []): void {
    this.gauges.set(name, { name, help, labels, values: new Map() });
  }

  registerHistogram(name: string, help: string, labels: string[] = [], buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]): void {
    this.histograms.set(name, { name, help, labels, buckets, values: new Map() });
  }

  incCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const counter = this.counters.get(name);
    if (!counter) return;
    const key = this.labelsToKey(labels);
    const current = counter.values.get(key) || 0;
    counter.values.set(key, current + value);
  }

  setGauge(name: string, labels: Record<string, string> = {}, value: number): void {
    const gauge = this.gauges.get(name);
    if (!gauge) return;
    const key = this.labelsToKey(labels);
    gauge.values.set(key, value);
  }

  observeHistogram(name: string, labels: Record<string, string> = {}, value: number): void {
    const histogram = this.histograms.get(name);
    if (!histogram) return;
    const key = this.labelsToKey(labels);

    let entry = histogram.values.get(key);
    if (!entry) {
      entry = { count: 0, sum: 0, buckets: new Map() };
      for (const bucket of histogram.buckets) {
        entry.buckets.set(bucket, 0);
      }
      histogram.values.set(key, entry);
    }

    entry.count++;
    entry.sum += value;
    for (const bucket of histogram.buckets) {
      if (value <= bucket) {
        entry.buckets.set(bucket, (entry.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  private labelsToKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  private keyToLabels(key: string): string {
    return key ? `{${key}}` : '';
  }

  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters
    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      for (const [key, value] of counter.values) {
        lines.push(`${counter.name}${this.keyToLabels(key)} ${value}`);
      }
    }

    // Gauges
    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      for (const [key, value] of gauge.values) {
        lines.push(`${gauge.name}${this.keyToLabels(key)} ${value}`);
      }
    }

    // Histograms
    for (const histogram of this.histograms.values()) {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`);
      lines.push(`# TYPE ${histogram.name} histogram`);
      for (const [key, entry] of histogram.values) {
        const labelsStr = key ? `,${key}` : '';
        for (const [bucket, count] of entry.buckets) {
          lines.push(`${histogram.name}_bucket{le="${bucket}"${labelsStr}} ${count}`);
        }
        lines.push(`${histogram.name}_bucket{le="+Inf"${labelsStr}} ${entry.count}`);
        lines.push(`${histogram.name}_sum${this.keyToLabels(key)} ${entry.sum}`);
        lines.push(`${histogram.name}_count${this.keyToLabels(key)} ${entry.count}`);
      }
    }

    return lines.join('\n');
  }
}

// Global metrics registry
const registry = new MetricsRegistry();

// Register AI router metrics
registry.registerCounter('researchflow_ai_requests_total', 'Total AI router requests', ['provider', 'model', 'tier', 'task_type', 'status']);
registry.registerCounter('researchflow_ai_tokens_total', 'Total tokens processed', ['provider', 'model', 'direction']);
registry.registerCounter('researchflow_ai_cost_usd_total', 'Total AI cost in USD (multiplied by 1000000 for precision)', ['provider', 'model', 'tier']);
registry.registerCounter('researchflow_ai_escalations_total', 'Total tier escalations', ['from_tier', 'to_tier', 'reason']);
registry.registerHistogram('researchflow_ai_latency_seconds', 'AI request latency in seconds', ['provider', 'model', 'tier'], [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60]);

// Register cache metrics
registry.registerCounter('researchflow_cache_hits_total', 'Cache hits', ['cache_type']);
registry.registerCounter('researchflow_cache_misses_total', 'Cache misses', ['cache_type']);
registry.registerGauge('researchflow_cache_hit_rate', 'Cache hit rate (0-1)', ['cache_type']);
registry.registerGauge('researchflow_cache_entries', 'Number of cache entries', ['cache_type']);

// Register job queue metrics
registry.registerGauge('researchflow_queue_depth', 'Number of pending jobs in queue', ['queue_name']);
registry.registerCounter('researchflow_jobs_total', 'Total jobs processed', ['job_type', 'status']);
registry.registerHistogram('researchflow_job_duration_seconds', 'Job processing duration', ['job_type'], [1, 5, 10, 30, 60, 120, 300, 600]);

// Register PHI scan metrics (counts only, no PHI values)
registry.registerCounter('researchflow_phi_scans_total', 'Total PHI scans performed', ['source', 'result']);
registry.registerCounter('researchflow_phi_detections_total', 'Total PHI detections by category', ['category']);
registry.registerCounter('researchflow_phi_blocks_total', 'Total PHI-based blocks', ['action']);

// Register HTTP metrics
registry.registerCounter('researchflow_http_requests_total', 'Total HTTP requests', ['method', 'path', 'status']);
registry.registerHistogram('researchflow_http_request_duration_seconds', 'HTTP request duration', ['method', 'path'], [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]);

// Register system metrics
registry.registerGauge('researchflow_process_memory_bytes', 'Process memory usage in bytes', ['type']);
registry.registerGauge('researchflow_process_uptime_seconds', 'Process uptime in seconds', []);

// Helper functions to record metrics
export function recordAIRequest(
  provider: string,
  model: string,
  tier: string,
  taskType: string,
  status: 'success' | 'error' | 'blocked',
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  latencyMs: number
): void {
  registry.incCounter('researchflow_ai_requests_total', { provider, model, tier, task_type: taskType, status });
  registry.incCounter('researchflow_ai_tokens_total', { provider, model, direction: 'input' }, inputTokens);
  registry.incCounter('researchflow_ai_tokens_total', { provider, model, direction: 'output' }, outputTokens);
  // Store cost as micro-dollars for precision
  registry.incCounter('researchflow_ai_cost_usd_total', { provider, model, tier }, Math.round(costUsd * 1000000));
  registry.observeHistogram('researchflow_ai_latency_seconds', { provider, model, tier }, latencyMs / 1000);
}

export function recordAIEscalation(fromTier: string, toTier: string, reason: string): void {
  registry.incCounter('researchflow_ai_escalations_total', { from_tier: fromTier, to_tier: toTier, reason });
}

export function recordCacheAccess(cacheType: string, hit: boolean): void {
  if (hit) {
    registry.incCounter('researchflow_cache_hits_total', { cache_type: cacheType });
  } else {
    registry.incCounter('researchflow_cache_misses_total', { cache_type: cacheType });
  }
}

export function updateCacheStats(cacheType: string, hitRate: number, entryCount: number): void {
  registry.setGauge('researchflow_cache_hit_rate', { cache_type: cacheType }, hitRate);
  registry.setGauge('researchflow_cache_entries', { cache_type: cacheType }, entryCount);
}

export function updateQueueDepth(queueName: string, depth: number): void {
  registry.setGauge('researchflow_queue_depth', { queue_name: queueName }, depth);
}

export function recordJob(jobType: string, status: 'completed' | 'failed' | 'queued', durationMs?: number): void {
  registry.incCounter('researchflow_jobs_total', { job_type: jobType, status });
  if (durationMs !== undefined && status !== 'queued') {
    registry.observeHistogram('researchflow_job_duration_seconds', { job_type: jobType }, durationMs / 1000);
  }
}

export function recordPHIScan(source: string, result: 'clean' | 'detected' | 'error'): void {
  registry.incCounter('researchflow_phi_scans_total', { source, result });
}

export function recordPHIDetection(category: string, count: number = 1): void {
  registry.incCounter('researchflow_phi_detections_total', { category }, count);
}

export function recordPHIBlock(action: string): void {
  registry.incCounter('researchflow_phi_blocks_total', { action });
}

export function recordHTTPRequest(method: string, path: string, status: number, durationMs: number): void {
  // Normalize path to avoid high cardinality
  const normalizedPath = normalizePath(path);
  registry.incCounter('researchflow_http_requests_total', { method, path: normalizedPath, status: String(status) });
  registry.observeHistogram('researchflow_http_request_duration_seconds', { method, path: normalizedPath }, durationMs / 1000);
}

function normalizePath(path: string): string {
  // Replace IDs with placeholders to prevent cardinality explosion
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-zA-Z0-9]{20,}/g, '/:id');
}

export function updateSystemMetrics(): void {
  const memUsage = process.memoryUsage();
  registry.setGauge('researchflow_process_memory_bytes', { type: 'heap_used' }, memUsage.heapUsed);
  registry.setGauge('researchflow_process_memory_bytes', { type: 'heap_total' }, memUsage.heapTotal);
  registry.setGauge('researchflow_process_memory_bytes', { type: 'rss' }, memUsage.rss);
  registry.setGauge('researchflow_process_memory_bytes', { type: 'external' }, memUsage.external);
  registry.setGauge('researchflow_process_uptime_seconds', {}, process.uptime());
}

// Collect cache stats from cache service
// Note: CacheService is a singleton that needs to be instantiated per-request
// For metrics, we use a simplified approach
export async function collectCacheMetrics(): Promise<void> {
  try {
    // Cache stats would be collected from a singleton instance
    // For now, metrics are updated via recordCacheAccess calls
  } catch {
    // Cache service may not be initialized
  }
}

// Get Prometheus-formatted metrics
export async function getMetrics(): Promise<string> {
  updateSystemMetrics();
  await collectCacheMetrics();
  return registry.toPrometheusFormat();
}

// Export registry for testing
export { registry as metricsRegistry };
