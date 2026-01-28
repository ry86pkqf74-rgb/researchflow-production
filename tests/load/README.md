# Load Testing with K6

This directory contains load testing configurations and scripts for ResearchFlow API endpoints.

## Quick Start

### 1. Install K6

```bash
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
sudo apt-get update
sudo apt-get install k6

# Windows (with Chocolatey)
choco install k6

# Or visit: https://k6.io/docs/getting-started/installation/
```

### 2. Run a Load Test

```bash
# Run full load test (25 minutes, 100 concurrent users)
./tests/load/k6-runner.sh full

# Run specific endpoint test
./tests/load/k6-runner.sh auth      # Authentication endpoint
./tests/load/k6-runner.sh projects  # Projects endpoint
./tests/load/k6-runner.sh governance # Governance endpoint

# Run realistic user workflow
./tests/load/k6-runner.sh workflow

# Test against custom URL
./tests/load/k6-runner.sh full --url=http://api.example.com

# Direct k6 command
k6 run tests/load/k6-config.js
```

## Load Testing Scenarios

### 1. Full Load Test (Default)
- **Duration**: 25 minutes
- **VUs**: Ramp up to 100
- **Flow**:
  - 2m: 0 → 20 users
  - 3m: 20 → 50 users
  - 5m: 50 → 100 users
  - 10m: Stay at 100 users
  - 3m: 100 → 50 users
  - 2m: 50 → 0 users
- **Endpoints tested**: Auth, Projects, Governance
- **Use case**: Comprehensive system load testing

### 2. Authentication Test
Tests the login endpoint under load.
```bash
./tests/load/k6-runner.sh auth
```

### 3. Projects Test
Tests the projects retrieval endpoint under load.
```bash
./tests/load/k6-runner.sh projects
```

### 4. Governance Test
Tests the governance pending endpoint under load.
```bash
./tests/load/k6-runner.sh governance
```

### 5. Workflow Test
Simulates realistic user journey:
1. Login
2. Fetch projects
3. Check governance status

```bash
./tests/load/k6-runner.sh workflow
```

### 6. Stress Test
Hits endpoints rapidly to find breaking points.
```bash
./tests/load/k6-runner.sh stress
```

### 7. Spike Test
Simulates sudden traffic spike.
```bash
./tests/load/k6-runner.sh spike
```

## Configuration

### Performance Thresholds

Thresholds are defined in `k6-config.js` and determine pass/fail criteria:

- **Auth p95**: < 200ms (95th percentile response time)
- **Auth p99**: < 500ms (99th percentile response time)
- **Projects p95**: < 200ms
- **Governance p95**: < 300ms (slower due to governance checks)
- **Error Rate**: < 1%
- **HTTP Status**: p95 < 500ms

### Virtual Users (VUs)

The full test targets:
- **Peak Load**: 100 concurrent users
- **Min Threshold**: Error rate < 1%
- **Target Latency**: p95 < 200ms for most endpoints

## Reading Test Results

### Summary Metrics

```
✓ status is correct
✓ response time < 500ms
✓ has content
```

### Key Metrics to Monitor

1. **Response Times**
   - `auth_duration` - Authentication endpoint response time
   - `projects_duration` - Projects endpoint response time
   - `governance_duration` - Governance endpoint response time

2. **Error Metrics**
   - `errors` - Error rate (should be < 1%)
   - `http_req_duration` - Overall HTTP request duration

3. **Load Metrics**
   - `active_users` - Current number of active VUs
   - `requests` - Total request count

### Example Output

```
scenarios: (100.00%) 1 scenario, 100 max VUs, 25m30s max duration (incl. graceful stop)
           default: 100 looping VUs for 25m0s (maxVUs: 100, gracefulStop: 30s)

✓ status is correct
✓ response time < 500ms
✓ has content

checks........................: 95.5% ✓ 2861 ✗ 134
data_received..................: 429 kB 3.4 kB/s
data_sent.......................: 184 kB 1.5 kB/s
http_req_duration...............: avg=156ms min=10ms med=142ms max=1.2s p(90)=235ms p(95)=289ms
```

## Generating Reports

K6 generates JSON reports that can be analyzed further:

```bash
# Reports are automatically saved to tests/load/reports/
ls -la tests/load/reports/

# Analyze a report
cat tests/load/reports/report_20240128_153022.json | jq '.metrics'
```

### Publishing to K6 Cloud

For more advanced analysis, upload to K6 Cloud:

```bash
# Login to K6 cloud
k6 login cloud

# Run test and push results to cloud
k6 run tests/load/k6-config.js --out cloud
```

## CI/CD Integration

### GitHub Actions

Load tests are configured in `.github/workflows/load-testing.yml` and run:
- **When**: On pushes to main branch
- **Frequency**: After successful build
- **Duration**: 25 minutes
- **Artifacts**: Test reports uploaded for review

### Running in CI

```bash
# Install k6 in CI environment
apt-get update && apt-get install -y k6

# Run test against staging/production
BASE_URL=https://api.example.com k6 run tests/load/k6-config.js
```

## Troubleshooting

### K6 Not Found
```bash
# Install k6
brew install k6  # or your package manager

# Verify installation
k6 version
```

### Connection Refused
```bash
# Check if API is running
curl http://localhost:3001/health

# Update BASE_URL if needed
./tests/load/k6-runner.sh full --url=http://your-api-url
```

### High Error Rate

1. Check API logs: `docker logs orchestrator`
2. Monitor system resources: `top`, `htop`
3. Check database connections
4. Review thresholds in `k6-config.js`

### Out of Memory

Increase memory limit:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

## Advanced Usage

### Custom VU Configuration

```bash
k6 run tests/load/k6-config.js \
  --vus 50 \
  --duration 5m \
  --out json=report.json
```

### Targeting Specific Endpoint

Modify the default function in `k6-config.js` to focus on specific endpoints.

### Custom Thresholds

Edit thresholds in `k6-config.js`:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<300', 'p(99)<1000'], // Stricter thresholds
}
```

## References

- [K6 Documentation](https://k6.io/docs/)
- [K6 JavaScript API](https://k6.io/docs/javascript-api/)
- [HTTP Performance Testing](https://k6.io/docs/test-types/load-testing/)
- [Best Practices](https://k6.io/docs/testing-guides/load-testing-best-practices/)

## Support

For issues or questions about load testing:
1. Check K6 documentation
2. Review error messages in test output
3. Check API logs and system resources
4. Consult team performance baselines
