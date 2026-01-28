# n8n + Notion Integration Execution Plan

**Generated:** January 28, 2026
**Status:** Active Execution

---

## Overview

This plan integrates two systems:
1. **Notion Integration Package** - TypeScript library for deployment task tracking
2. **n8n Workflow Automation** - 4 webhook-triggered workflows

---

## Parallel Execution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARALLEL EXECUTION                                   │
├─────────────────────────────┬───────────────────────────────────────────────┤
│   AGENT 1: Package Setup    │   AGENT 2: n8n Workflow Configs               │
│   - Copy to packages/       │   - Create workflow JSON exports              │
│   - Update package.json     │   - github-notion-sync.json                   │
│   - Wire up orchestrator    │   - notion-ci-trigger.json                    │
│   Duration: 15-20 min       │   - deployment-notify.json                    │
│                             │   - stage-completion.json                     │
│                             │   Duration: 15-20 min                         │
└─────────────────────────────┴───────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BROWSER: Import to n8n Cloud                              │
│   - Import 4 workflow JSON files                                             │
│   - Activate webhooks                                                        │
│   - Copy webhook URLs to .env                                                │
│   Duration: 10-15 min                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent 1: Notion Package Integration

### Tasks

1. **Copy package to monorepo**
   ```
   notion-integration/ → packages/notion-integration/
   ```

2. **Update root package.json workspaces**
   - Add `packages/notion-integration` to workspaces

3. **Wire up orchestrator service**
   - Import tracker in orchestrator
   - Add execution tracking to key operations

4. **Add environment variables**
   - `NOTION_API_KEY`
   - Database IDs (pre-configured)

### Deliverables
- `packages/notion-integration/` - Full package
- Updated `package.json` with workspace
- Updated `services/orchestrator/src/services/notionTracker.ts`

---

## Agent 2: n8n Workflow JSON Configs

### Workflow 1: GitHub → Notion Sync

**File:** `infrastructure/n8n/github-notion-sync.json`

```json
{
  "name": "GitHub Notion Sync",
  "nodes": [
    { "type": "n8n-nodes-base.webhook", "path": "github-notion-sync" },
    { "type": "n8n-nodes-base.if", "name": "Check Event Type" },
    { "type": "n8n-nodes-base.notion", "name": "Create/Update Task" },
    { "type": "n8n-nodes-base.respondToWebhook" }
  ]
}
```

### Workflow 2: Notion → CI Trigger

**File:** `infrastructure/n8n/notion-ci-trigger.json`

Triggered when Notion task status = "Queue CI"
- Triggers GitHub Actions workflow dispatch
- Updates Notion task to "CI Running"

### Workflow 3: Deployment Notify

**File:** `infrastructure/n8n/deployment-notify.json`

- Receives deployment events
- Sends Slack message with status
- Updates Notion execution log

### Workflow 4: Stage Completion

**File:** `infrastructure/n8n/stage-completion.json`

- Receives workflow stage completion
- Updates Notion project status
- Optionally notifies team

---

## Browser: n8n Import

1. Navigate to n8n cloud
2. For each workflow JSON:
   - Click "Import from File"
   - Upload JSON
   - Configure credentials (Notion, Slack, GitHub)
   - Activate workflow
3. Copy webhook URLs
4. Update `.env` with URLs

---

## Database Configuration

### Notion Databases (Pre-configured)

| Database | ID |
|----------|-----|
| Deployment Tasks | `52e84cac-8ed0-4231-b9c8-5b854d042b9b` |
| Execution Log | `79d9d19c-9de3-4674-976f-fa9ad96ea826` |

### Environment Variables

```bash
# Notion
NOTION_API_KEY=secret_xxx
NOTION_DEPLOYMENT_TASKS_DB=52e84cac-8ed0-4231-b9c8-5b854d042b9b
NOTION_EXECUTION_LOG_DB=79d9d19c-9de3-4674-976f-fa9ad96ea826

# n8n Webhooks (populated after import)
N8N_WEBHOOK_GITHUB_NOTION=https://xxx.app.n8n.cloud/webhook/github-notion-sync
N8N_WEBHOOK_CI_TRIGGER=https://xxx.app.n8n.cloud/webhook/notion-ci-trigger
N8N_WEBHOOK_DEPLOY_NOTIFY=https://xxx.app.n8n.cloud/webhook/deployment-notify
N8N_WEBHOOK_STAGE_COMPLETE=https://xxx.app.n8n.cloud/webhook/stage-completion
```

---

## Success Criteria

- [ ] Notion package integrated into monorepo
- [ ] 4 n8n workflows imported and active
- [ ] Webhook URLs configured in .env
- [ ] Test execution tracking works
- [ ] GitHub → Notion sync functional
- [ ] Deployment notifications working

---

*Execution Plan - ResearchFlow n8n + Notion Integration*
