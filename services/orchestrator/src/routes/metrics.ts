/**
 * Prometheus Metrics Router
 *
 * Exposes /metrics endpoint for Prometheus scraping.
 * Phase 08: Observability + Worker Parallelism
 *
 * See docs/architecture/perf-optimization-roadmap.md
 */

import { Router, Request, Response } from 'express';
import { config } from '../config/env';

const router = Router();

/**
 * Metric types
 */
type MetricType = 'counter' | 'gauge' | 'histogram';

interface MetricValue {
  value: number;
  labels: Record<string, string>;
}

interface Metric {
  name: string;
  help: string;
  type: MetricType;
  values: MetricValue[];
}

/**
 * Simple in-memory metrics registry
 */
class MetricsRegistry {
  private metrics: Map<string, Metric> = new Map();

  /**
   * Register or get a counter metric
   */
  counter(name: string, help: string): Counter {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        help,
        type: 'counter',
        values: [],
      });
    }
    return new Counter(this.metrics.get(name)!);
  }

  /**
   * Register or get a gauge metric
   */
  gauge(name: string, help: string): Gauge {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        help,
        type: 'gauge',
        values: [],
      });
    }
    return new Gauge(this.metrics.get(name)!);
  }

  /**
   * Register or get a histogram metric
   */
  histogram(name: string, help: string): Histogram {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        help,
        type: 'histogram',
        values: [],
      });
    }
    return new Histogram(this.metrics.get(name)!);
  }

  /**
   * Format all metrics in Prometheus text format
   */
  format(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.values.length === 0) {
        lines.push(`${metric.name} 0`);
      } else {
        for (const { value, labels } of metric.values) {
          const labelsStr = Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');

          if (labelsStr) {
            lines.push(`${metric.name}{${labelsStr}} ${value}`);
          } else {
            lines.push(`${metric.name} ${value}`);
          }
        }
      }

      lines.push('');
    }

    // Add process metrics
    const memUsage = process.memoryUsage();
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${memUsage.rss}`);
    lines.push('');

    lines.push('# HELP process_heap_bytes Heap memory size in bytes.');
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes ${memUsage.heapUsed}`);
    lines.push('');

    lines.push('# HELP nodejs_eventloop_lag_seconds Event loop lag in seconds.');
    lines.push('# TYPE nodejs_eventloop_lag_seconds gauge');
    lines.push(`nodejs_eventloop_lag_seconds 0`);

    return lines.join('\n');
  }
}

/**
 * Counter metric - only increases
 */
class Counter {
  private metric: Metric;

  constructor(metric: Metric) {
    this.metric = metric;
  }

  inc(labels: Record<string, string> = {}, amount = 1): void {
    const existing = this.findValue(labels);
    if (existing) {
      existing.value += amount;
    } else {
      this.metric.values.push({ value: amount, labels });
    }
  }

  private findValue(labels: Record<string, string>): MetricValue | undefined {
    return this.metric.values.find(
      (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
    );
  }
}

/**
 * Gauge metric - can increase or decrease
 */
class Gauge {
  private metric: Metric;

  constructor(metric: Metric) {
    this.metric = metric;
  }

  set(value: number, labels: Record<string, string> = {}): void {
    const existing = this.findValue(labels);
    if (existing) {
      existing.value = value;
    } else {
      this.metric.values.push({ value, labels });
    }
  }

  inc(labels: Record<string, string> = {}, amount = 1): void {
    const existing = this.findValue(labels);
    if (existing) {
      existing.value += amount;
    } else {
      this.metric.values.push({ value: amount, labels });
    }
  }

  dec(labels: Record<string, string> = {}, amount = 1): void {
    const existing = this.findValue(labels);
    if (existing) {
      existing.value -= amount;
    } else {
      this.metric.values.push({ value: -amount, labels });
    }
  }

  private findValue(labels: Record<string, string>): MetricValue | undefined {
    return this.metric.values.find(
      (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
    );
  }
}

/**
 * Histogram metric - tracks value distribution
 */
class Histogram {
  private metric: Metric;
  private buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private observations: Map<string, number[]> = new Map();

  constructor(metric: Metric) {
    this.metric = metric;
  }

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = JSON.stringify(labels);
    if (!this.observations.has(key)) {
      this.observations.set(key, []);
    }
    this.observations.get(key)!.push(value);

    // Update metric values for Prometheus format
    this.updateMetricValues();
  }

  private updateMetricValues(): void {
    this.metric.values = [];

    for (const [labelsJson, obs] of this.observations.entries()) {
      const labels = JSON.parse(labelsJson);
      let cumulative = 0;

      for (const bucket of this.buckets) {
        const count = obs.filter((v) => v <= bucket).length;
        this.metric.values.push({
          value: count,
          labels: { ...labels, le: String(bucket) },
        });
      }

      // +Inf bucket
      this.metric.values.push({
        value: obs.length,
        labels: { ...labels, le: '+Inf' },
      });
    }
  }
}

// Global metrics registry
const registry = new MetricsRegistry();

// Define metrics
export const httpRequestsTotal = registry.counter(
  'researchflow_orchestrator_http_requests_total',
  'Total HTTP requests by method, path, and status'
);

export const httpRequestDuration = registry.histogram(
  'researchflow_orchestrator_http_request_duration_seconds',
  'HTTP request duration in seconds'
);

export const activeConnections = registry.gauge(
  'researchflow_orchestrator_active_connections',
  'Number of active connections'
);

export const proxyRequestsTotal = registry.counter(
  'researchflow_orchestrator_proxy_requests_total',
  'Total proxy requests to worker'
);

export const proxyRequestDuration = registry.histogram(
  'researchflow_orchestrator_proxy_duration_seconds',
  'Proxy request duration in seconds'
);

export const cacheHitsTotal = registry.counter(
  'researchflow_orchestrator_cache_hits_total',
  'Total cache hits by cache type'
);

export const cacheMissesTotal = registry.counter(
  'researchflow_orchestrator_cache_misses_total',
  'Total cache misses by cache type'
);

/**
 * GET /metrics
 *
 * Prometheus metrics endpoint
 */
router.get('/', (req: Request, res: Response) => {
  if (!config.metricsEnabled) {
    res.status(503).send('# Metrics disabled\n');
    return;
  }

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(registry.format());
});

/**
 * Express middleware to track request metrics
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: () => void
): void {
  if (!config.metricsEnabled) {
    next();
    return;
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSeconds = durationNs / 1e9;

    // Extract route pattern (remove IDs)
    const path = req.route?.path || req.path.replace(/\/[a-f0-9-]{36}/gi, '/:id');

    httpRequestsTotal.inc({
      method: req.method,
      path,
      status: String(res.statusCode),
    });

    httpRequestDuration.observe(durationSeconds, {
      method: req.method,
      path,
    });
  });

  next();
}

export default router;
export { registry };
