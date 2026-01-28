# ResearchFlow AI Tool Execution Plan

**Generated:** January 27, 2026
**Status:** All AI Tools Orchestrated & Active

---

## AI Tool Status Dashboard

| Tool | Status | Endpoint | Verified |
|------|--------|----------|----------|
| **Claude (Anthropic)** | 🟢 ACTIVE | api.anthropic.com | ✅ ANTHROPIC_OK |
| **GPT-4 (OpenAI)** | 🟢 ACTIVE | api.openai.com | ✅ gpt-4 found |
| **Grok (xAI)** | 🟢 ACTIVE | api.x.ai | ✅ grok found |
| **Mercury (InceptionLabs)** | 🟢 ACTIVE | api.inceptionlabs.ai | ✅ mercury found |
| **Sourcegraph** | 🟢 CONFIGURED | sourcegraph.com | ✅ Code Intelligence |

---

## Repository Analysis Summary

Based on comprehensive analysis, here's what was found:

### Overall Deployment Readiness: **75-80%**

| Area | Status | Issues Found |
|------|--------|--------------|
| Docker Services | ✅ Healthy | 7/7 running |
| Deployment Config | ⚠️ Partial | Missing secrets manifests |
| API Endpoints | ⚠️ Needs Work | 50+ TODOs, missing auth |
| Frontend Build | ⚠️ Warnings | TypeScript errors, ESLint missing |
| Security | ⚠️ Gaps | Auth bypass in code |

---

## Task Assignments by AI Tool

### 🟣 Claude (Anthropic) - Architecture & Code Review

**Best For:** Complex analysis, architectural decisions, documentation, security review

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| C-01 | Review auth.ts security bypass (line 73-90) | CRITICAL | Pending |
| C-02 | Analyze ecosystem.ts OAuth implementation | HIGH | Pending |
| C-03 | Review RBAC middleware gaps in custom-fields.ts | HIGH | Pending |
| C-04 | Document deployment prerequisites | MEDIUM | Pending |
| C-05 | Create secrets management guide | HIGH | Pending |

**Commands:**
```bash
# Trigger Claude review on PR
gh workflow run ai-code-review.yml -f review_model=claude
```

---

### 🟢 GPT-4 (OpenAI) - Code Generation & Refactoring

**Best For:** Implementing TODO stubs, generating boilerplate, API completions

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| G-01 | Implement citations.ts BibTeX parser (line 478) | HIGH | Pending |
| G-02 | Complete ai-streaming.ts AI integration | HIGH | Pending |
| G-03 | Implement artifact query endpoint | HIGH | Pending |
| G-04 | Generate ESLint configuration | MEDIUM | Pending |
| G-05 | Implement email service integration | MEDIUM | Pending |

**Commands:**
```bash
# Trigger GPT-4 review on PR
gh workflow run ai-code-review.yml -f review_model=gpt4
```

---

### 🔵 Grok (xAI) - Experimental & Hypothesis

**Best For:** Alternative approaches, experimental ideas, edge cases

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| X-01 | Suggest alternative OAuth token patterns | MEDIUM | Pending |
| X-02 | Propose bundle size optimization strategies | MEDIUM | Pending |
| X-03 | Generate test scenarios for edge cases | LOW | Pending |
| X-04 | Identify potential security attack vectors | HIGH | Pending |

**Commands:**
```bash
# Trigger Grok review on PR
gh workflow run ai-code-review.yml -f review_model=grok
```

---

### ⚡ Mercury (InceptionLabs) - Fast Code Completion

**Best For:** Boilerplate generation, repetitive patterns, quick completions

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| M-01 | Generate RBAC middleware for all endpoints | HIGH | Pending |
| M-02 | Create Kubernetes Secret templates | HIGH | Pending |
| M-03 | Generate database migration stubs | MEDIUM | Pending |
| M-04 | Create audit logging boilerplate | MEDIUM | Pending |

---

### 🔍 Sourcegraph - Code Intelligence

**Best For:** Cross-repo search, finding patterns, dependency analysis

| Task ID | Task | Priority | Status |
|---------|------|----------|--------|
| S-01 | Find all TESTROS references | CRITICAL | Pending |
| S-02 | Locate all missing auth middleware | HIGH | Pending |
| S-03 | Search for hardcoded credentials | CRITICAL | Pending |
| S-04 | Find all TODO/FIXME comments | MEDIUM | Pending |

---

## Critical Path - Deployment Blockers

### Phase 1: Security (Week 1)
```
┌─────────────────────────────────────────────────────────────┐
│ CLAUDE: Review auth.ts security bypass (C-01)               │
│    ↓                                                        │
│ SOURCEGRAPH: Find all TESTROS references (S-01)            │
│    ↓                                                        │
│ GPT-4: Generate secure authentication fix                   │
│    ↓                                                        │
│ CLAUDE: Review the fix for security                         │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: API Completion (Week 2)
```
┌─────────────────────────────────────────────────────────────┐
│ SOURCEGRAPH: Find all TODO endpoints                        │
│    ↓                                                        │
│ GPT-4: Implement OAuth token exchange (G-02)               │
│ MERCURY: Generate RBAC middleware (M-01) [parallel]        │
│    ↓                                                        │
│ CLAUDE: Review implementations                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Frontend & Build (Week 2)
```
┌─────────────────────────────────────────────────────────────┐
│ GPT-4: Generate ESLint configuration (G-04)                │
│    ↓                                                        │
│ SOURCEGRAPH: Find NEXT_PUBLIC env var usage                │
│    ↓                                                        │
│ MERCURY: Bulk replace with VITE_ variables                 │
│    ↓                                                        │
│ GROK: Suggest bundle optimization strategies               │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Deployment (Week 3)
```
┌─────────────────────────────────────────────────────────────┐
│ MERCURY: Generate Kubernetes Secret templates (M-02)       │
│    ↓                                                        │
│ CLAUDE: Review secrets for security                         │
│    ↓                                                        │
│ GPT-4: Generate database migrations (M-03)                 │
│    ↓                                                        │
│ CLAUDE: Write deployment documentation (C-04)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Execution Commands

### Run Full AI Code Review (Multi-Model)
```bash
# Create a PR, then run multi-model review
gh workflow run ai-code-review.yml -f review_model=multi
```

### Health Check All Services
```bash
./scripts/health-check.sh --verbose
```

### Setup GitHub Secrets
```bash
./scripts/setup-github-secrets.sh
```

### Run Security Scan
```bash
gh workflow run security-scan.yaml
```

---

## Quick Reference - Issue Locations

### Critical Security Issues
| File | Line | Issue |
|------|------|-------|
| `services/orchestrator/src/routes/auth.ts` | 73-90 | TESTROS bypass |
| `services/orchestrator/src/routes/ecosystem.ts` | 243-246 | Placeholder tokens |
| `services/orchestrator/src/routes/custom-fields.ts` | All | Missing auth |

### High-Priority TODOs
| File | Line | TODO |
|------|------|------|
| `citations.ts` | 478 | BibTeX parser |
| `ai-streaming.ts` | 232 | AI integration |
| `v2/artifacts.routes.ts` | 487 | Query implementation |
| `export.ts` | 126 | Pandoc export |

### Frontend Issues
| File | Issue |
|------|-------|
| `packages/core/types/index.ts` | Duplicate exports |
| `packages/core/types/schema.ts` | Type errors |
| `services/web/nginx.conf` | Missing /collab proxy |

---

## Next Steps

1. **Immediate:** Run `./scripts/setup-github-secrets.sh` to configure all API keys
2. **Today:** Address auth.ts security bypass (C-01)
3. **This Week:** Complete Phase 1 security tasks
4. **Week 2:** API completion with GPT-4 and Mercury
5. **Week 3:** Final deployment preparation

---

*Generated by AI Tool Orchestration System*
*All tools verified active and ready for deployment assistance*
