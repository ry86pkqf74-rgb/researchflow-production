# ADR 0003: Argo Rollouts for Deployment Strategy

## Status

Accepted

## Context

Production deployments require:
- Zero-downtime updates
- Ability to quickly rollback
- Gradual traffic shifting for risk mitigation
- Automated rollback on failure

Standard Kubernetes Deployments provide rolling updates but lack:
- Blue/green deployment capability
- Canary deployments with traffic splitting
- Automated analysis and rollback

## Decision

Use **Argo Rollouts** for progressive delivery in production.

Strategies implemented:
1. **Blue/Green** for the orchestrator (user-facing API)
2. **Canary** for workers (gradual rollout)

## Consequences

### Positive
- Blue/green for instant rollback capability
- Canary for gradual, low-risk worker updates
- Prometheus integration for automated analysis
- GitOps-compatible with ArgoCD

### Negative
- Additional CRD and controller to manage
- Learning curve for team
- Requires Prometheus metrics for analysis

### Implementation

**Orchestrator (Blue/Green):**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    blueGreen:
      activeService: orchestrator
      previewService: orchestrator-preview
      autoPromotionEnabled: false
```

**Worker (Canary):**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: {duration: 5m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
      analysis:
        templates:
          - templateName: success-rate
```

### Metrics for Analysis

Rollouts will abort if:
- Error rate > 5% during canary
- p95 latency > 1 second
- Job failure rate increases significantly

### Rollback Procedure

```bash
# Manual rollback
kubectl argo rollouts undo orchestrator

# Abort in-progress rollout
kubectl argo rollouts abort orchestrator
```
