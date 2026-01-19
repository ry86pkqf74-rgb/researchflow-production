# Istio Service Mesh Configuration

**Phase A - Task 10: Istio Service Mesh**

## Overview

This directory contains Istio configuration for ResearchFlow microservices, providing:

- **mTLS**: Automatic mutual TLS between services
- **Traffic Management**: Intelligent routing, retries, timeouts
- **Observability**: Distributed tracing, metrics collection
- **Security**: Fine-grained access control with OPA integration

## Installation

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- 4GB+ available memory

### Install Istio

```bash
# Download and install Istio CLI
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Install Istio with default profile
istioctl install --set profile=default -y

# Verify installation
istioctl verify-install

# Enable sidecar injection for researchflow namespace
kubectl label namespace researchflow istio-injection=enabled

# Verify label
kubectl get namespace researchflow --show-labels
```

### Deploy Istio Configuration

```bash
# Apply all Istio resources
kubectl apply -f infrastructure/kubernetes/base/istio/

# Verify configuration
kubectl get peerauthentication -n researchflow
kubectl get destinationrule -n researchflow
kubectl get virtualservice -n researchflow
kubectl get authorizationpolicy -n researchflow
```

## Configuration Files

### peer-authentication.yaml
Enforces STRICT mTLS mode for all service-to-service communication.

### destination-rules.yaml
Configures connection pooling, circuit breaking, and outlier detection for each service.

### virtual-services.yaml
Defines routing rules, timeouts, and retry policies.

### authorization-policy.yaml
Integrates with OPA for external authorization on API endpoints.

## Verifying mTLS

```bash
# Check if mTLS is enabled
kubectl exec -it $(kubectl get pod -n researchflow -l app.kubernetes.io/component=orchestrator -o jsonpath='{.items[0].metadata.name}') -n researchflow -c istio-proxy -- openssl s_client -connect worker:8000

# Should show certificate verification and TLS handshake
```

## Traffic Management

### View Traffic Routes

```bash
# Get virtual services
kubectl get virtualservices -n researchflow

# Describe routing rules
kubectl describe virtualservice orchestrator -n researchflow
```

### Test Retries

```bash
# Simulate service failure and observe retries
kubectl logs -n researchflow -l app.kubernetes.io/component=orchestrator -c istio-proxy --tail=100
```

## Observability

### Kiali Dashboard

```bash
# Install Kiali
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml

# Access dashboard
istioctl dashboard kiali
```

### Jaeger Tracing

```bash
# Install Jaeger
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/jaeger.yaml

# Access tracing UI
istioctl dashboard jaeger
```

### Prometheus Metrics

```bash
# Install Prometheus
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml

# View metrics
istioctl dashboard prometheus
```

## Troubleshooting

### Sidecars not injected

```bash
# Check namespace label
kubectl get namespace researchflow --show-labels

# If missing, add label
kubectl label namespace researchflow istio-injection=enabled

# Restart pods to inject sidecars
kubectl rollout restart deployment -n researchflow
```

### mTLS connection failures

```bash
# Check peer authentication
kubectl get peerauthentication -n researchflow -o yaml

# Check destination rules
kubectl get destinationrule -n researchflow -o yaml

# View proxy logs
kubectl logs -n researchflow POD_NAME -c istio-proxy
```

### OPA authorization failures

```bash
# Check if OPA is running
kubectl get pods -n researchflow -l app=opa

# View OPA logs
kubectl logs -n researchflow -l app=opa

# Test policy directly
kubectl port-forward -n researchflow svc/opa 8181:8181
curl -X POST http://localhost:8181/v1/data/envoy/authz/allow \
  -d '{"input": {...}}'
```

## Performance Tuning

### Resource Limits

Istio sidecars add overhead. Adjust pod resources:

```yaml
resources:
  requests:
    cpu: "100m"      # Add 100m for sidecar
    memory: "128Mi"  # Add 128Mi for sidecar
  limits:
    cpu: "2000m"
    memory: "1Gi"
```

### Connection Pool Tuning

Edit `destination-rules.yaml` to adjust connection pools:

```yaml
trafficPolicy:
  connectionPool:
    tcp:
      maxConnections: 100
    http:
      http1MaxPendingRequests: 50
      http2MaxRequests: 100
```

## Security Best Practices

1. **Always use STRICT mTLS** in production
2. **Enable authorization policies** for all services
3. **Regularly update Istio** to latest patch version
4. **Monitor authorization denials** in OPA logs
5. **Use network policies** in addition to Istio policies

## Rollback

To remove Istio:

```bash
# Remove Istio injection label
kubectl label namespace researchflow istio-injection-

# Delete Istio configuration
kubectl delete -f infrastructure/kubernetes/base/istio/

# Restart pods to remove sidecars
kubectl rollout restart deployment -n researchflow

# Uninstall Istio (if needed)
istioctl uninstall --purge -y
```

## Resources

- [Istio Documentation](https://istio.io/latest/docs/)
- [Istio Security Best Practices](https://istio.io/latest/docs/ops/best-practices/security/)
- [OPA Integration](https://www.openpolicyagent.org/docs/latest/envoy-introduction/)
