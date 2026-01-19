# Argo Rollouts Configuration

**Phase A - Task 34 & 49: Blue-Green and Canary Deployments**

## Overview

Argo Rollouts provides advanced deployment strategies for Kubernetes:

- **Blue-Green**: Deploy new version alongside old, switch traffic when ready
- **Canary**: Gradually shift traffic from old to new version with automated rollback
- **Progressive Delivery**: Automated analysis and promotion based on metrics

## Installation

### Install Argo Rollouts

```bash
# Install Argo Rollouts controller
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Install kubectl plugin
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x kubectl-argo-rollouts-linux-amd64
sudo mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts

# Verify installation
kubectl argo rollouts version
```

### Deploy Rollouts

```bash
# Apply rollout configurations
kubectl apply -f infrastructure/kubernetes/base/rollouts/

# Verify rollouts
kubectl argo rollouts list -n researchflow
```

## Blue-Green Deployment

### Strategy

1. Deploy new version ("green") alongside current version ("blue")
2. Run automated tests against green version
3. Manual or automated promotion
4. Switch all traffic to green
5. Keep blue as rollback option for 5 minutes
6. Scale down blue

### Trigger Deployment

```bash
# Update image
kubectl argo rollouts set image orchestrator-bg \
  orchestrator=researchflow/orchestrator:v2.0.0 \
  -n researchflow

# Watch progress
kubectl argo rollouts get rollout orchestrator-bg -n researchflow --watch

# Preview new version (via preview service)
kubectl port-forward svc/orchestrator-preview 8080:3001 -n researchflow

# Promote after verification
kubectl argo rollouts promote orchestrator-bg -n researchflow

# Abort if issues found
kubectl argo rollouts abort orchestrator-bg -n researchflow
```

### Testing Preview Version

```bash
# Access preview service
PREVIEW_IP=$(kubectl get svc orchestrator-preview -n researchflow -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Run smoke tests
curl http://$PREVIEW_IP:3001/healthz
curl http://$PREVIEW_IP:3001/api/status

# Run integration tests
npm run test:integration -- --baseUrl=http://$PREVIEW_IP:3001
```

## Canary Deployment

### Strategy

1. Deploy new version as canary (10% traffic)
2. Monitor metrics for 5 minutes
3. If successful, increase to 25%
4. Continue progressive rollout: 10% → 25% → 50% → 75% → 100%
5. Automated rollback if metrics degrade

### Trigger Deployment

```bash
# Update image
kubectl argo rollouts set image orchestrator-canary \
  orchestrator=researchflow/orchestrator:v2.0.0 \
  -n researchflow

# Watch progress (shows traffic weights)
kubectl argo rollouts get rollout orchestrator-canary -n researchflow --watch

# Skip to next step (during pause)
kubectl argo rollouts promote orchestrator-canary -n researchflow

# Abort and rollback
kubectl argo rollouts abort orchestrator-canary -n researchflow
```

### Monitoring Canary

```bash
# View analysis runs
kubectl argo rollouts get experiment -n researchflow

# View metrics
kubectl argo rollouts get rollout orchestrator-canary -n researchflow \
  --show-metrics

# View logs from canary pods
kubectl logs -n researchflow -l rollouts-pod-template-hash=<canary-hash>
```

## Analysis Templates

### Success Rate Analysis

Monitors HTTP success rate from Prometheus metrics:

```yaml
successCondition: result >= 0.95  # 95% success rate
```

### Latency Analysis

Monitors P95 latency:

```yaml
successCondition: result <= 500  # Max 500ms P95 latency
```

## Integration with Istio

Canary rollouts use Istio for traffic splitting:

1. Argo Rollouts updates VirtualService weights
2. Istio Envoy proxies route traffic accordingly
3. Metrics collected from Istio telemetry
4. Automated decisions based on analysis

## Rollback

### Automatic Rollback

Rollback happens automatically if:
- Analysis fails (success rate < 95%)
- P95 latency exceeds threshold
- Error rate spikes

### Manual Rollback

```bash
# Abort current rollout
kubectl argo rollouts abort orchestrator-canary -n researchflow

# Rollback to previous version
kubectl argo rollouts undo orchestrator-canary -n researchflow

# Rollback to specific revision
kubectl argo rollouts undo orchestrator-canary --to-revision=3 -n researchflow
```

## Dashboard

### Web UI

```bash
# Access Argo Rollouts dashboard
kubectl argo rollouts dashboard

# Then open: http://localhost:3100
```

### CLI Watch

```bash
# Watch all rollouts
watch kubectl argo rollouts list -n researchflow

# Watch specific rollout with details
kubectl argo rollouts get rollout orchestrator-canary -n researchflow --watch
```

## Best Practices

1. **Always use analysis** for canary deployments
2. **Test preview** thoroughly before promoting blue-green
3. **Monitor metrics** during rollouts
4. **Set appropriate timeouts** for your application
5. **Keep rollback window** sufficient for detection
6. **Use traffic mirroring** for production testing
7. **Automate promotion** only after gaining confidence

## Troubleshooting

### Rollout stuck in progressing

```bash
# Check rollout status
kubectl argo rollouts status orchestrator-canary -n researchflow

# View events
kubectl describe rollout orchestrator-canary -n researchflow

# Check analysis
kubectl get analysisrun -n researchflow
kubectl describe analysisrun <name> -n researchflow
```

### Analysis always failing

```bash
# Check Prometheus connectivity
kubectl exec -it <rollout-pod> -n researchflow -- \
  curl http://prometheus:9090/api/v1/query?query=up

# View analysis results
kubectl argo rollouts get rollout orchestrator-canary -n researchflow \
  --show-metrics
```

### Traffic not splitting

```bash
# Verify Istio VirtualService
kubectl get virtualservice orchestrator -n researchflow -o yaml

# Check destination rule subsets
kubectl get destinationrule orchestrator -n researchflow -o yaml

# View Istio proxy config
istioctl proxy-config routes <pod-name> -n researchflow
```

## Resources

- [Argo Rollouts Documentation](https://argoproj.github.io/argo-rollouts/)
- [Progressive Delivery](https://argoproj.github.io/argo-rollouts/features/progressive-delivery/)
- [Analysis Templates](https://argoproj.github.io/argo-rollouts/features/analysis/)
