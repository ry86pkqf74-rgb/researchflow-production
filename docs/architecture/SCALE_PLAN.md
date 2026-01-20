# ResearchFlow Scale Plan

## Overview

This document outlines the scaling strategy for ResearchFlow production systems, covering database scaling, distributed processing, caching layers, and guidance on horizontal vs vertical scaling decisions.

## Architecture Summary

ResearchFlow consists of the following scalable components:

| Component | Technology | Current Setup | Scale Target |
|-----------|------------|---------------|--------------|
| Orchestrator | Node.js | Single instance | 3-10 replicas |
| Worker | Python | Single instance | 5-20 replicas |
| Database | PostgreSQL | Single instance | Read replicas + connection pooling |
| Cache | Redis | Single instance | Cluster mode |
| Collaboration | Node.js/WebSocket | Single instance | Horizontally scaled with sticky sessions |

## Database Scaling Strategy

### Phase 1: Connection Pooling (Immediate)

Connection pooling reduces database connection overhead and improves throughput.

#### PgBouncer Configuration

```ini
# pgbouncer.ini
[databases]
researchflow = host=postgres port=5432 dbname=ros

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
default_pool_size = 20
min_pool_size = 5
max_client_conn = 200
reserve_pool_size = 5
reserve_pool_timeout = 3

# Timeouts
server_idle_timeout = 600
server_connect_timeout = 15
query_timeout = 300
```

#### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
  namespace: researchflow
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pgbouncer
  template:
    metadata:
      labels:
        app: pgbouncer
    spec:
      containers:
      - name: pgbouncer
        image: edoburu/pgbouncer:1.21.0
        ports:
        - containerPort: 6432
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: url
        - name: POOL_MODE
          value: "transaction"
        - name: DEFAULT_POOL_SIZE
          value: "20"
        - name: MAX_CLIENT_CONN
          value: "200"
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "200m"
        livenessProbe:
          tcpSocket:
            port: 6432
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          tcpSocket:
            port: 6432
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: pgbouncer
  namespace: researchflow
spec:
  selector:
    app: pgbouncer
  ports:
  - port: 5432
    targetPort: 6432
```

#### Application Configuration

Update `DATABASE_URL` to point to PgBouncer:

```bash
# Before
DATABASE_URL=postgresql://ros:ros@postgres:5432/ros

# After (through PgBouncer)
DATABASE_URL=postgresql://ros:ros@pgbouncer:5432/ros
```

### Phase 2: Read Replicas (10K+ concurrent users)

Read replicas offload read-heavy queries from the primary database.

#### PostgreSQL Streaming Replication Setup

```yaml
# Primary PostgreSQL ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-primary-config
  namespace: researchflow
data:
  postgresql.conf: |
    wal_level = replica
    max_wal_senders = 10
    max_replication_slots = 10
    wal_keep_size = 1GB
    hot_standby = on
    synchronous_commit = on

  pg_hba.conf: |
    host replication replicator 10.0.0.0/8 md5
    host all all 0.0.0.0/0 md5
```

#### Replica StatefulSet

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-replica
  namespace: researchflow
spec:
  serviceName: postgres-replica
  replicas: 2
  selector:
    matchLabels:
      app: postgres-replica
  template:
    metadata:
      labels:
        app: postgres-replica
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        env:
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: password
        command:
        - bash
        - -c
        - |
          # Initialize as replica
          pg_basebackup -h postgres-primary -U replicator -D $PGDATA -Fp -Xs -P -R
          exec postgres
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
```

#### Read/Write Splitting in Application

```typescript
// packages/core/src/db/connection.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const primaryPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

const replicaPool = new Pool({
  connectionString: process.env.DATABASE_REPLICA_URL,
  max: 50,
});

export const dbWrite = drizzle(primaryPool);
export const dbRead = drizzle(replicaPool);

// Usage
export async function getPatientById(id: string) {
  // Read from replica
  return dbRead.query.patients.findFirst({ where: eq(patients.id, id) });
}

export async function updatePatient(id: string, data: PatientUpdate) {
  // Write to primary
  return dbWrite.update(patients).set(data).where(eq(patients.id, id));
}
```

### Phase 3: Sharding Considerations (100K+ users)

Sharding should be considered when vertical scaling and read replicas are insufficient.

#### Sharding Strategy Options

| Strategy | Use Case | Complexity |
|----------|----------|------------|
| Tenant-based | Multi-tenant SaaS | Medium |
| Range-based | Time-series data | Medium |
| Hash-based | Even distribution | High |
| Geo-based | Regional compliance | High |

#### Recommended: Tenant-based Sharding

For ResearchFlow, tenant-based sharding by organization is recommended:

```
Shard 1: Organizations A-M (US East)
Shard 2: Organizations N-Z (US West)
Shard 3: EU Organizations (EU West)
```

#### Citus Extension Setup

```sql
-- Enable Citus on coordinator
CREATE EXTENSION citus;

-- Add worker nodes
SELECT citus_add_node('postgres-shard-1', 5432);
SELECT citus_add_node('postgres-shard-2', 5432);

-- Distribute tables by organization_id
SELECT create_distributed_table('patients', 'organization_id');
SELECT create_distributed_table('artifacts', 'organization_id');
SELECT create_distributed_table('audit_logs', 'organization_id');

-- Reference tables (replicated to all shards)
SELECT create_reference_table('organizations');
SELECT create_reference_table('feature_flags');
```

#### Migration Path

1. **Audit queries** - Identify cross-tenant queries that need refactoring
2. **Add organization_id** - Ensure all tables have tenant identifier
3. **Enable Citus** - Start with single-node Citus
4. **Add shards gradually** - Move tenants to new shards during maintenance windows
5. **Monitor and tune** - Adjust shard distribution based on load

## Distributed Processing Roadmap

### Current Architecture

```
[Orchestrator] --HTTP--> [Worker]
      |                     |
      v                     v
  [PostgreSQL]          [Artifacts]
```

### Phase 1: Queue-Based Processing (Immediate)

Replace synchronous HTTP calls with queue-based async processing.

#### Redis Queue Implementation

```typescript
// services/orchestrator/src/queue/jobQueue.ts
import Bull from 'bull';

export const analysisQueue = new Bull('analysis', {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Producer
export async function enqueueAnalysis(payload: AnalysisPayload): Promise<string> {
  const job = await analysisQueue.add('process', payload, {
    priority: payload.priority || 5,
    timeout: 300000, // 5 minutes
  });
  return job.id;
}

// Consumer (in worker service)
analysisQueue.process('process', async (job) => {
  const { data } = job;
  await job.progress(10);

  const result = await runAnalysis(data);
  await job.progress(100);

  return result;
});
```

#### Python Worker with Redis Queue

```python
# services/worker/src/queue/consumer.py
import asyncio
from redis import Redis
from rq import Worker, Queue

redis_conn = Redis.from_url(os.environ['REDIS_URL'])

queues = [
    Queue('analysis', connection=redis_conn),
    Queue('extraction', connection=redis_conn),
    Queue('validation', connection=redis_conn),
]

def run_worker():
    worker = Worker(queues, connection=redis_conn)
    worker.work(with_scheduler=True)
```

### Phase 2: Worker Scaling (10+ concurrent jobs)

#### Horizontal Pod Autoscaler for Workers

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
  namespace: researchflow
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: redis_queue_length
        selector:
          matchLabels:
            queue: analysis
      target:
        type: AverageValue
        averageValue: "5"
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Pods
        value: 4
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 2
        periodSeconds: 120
```

#### KEDA Scaling (Alternative)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaledobject
  namespace: researchflow
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 2
  maxReplicaCount: 20
  pollingInterval: 15
  cooldownPeriod: 300
  triggers:
  - type: redis
    metadata:
      address: redis:6379
      listName: analysis
      listLength: "10"
      enableTLS: "false"
```

### Phase 3: Distributed Task Coordination (50+ workers)

For complex workflows spanning multiple workers, implement a task orchestration layer.

#### Temporal.io Integration

```typescript
// services/orchestrator/src/workflows/analysisWorkflow.ts
import { proxyActivities, sleep } from '@temporalio/workflow';

const activities = proxyActivities<typeof import('./activities')>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function analysisWorkflow(input: AnalysisInput): Promise<AnalysisResult> {
  // Step 1: Validate input
  const validationResult = await activities.validateInput(input);
  if (!validationResult.valid) {
    throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
  }

  // Step 2: Extract data (can run in parallel)
  const [demographics, diagnoses, procedures] = await Promise.all([
    activities.extractDemographics(input.datasetId),
    activities.extractDiagnoses(input.datasetId),
    activities.extractProcedures(input.datasetId),
  ]);

  // Step 3: Run analysis
  const analysis = await activities.runAnalysis({
    demographics,
    diagnoses,
    procedures,
  });

  // Step 4: Generate report
  const report = await activities.generateReport(analysis);

  return { analysis, report };
}
```

## Caching Layers

### Layer 1: Application Cache (Redis)

#### Cache Configuration

```typescript
// services/orchestrator/src/cache/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};
```

#### Cache Patterns

| Pattern | TTL | Invalidation |
|---------|-----|--------------|
| User session | 24h | On logout |
| API responses | 5m | On data change |
| Feature flags | 1m | On update |
| Literature search | 24h | Manual |
| AI responses (prompt cache) | 1h | N/A |

### Layer 2: Redis Cluster (High Availability)

#### Redis Cluster Configuration

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: researchflow
spec:
  serviceName: redis-cluster
  replicas: 6  # 3 masters + 3 replicas
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        - containerPort: 16379
        command:
        - redis-server
        args:
        - --cluster-enabled yes
        - --cluster-config-file /data/nodes.conf
        - --cluster-node-timeout 5000
        - --appendonly yes
        - --maxmemory 1gb
        - --maxmemory-policy allkeys-lru
        volumeMounts:
        - name: data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### Layer 3: CDN for Static Assets

#### CloudFront Configuration

```yaml
# infrastructure/terraform/cdn.tf
resource "aws_cloudfront_distribution" "researchflow" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.static.bucket_regional_domain_name
    origin_id   = "s3-static"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  origin {
    domain_name = "api.researchflow.example.com"
    origin_id   = "api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api"
    viewer_protocol_policy = "https-only"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin", "Accept"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
```

#### Cache Headers for API Responses

```typescript
// services/orchestrator/src/middleware/cache-headers.ts
export function cacheHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Don't cache mutations
    if (req.method !== 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    // Cache public endpoints
    if (req.path.startsWith('/api/public/')) {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      return next();
    }

    // Don't cache authenticated endpoints by default
    res.setHeader('Cache-Control', 'private, no-cache');
    next();
  };
}
```

## Horizontal vs Vertical Scaling Guidance

### When to Scale Vertically

| Indicator | Vertical Scaling Action |
|-----------|------------------------|
| Database CPU > 80% | Upgrade instance class |
| Memory pressure (swapping) | Add RAM |
| Single-threaded bottleneck | Faster CPU |
| I/O wait > 20% | Upgrade to SSD/NVMe |

#### Database Vertical Scaling Path

```
db.t3.medium (2 vCPU, 4GB)
    ↓ (100 concurrent users)
db.r5.large (2 vCPU, 16GB)
    ↓ (500 concurrent users)
db.r5.xlarge (4 vCPU, 32GB)
    ↓ (1000 concurrent users)
db.r5.2xlarge (8 vCPU, 64GB)
    ↓ Consider read replicas
```

### When to Scale Horizontally

| Indicator | Horizontal Scaling Action |
|-----------|--------------------------|
| Request latency increasing | Add more replicas |
| Queue depth growing | Add more workers |
| Connection limits hit | Add connection pooling |
| Single point of failure | Add redundancy |

#### Application Horizontal Scaling Path

```
1 Orchestrator + 1 Worker
    ↓ (50 concurrent users)
2 Orchestrators + 3 Workers + Load Balancer
    ↓ (200 concurrent users)
3 Orchestrators + 5 Workers + Auto-scaling
    ↓ (1000 concurrent users)
5 Orchestrators + 10 Workers + Queue-based processing
    ↓ (5000+ concurrent users)
Consider microservices decomposition
```

### Decision Matrix

| Component | Vertical First | Horizontal First | Hybrid |
|-----------|---------------|------------------|--------|
| PostgreSQL | Yes | No | Read replicas |
| Redis | Yes (to 64GB) | Then cluster | Cluster |
| Orchestrator | No | Yes | N/A |
| Worker | No | Yes | N/A |
| Web Frontend | No | Yes (CDN) | N/A |

## Capacity Planning

### Load Projections

| Metric | Current | 6 Months | 12 Months |
|--------|---------|----------|-----------|
| Concurrent Users | 50 | 200 | 1000 |
| Requests/second | 10 | 50 | 200 |
| Data Volume | 10GB | 50GB | 200GB |
| Worker Jobs/hour | 100 | 500 | 2000 |

### Resource Estimates by Scale

#### Small (< 100 users)

```yaml
Orchestrator: 2 replicas, 512Mi RAM, 0.5 CPU
Worker: 2 replicas, 1Gi RAM, 1 CPU
PostgreSQL: Single instance, 8GB RAM
Redis: Single instance, 1GB RAM
```

#### Medium (100-1000 users)

```yaml
Orchestrator: 3-5 replicas, 1Gi RAM, 1 CPU
Worker: 5-10 replicas, 2Gi RAM, 2 CPU
PostgreSQL: Primary + 2 read replicas, 32GB RAM
Redis: 3-node cluster, 4GB RAM each
PgBouncer: 2 replicas
```

#### Large (1000+ users)

```yaml
Orchestrator: 5-10 replicas, 2Gi RAM, 2 CPU
Worker: 10-20 replicas, 4Gi RAM, 4 CPU
PostgreSQL: Citus cluster (3+ nodes), 64GB RAM each
Redis: 6-node cluster, 8GB RAM each
PgBouncer: 3 replicas
CDN: CloudFront/Cloudflare
Message Queue: Dedicated Redis or RabbitMQ cluster
```

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)

- [ ] Deploy PgBouncer
- [ ] Configure HPA for Orchestrator
- [ ] Set up Redis caching
- [ ] Implement cache headers

### Phase 2: Queue Processing (Week 3-4)

- [ ] Implement Bull queue for async jobs
- [ ] Migrate worker to queue consumer
- [ ] Configure worker HPA
- [ ] Add job monitoring

### Phase 3: High Availability (Week 5-6)

- [ ] Deploy PostgreSQL read replicas
- [ ] Implement read/write splitting
- [ ] Deploy Redis cluster
- [ ] Set up CDN

### Phase 4: Advanced (As Needed)

- [ ] Evaluate sharding requirements
- [ ] Consider Temporal.io for workflows
- [ ] Implement multi-region deployment
- [ ] Set up disaster recovery site

## Monitoring Scale Metrics

### Key Metrics to Track

```yaml
# Prometheus queries for scaling decisions
- name: scale-metrics
  rules:
    - record: orchestrator:requests_per_second
      expr: rate(http_requests_total{service="orchestrator"}[5m])

    - record: worker:queue_depth
      expr: redis_list_length{list="analysis"}

    - record: postgres:connections_used_percent
      expr: pg_stat_activity_count / pg_settings_max_connections * 100

    - record: redis:memory_used_percent
      expr: redis_memory_used_bytes / redis_memory_max_bytes * 100
```

### Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU utilization | 70% | 85% | Scale out |
| Memory utilization | 80% | 90% | Scale up |
| Queue depth | 100 | 500 | Add workers |
| DB connections | 70% | 85% | Add pooling |
| Response latency (p99) | 2s | 5s | Investigate |

## References

- [PostgreSQL High Availability](https://www.postgresql.org/docs/current/high-availability.html)
- [Redis Cluster Tutorial](https://redis.io/docs/management/scaling/)
- [Kubernetes HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [KEDA Documentation](https://keda.sh/docs/)
- [Temporal.io Concepts](https://docs.temporal.io/concepts)
