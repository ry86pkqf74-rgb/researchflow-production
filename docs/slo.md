# Phase A - Task 35: Service Level Objectives (SLOs) and Monitoring

## Overview

This document defines the Service Level Objectives (SLOs) for ResearchFlow Production.
All SLOs are tied to monitoring via Prometheus metrics and Grafana dashboards.

## SLO Summary

| Service | Metric | Target | Window |
|---------|--------|--------|--------|
| Orchestrator API | Availability | 99.9% | 30 days |
| Orchestrator API | p95 Latency | < 500ms | Rolling 1 hour |
| Worker Jobs | Completion Rate | > 99% | 30 days |
| Worker Jobs | p95 Completion Time | < 5 minutes | Rolling 1 hour |
| PHI Scanner | Error Rate | < 0.1% | 30 days |

---

## Detailed SLOs

### 1. Orchestrator API Availability

**Target:** 99.9% (allows ~43 minutes downtime/month)

**Definition:** Percentage of successful (non-5xx) responses from `/healthz` endpoint.

**Prometheus Query:**
```promql
sum(rate(http_requests_total{job="orchestrator",code!~"5.."}[5m])) /
sum(rate(http_requests_total{job="orchestrator"}[5m])) * 100
```

**Alert Rule:**
```yaml
- alert: OrchestratorAvailabilityLow
  expr: |
    (sum(rate(http_requests_total{job="orchestrator",code!~"5.."}[5m])) /
     sum(rate(http_requests_total{job="orchestrator"}[5m])) * 100) < 99.9
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Orchestrator availability below SLO"
```

---

### 2. Orchestrator API Latency

**Target:** p95 < 500ms

**Definition:** 95th percentile response time for API requests.

**Prometheus Query:**
```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{job="orchestrator"}[5m])) by (le)
) * 1000
```

**Alert Rule:**
```yaml
- alert: OrchestratorLatencyHigh
  expr: |
    histogram_quantile(0.95,
      sum(rate(http_request_duration_seconds_bucket{job="orchestrator"}[5m])) by (le)
    ) * 1000 > 500
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Orchestrator p95 latency exceeds 500ms"
```

---

### 3. Worker Job Completion Rate

**Target:** > 99%

**Definition:** Percentage of jobs that complete successfully.

**Prometheus Query:**
```promql
sum(researchflow_jobs_completed_total{status="success"}) /
sum(researchflow_jobs_completed_total) * 100
```

**Alert Rule:**
```yaml
- alert: WorkerJobFailureRateHigh
  expr: |
    (sum(rate(researchflow_jobs_completed_total{status="failed"}[1h])) /
     sum(rate(researchflow_jobs_completed_total[1h])) * 100) > 1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Job failure rate exceeds 1%"
```

---

### 4. Worker Job Completion Time

**Target:** p95 < 5 minutes (300 seconds)

**Definition:** 95th percentile time from job submission to completion.

**Prometheus Query:**
```promql
histogram_quantile(0.95,
  sum(rate(researchflow_job_duration_seconds_bucket[5m])) by (le)
)
```

**Alert Rule:**
```yaml
- alert: WorkerJobsDurationHigh
  expr: |
    histogram_quantile(0.95,
      sum(rate(researchflow_job_duration_seconds_bucket[5m])) by (le)
    ) > 300
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Job p95 duration exceeds 5 minutes"
```

---

### 5. Queue Depth

**Target:** Queue depth < 100 for sustained period

**Definition:** Number of jobs waiting in the queue.

**Prometheus Query:**
```promql
researchflow_queue_depth
```

**Alert Rule:**
```yaml
- alert: QueueBacklogHigh
  expr: researchflow_queue_depth > 100
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Job queue backlog exceeds 100 jobs"
```

---

## Grafana Dashboards

### Required Panels

1. **Service Health Overview**
   - Availability percentage (last 24h, 7d, 30d)
   - Current p95 latency
   - Error rate trend

2. **Job Processing**
   - Queue depth over time
   - Jobs completed/failed per hour
   - Job duration distribution

3. **Resource Utilization**
   - CPU/Memory per pod
   - Pod restart count
   - OOM kill events

4. **AI Router Metrics**
   - Requests per model tier
   - Cost per day
   - Fallback events

---

## Error Budget

### Calculation

With 99.9% availability SLO:
- **Error budget per month:** 0.1% = ~43 minutes
- **Error budget per week:** ~10 minutes

### Policy

1. If error budget is < 50%, freeze non-critical changes
2. If error budget is < 25%, incident response required
3. If error budget is exhausted, all changes require approval

---

## Monitoring Ties

| SLO | Prometheus Metric | Grafana Dashboard | Alert |
|-----|-------------------|-------------------|-------|
| Availability | `http_requests_total` | Service Health | OrchestratorAvailabilityLow |
| Latency | `http_request_duration_seconds` | Service Health | OrchestratorLatencyHigh |
| Job Completion | `researchflow_jobs_completed_total` | Job Processing | WorkerJobFailureRateHigh |
| Job Duration | `researchflow_job_duration_seconds` | Job Processing | WorkerJobsDurationHigh |
| Queue Depth | `researchflow_queue_depth` | Job Processing | QueueBacklogHigh |

---

## Review Schedule

- **Weekly:** Review alert frequency and false positives
- **Monthly:** Review SLO attainment and adjust targets if needed
- **Quarterly:** Full SLO review with stakeholders
