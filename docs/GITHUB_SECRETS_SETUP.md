# ResearchFlow GitHub Secrets Configuration Guide

This document provides complete instructions for configuring GitHub Secrets required for CI/CD workflows, AI-powered code review, and deployment pipelines.

## Table of Contents

1. [Required Secrets Overview](#required-secrets-overview)
2. [AI Provider API Keys](#ai-provider-api-keys)
3. [Infrastructure Secrets](#infrastructure-secrets)
4. [Security & Compliance](#security--compliance)
5. [Deployment Secrets](#deployment-secrets)
6. [How to Add Secrets](#how-to-add-secrets)

---

## Required Secrets Overview

### Priority Levels
- 🔴 **Critical**: Required for core functionality
- 🟡 **Important**: Required for full feature set
- 🟢 **Optional**: Enhances capabilities but not required

| Secret Name | Priority | Used In | Purpose |
|------------|----------|---------|---------|
| `OPENAI_API_KEY` | 🔴 | AI Review, Chat Agents | GPT-4 for code analysis |
| `ANTHROPIC_API_KEY` | 🔴 | AI Review, Primary LLM | Claude for structured analysis |
| `XAI_API_KEY` | 🟡 | AI Review, Hypothesis | Grok for experimental ideation |
| `MERCURY_API_KEY` | 🟡 | Code Generation | Mercury diffusion LLM |
| `SOURCEGRAPH_API_KEY` | 🟡 | Code Intelligence | Codebase search |
| `NCBI_API_KEY` | 🟡 | Literature Search | PubMed/MeSH integration |
| `SEMANTIC_SCHOLAR_API_KEY` | 🟢 | Literature Search | Academic paper search |
| `KUBE_CONFIG_PRODUCTION` | 🔴 | Deployment | Kubernetes access |
| `KUBE_CONFIG_STAGING` | 🔴 | Deployment | Kubernetes access |
| `PRODUCTION_URL` | 🔴 | Health Checks | Production endpoint |
| `STAGING_URL` | 🔴 | Health Checks | Staging endpoint |
| `JWT_SECRET` | 🔴 | Authentication | Token signing |
| `ANALYTICS_IP_SALT` | 🟡 | Analytics | Privacy-preserving analytics |
| `SENTRY_DSN` | 🟢 | Error Tracking | Exception monitoring |
| `CODECOV_TOKEN` | 🟢 | Code Coverage | Coverage reports |
| `GITLEAKS_LICENSE` | 🟢 | Security Scan | Secret detection |

---

## AI Provider API Keys

### OpenAI (GPT-4, GPT-4o, Codex)

**Secret Name:** `OPENAI_API_KEY`

**How to obtain:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-proj-...`)

**Used in workflows:**
- `ai-code-review.yml` - AI-powered PR analysis
- `ci.yml` - Chat agent tests

**Format:** `sk-proj-...` or `sk-...`

---

### Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)

**Secret Name:** `ANTHROPIC_API_KEY`

**How to obtain:**
1. Go to [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Sign in or create an account
3. Navigate to API Keys
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-api03-...`)

**Used in workflows:**
- `ai-code-review.yml` - Primary code review LLM
- `prompts-ci.yml` - Prompt testing

**Format:** `sk-ant-api03-...`

---

### xAI (Grok-2, Grok-3)

**Secret Name:** `XAI_API_KEY`

**How to obtain:**
1. Go to [xAI Console](https://console.x.ai/)
2. Sign in with your X/Twitter account
3. Navigate to API section
4. Generate a new API key
5. Copy the key (starts with `xai-...`)

**Used in workflows:**
- `ai-code-review.yml` - Alternative AI perspective
- Hypothesis generation features

**Format:** `xai-...`

---

### InceptionLabs Mercury

**Secret Name:** `MERCURY_API_KEY`

**How to obtain:**
1. Go to [InceptionLabs](https://inceptionlabs.ai/)
2. Sign up for Mercury access
3. Navigate to dashboard
4. Copy your API key

**Used in workflows:**
- Code generation tasks
- Diffusion-based language model features

**Format:** `sk_...` (varies)

---

### Sourcegraph

**Secret Name:** `SOURCEGRAPH_API_KEY`

**How to obtain:**
1. Go to [Sourcegraph](https://sourcegraph.com/)
2. Navigate to User Settings → Access tokens
3. Create a new token with appropriate scopes
4. Copy the token (starts with `sgp_...`)

**Used in workflows:**
- Code intelligence integration
- Cross-repository search

**Format:** `sgp_...`

---

### NCBI/NLM

**Secret Name:** `NCBI_API_KEY`

**How to obtain:**
1. Go to [NCBI Account Settings](https://www.ncbi.nlm.nih.gov/account/settings/)
2. Sign in or create an NCBI account
3. Navigate to API Key Management
4. Generate a new API key
5. Copy the key

**Used in:**
- MeSH term enrichment
- PubMed literature search

---

### Semantic Scholar

**Secret Name:** `SEMANTIC_SCHOLAR_API_KEY`

**How to obtain:**
1. Go to [Semantic Scholar API](https://www.semanticscholar.org/product/api)
2. Request API access
3. Once approved, copy your API key

**Used in:**
- Enhanced literature search
- Citation analysis

---

## Infrastructure Secrets

### Kubernetes Configuration

**Secret Names:**
- `KUBE_CONFIG_PRODUCTION`
- `KUBE_CONFIG_STAGING`

**How to obtain:**
1. Export your kubeconfig: `kubectl config view --raw`
2. Base64 encode if needed
3. Store as secret

**Used in workflows:**
- `deploy-production.yml`
- `deploy-staging.yml`

---

### Environment URLs

**Secret Names:**
- `PRODUCTION_URL` - e.g., `https://researchflow.yourdomain.com`
- `STAGING_URL` - e.g., `https://staging.researchflow.yourdomain.com`

**Used in:**
- Health check verification
- Smoke tests

---

## Security & Compliance

### JWT Secret

**Secret Name:** `JWT_SECRET`

**How to generate:**
```bash
openssl rand -hex 32
```

**Requirements:**
- Minimum 32 characters
- Use cryptographically secure random generation
- Never reuse across environments

---

### Analytics IP Salt

**Secret Name:** `ANALYTICS_IP_SALT`

**How to generate:**
```bash
openssl rand -hex 16
```

**Purpose:** Privacy-preserving IP hashing for analytics

---

### Gitleaks License

**Secret Name:** `GITLEAKS_LICENSE`

**How to obtain:**
1. Visit [Gitleaks](https://gitleaks.io/)
2. Sign up for a license
3. Copy your license key

**Used in:**
- `security-scan.yaml` - Secret detection

---

## Deployment Secrets

### Container Registry (GitHub Container Registry)

The `GITHUB_TOKEN` is automatically provided and used for:
- Pushing container images to ghcr.io
- Pulling images during deployment

No additional configuration needed.

---

### Webhook Secrets (Optional)

**Secret Names:**
- `STRIPE_WEBHOOK_SECRET` - Payment processing webhooks
- `ZOOM_WEBHOOK_SECRET_TOKEN` - Video integration
- `ZOOM_VERIFICATION_TOKEN` - Zoom URL validation

---

## How to Add Secrets

### Via GitHub Web UI

1. Navigate to your repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name (exactly as shown above)
5. Paste the secret value
6. Click **Add secret**

### Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
brew install gh

# Authenticate
gh auth login

# Add a secret
gh secret set OPENAI_API_KEY --body "sk-proj-..."

# Add secrets from a file (one per line, format: NAME=value)
gh secret set -f .env.secrets

# List existing secrets
gh secret list
```

### Using Environment-Specific Secrets

For production/staging separation:

1. Go to **Settings** → **Environments**
2. Create `production` and `staging` environments
3. Add environment-specific secrets under each
4. Reference in workflows with `environment: production`

---

## Verification

After adding secrets, verify they're configured correctly:

1. **Trigger a test workflow:**
   ```bash
   gh workflow run ci.yml
   ```

2. **Check workflow logs:**
   - Navigate to Actions tab
   - Look for successful secret access (secrets are masked in logs)

3. **Verify AI providers:**
   - Create a test PR to trigger `ai-code-review.yml`
   - Check that AI comments appear on the PR

---

## Troubleshooting

### Common Issues

1. **"Bad credentials" or 401 errors**
   - Verify the API key is correct (no extra spaces/newlines)
   - Check the key hasn't expired
   - Ensure billing is active on the provider account

2. **Secret not found in workflow**
   - Verify exact secret name (case-sensitive)
   - Check if using environment-specific secrets with correct environment

3. **Rate limiting**
   - OpenAI: Check usage limits at platform.openai.com/usage
   - Anthropic: Check console.anthropic.com/settings/limits

---

## Security Best Practices

1. **Rotate secrets regularly** (every 90 days recommended)
2. **Use environment-specific secrets** for production/staging
3. **Never log or print secrets** in workflow outputs
4. **Enable secret scanning** in repository settings
5. **Use least-privilege access** when generating API keys

---

## Quick Reference - All Secrets

```bash
# Required for AI features
gh secret set OPENAI_API_KEY
gh secret set ANTHROPIC_API_KEY
gh secret set XAI_API_KEY
gh secret set MERCURY_API_KEY
gh secret set SOURCEGRAPH_API_KEY

# Required for literature search
gh secret set NCBI_API_KEY
gh secret set SEMANTIC_SCHOLAR_API_KEY

# Required for deployment
gh secret set KUBE_CONFIG_PRODUCTION
gh secret set KUBE_CONFIG_STAGING
gh secret set PRODUCTION_URL
gh secret set STAGING_URL

# Required for security
gh secret set JWT_SECRET
gh secret set ANALYTICS_IP_SALT

# Optional
gh secret set SENTRY_DSN
gh secret set VITE_SENTRY_DSN
gh secret set CODECOV_TOKEN
gh secret set GITLEAKS_LICENSE
```

---

*Last updated: January 2026*
