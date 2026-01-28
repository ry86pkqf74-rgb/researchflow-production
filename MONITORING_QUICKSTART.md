# ResearchFlow Monitoring - Quick Start Guide

## 5-Minute Setup

### Step 1: Configure Environment Variables

Add to your `.env` file:

```bash
# Grafana
GRAFANA_ADMIN_PASSWORD=securepassword123

# Slack (optional but recommended)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# SMTP (optional for email alerts)
SMTP_SERVER=smtp.gmail.com:587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Database (for exporters)
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_NAME=researchflow
```

### Step 2: Start the Monitoring Stack

```bash
cd /path/to/researchflow-production

# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps

# Output should show:
# prometheus    - running on port 9090
# grafana       - running on port 3000
# alertmanager  - running on port 9093
# node-exporter - running on port 9100
# redis         - running on port 6379
# postgres      - running on port 5432
```

### Step 3: Access the Dashboards

- **Grafana Dashboards**: http://localhost:3000
  - Username: `admin`
  - Password: Value from `GRAFANA_ADMIN_PASSWORD`
  - Pre-configured dashboards available in left sidebar

- **Prometheus UI**: http://localhost:9090
  - View scraped targets: Status > Targets
  - Query metrics: Graph tab

- **Alertmanager**: http://localhost:9093
  - View active alerts
  - Manage silences
  - Check alert routing

### Step 4: Integrate Application Metrics (Orchestrator)

```bash
# 1. Install prom-client
cd services/orchestrator
npm install prom-client

# 2. Add to your main server file (e.g., src/index.ts or src/app.ts):

import {
  metricsHandler,
  healthCheckHandler,
  httpMetricsMiddleware,
  requestContextMiddleware,
  initializeMetrics,
} from './middleware/metrics';

// Before route handlers (after middleware setup)
app.use(requestContextMiddleware);
app.use(httpMetricsMiddleware);

// Add endpoints for Prometheus to scrape
app.get('/metrics', metricsHandler);
app.get('/health', healthCheckHandler);

// Initialize periodic metric updates
initializeMetrics(
  // Function to get active users count
  async () => {
    // Example: return user count from database
    const count = await db.query('SELECT COUNT(*) FROM users WHERE lastSeenAt > NOW() - INTERVAL 5 minutes');
    return count[0].count;
  },
  // Function to get pending approvals count
  async () => {
    // Example: return pending approval count
    const count = await db.query('SELECT COUNT(*) FROM approvals WHERE status = "pending"');
    return count[0].count;
  }
);

# 3. Restart orchestrator
docker-compose restart orchestrator
```

### Step 5: Verify Metrics Collection

1. Wait 15-30 seconds for Prometheus to scrape metrics
2. Check Prometheus targets: http://localhost:9090/targets
3. All services should show "UP" status (green)
4. Query a metric in Prometheus: `up` or `http_requests_total`
5. View dashboards in Grafana - they should populate with data

## Available Dashboards

1. **Service Health** - Service uptime, restart counts, status
2. **API Latency** - Request latency percentiles (p50, p95, p99)
3. **Error Rates** - Error rate trends and error count by endpoint
4. **Resources** - CPU, memory, disk usage by container

## Key Metrics Available

### HTTP/API Metrics
- `http_request_duration_ms` - Request latency histogram
- `http_requests_total` - Total request count by status
- `http_request_size_bytes` - Request payload size
- `http_response_size_bytes` - Response payload size

### Business Metrics
- `active_users` - Current active user count
- `pending_approvals` - Number of pending approvals
- `document_processing_time_ms` - Document processing latency

### System Metrics
- `up` - Service health (0=down, 1=up)
- `process_resident_memory_bytes` - Process memory usage
- `process_cpu_seconds_total` - CPU time used
- `node_cpu_seconds_total` - Host CPU usage
- `node_memory_MemAvailable_bytes` - Available memory

## Common Queries in Prometheus

```
# Service uptime
up{job="orchestrator"}

# Request rate (requests per second)
rate(http_requests_total[5m])

# Error rate percentage
100 * sum(rate(http_requests_total{status=~"4..|5.."}[5m])) / sum(rate(http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))

# Active users
active_users

# Memory usage
process_resident_memory_bytes{job="orchestrator"}
```

## Alert Channels

Alerts are routed to Slack if webhook is configured:

- **#critical-alerts** - Service down, very high error rates
- **#error-alerts** - High error rates
- **#performance-alerts** - High latency, CPU/memory issues
- **#alerts** - General alerts

Email alerts sent to ops team for resource issues (DiskSpaceLow, etc.)

## Troubleshooting

### Metrics not appearing?

```bash
# 1. Check if service is running
curl http://localhost:3000/metrics

# 2. Check Prometheus targets
# Go to http://localhost:9090/targets and look for your service

# 3. Check Docker logs
docker logs orchestrator
docker logs prometheus

# 4. Verify network connectivity
docker-compose exec prometheus ping orchestrator
```

### Alerts not firing?

```bash
# 1. Check alert rules in Prometheus
# Go to http://localhost:9090/alerts

# 2. Verify Slack webhook URL is correct
curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test"}'

# 3. Check Alertmanager configuration
docker logs alertmanager
```

### Dashboard not showing data?

1. Verify Prometheus datasource is healthy (Data Sources in Grafana settings)
2. Wait 30+ seconds for data collection
3. Check Prometheus has data: http://localhost:9090/graph
4. Refresh Grafana dashboard (F5)

## Next Steps

1. **Configure Alert Routes** - Customize Slack channels in `/infrastructure/monitoring/alertmanager.yml`
2. **Adjust Thresholds** - Modify alert rules in `/infrastructure/monitoring/alert-rules.yml`
3. **Add Custom Metrics** - Extend `/services/orchestrator/src/middleware/metrics.ts`
4. **Create Custom Dashboards** - Add new JSON dashboard files in `/infrastructure/monitoring/grafana/provisioning/dashboards/`
5. **Set Up SMTP** - Configure email alerts in `alertmanager.yml`

## Documentation

- **Full Setup Guide**: See `/infrastructure/monitoring/README.md`
- **Implementation Details**: See `/MONITORING_SETUP_SUMMARY.md`
- **Prometheus Config**: `/infrastructure/monitoring/prometheus.yml`
- **Alert Rules**: `/infrastructure/monitoring/alert-rules.yml`
- **Metrics Middleware**: `/services/orchestrator/src/middleware/metrics.ts`

## Support

For detailed configuration and troubleshooting:
1. Check the comprehensive README: `/infrastructure/monitoring/README.md`
2. Review Docker Compose file: `/docker-compose.monitoring.yml`
3. Consult Prometheus documentation: https://prometheus.io/docs
4. Review Grafana docs: https://grafana.com/docs/

## Default Credentials

- Grafana: `admin` / `<GRAFANA_ADMIN_PASSWORD from .env>`
- Prometheus: No authentication required
- Alertmanager: No authentication required

**Change Grafana password after first login!**
