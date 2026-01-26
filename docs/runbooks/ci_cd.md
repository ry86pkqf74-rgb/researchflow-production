# CI/CD Runbook

## Overview

ResearchFlow uses GitHub Actions for continuous integration, security scanning, and deployment automation.

## Workflow Files

Located in `.github/workflows/`:

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `ci.yml` | PR, push to main | Lint, typecheck, tests |
| Security | `security-scan.yaml` | PR, push, weekly | Trivy, CodeQL, Gitleaks |
| Build Images | `build-images.yml` | Push to main | Docker image builds |
| Deploy Staging | `deploy-staging.yml` | Push to main | K8s staging deploy |
| Deploy Production | `deploy-production.yml` | Manual, tag | K8s production deploy |
| PHI Codegen | `phi-codegen-check.yml` | PR | Verify PHI patterns |
| PR Size Guard | `pr-size-guard.yml` | PR | Enforce PR size limits |
| Publish Docs | `publish-docs.yml` | Push to main | MkDocs deployment |
| Slack Notify | `slack-notify.yml` | Workflow completion | CI notifications |

## CI Pipeline

### Jobs

1. **test** (Node.js)
   - Checkout code
   - Setup Node 20
   - Install dependencies
   - Run lint
   - Run typecheck
   - Run unit tests
   - Generate coverage

2. **python-tests**
   - Checkout code
   - Setup Python 3.11
   - Install requirements
   - Run pytest

### Running Locally

```bash
# Lint
npm run lint

# Typecheck
npm run typecheck

# Tests
npm test

# Coverage
npm run test:coverage

# All checks
npm run ci
```

## Security Scanning

### Trivy (Container Scanning)

Scans Docker images for vulnerabilities.

```bash
# Local scan
trivy image researchflow/orchestrator:latest
```

### CodeQL (SAST)

Static analysis for security vulnerabilities.

```bash
# Results in GitHub Security tab
```

### Gitleaks (Secrets)

Scans for hardcoded secrets.

```bash
# Local scan
gitleaks detect --source .
```

### pip-audit (Python Dependencies)

Checks for vulnerable Python packages.

```bash
cd services/worker
pip-audit
```

## Docker Builds

### Images

- `researchflow/orchestrator`
- `researchflow/web`
- `researchflow/worker`
- `researchflow/collab`

### Building Locally

```bash
# All services
docker compose build

# Single service
docker compose build orchestrator
```

### Registry

Images pushed to configured registry (GitHub Container Registry or DockerHub).

## Deployment

### Staging

Automatic on push to main:

1. Build images
2. Push to registry
3. Update K8s manifests
4. Apply to staging cluster

### Production

Manual trigger with tag:

1. Create release tag
2. Trigger deploy workflow
3. Approve deployment
4. Apply to production cluster

### Rollback

```bash
# K8s rollback
kubectl rollout undo deployment/orchestrator

# Or deploy specific version
kubectl set image deployment/orchestrator orchestrator=researchflow/orchestrator:v1.2.3
```

## Environment Variables

### Required Secrets (GitHub)

```
DOCKER_USERNAME
DOCKER_PASSWORD
KUBECONFIG_STAGING
KUBECONFIG_PRODUCTION
SLACK_WEBHOOK_URL
```

### Optional

```
CODECOV_TOKEN
SONAR_TOKEN
```

## Troubleshooting

### CI Failing

1. Check workflow logs in GitHub Actions
2. Run locally: `npm run ci`
3. Check for flaky tests

### Security Scan Alerts

1. Review in GitHub Security tab
2. Update vulnerable dependencies
3. Add to ignore list if false positive

### Deploy Failed

1. Check K8s events: `kubectl get events`
2. Check pod logs: `kubectl logs -l app=orchestrator`
3. Verify image exists in registry

## Adding New Workflows

1. Create `.github/workflows/new-workflow.yml`
2. Define triggers, jobs, steps
3. Add required secrets
4. Test in feature branch

## PR Size Guards

PRs are limited to prevent large, hard-to-review changes:

- Warning at 500 lines
- Block at 1000 lines

Override with `size/approved` label (requires maintainer).

## Related Documentation

- [.github/workflows/](.github/workflows/) - Workflow definitions
- [infrastructure/kubernetes/](infrastructure/kubernetes/) - K8s manifests
- [docker-compose.yml](docker-compose.yml) - Local development
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
