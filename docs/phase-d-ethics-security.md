# Phase D: AI Ethics & Security Deepening (Tasks 61-80)

**Status**: COMPLETE
**Started**: 2026-01-20
**Last Updated**: 2026-01-20

---

## Discovery & Mapping

### Canonical Orchestrator Entrypoint
- **Primary**: `/workspace/services/orchestrator/index.ts` (used by `npm dev` and `npm start`)
- **Secondary**: `/workspace/services/orchestrator/src/index.ts` (legacy, imported by primary)
- **Recommendation**: Use primary for all new routes

### AI Invocations Recording
- **Current**: `handoffPacks` table in `packages/core/types/schema.ts` (lines 391-431)
  - Tracks: modelId, modelVersion, promptHash, responseHash, tokenUsage, costCents
  - Links to: approvalGates via approvalGateId
- **Gap**: No dedicated `ai_invocations` or `ai_model_usage` tables
- **Action**: Add new tables for Phase D tracking

### Approvals Handling
- **Tables**:
  - `approvalGates` (lines 269-308) - Full workflow with status, escalation
  - `approvalAuditEntries` (lines 314-336) - Tracks actions on gates
- **Middleware**: `services/orchestrator/src/middleware/governance-gates.ts`
  - `governanceGate()` - Creates approval gates with PHI scanning
  - `checkApprovalStatus()` - Queries gate status
  - `blockInStandby()` - Blocks in STANDBY mode
- **Pattern**: Returns 202 PENDING with gateId, client polls for status

### Audit Service
- **Files**:
  - `services/orchestrator/src/services/audit-service.ts` - Uses `logAction()`
  - `services/orchestrator/src/services/auditService.ts` - Hash chain version
- **Recommendation**: Consolidate to auditService.ts (hash chain)

---

## Task Checklist

### PR1: Ethics Gate + Consent + Feedback + Explainability

| Task | Description | Status | Files Changed |
|------|-------------|--------|---------------|
| 62 | Ethics gate pre-AI jobs | ✅ Complete | `src/middleware/ethics-gate.ts`, `schema.ts` |
| 64 | Explainability logging | ✅ Complete | `ai-router/explainability.service.ts`, `schema.ts` |
| 65 | Feedback loop for AI | ✅ Complete | `src/routes/ai-feedback.ts`, `schema.ts` |
| 73 | GDPR consent UI | ✅ Complete | `src/routes/consent.ts`, `schema.ts` |

### PR2: Presidio + Watermarking + Anomaly Detection

| Task | Description | Status | Files Changed |
|------|-------------|--------|---------------|
| 63 | AI content watermarking | ✅ Complete | `ai-router/watermark.service.ts` |
| 66 | Presidio PHI integration | ✅ Complete | `phi-engine/adapters/presidio-adapter.ts` |
| 67 | Audit anomaly detection | ✅ Complete | `worker/src/security/audit_anomaly_detector.py` |

### PR3: Zero-Trust + Rate Limiting + Circuit Breakers

| Task | Description | Status | Files Changed |
|------|-------------|--------|---------------|
| 68 | Zero-trust mTLS | ✅ Complete | `infrastructure/kubernetes/istio/*` |
| 69 | DDoS ingress protection | ✅ Complete | `infrastructure/kubernetes/base/ingress.yaml`, `ingress-api.yaml` |
| 71 | Rate limiting all endpoints | ✅ Complete | `src/middleware/rate-limiter.ts` |
| 72 | Circuit breakers | ✅ Complete | `src/clients/workerClient.ts` |

### PR4: Vault + Splunk + Quotas + Chaos + MFA

| Task | Description | Status | Files Changed |
|------|-------------|--------|---------------|
| 70 | Vault secrets management | ✅ Complete | `src/services/vault-client.ts` |
| 74 | Splunk log forwarding | ✅ Complete | `src/services/splunk-logger.ts` |
| 75 | Resource quotas per user | ✅ Complete | `infrastructure/kubernetes/base/resource-quotas.yaml` |
| 76 | Auto-scaling HPA tuning | ✅ Complete | `infrastructure/kubernetes/base/hpa-config.yaml` |
| 77 | Chaos Mesh tests | ✅ Complete | `tests/chaos/chaos-experiments.yaml` |
| 78 | Security scanning deps | ✅ Complete | `.github/workflows/security-scan.yaml` |
| 79 | MFA (TOTP) | ✅ Complete | `src/services/mfa-service.ts`, `src/routes/mfa.ts` |
| 80 | Simulated breach tests | ✅ Complete | `tests/security/simulated-breaches.ts` |

---

## Files Created/Modified

### New Files
```
# PR1: Ethics & Consent
services/orchestrator/src/middleware/ethics-gate.ts
services/orchestrator/src/middleware/asyncHandler.ts
services/orchestrator/src/routes/consent.ts
services/orchestrator/src/routes/ai-feedback.ts
packages/ai-router/src/explainability.service.ts
migrations/0004_phase_d_ethics_security.sql

# PR2: PHI & Anomaly
packages/phi-engine/src/adapters/presidio-adapter.ts
packages/ai-router/src/watermark.service.ts
services/worker/src/security/__init__.py
services/worker/src/security/audit_anomaly_detector.py

# PR3: Security Infrastructure
services/orchestrator/src/middleware/rate-limiter.ts
services/orchestrator/src/clients/workerClient.ts
infrastructure/kubernetes/istio/peer-authentication.yaml
infrastructure/kubernetes/istio/destination-rules.yaml
infrastructure/kubernetes/istio/authorization-policy.yaml
infrastructure/kubernetes/istio/kustomization.yaml
infrastructure/kubernetes/base/ingress-api.yaml

# PR4: Advanced Security
services/orchestrator/src/services/vault-client.ts
services/orchestrator/src/services/splunk-logger.ts
services/orchestrator/src/services/mfa-service.ts
services/orchestrator/src/routes/mfa.ts
infrastructure/kubernetes/base/resource-quotas.yaml
infrastructure/kubernetes/base/hpa-config.yaml
tests/chaos/chaos-experiments.yaml
tests/security/simulated-breaches.ts
.github/workflows/security-scan.yaml
```

### Modified Files
```
packages/core/types/schema.ts          # Added Phase D tables
services/orchestrator/routes.ts        # Mounted consent, ai-feedback, mfa routes
infrastructure/kubernetes/base/ingress.yaml  # Added DDoS protection
```

---

## Environment Variables Added

```bash
# PR1: Ethics & Consent
ETHICS_GATE_ENABLED=false
ETHICS_APPROVAL_VALIDITY_HOURS=24
EXPLAINABILITY_LOGGING_ENABLED=false
GDPR_CONSENT_REQUIRED=false
CONSENT_VERSION=1.0.0

# PR2: PHI & Anomaly
PRESIDIO_ENABLED=false
PRESIDIO_SERVICE_URL=http://presidio:8080
WATERMARK_AI_OUTPUT=false
WATERMARK_SECRET_KEY=researchflow-default-key-change-in-production
ANOMALY_DETECTION_ENABLED=false

# PR3: Security Infrastructure
ISTIO_MTLS_ENABLED=false
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT_MS=10000
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=30000

# PR4: Advanced Security
VAULT_ENABLED=false
VAULT_ADDR=http://vault:8200
VAULT_NAMESPACE=researchflow
VAULT_ROLE_ID=
VAULT_SECRET_ID=
SIEM_LOGGING_ENABLED=false
SIEM_BACKEND=splunk
SPLUNK_HEC_URL=
SPLUNK_HEC_TOKEN=
ELASTICSEARCH_URL=
MFA_ENABLED=false
MFA_ISSUER=ResearchFlow
MFA_WINDOW_SIZE=1
MFA_MAX_ATTEMPTS=5
MFA_LOCKOUT_MINUTES=15
SECURITY_TESTING_MODE=false
CHAOS_TESTING_ENABLED=false
```

---

## Database Migrations

| Migration | Tables | PR |
|-----------|--------|-----|
| `0004_phase_d_ethics_security.sql` | ethics_approvals, ai_invocations, ai_output_feedback, user_consents, user_quotas, mfa_enrollments, security_anomalies | All |

---

## Verification Commands

```bash
# Type checking
npm run typecheck

# Unit tests
npm test

# Governance tests
npm run test:governance

# Security tests
npm run test:security

# Full CI
npm run ci

# Kubernetes validation
kubectl apply --dry-run=client -f infrastructure/kubernetes/istio/
kubectl apply --dry-run=client -f infrastructure/kubernetes/base/

# Chaos tests (staging only)
kubectl apply -f tests/chaos/chaos-experiments.yaml
```

---

## Security Considerations

1. **PHI Protection**: All PHI scanning returns only types and locations, never actual values
2. **Audit Logging**: Hash chain maintains integrity, SIEM forwarding for centralized monitoring
3. **Zero Trust**: Istio mTLS enforces encrypted service-to-service communication
4. **Rate Limiting**: Role-based limits prevent abuse, endpoint-specific limits for sensitive operations
5. **Circuit Breakers**: Prevent cascade failures when downstream services are unavailable
6. **MFA**: TOTP-based with backup codes, rate limited to prevent brute force
7. **Secrets Management**: Vault integration for dynamic secrets rotation
8. **Chaos Testing**: Validates resilience but NEVER runs in production

---

## Notes

- All new tables use UUID primary keys via `gen_random_uuid()`
- All feature flags default to OFF/safe
- PHI values NEVER logged - only types and locations
- Hash chain maintained for audit integrity
- Chaos testing requires explicit SECURITY_TESTING_MODE=true and non-production environment
- Simulated breaches are for training and validation only
