# ResearchFlow Autoscaling Runbook

This document describes the autoscaling configuration and verification procedures for ResearchFlow.

## Overview

ResearchFlow uses multiple autoscaling strategies:

1. **Kubernetes HPA** - CPU/memory-based scaling for the main worker deployment
2. **KEDA** - Queue depth-based scaling for worker-consumer pods
3. **VPA** (optional) - Automatic resource request adjustment

## Prerequisites

### Metrics Server
```bash
# Verify metrics server is running
kubectl get deployment metrics-server -n kube-system

# Check metrics availability
kubectl top pods -n researchflow
```

### KEDA Operator
```bash
# Install KEDA
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm install keda kedacore/keda --namespace keda --create-namespace

# Verify KEDA is running
kubectl get pods -n keda
```

### Prometheus Adapter (for custom metrics)
```bash
# Install Prometheus Adapter
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace monitoring \
  --set prometheus.url=http://prometheus-server.monitoring.svc:9090

# Verify custom metrics
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1" | jq .
```

## Autoscaling Configuration

### Worker HPA (CPU/Memory)

Location: `infrastructure/kubernetes/base/worker-hpa.yaml`

| Parameter | Value | Description |
|-----------|-------|-------------|
| minReplicas | 2 | Minimum worker pods |
| maxReplicas | 10 | Maximum worker pods |
| CPU target | 70% | Scale up when CPU > 70% |
| Memory target | 80% | Scale up when memory > 80% |
| Scale-up cooldown | 60s | Wait before scaling up again |
| Scale-down cooldown | 300s | Wait before scaling down |

### Worker Consumer KEDA (Queue Depth)

Location: `infrastructure/kubernetes/base/worker-consumer-keda.yaml`

| Parameter | Value | Description |
|-----------|-------|-------------|
| minReplicaCount | 1 | Minimum consumer pods |
| maxReplicaCount | 20 | Maximum consumer pods |
| listLength | 5 | Scale up when > 5 jobs per pod |
| activationListLength | 1 | Start scaling when ≥ 1 job |
| pollingInterval | 15s | Check queue every 15 seconds |
| cooldownPeriod | 60s | Wait before scaling to zero |

## Verification Procedures

### 1. Verify HPA Status
```bash
# Check HPA status
kubectl get hpa -n researchflow

# Detailed HPA info
kubectl describe hpa worker-hpa -n researchflow

# Watch scaling events
kubectl get events -n researchflow --field-selector reason=SuccessfulRescale
```

### 2. Verify KEDA ScaledObject
```bash
# Check ScaledObject status
kubectl get scaledobject -n researchflow

# Detailed ScaledObject info
kubectl describe scaledobject worker-consumer-scaledobject -n researchflow

# Check KEDA operator logs
kubectl logs -n keda -l app=keda-operator --tail=50
```

### 3. Load Test for Scaling
```bash
# Generate load by enqueueing jobs
for i in {1..50}; do
  curl -X POST http://localhost:3001/api/jobs \
    -H "Content-Type: application/json" \
    -d '{"type":"test","config":{}}'
done

# Watch pod scaling
watch kubectl get pods -n researchflow -l app=worker-consumer

# Check queue depth
redis-cli -u $REDIS_URL LLEN researchflow:jobs:pending
```

### 4. Verify VPA Recommendations
```bash
# Check VPA status
kubectl get vpa -n researchflow

# View recommendations
kubectl describe vpa worker-vpa -n researchflow
```

## Troubleshooting

### HPA Not Scaling

1. **Check metrics availability**
   ```bash
   kubectl top pods -n researchflow
   ```
   If no metrics, verify metrics-server is running.

2. **Check HPA conditions**
   ```bash
   kubectl describe hpa worker-hpa -n researchflow | grep -A 10 Conditions
   ```

3. **Verify resource requests are set**
   ```bash
   kubectl get deployment worker -n researchflow -o yaml | grep -A 5 resources
   ```

### KEDA Not Scaling

1. **Check ScaledObject status**
   ```bash
   kubectl get scaledobject worker-consumer-scaledobject -n researchflow -o yaml
   ```
   Look for `status.conditions`.

2. **Verify Redis connectivity**
   ```bash
   kubectl exec -n keda -it $(kubectl get pod -n keda -l app=keda-operator -o name | head -1) -- \
     redis-cli -u $REDIS_URL ping
   ```

3. **Check KEDA operator logs**
   ```bash
   kubectl logs -n keda -l app=keda-operator --tail=100 | grep -i error
   ```

### Scaling Too Aggressively

1. Increase `stabilizationWindowSeconds` in HPA behavior
2. Increase `cooldownPeriod` in KEDA ScaledObject
3. Adjust `listLength` threshold in KEDA trigger

### Scaling Too Slowly

1. Decrease `pollingInterval` in KEDA ScaledObject
2. Adjust scale-up policies in HPA behavior
3. Lower `listLength` threshold

## Metrics and Alerts

### Key Metrics to Monitor

- `kube_horizontalpodautoscaler_status_current_replicas` - Current HPA replicas
- `kube_horizontalpodautoscaler_status_desired_replicas` - Desired HPA replicas
- `redis_queue_depth{queue="researchflow-jobs"}` - Job queue depth
- `keda_scaler_metrics_value` - KEDA scaler metrics

### Alert Conditions

1. **WorkerHPAAtMaxReplicas** - HPA at max for > 10 minutes
2. **WorkerHPAFlapping** - Scaling events > 5 in 30 minutes
3. **WorkerQueueBacklog** - Queue depth > 100 for > 5 minutes

## Emergency Procedures

### Manual Scaling
```bash
# Scale worker deployment manually
kubectl scale deployment worker -n researchflow --replicas=10

# Scale worker-consumer manually (KEDA will take over)
kubectl scale deployment worker-consumer -n researchflow --replicas=5
```

### Pause Autoscaling
```bash
# Pause HPA (set manual replicas)
kubectl patch hpa worker-hpa -n researchflow -p '{"spec":{"minReplicas":5,"maxReplicas":5}}'

# Pause KEDA
kubectl annotate scaledobject worker-consumer-scaledobject -n researchflow \
  autoscaling.keda.sh/paused="true"

# Resume KEDA
kubectl annotate scaledobject worker-consumer-scaledobject -n researchflow \
  autoscaling.keda.sh/paused-
```

### Drain Queue
```bash
# Move jobs to dead-letter queue (if implemented)
redis-cli -u $REDIS_URL RENAME researchflow:jobs:pending researchflow:jobs:dlq

# Or clear queue (DATA LOSS - use with caution)
redis-cli -u $REDIS_URL DEL researchflow:jobs:pending
```

## Configuration Changes

When modifying autoscaling configuration:

1. Apply changes to staging first
2. Monitor for at least 1 hour under normal load
3. Run load test to verify scaling behavior
4. Review scaling events and metrics
5. Apply to production during low-traffic window
6. Monitor closely for 24 hours

## References

- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [KEDA Documentation](https://keda.sh/docs/)
- [Prometheus Adapter](https://github.com/kubernetes-sigs/prometheus-adapter)
