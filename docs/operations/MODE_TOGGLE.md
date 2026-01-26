# ResearchFlow Mode Toggling Operations Guide

## Overview

ResearchFlow operates in one of three governance modes that control system behavior,
data processing capabilities, and security posture. This document covers mode definitions,
emergency procedures, and return-to-normal checklists.

## Mode Definitions

### DEMO Mode (Default, Safest)

| Aspect | Behavior |
|--------|----------|
| AI Calls | Blocked - returns mock responses |
| Data Upload | Blocked |
| Data Export | Blocked |
| Authentication | Optional |
| Network Calls | May be blocked (if NO_NETWORK=true) |

**Use Case:** Demonstrations, training, UI development, testing without real data.

### LIVE Mode (Production)

| Aspect | Behavior |
|--------|----------|
| AI Calls | Enabled - real API calls |
| Data Upload | Enabled (with PHI scanning if STRICT_PHI_ON_UPLOAD=true) |
| Data Export | Enabled |
| Authentication | Required |
| Network Calls | Enabled |

**Use Case:** Normal production operation with real research data.

### STANDBY Mode (Emergency Lockdown)

| Aspect | Behavior |
|--------|----------|
| AI Calls | Blocked |
| Data Upload | Blocked |
| Data Export | Blocked |
| Write Operations | All blocked |
| Read Operations | Limited to /status, /health, /config |
| Authentication | Required for allowed endpoints |

**Use Case:** Emergency maintenance, security incidents, system stabilization.

## Environment Variables

### Mode Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ROS_MODE` | **Override mode** - takes precedence over GOVERNANCE_MODE | (empty) |
| `GOVERNANCE_MODE` | Standard mode configuration | DEMO |

**Priority:** `ROS_MODE` > `GOVERNANCE_MODE` > Default (DEMO)

### Safety Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `NO_NETWORK` | Block all external network calls | false |
| `MOCK_ONLY` | Force mock responses even in LIVE | false |
| `ALLOW_UPLOADS` | Enable/disable file uploads | true |
| `STRICT_PHI_ON_UPLOAD` | Enforce PHI scanning on uploads | true |

## Emergency STANDBY Procedure

Use this procedure when you need to immediately lock down the system due to:
- Security incident
- Data integrity concerns
- System instability
- Regulatory compliance issues

### Docker Compose (Local/Staging)

```bash
# Immediate lockdown - all services
export ROS_MODE=STANDBY
docker-compose -f docker-compose.prod.yml up -d

# Or restart specific services
docker-compose -f docker-compose.prod.yml restart orchestrator worker
```

### Kubernetes (Production)

```bash
# Option 1: Patch ConfigMap directly (fastest)
kubectl patch configmap researchflow-config -n researchflow-production \
  --type merge -p '{"data":{"ROS_MODE":"STANDBY"}}'

# Restart deployments to pick up changes
kubectl rollout restart deployment/orchestrator -n researchflow-production
kubectl rollout restart deployment/worker -n researchflow-production

# Option 2: Edit kustomization and apply
# Uncomment ROS_MODE=STANDBY in overlays/production/kustomization.yaml
kubectl apply -k infrastructure/kubernetes/overlays/production
```

### Verification

```bash
# Check mode via API
curl https://api.researchflow.example.com/api/governance/mode

# Expected response:
# {"mode": "STANDBY", "allowedOperations": ["GET /api/status", "GET /api/health"]}

# Check pod environment
kubectl exec -it deployment/orchestrator -n researchflow-production -- env | grep MODE
```

## Return-to-LIVE Checklist

Before returning the system to LIVE mode, complete this checklist:

### Pre-Flight Checks

- [ ] **Incident Resolved:** Root cause identified and mitigated
- [ ] **Security Review:** No active threats or vulnerabilities
- [ ] **Data Integrity:** Database consistency verified
- [ ] **Dependencies:** All external services (Redis, Postgres, APIs) healthy
- [ ] **Logs Reviewed:** No error patterns that would recur

### Infrastructure Verification

- [ ] **Health Endpoints:** All services returning healthy status
  ```bash
  curl https://api.researchflow.example.com/health
  curl https://api.researchflow.example.com/api/status
  ```

- [ ] **Database Connectivity:** Postgres accepting connections
  ```bash
  kubectl exec -it deployment/orchestrator -n researchflow-production -- \
    node -e "require('./db').pool.query('SELECT 1')"
  ```

- [ ] **Redis Connectivity:** Cache service responding
  ```bash
  kubectl exec -it pod/redis-0 -n researchflow-production -- redis-cli ping
  ```

- [ ] **External APIs:** Anthropic API reachable (if applicable)

### Mode Transition

```bash
# Docker Compose
unset ROS_MODE
# Or explicitly set to empty
export ROS_MODE=
docker-compose -f docker-compose.prod.yml up -d

# Kubernetes - remove ROS_MODE override
kubectl patch configmap researchflow-config -n researchflow-production \
  --type json -p '[{"op": "remove", "path": "/data/ROS_MODE"}]'

kubectl rollout restart deployment/orchestrator -n researchflow-production
kubectl rollout restart deployment/worker -n researchflow-production
```

### Post-Transition Verification

- [ ] **Mode Confirmed:** API returns `{"mode": "LIVE"}`
- [ ] **AI Calls Working:** Test a simple AI endpoint
- [ ] **Upload Working:** Test file upload (with test data)
- [ ] **Authentication Working:** Verify auth flow
- [ ] **Monitoring:** Check metrics/alerts are normal

### Communication

- [ ] **Stakeholders Notified:** Inform team of return to normal operation
- [ ] **Incident Report:** Document what happened and resolution
- [ ] **Runbook Updated:** Add any learnings to this document

## Monitoring Alerts

Configure alerts for mode changes:

```yaml
# Prometheus alert example
groups:
  - name: researchflow-mode
    rules:
      - alert: ResearchFlowModeChange
        expr: |
          changes(researchflow_governance_mode{mode!="LIVE"}[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "ResearchFlow mode changed to {{ $labels.mode }}"
          description: "System mode is no longer LIVE. Investigate immediately."

      - alert: ResearchFlowStandbyMode
        expr: |
          researchflow_governance_mode{mode="STANDBY"} == 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "ResearchFlow in STANDBY mode"
          description: "System has been in STANDBY for 5+ minutes. Verify this is intentional."
```

## Troubleshooting

### Mode Not Changing

1. **Environment variable not propagated:**
   ```bash
   # Check actual env in container
   kubectl exec -it deployment/orchestrator -- env | grep MODE
   ```

2. **ConfigMap not applied:**
   ```bash
   kubectl describe configmap researchflow-config -n researchflow-production
   ```

3. **Pods not restarted:**
   ```bash
   kubectl rollout status deployment/orchestrator -n researchflow-production
   ```

### Invalid Mode Value

If `ROS_MODE` is set to an invalid value, the system logs a warning and falls back to `GOVERNANCE_MODE`, then to DEMO. Check logs:

```bash
kubectl logs deployment/orchestrator -n researchflow-production | grep MODE-GUARD
```

## Quick Reference

| Action | Command |
|--------|---------|
| Emergency STANDBY | `kubectl patch cm researchflow-config -p '{"data":{"ROS_MODE":"STANDBY"}}'` |
| Return to LIVE | `kubectl patch cm researchflow-config --type json -p '[{"op":"remove","path":"/data/ROS_MODE"}]'` |
| Check current mode | `curl https://api.example.com/api/governance/mode` |
| Force DEMO locally | `export ROS_MODE=DEMO && docker-compose up -d` |
