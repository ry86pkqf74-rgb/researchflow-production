# ResearchFlow Profiling Guide

## Overview

This document provides guidance for profiling and performance analysis of ResearchFlow services.
Profiling is essential for identifying bottlenecks, optimizing resource usage, and maintaining
responsive user experiences.

## Profiling Levels

### 1. Application-Level Profiling

#### Node.js (Orchestrator)

**Built-in V8 Profiler:**
```bash
# Start orchestrator with profiler enabled
NODE_OPTIONS="--inspect" node services/orchestrator/index.js

# Connect Chrome DevTools
# Navigate to chrome://inspect in Chrome
```

**Heap Snapshots:**
```typescript
// Add to any route handler for on-demand heap snapshot
import v8 from 'v8';
import fs from 'fs';

app.get('/debug/heap-snapshot', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    const filename = `/tmp/heap-${Date.now()}.heapsnapshot`;
    const snapshotStream = v8.writeHeapSnapshot(filename);
    res.json({ file: filename });
  } else {
    res.status(403).json({ error: 'Not available in production' });
  }
});
```

**CPU Profiling with clinic.js:**
```bash
# Install clinic
npm install -g clinic

# Flame graph
clinic flame -- node services/orchestrator/index.js

# Doctor (general analysis)
clinic doctor -- node services/orchestrator/index.js

# Bubbleprof (async operations)
clinic bubbleprof -- node services/orchestrator/index.js
```

#### Python (Worker)

**cProfile:**
```python
import cProfile
import pstats
from io import StringIO

def profile_endpoint():
    """Profile a slow endpoint"""
    pr = cProfile.Profile()
    pr.enable()

    # ... your code here ...

    pr.disable()
    s = StringIO()
    ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
    ps.print_stats(20)  # Top 20 functions
    return s.getvalue()
```

**py-spy (Production-safe):**
```bash
# Install py-spy
pip install py-spy

# Record profile
py-spy record -o profile.svg -- python api_server.py

# Live top-like view
py-spy top --pid <worker_pid>
```

**memory_profiler:**
```python
from memory_profiler import profile

@profile
def memory_intensive_function():
    # Your code here
    pass
```

### 2. Database Profiling

#### PostgreSQL

**Enable slow query logging:**
```sql
-- In postgresql.conf or via ALTER SYSTEM
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second
ALTER SYSTEM SET log_statement = 'all';  -- Development only!
SELECT pg_reload_conf();
```

**Explain analyze:**
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM artifacts WHERE project_id = 'xyz';
```

**pg_stat_statements:**
```sql
-- Enable extension
CREATE EXTENSION pg_stat_statements;

-- Top queries by total time
SELECT
  substring(query, 1, 50) as query_preview,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

#### Redis

**Slow log:**
```bash
# Get slow commands (> 10ms by default)
redis-cli SLOWLOG GET 10

# Configure threshold (microseconds)
redis-cli CONFIG SET slowlog-log-slower-than 5000
```

**Memory analysis:**
```bash
# Memory usage by key pattern
redis-cli --scan --pattern "artifact:*" | head -100 | xargs -I {} redis-cli MEMORY USAGE {}

# Memory doctor
redis-cli MEMORY DOCTOR
```

### 3. Network Profiling

**Request timing (Express middleware):**
```typescript
// Add to orchestrator
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    if (durationMs > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${durationMs}ms`);
    }
  });

  next();
});
```

**External call timing:**
```typescript
// In telemetry.ts - extend with timing
export interface ExternalCallTiming {
  provider: AIProvider;
  durationMs: number;
  success: boolean;
}

// Track in gatedAICall
const startTime = Date.now();
try {
  const result = await fn();
  const duration = Date.now() - startTime;
  telemetry.recordTiming('external_call', duration, { provider });
  return result;
} catch (error) {
  const duration = Date.now() - startTime;
  telemetry.recordTiming('external_call_error', duration, { provider });
  throw error;
}
```

### 4. Container/Kubernetes Profiling

**Resource monitoring:**
```bash
# Pod resource usage
kubectl top pods -n researchflow-production

# Node resource usage
kubectl top nodes

# Detailed pod metrics
kubectl describe pod <pod-name> -n researchflow-production
```

**Container profiling with kubectl debug:**
```bash
# Attach ephemeral debug container
kubectl debug -it <pod-name> -n researchflow-production --image=alpine -- sh

# Install profiling tools in debug container
apk add --no-cache py3-pip
pip install py-spy
```

## Performance Benchmarks

### Baseline Metrics

Target performance metrics for ResearchFlow:

| Endpoint | P50 | P95 | P99 | Max |
|----------|-----|-----|-----|-----|
| GET /health | <5ms | <10ms | <20ms | <50ms |
| GET /api/projects | <50ms | <200ms | <500ms | <1s |
| POST /api/ai/generate | <2s | <5s | <10s | <30s |
| POST /api/artifacts (upload) | <500ms | <2s | <5s | <10s |

### Load Testing

**k6 example script:**
```javascript
// k6-script.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up
    { duration: '5m', target: 50 },  // Steady state
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get('http://localhost:3001/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

**Run load test:**
```bash
k6 run k6-script.js
```

## Profiling Playbook

### Scenario: High CPU Usage

1. **Identify the process:**
   ```bash
   top -p $(pgrep -f "orchestrator\|worker")
   ```

2. **Capture CPU profile:**
   - Node.js: `clinic flame`
   - Python: `py-spy record`

3. **Analyze flame graph:**
   - Look for wide bars (time-consuming)
   - Identify recursive patterns
   - Check for synchronous operations

4. **Common causes:**
   - JSON serialization of large objects
   - Regex operations on large strings
   - Unoptimized database queries
   - Missing indexes

### Scenario: Memory Leak

1. **Monitor memory growth:**
   ```bash
   watch -n 5 'kubectl top pod <pod-name> -n researchflow-production'
   ```

2. **Capture heap snapshots:**
   - Take snapshot at startup
   - Take snapshot after N requests
   - Compare snapshots in Chrome DevTools

3. **Common causes:**
   - Event listeners not removed
   - Closures capturing large objects
   - Cache without eviction policy
   - Circular references

### Scenario: Slow Database Queries

1. **Enable slow query logging:**
   ```sql
   ALTER SYSTEM SET log_min_duration_statement = 100;
   ```

2. **Identify problematic queries:**
   ```sql
   SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
   ```

3. **Analyze query plans:**
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) <slow_query>;
   ```

4. **Common fixes:**
   - Add indexes
   - Optimize JOINs
   - Add LIMIT clauses
   - Use connection pooling

## Validation Fast-Path (Documented, Not Enabled)

For future optimization, consider implementing fast-path validation:

### Concept

Skip expensive validation for trusted, previously-validated content:

```typescript
// Future implementation concept - NOT CURRENTLY ENABLED
interface ValidationCache {
  contentHash: string;
  validatedAt: Date;
  result: ValidationResult;
}

async function validateWithCache(content: string, schema: Schema): Promise<ValidationResult> {
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  // Check cache
  const cached = await cache.get(`validation:${hash}`);
  if (cached && cached.validatedAt > Date.now() - CACHE_TTL) {
    return cached.result;
  }

  // Full validation
  const result = await fullValidation(content, schema);

  // Cache result
  await cache.set(`validation:${hash}`, {
    contentHash: hash,
    validatedAt: new Date(),
    result,
  });

  return result;
}
```

### Prerequisites for Enabling

- [ ] Content hash stability verified
- [ ] Cache invalidation strategy defined
- [ ] Security review completed
- [ ] Performance baseline established
- [ ] Rollback plan documented

## Monitoring Integration

### Prometheus Metrics

Add profiling-related metrics to existing telemetry:

```typescript
// In prometheus.ts
histogram('http_request_duration_seconds', {
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

histogram('db_query_duration_seconds', {
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.1, 1, 5],
});
```

### Grafana Dashboards

Key panels to include:

1. **Request latency histogram** - P50/P95/P99 over time
2. **Database query distribution** - Slow queries by table
3. **Memory usage trend** - Detect leaks
4. **CPU usage by container** - Identify hotspots
5. **External API latency** - AI provider response times

## Quick Reference

| Task | Command |
|------|---------|
| CPU profile (Node) | `clinic flame -- node index.js` |
| CPU profile (Python) | `py-spy record -o profile.svg -- python api_server.py` |
| Memory profile (Node) | `node --inspect` + Chrome DevTools |
| Memory profile (Python) | `mprof run python api_server.py` |
| Slow query log | `ALTER SYSTEM SET log_min_duration_statement = 100;` |
| Redis slow log | `redis-cli SLOWLOG GET 10` |
| Pod resources | `kubectl top pods -n researchflow-production` |
| Load test | `k6 run script.js` |
