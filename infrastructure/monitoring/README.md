# ResearchFlow Monitoring Stack

Comprehensive monitoring solution for ResearchFlow production environment using Prometheus, Grafana, and Alertmanager.

## Overview

The monitoring stack provides:

- **Prometheus**: Time-series database for metrics collection and storage
- **Grafana**: Visualization and dashboarding platform
- **Alertmanager**: Alert routing, grouping, and notification management
- **Node Exporter**: Host system metrics
- **Redis Exporter**: Redis instance metrics
- **PostgreSQL Exporter**: Database metrics
- **cAdvisor**: Container resource metrics

## Quick Start

### 1. Environment Setup

Create or update your `.env` file with monitoring configuration:

```bash
# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=your_secure_password

# Slack Webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# SMTP Configuration
SMTP_SERVER=smtp.your-domain.com:587
SMTP_USERNAME=alerts@your-domain.com
SMTP_PASSWORD=your_smtp_password

# Database Configuration (for exporters)
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=researchflow
```

### 2. Start Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

This will start:
- Prometheus on port 9090
- Grafana on port 3000
- Alertmanager on port 9093
- All exporters on their respective ports

### 3. Access Monitoring Interfaces

- **Grafana**: http://localhost:3000 (admin / password from .env)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## Configuration Files

### prometheus.yml

Main Prometheus configuration with:
- 15-second scrape interval for all services
- Service discovery for orchestrator, worker, web services
- Database and cache monitoring
- 15-day data retention
- Alert rule loading

Key scrape targets:
- `orchestrator:3000` - Main orchestrator service
- `worker:3001` - Worker service
- `web:3002` - Web service
- `redis-exporter:9121` - Redis metrics
- `postgres-exporter:9187` - PostgreSQL metrics
- `node-exporter:9100` - Host metrics
- `cadvisor:8080` - Container metrics

### alertmanager.yml

Alert routing and notification configuration with:
- Route grouping by service and alert name
- Slack webhook integration for critical alerts
- Email integration for ops team
- Alert inhibition rules to prevent duplicates
- Different notification channels by severity

Slack channels:
- `#alerts` - General alerts
- `#critical-alerts` - Service-level criticalities
- `#error-alerts` - High error rates
- `#performance-alerts` - Performance issues

### alert-rules.yml

Prometheus alert rules covering:

#### Service Health
- `ServiceDown`: Service unavailable for 5 minutes

#### Error Rates
- `HighErrorRate`: Error rate > 5% for 5 minutes
- `VeryHighErrorRate`: Error rate > 10% for 2 minutes

#### Latency
- `HighLatency`: P95 > 500ms for 5 minutes
- `VeryHighLatency`: P95 > 1000ms for 2 minutes
- `P99LatencyHigh`: P99 > 2000ms for 5 minutes

#### Disk Space
- `DiskSpaceLow`: < 10% available for 5 minutes
- `DiskSpaceCritical`: < 5% available for 2 minutes

#### Memory
- `MemoryHigh`: > 90% utilized for 5 minutes
- `MemoryCritical`: > 95% utilized for 2 minutes

#### CPU
- `HighCPUUsage`: > 80% utilized for 5 minutes
- `VeryHighCPUUsage`: > 95% utilized for 2 minutes

#### Database & Cache
- `RedisConnectionError`: No connected clients
- `PostgresConnectionError`: Database down

#### Custom Business Metrics
- `HighPendingApprovals`: > 100 approvals for 15 minutes
- `VeryHighPendingApprovals`: > 500 approvals for 5 minutes
- `LowActiveUsers`: No active users for 10 minutes

## Grafana Dashboards

### 1. Service Health Dashboard
- Service up/down status (pie chart)
- Service restart counts
- Service uptime trends

### 2. API Latency Dashboard
- P50, P95, P99, Max latency stats
- Request duration histogram percentiles
- Request rate by service and route

### 3. Error Rates Dashboard
- Overall error rate (4xx + 5xx)
- Server error rate (5xx only)
- Error requests by service
- Error count by status and endpoint

### 4. Resources Dashboard
- CPU usage by container
- Memory usage by container
- Disk space availability
- Disk and CPU status gauges

## Application Metrics Integration

The `services/orchestrator/src/middleware/metrics.ts` provides:

### HTTP Metrics
- **http_request_duration_ms**: Histogram with buckets from 10ms to 5s
- **http_requests_total**: Counter by method, route, status
- **http_request_size_bytes**: Request payload size
- **http_response_size_bytes**: Response payload size

### Business Metrics
- **active_users**: Gauge for current active user count
- **pending_approvals**: Gauge for pending approvals

### Database Metrics
- **db_query_duration_ms**: Query execution time histogram
- **db_operations_total**: Operation counter by type and status

### Cache Metrics
- **cache_hits_total**: Cache hit counter
- **cache_misses_total**: Cache miss counter

### Document Processing
- **document_processing_time_ms**: Processing time histogram

### Queue Metrics
- **queue_depth**: Job queue depth histogram

## Integration with Services

### Orchestrator Service

1. Install prom-client:
```bash
npm install prom-client
```

2. Import and initialize metrics in main server file:
```typescript
import {
  metricsHandler,
  healthCheckHandler,
  httpMetricsMiddleware,
  requestContextMiddleware,
  initializeMetrics,
} from './middleware/metrics';

// Before routes
app.use(requestContextMiddleware);
app.use(httpMetricsMiddleware);

// Metrics endpoint
app.get('/metrics', metricsHandler);
app.get('/health', healthCheckHandler);

// Initialize with business metric functions
initializeMetrics(
  async () => {
    // Return active user count from database
    return await User.count({ where: { lastSeenAt: { $gte: Date.now() - 5*60*1000 } } });
  },
  async () => {
    // Return pending approval count
    return await Approval.count({ where: { status: 'pending' } });
  }
);
```

3. Use tracking wrappers for operations:
```typescript
import { trackDatabaseOperation, trackDocumentProcessing, trackCacheAccess } from './middleware/metrics';

// Database operations
const result = await trackDatabaseOperation('select', 'users', () => {
  return User.findAll();
});

// Document processing
await trackDocumentProcessing('pdf_extraction', async () => {
  return await extractPDFContent(file);
});

// Cache operations
const data = cache.get('key');
trackCacheAccess('user_cache', !!data);
```

## Monitoring Practices

### Alert Tuning

Adjust alert thresholds in `alert-rules.yml` based on your environment:
- Development: Higher thresholds (more lenient)
- Staging: Mid-range thresholds
- Production: Lower thresholds (more strict)

### Silence Management

Temporarily silence alerts in Alertmanager UI:
1. Navigate to Alertmanager dashboard (port 9093)
2. Click "New Silence"
3. Set matcher and duration
4. Confirm silence

### Retention Policy

Prometheus stores 15 days of metrics by default:
- Adjust in `prometheus.yml` under `storage.tsdb.retention.time`
- Balance between storage needs and historical data requirements

### Custom Metrics

Add custom metrics for your specific use cases:
```typescript
import * as prometheus from 'prom-client';

const customCounter = new prometheus.Counter({
  name: 'your_metric_name',
  help: 'Description of your metric',
  labelNames: ['label1', 'label2'],
});

// Use it
customCounter.labels('value1', 'value2').inc();
```

## Troubleshooting

### Metrics not appearing in Prometheus

1. Verify service is running: `curl http://localhost:3000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify service is in `prometheus.yml` scrape_configs
4. Check Docker network connectivity

### Grafana dashboards not loading

1. Verify Prometheus datasource is accessible
2. Check dashboard JSON syntax
3. Restart Grafana: `docker restart grafana`
4. Check Grafana logs: `docker logs grafana`

### Alertmanager not sending notifications

1. Verify Slack/Email configuration in `alertmanager.yml`
2. Check alert rules are firing: http://localhost:9090/alerts
3. Verify Alertmanager can reach notification services
4. Check Alertmanager logs: `docker logs alertmanager`

### High memory usage

1. Reduce scrape interval (less frequent collection)
2. Reduce retention time for Prometheus
3. Adjust Docker container memory limits
4. Check for cardinality explosion in labels

## Scaling Considerations

### For larger deployments:

1. **Remote Storage**: Use Prometheus remote storage (S3, GCS)
2. **Federation**: Run multiple Prometheus instances with federation
3. **Alertmanager**: Run HA cluster with multiple instances
4. **Grafana**: Use external database (PostgreSQL/MySQL)
5. **Performance**: Use dedicated monitoring infrastructure

## Security

### Best Practices

1. **Authentication**: Enable Grafana authentication
2. **Network**: Restrict access to monitoring endpoints
3. **Credentials**: Use environment variables for sensitive data
4. **HTTPS**: Use reverse proxy with TLS
5. **API Keys**: Generate Grafana API keys for integrations

### Environment Variables

All sensitive data should use environment variables:
- `SLACK_WEBHOOK_URL`
- `SMTP_SERVER`, `SMTP_USERNAME`, `SMTP_PASSWORD`
- `GRAFANA_ADMIN_PASSWORD`
- `DB_PASSWORD`

## Maintenance

### Regular Tasks

- Review alert thresholds monthly
- Archive old dashboards quarterly
- Update exporters and Prometheus regularly
- Test alert routing and notifications
- Review and clean up stale alerts

### Backup

```bash
# Backup Prometheus data
docker exec prometheus tar czf - /prometheus > prometheus_backup.tar.gz

# Backup Grafana configuration
docker exec grafana tar czf - /var/lib/grafana > grafana_backup.tar.gz
```

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [prom-client Node.js Library](https://github.com/siimon/prom-client)
