# Docker Scout CI/CD Integration Guide

## Overview

This guide covers the Docker Scout security scanning integration for ResearchFlow.

The workflow scans all three services:
- **Orchestrator** (Node.js) - API and job orchestration
- **Worker** (Python FastAPI) - Data processing and workflow engine
- **Web** (React) - Frontend application

## Prerequisites

### 1. Docker Hub Account (for Scout API)

Docker Scout requires Docker Hub authentication for API access, even when scanning images in other registries.

1. Create a [Docker Hub account](https://hub.docker.com) if you don't have one
2. Go to **Account Settings** → **Security**
3. Click **New Access Token**
4. Name: `researchflow-scout`
5. Permissions: **Read-only** (sufficient for scanning)
6. Copy the token immediately

### 2. GitHub Repository Secrets

Add these secrets to your repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add:

| Secret | Value |
|--------|-------|
| `DOCKER_USER` | Your Docker Hub username |
| `DOCKER_PAT` | Docker Hub access token from step 1 |

> Note: `GITHUB_TOKEN` is automatically provided - no setup needed.

## How It Works

### On Pull Request

1. Builds each service image locally (not pushed)
2. Compares PR image against `main` branch baseline
3. Posts vulnerability diff as PR comment
4. Uploads SARIF report to GitHub Security tab

### On Push to Main

1. Builds images with SBOM and provenance attestations
2. Pushes to GitHub Container Registry (ghcr.io)
3. Images become the new baseline for future comparisons

## Workflow Output

### PR Comments

Each service gets a comparison comment showing:
- New vulnerabilities introduced
- Vulnerabilities fixed
- Package changes
- Policy compliance delta

### Job Summary

The workflow generates a summary table:

| Service | Status | Details |
|---------|--------|---------|
| 🟢 Orchestrator | ✅ Passed | Node.js API |
| 🟢 Worker | ✅ Passed | Python FastAPI |
| 🔴 Web | ❌ Failed | Check logs |

### Security Tab

SARIF reports appear under **Security** → **Code scanning alerts**.

## Configuration

### Adjust Severity Levels

Edit `.github/workflows/docker-scout.yml`:

```yaml
- name: Docker Scout Compare
  uses: docker/scout-action@v1
  with:
    only-severities: critical,high,medium  # Add medium
```

### Trigger Paths

The workflow only runs when relevant files change:

```yaml
paths:
  - "services/**"
  - "packages/**"
  - "Dockerfile*"
  - "docker-compose*.yml"
  - "infrastructure/docker/**"
```

## Troubleshooting

### "Image not found" Error

The PR image must be loaded locally. Ensure:
```yaml
load: ${{ github.event_name == 'pull_request' }}
```

### "Authentication required" Error

Verify secrets are set:
1. `DOCKER_USER` = Docker Hub username (not email)
2. `DOCKER_PAT` = Valid access token

### SARIF Upload Fails

- Requires GitHub Advanced Security (free for public repos)
- For private repos, requires GitHub Enterprise or appropriate plan

### No Baseline Image

If `main` branch has never been built, the first scan won't have a comparison baseline. Push to main first to establish baseline.

## Integration with Existing Workflows

This workflow complements your existing CI/CD:

| Workflow | Purpose |
|----------|---------|
| `build-images.yml` | Build & push images |
| `docker-scout.yml` | Security scanning |
| `security-scan.yaml` | Additional security checks |

Consider adding Scout as a required check:

1. **Settings** → **Branches** → **main**
2. **Require status checks**
3. Add: `Scout - Orchestrator`, `Scout - Worker`, `Scout - Web`

## Resources

- [Docker Scout Documentation](https://docs.docker.com/scout/)
- [Scout Action Reference](https://github.com/docker/scout-action)
- [GitHub Security Features](https://docs.github.com/en/code-security)
