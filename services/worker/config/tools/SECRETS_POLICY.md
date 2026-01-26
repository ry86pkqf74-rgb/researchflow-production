# Secrets Management Policy

**Policy Owner:** Research Project Lead  
**Effective Date:** 2025-12-25  
**Review Cycle:** Quarterly  
**Status:** Active

---

## Core Principle

**ZERO SECRETS IN REPOSITORY.**

This repository contains NO:
- API keys
- Access tokens
- Passwords
- Private keys
- OAuth credentials
- Personal email addresses (use institutional only)
- Database connection strings with credentials

**Rationale:** Repository is version-controlled and may be shared. All sensitive credentials must remain external.

---

## Secrets Storage

### Environment Variables (Primary Method)

All secrets MUST be stored as **environment variables** on the machine/service that executes code requiring credentials.

**Examples:**
```bash
# AI provider API keys (for external runner)
export OPENAI_API_KEY="sk-proj-..."
export TOGETHER_API_KEY="..."
export ANTHROPIC_API_KEY="..."

# GitHub (for PR automation)
export GITHUB_TOKEN="ghp_..."

# Optional: Analytics/monitoring
export DATADOG_API_KEY="..."
```

### Where to Set Environment Variables

**Local Development:**
- Create `.env` file in project root (gitignored, never committed)
- Use `python-dotenv` to load variables: `load_dotenv()`
- See [`.env.example`](../../.env.example) for template

**External n8n Runner:**
- Set environment variables on n8n host (Docker container, VM, or n8n cloud)
- n8n can access env vars directly in workflow nodes
- Reference: [docs/n8n/README.md](../docs/n8n/README.md)

**CI/CD (GitHub Actions):**
- Store secrets in GitHub repository settings → Secrets
- Access via `${{ secrets.SECRET_NAME }}` in workflow YAML
- Document required secrets in `.github/workflows/README.md` (if implemented)

---

## Prohibited Practices

❌ **NEVER:**
- Commit `.env` files with real values
- Hardcode API keys in Python/YAML files
- Store credentials in config files (even encrypted)
- Share API keys via unencrypted email/chat
- Use shared API keys across multiple projects (dedicated keys preferred)
- Store billing receipts or cost data in repo (track externally)

---

## Required Secrets Inventory

### AI Provider Keys (External Runner Only)

| Secret Name | Purpose | Where Used | Required? |
|-------------|---------|------------|-----------|
| `OPENAI_API_KEY` | OpenAI API access (GPT-4, GPT-4o) | n8n runner | Yes (if using OpenAI) |
| `TOGETHER_API_KEY` | Together AI API access (Llama, Mixtral) | n8n runner | Yes (if using Together) |
| `ANTHROPIC_API_KEY` | Anthropic API access (Claude) | n8n runner | Optional |

### GitHub Integration (Optional)

| Secret Name | Purpose | Where Used | Required? |
|-------------|---------|------------|-----------|
| `GITHUB_TOKEN` | PR automation, issue tracking | n8n runner | Optional (for PR summaries) |

### Monitoring (Optional)

| Secret Name | Purpose | Where Used | Required? |
|-------------|---------|------------|-----------|
| `DATADOG_API_KEY` | Application monitoring | n8n runner | Optional |
| `SENTRY_DSN` | Error tracking | Python scripts | Optional |

---

## Secret Rotation Policy

### Frequency

- **API Keys:** Rotate every 90 days (or per provider policy)
- **GitHub Tokens:** Rotate every 90 days or on personnel change
- **Emergency Rotation:** Immediately if compromise suspected

### Rotation Procedure

1. Generate new key/token from provider dashboard
2. Update environment variable on all affected systems:
   ```bash
   # Example: Update OpenAI key
   export OPENAI_API_KEY="sk-proj-NEW_KEY_HERE"
   ```
3. Restart services that load env vars on startup (e.g., n8n):
   ```bash
   docker restart n8n
   ```
4. Test with low-cost request to verify new key works
5. Revoke old key from provider dashboard
6. Document rotation in internal ops log (not in repo)

---

## Access Control

### Who Has Access to Secrets?

**API Keys (AI Providers):**
- Research project lead (primary account owner)
- n8n operator (for runtime execution)
- Backup operator (for disaster recovery)

**GitHub Token:**
- n8n operator (if PR automation enabled)

### Principle of Least Privilege

- Only operators who need secrets for their role should have access
- Use separate API keys per environment (dev, test, prod) if possible
- Revoke access immediately when personnel leave project

---

## Incident Response

### If Secrets Are Compromised

1. **Immediate Actions:**
   - Revoke compromised key from provider dashboard
   - Generate new key and update environment variables
   - Restart affected services
   - Review API usage logs for unauthorized activity

2. **Investigation:**
   - Determine how compromise occurred (accidental commit, shared via email, etc.)
   - Check git history: `git log --all --full-history -- "*/.env"` (should be empty)
   - Review GitHub repo for accidentally committed secrets

3. **Remediation:**
   - Update all affected systems with new keys
   - Document incident and lessons learned (internal ops log)
   - Implement additional safeguards (pre-commit hooks, secret scanning)

4. **Notification:**
   - Notify project lead immediately
   - If financial impact (unauthorized API usage): Review billing, contact provider

---

## Compliance Verification

### Pre-Commit Checklist

Before every commit:
- [ ] No `.env` file in staged changes: `git diff --cached | grep -i "\.env"`
- [ ] No hardcoded keys: `git diff --cached | grep -iE "(api_key|token|password)"`
- [ ] `.env.example` contains only placeholders (no real values)

### Automated Scanning (Future)

**Planned:**
- Pre-commit hook to scan for common secret patterns
- GitHub Secret Scanning enabled (if repo becomes public)
- Regular audits of environment variable usage

---

## External Runner Responsibilities

Per [docs/handoffs/README.md](../docs/handoffs/README.md) runner contract:

**The external runner (n8n) MUST:**
1. Store API keys as environment variables (never in workflow JSON)
2. Never write API keys to manifests or response files
3. Use HTTPS for all API calls (encrypted in transit)
4. Log API provider and model name, but NOT the actual key
5. Implement rate limiting to prevent runaway costs

**The repository MUST:**
1. Never reference specific API keys (only document env var names)
2. Provide `.env.example` template for local setup
3. Gitignore `.env` and all credential files
4. Document required secrets in this policy

---

## Template: .env.example

See [`.env.example`](../../.env.example) in project root for template with placeholder values.

---

## References

- [docs/handoffs/README.md](../docs/handoffs/README.md) - Runner contract security requirements
- [docs/n8n/README.md](../docs/n8n/README.md) - n8n credential management
- [docs/n8n/N8N_OPERATOR_GUIDE.md](../docs/n8n/N8N_OPERATOR_GUIDE.md) - Operator credential procedures
- [.env.example](../../.env.example) - Environment variable template

---

## Policy Updates

| Date | Version | Change |
|------|---------|--------|
| 2025-12-25 | 1.0 | Initial policy (Iteration 1: Governance Gap Fill) |
