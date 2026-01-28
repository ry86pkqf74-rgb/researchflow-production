# N8N Cloud Workflow Automation - Comprehensive Execution Plan

**Document Version:** 1.0
**Last Updated:** January 28, 2026
**Status:** Ready for Implementation
**Environment:** ResearchFlow Production
**N8N Instance:** https://loganglosser13.app.n8n.cloud

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Integration Components](#integration-components)
4. [Workflow Specifications](#workflow-specifications)
5. [Implementation Timeline](#implementation-timeline)
6. [Testing & Validation](#testing--validation)
7. [Security & Compliance](#security--compliance)
8. [Monitoring & Observability](#monitoring--observability)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Appendix](#appendix)

---

## Executive Summary

This document outlines the comprehensive strategy for deploying and managing n8n cloud workflows within the ResearchFlow production environment. The plan integrates GitHub issue tracking, Notion task management, CI/CD automation, and deployment notifications into a cohesive workflow orchestration system.

### Key Objectives

- **GitHub → Notion Synchronization:** Automatically sync GitHub issues to Notion task database
- **Notion-Triggered CI/CD:** Execute CI/CD pipelines based on Notion task status changes
- **Deployment Notifications:** Send real-time deployment status notifications to Slack
- **Workflow Stage Completion:** Sync research workflow stage completions with external systems

### Integration Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     ResearchFlow Orchestrator                     │
│                    (Node.js Express Backend)                      │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
        ┌───────▼────────┐ ┌──────▼─────────┐ ┌─────▼────────┐
        │   N8N Cloud    │ │  GitHub API    │ │ Notion API   │
        │   Workflows    │ │  (WebHooks)    │ │  (Database)  │
        └───────┬────────┘ └────────────────┘ └──────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼──────┐ ┌─▼────────┐ ┌─▼──────────┐
│   Slack  │ │ CI/CD    │ │ Analytics  │
│ Webhooks │ │ Systems  │ │ Dashboard  │
└──────────┘ └──────────┘ └────────────┘
```

---

## Architecture Overview

### System Components

#### 1. N8N MCP Server Integration

**Type:** Model Context Protocol Server
**Location:** https://loganglosser13.app.n8n.cloud/mcp-server/http
**Authentication:** JWT Token

**Features:**
- Direct workflow manipulation and execution
- Real-time execution monitoring
- Workflow list and management
- Execution status queries

**Configuration Details:**
```typescript
// From services/orchestrator/src/integrations/n8n.ts
const N8nClient {
  baseUrl: "https://loganglosser13.app.n8n.cloud"
  apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." (JWT)
  mcpServerUrl: "https://loganglosser13.app.n8n.cloud/mcp-server/http"
  mcpToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." (MCP JWT)
}
```

#### 2. Webhook Endpoints (ResearchFlow Orchestrator)

The orchestrator exposes four primary webhook endpoints for n8n workflow triggers:

| Endpoint | Method | Purpose | Trigger Source |
|----------|--------|---------|-----------------|
| `/api/n8n/webhook/github-sync` | POST | Receive GitHub issue sync notifications | N8N Workflow (GitHub Sync) |
| `/api/n8n/webhook/notion-update` | POST | Receive Notion task updates | N8N Workflow (Notion Watcher) |
| `/api/n8n/webhook/ci-complete` | POST | CI/CD completion notifications | N8N Workflow (CI/CD Trigger) |
| `/api/n8n/webhook/stage-completion` | POST | Workflow stage completion events | N8N Workflow (Stage Monitor) |

#### 3. External Service Integrations

**GitHub Integration:**
- API: GitHub REST API v2022-11-28
- Webhook Events: Issues (opened, closed, edited, labeled)
- PAT Token: Configured in orchestrator environment
- Rate Limit: 5,000 requests/hour

**Notion Integration:**
- API: Notion v2022-06-28
- Database Operations: Read, Create, Update
- Blocks: Database queries, page content updates
- Rate Limit: 3-4 requests/second

**CI/CD Systems:**
- GitHub Actions (native)
- CircleCI (if configured)
- GitLab CI (if configured)

---

## Integration Components

### Component 1: N8N Client Library

**File:** `/services/orchestrator/src/integrations/n8n.ts`

**Class: N8nClient**

```typescript
// Available Methods:
- listWorkflows(): Promise<N8nWorkflow[]>
- getWorkflow(workflowId: string): Promise<N8nWorkflow>
- activateWorkflow(workflowId: string): Promise<N8nWorkflow>
- deactivateWorkflow(workflowId: string): Promise<N8nWorkflow>
- executeWorkflow(workflowId: string, data?: any): Promise<N8nExecution>
- getExecution(executionId: string): Promise<N8nExecution>
- listExecutions(params?: {workflowId?, status?, limit?}): Promise<N8nExecution[]>
- triggerWebhook(path: string, payload: N8nWebhookPayload): Promise<unknown>
```

**Usage Example:**
```typescript
import { n8nClient, n8nWorkflows } from '../integrations/n8n';

// Sync GitHub issue to Notion
await n8nWorkflows.syncGitHubToNotion({
  title: 'Bug: Fix authentication',
  body: 'Users cannot login...',
  number: 1234,
  labels: ['bug', 'critical'],
  state: 'open'
});

// Trigger CI/CD from Notion status change
await n8nWorkflows.triggerCIFromNotion({
  id: 'task-123',
  status: 'Ready for Testing',
  title: 'Feature: Add dark mode'
});

// Send deployment notification
await n8nWorkflows.notifyDeployment({
  service: 'orchestrator',
  version: 'v1.2.3',
  status: 'success',
  url: 'https://api.researchflow.app'
});

// Sync workflow stage completion
await n8nWorkflows.syncStageCompletion({
  stageId: 1,
  stageName: 'Literature Review',
  projectId: 'proj-456',
  status: 'completed',
  outputs: { articlesReviewed: 42 }
});
```

### Component 2: Webhook Handlers

**Location:** `/services/orchestrator/src/routes/webhooks/`

**Webhook Handler Pattern:**

```typescript
interface WebhookPayload {
  event: string;           // e.g., 'github.issue.sync'
  data: Record<string, unknown>;  // Event-specific data
  timestamp: string;       // ISO 8601 timestamp
  source: string;          // 'researchflow-orchestrator'
}
```

**Handler Functions Required:**
- `handleGithubSync(payload)` → Processes GitHub issues
- `handleNotionUpdate(payload)` → Updates local Notion state
- `handleCiComplete(payload)` → Processes CI results
- `handleStageCompletion(payload)` → Triggers downstream workflows

### Component 3: Environment Configuration

**Critical Environment Variables:**

```bash
# N8N Cloud Integration
N8N_BASE_URL=https://loganglosser13.app.n8n.cloud
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Public API JWT)
N8N_MCP_SERVER_URL=https://loganglosser13.app.n8n.cloud/mcp-server/http
N8N_MCP_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (MCP API JWT)

# Third-party Integrations
GITHUB_PAT=ghp_xxxxxxxxxxxxx (GitHub Personal Access Token)
NOTION_API_KEY=ntn_xxxxxxxxxxxxxxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## Workflow Specifications

### Workflow 1: GitHub → Notion Sync

**Name:** `github-issue-notion-sync`
**Trigger:** GitHub Issue webhook (opened, edited, labeled, closed)
**Frequency:** Real-time
**SLA:** < 30 seconds

#### Flow Diagram

```
GitHub Issue Event
        │
        ▼
┌──────────────────────┐
│ GitHub Webhook Node  │
│ (n8n trigger)        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Transform Issue Data │
│ (map fields)         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Check if Task Exists │
│ (Notion query)       │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    │             │
    YES          NO
    │             │
    ▼             ▼
┌─────────┐   ┌──────────┐
│ Update  │   │ Create   │
│ Task    │   │ New Task │
└────┬────┘   └────┬─────┘
     │             │
     └──────┬──────┘
            │
            ▼
   ┌────────────────────┐
   │ Send Confirmation  │
   │ to Orchestrator    │
   └────────────────────┘
```

#### Implementation Details

**1. GitHub Webhook Configuration**
- Event types: `issues`
- Activities: opened, closed, edited, labeled, unlabeled
- Payload includes: title, body, labels, state, user, assignees, milestone

**2. Data Transformation Node**
```typescript
// Input from GitHub webhook
{
  action: "opened",
  issue: {
    number: 1234,
    title: "Authentication Bug",
    body: "Users cannot login with Google OAuth",
    labels: [{name: "bug"}, {name: "critical"}],
    state: "open",
    created_at: "2026-01-28T10:30:00Z",
    user: {login: "username"}
  }
}

// Transformed for Notion
{
  title: "Authentication Bug",
  description: "Users cannot login with Google OAuth",
  issueNumber: "#1234",
  labels: "bug, critical",
  status: "Backlog",  // Notion status field
  source: "GitHub",
  sourceUrl: "https://github.com/org/repo/issues/1234",
  assignee: "username",
  createdAt: "2026-01-28T10:30:00Z"
}
```

**3. Notion Database Query**
- Database ID: (from NOTION_DATABASE_GITHUB_TASKS env var)
- Query: Check if issue number exists
- Property: "Issue Number" = GitHub issue number

**4. Create/Update Logic**
- IF exists: Update fields (status, description, labels, lastSyncedAt)
- IF not exists: Create new page with all properties

**5. Confirmation Hook**
- POST to `/api/n8n/webhook/github-sync`
- Payload includes task ID and sync timestamp

#### Notion Database Schema

| Property | Type | Purpose |
|----------|------|---------|
| Title | Title | Issue title |
| Description | Rich Text | Issue body/description |
| Issue Number | Number | GitHub issue #123 |
| Labels | Multi-select | Issue tags |
| Status | Select | Backlog, Triage, In Progress, In Review, Done |
| Source | Select | GitHub, Manual, etc. |
| Source URL | URL | Link to GitHub issue |
| Assignee | Person | Responsible party |
| Created | Date | Issue creation date |
| Last Synced | Date | Last sync timestamp |

---

### Workflow 2: Notion Status Change → CI/CD Trigger

**Name:** `notion-ci-trigger`
**Trigger:** Notion status field change (manual or automated)
**Frequency:** On demand
**SLA:** < 1 minute

#### Flow Diagram

```
Notion Status Update
(e.g., "Backlog" → "Ready for Testing")
        │
        ▼
┌─────────────────────┐
│ Status Changed?     │
│ (Notion database    │
│  polling or webhook)│
└────────┬────────────┘
         │
    ┌────▼─────┐
    │ Status = │ NO → Exit
    │ Ready?   │
    └────┬─────┘
         │ YES
         ▼
┌──────────────────────┐
│ Extract Project Info │
│ (repository, branch) │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Determine CI System  │
│ (GitHub Actions,     │
│  CircleCI, etc.)     │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Trigger CI Pipeline  │
│ (dispatch event or   │
│  API call)           │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Update Notion Status │
│ → "Testing"          │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Notify Orchestrator  │
│ /api/n8n/webhook/    │
│ ci-complete          │
└──────────────────────┘
```

#### Implementation Details

**1. Notion Database Polling or Webhook**
- Monitor "Status" field changes
- Trigger on specific transitions:
  - "Backlog" → "Ready for Testing"
  - "Ready for Testing" → "Testing in Progress"
  - "Testing Complete" → "Ready for Deploy"

**2. Task Information Extraction**
```typescript
// From Notion task
{
  id: "task-123",
  title: "Implement dark mode",
  status: "Ready for Testing",
  repository: "researchflow-production",
  branch: "feature/dark-mode",
  ciSystem: "github-actions",
  workflowName: "test.yml",
  requiredEnv: {
    NODE_ENV: "test",
    DATABASE_URL: "..."
  }
}
```

**3. CI/CD Dispatch Logic**

**GitHub Actions:**
```bash
curl -X POST \
  https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "ref": "feature/dark-mode",
    "inputs": {
      "task_id": "task-123",
      "test_suite": "full"
    }
  }'
```

**CircleCI:**
```bash
curl -X POST \
  https://circleci.com/api/v2/project/gh/{org}/{repo}/pipeline \
  -H "Circle-Token: $CIRCLECI_TOKEN" \
  -d '{
    "branch": "feature/dark-mode",
    "parameters": {
      "task_id": "task-123"
    }
  }'
```

**4. Status Update in Notion**
- Update Status field to "Testing in Progress"
- Record CI workflow URL
- Set expected completion time

**5. Orchestrator Notification**
- POST to `/api/n8n/webhook/ci-complete` with:
  - Task ID
  - CI workflow URL
  - Expected completion time

---

### Workflow 3: CI/CD Completion → Slack Notifications

**Name:** `ci-completion-slack-notify`
**Trigger:** CI pipeline webhook (GitHub Actions, CircleCI)
**Frequency:** Per CI run
**SLA:** < 1 minute

#### Flow Diagram

```
CI Pipeline Completes
(success or failure)
        │
        ▼
┌──────────────────────┐
│ CI Webhook Event     │
│ (GitHub/CircleCI)    │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Extract CI Data      │
│ (status, commit,     │
│  duration, logs)     │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Query Task Details   │
│ (from Notion by      │
│  branch name)        │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Build Slack Message  │
│ (with formatting,    │
│  status color)       │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Send to Slack        │
│ (webhook)            │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Update Notion Status │
│ Based on CI result   │
└──────────────────────┘
```

#### Implementation Details

**1. CI Webhook Events**

**GitHub Actions workflow_run:**
```json
{
  "action": "completed",
  "workflow_run": {
    "id": 123456,
    "name": "Test Suite",
    "head_branch": "feature/dark-mode",
    "conclusion": "success",
    "status": "completed",
    "run_number": 42,
    "created_at": "2026-01-28T10:30:00Z",
    "updated_at": "2026-01-28T10:45:00Z",
    "html_url": "https://github.com/org/repo/actions/runs/123456"
  },
  "repository": {
    "name": "researchflow-production",
    "full_name": "org/researchflow-production"
  }
}
```

**2. Data Transformation for Slack**

```typescript
interface SlackMessage {
  text: string;           // Summary
  blocks: Block[];        // Formatted blocks
  color?: string;         // Green/Red for status
  fields: Record<string, string>;
  timestamp: number;
}

// Success message
{
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "✅ *CI Pipeline Successful*\n<branch> feature/dark-mode"
      }
    },
    {
      type: "section",
      fields: [
        {type: "mrkdwn", text: "*Status*\nPassed"},
        {type: "mrkdwn", text: "*Duration*\n15m 30s"},
        {type: "mrkdwn", text: "*Commit*\n<sha short>"},
        {type: "mrkdwn", text: "*Task*\nTask-123"}
      ]
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {type: "plain_text", text: "View Logs"},
          url: "https://github.com/.../actions/runs/123456"
        },
        {
          type: "button",
          text: {type: "plain_text", text: "Mark Ready for Deploy"},
          action_id: "mark_ready_deploy"
        }
      ]
    }
  ]
}
```

**3. Slack Webhook Configuration**
- Channel: #deployments (configurable)
- Format: Rich blocks with buttons
- Mentions: @assignee if test failed

**4. Notion Status Update Logic**
```typescript
if (ciResult.conclusion === 'success') {
  // Update Notion task status
  notion.updatePage(taskId, {
    status: 'Testing Complete',
    lastTestRun: now(),
    lastTestStatus: 'PASSED',
    ciUrl: ciResult.html_url
  });
} else {
  // Failed - notify assignee
  notion.updatePage(taskId, {
    status: 'Testing Failed',
    lastTestRun: now(),
    lastTestStatus: 'FAILED',
    failureDetails: ciResult.failure_log
  });
}
```

---

### Workflow 4: Research Workflow Stage Completion Sync

**Name:** `workflow-stage-completion-sync`
**Trigger:** ResearchFlow stage completion webhook
**Frequency:** Per stage completion
**SLA:** < 5 seconds

#### Flow Diagram

```
Stage Completion Event
(from ResearchFlow pipeline)
        │
        ▼
┌────────────────────────┐
│ Stage Complete Webhook │
│ /api/n8n/webhook/      │
│ stage-completion       │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Extract Stage Details  │
│ (stageId, projectId,   │
│  outputs, artifacts)   │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Sync to External DBs   │
│ • Update Notion page   │
│ • Write to Analytics   │
│ • Store in Archive     │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Trigger Downstream     │
│ Stages (if ready)      │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Generate Reports       │
│ (PDF, JSON, CSV)       │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Archive Artifacts      │
│ (S3 or similar)        │
└────────────────────────┘
```

#### Implementation Details

**1. Webhook Payload Structure**

```json
{
  "event": "workflow.stage.complete",
  "data": {
    "stageId": 1,
    "stageName": "Literature Review",
    "projectId": "proj-456",
    "status": "completed",
    "startedAt": "2026-01-15T09:00:00Z",
    "completedAt": "2026-01-28T14:30:00Z",
    "outputs": {
      "articlesReviewed": 42,
      "studiesIncluded": 23,
      "exclusionReasons": {...},
      "summaryDocument": "s3://...summary.pdf",
      "dataExport": "s3://...data.csv"
    },
    "metrics": {
      "executionTime": 327600,
      "aiTokensUsed": 152340,
      "costEstimate": 12.50
    }
  },
  "timestamp": "2026-01-28T14:30:00Z",
  "source": "researchflow-orchestrator"
}
```

**2. Notion Page Update**

Database: Research Projects
Query by: projectId
Update fields:
- Current Stage: "Literature Review"
- Stage Status: "Completed"
- Articles Reviewed: 42
- Last Updated: 2026-01-28T14:30:00Z
- Stage Output URL: Link to summary

**3. Analytics Event**

Send structured data to analytics platform:
```typescript
{
  event: "stage_completed",
  properties: {
    project_id: "proj-456",
    stage_id: 1,
    stage_name: "Literature Review",
    duration_seconds: 327600,
    articles_reviewed: 42,
    ai_tokens_used: 152340,
    cost_usd: 12.50,
    success: true
  },
  timestamp: "2026-01-28T14:30:00Z"
}
```

**4. Artifact Archival**

```bash
# Move stage outputs to archive
- Summary PDF → S3/artifact-archive/proj-456/stage-1/
- CSV exports → S3/artifact-archive/proj-456/stage-1/
- JSON metadata → S3/artifact-archive/proj-456/stage-1/manifest.json

# Create archive manifest
{
  "projectId": "proj-456",
  "stageId": 1,
  "stageName": "Literature Review",
  "completedAt": "2026-01-28T14:30:00Z",
  "artifacts": [
    {
      "type": "summary",
      "path": "s3://bucket/proj-456/stage-1/summary.pdf",
      "size": 2500000,
      "checksum": "sha256:..."
    },
    ...
  ]
}
```

**5. Downstream Trigger Logic**

```typescript
// Check if next stage prerequisites are met
const nextStageReady = async (projectId, currentStageId) => {
  const project = await notion.getProject(projectId);
  const nextStage = project.stages[currentStageId + 1];

  return nextStage.prerequisites.every(prereq => {
    return prereq.stageName in project.completedStages;
  });
};

// Auto-trigger next stage if ready
if (await nextStageReady(projectId, stageId)) {
  await n8nClient.executeWorkflow('workflow-stage-next-trigger', {
    projectId,
    stageId: stageId + 1
  });
}
```

---

## Implementation Timeline

### Phase 1: Foundation Setup (Week 1-2)

**Tasks:**
- [ ] Verify n8n cloud instance credentials and access
- [ ] Test API connectivity from orchestrator service
- [ ] Set up webhook endpoint middleware in Express
- [ ] Configure environment variables (.env validation)
- [ ] Create webhook handler stubs

**Deliverables:**
- Working N8nClient connection tests
- Webhook endpoints registered
- CI/CD pipeline logs showing successful MCP connections

**Owner:** Backend Team
**Duration:** 5 business days

---

### Phase 2: GitHub Integration (Week 2-3)

**Tasks:**
- [ ] Create GitHub → Notion sync workflow in n8n UI
- [ ] Configure GitHub webhook authentication
- [ ] Set up Notion database schema (if not exists)
- [ ] Implement data transformation logic
- [ ] Test sync with sample GitHub issue
- [ ] Add retry logic and error handling
- [ ] Document workflow configuration

**Deliverables:**
- Functional GitHub → Notion sync workflow
- Notion database populated with test issues
- Error logs and monitoring configured
- Runbook for manual re-sync

**Owner:** Integration Team
**Duration:** 8 business days

---

### Phase 3: CI/CD Automation (Week 3-4)

**Tasks:**
- [ ] Create Notion status change monitor workflow
- [ ] Implement CI system dispatch logic (GitHub Actions first)
- [ ] Set up webhook authentication for CI providers
- [ ] Add branch name to task mapping
- [ ] Test manual trigger → CI pipeline flow
- [ ] Implement CircleCI support (if needed)
- [ ] Configure workflow timeout handling

**Deliverables:**
- Notion status change → CI trigger workflow
- CI/CD pipelines automatically triggered
- Status rollback on failure
- Health check endpoints

**Owner:** DevOps Team
**Duration:** 10 business days

---

### Phase 4: Notification System (Week 4-5)

**Tasks:**
- [ ] Create CI completion → Slack notification workflow
- [ ] Design Slack message templates (success/failure)
- [ ] Implement interactive buttons (View Logs, Mark Ready)
- [ ] Configure Slack channel routing (by team/project)
- [ ] Add notification preferences to user settings
- [ ] Implement digest aggregation (optional)
- [ ] Test with real CI runs

**Deliverables:**
- Slack notifications for all CI completions
- Notion status auto-updates on CI result
- User notification preferences working
- Archive of notification patterns

**Owner:** Frontend/UX Team
**Duration:** 8 business days

---

### Phase 5: Workflow Stage Completion (Week 5-6)

**Tasks:**
- [ ] Create orchestrator endpoint for stage completion
- [ ] Implement Notion project database updates
- [ ] Set up analytics event tracking
- [ ] Configure artifact archival to S3
- [ ] Implement downstream stage triggering logic
- [ ] Add reporting and dashboard updates
- [ ] Performance test with large artifact payloads

**Deliverables:**
- Stage completion workflow fully operational
- Notion research projects updated in real-time
- Analytics dashboard showing stage metrics
- Archive manifest validation tests

**Owner:** Data Team
**Duration:** 10 business days

---

### Phase 6: Testing & Validation (Week 6-7)

**Tasks:**
- [ ] End-to-end integration testing
- [ ] Load testing (100+ concurrent workflows)
- [ ] Failure scenario testing
- [ ] Security audit (token handling, data validation)
- [ ] Performance benchmarking
- [ ] Documentation review and finalization
- [ ] Team training and runbook walkthrough

**Deliverables:**
- Integration test suite (95%+ pass rate)
- Performance baseline established
- Security audit report
- Team training completion certificates
- Final runbook and troubleshooting guide

**Owner:** QA Team
**Duration:** 10 business days

---

### Phase 7: Production Deployment (Week 7)

**Tasks:**
- [ ] Pre-production environment validation
- [ ] Gradual rollout strategy (canary deployment)
- [ ] Incident response procedures
- [ ] On-call rotation setup
- [ ] Production monitoring activated
- [ ] Stakeholder communication

**Deliverables:**
- Workflows live in production
- Monitoring dashboards active
- On-call team trained
- Success metrics baseline

**Owner:** DevOps + Engineering Leads
**Duration:** 5 business days

---

## Testing & Validation

### Unit Testing

**Test File:** `services/orchestrator/src/__tests__/n8n-integration.test.ts`

```typescript
describe('N8nClient', () => {
  describe('Authentication', () => {
    test('should initialize with environment variables', () => {
      const client = new N8nClient();
      expect(client.baseUrl).toBe('https://loganglosser13.app.n8n.cloud');
      expect(client.mcpToken).toBeDefined();
    });

    test('should handle missing API key gracefully', async () => {
      const client = new N8nClient();
      process.env.N8N_API_KEY = '';
      const result = await client.listWorkflows();
      expect(result.error).toBeDefined();
    });
  });

  describe('Workflows', () => {
    test('should list all workflows', async () => {
      const result = await n8nClient.listWorkflows();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
    });

    test('should activate workflow', async () => {
      const result = await n8nClient.activateWorkflow('workflow-id');
      expect(result.data?.active).toBe(true);
    });

    test('should execute workflow with data', async () => {
      const result = await n8nClient.executeWorkflow('github-sync', {
        issue: { number: 123, title: 'Test' }
      });
      expect(result.data?.id).toBeDefined();
      expect(result.data?.finished).toBeDefined();
    });
  });

  describe('Webhooks', () => {
    test('should trigger webhook with payload', async () => {
      const result = await n8nClient.triggerWebhook('github-notion-sync', {
        event: 'github.issue.sync',
        data: { issue: {} },
        timestamp: new Date().toISOString(),
        source: 'test'
      });
      expect(result.error).toBeUndefined();
    });
  });
});
```

### Integration Testing

**Test Scenarios:**

1. **GitHub Issue Sync**
   - Create issue in GitHub
   - Verify webhook received by n8n
   - Confirm Notion page created
   - Check field mappings accurate
   - Validate timestamp precision

2. **Notion to CI/CD**
   - Change Notion task status
   - Verify CI pipeline triggered
   - Confirm correct branch/workflow used
   - Check environment variables passed
   - Validate build logs accessible

3. **CI Completion Notification**
   - Trigger CI pipeline completion event
   - Verify Slack notification sent
   - Check message formatting
   - Confirm button interactions work
   - Validate Notion status update

4. **Stage Completion Sync**
   - Trigger stage completion webhook
   - Verify Notion update
   - Check analytics event recorded
   - Confirm artifacts archived
   - Validate downstream trigger

### Performance Testing

**Load Test Scenarios:**

```typescript
// Concurrent webhook hits
const concurrentRequests = 100;
const requests = Array(concurrentRequests)
  .fill(null)
  .map(() => n8nClient.triggerWebhook('github-notion-sync', {...}));

const results = await Promise.allSettled(requests);
const successRate = results.filter(r => r.status === 'fulfilled').length;
console.log(`Success rate: ${(successRate/concurrentRequests)*100}%`);
console.log(`P95 latency: ${getPercentile(latencies, 95)}ms`);
```

**Expected Baselines:**
- Webhook processing: < 100ms p95
- Success rate: > 99.5%
- Error recovery: < 5 minute max retry
- Database operations: < 500ms per Notion page update

---

## Security & Compliance

### API Authentication

**N8N API Security:**
- JWT tokens stored in environment variables only
- Tokens rotated every 90 days
- Token scopes limited to required operations
- No tokens in logs or error messages

**Implementation:**
```typescript
// ✅ SECURE
const token = process.env.N8N_API_KEY;
headers['X-N8N-API-KEY'] = token;

// ❌ INSECURE (never do this)
console.log(`Using token: ${process.env.N8N_API_KEY}`);
```

### Webhook Signature Verification

**GitHub Webhook:**
```typescript
import { createHmac } from 'crypto';

function verifyGitHubSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const computed = 'sha256=' + createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return timingSafeEqual(computed, signature);
}
```

**Notion Webhook:**
```typescript
// Notion doesn't use signatures for webhooks
// Instead, validate IP whitelist and use bearer tokens
function validateNotionRequest(req: Request): boolean {
  const notionIPs = ['13.107.42.14', '13.107.43.12']; // Example IPs
  return notionIPs.includes(req.ip);
}
```

### Data Encryption

**In Transit:**
- All HTTP traffic via HTTPS
- TLS 1.2 minimum
- Certificate pinning for n8n cloud (optional)

**At Rest:**
- Sensitive data in .env (not in code)
- Database credentials rotated quarterly
- Audit logs retained for 1 year minimum

### Rate Limiting

**N8N API:**
- 5,000 requests/hour limit
- Implement exponential backoff on 429 responses

**GitHub API:**
- 5,000 requests/hour per token
- Monitor X-RateLimit headers
- Queue requests if approaching limit

**Notion API:**
- 3-4 requests/second per token
- Use batch operations where possible
- Implement request throttling

---

## Monitoring & Observability

### Metrics to Track

**Workflow Execution Metrics:**
```typescript
interface WorkflowMetrics {
  workflowId: string;
  executionTime: number;        // milliseconds
  status: 'success' | 'error' | 'timeout';
  errorCount: number;
  retryCount: number;
  timestamp: string;
}
```

**Dashboard Queries:**

```sql
-- Average execution time by workflow
SELECT
  workflow_id,
  AVG(execution_time) as avg_execution_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time) as p95_ms
FROM workflow_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY workflow_id
ORDER BY avg_execution_ms DESC;

-- Error rate by workflow
SELECT
  workflow_id,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  COUNT(*) as total_executions,
  ROUND(100 * COUNT(*) FILTER (WHERE status = 'error')::numeric / COUNT(*), 2) as error_rate_percent
FROM workflow_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY workflow_id
ORDER BY error_rate_percent DESC;

-- Retry analysis
SELECT
  workflow_id,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY retry_count) as median_retries,
  MAX(retry_count) as max_retries
FROM workflow_metrics
WHERE timestamp > NOW() - INTERVAL '7 days'
AND status = 'success'
GROUP BY workflow_id;
```

### Alerting Rules

**Alert:** Workflow Error Rate > 5%
```
WHEN (count(metric="workflow_metrics_error") / count(metric="workflow_metrics_total")) > 0.05
FOR 10 minutes
THEN trigger_alert("Workflow Error Rate High", priority="HIGH")
```

**Alert:** Webhook Latency > 1 second
```
WHEN percentile(metric="webhook_latency_ms", percentile=95) > 1000
FOR 5 minutes
THEN trigger_alert("Webhook Latency High", priority="MEDIUM")
```

**Alert:** N8N API Unreachable
```
WHEN probe_http_status_code{instance="n8n.cloud"} != 200
FOR 1 minute
THEN trigger_alert("N8N Unreachable", priority="CRITICAL")
```

### Log Aggregation

**Structured Logging:**
```typescript
logger.info('Workflow execution started', {
  workflow_id: 'github-sync',
  execution_id: 'exec-123',
  trigger: 'webhook',
  payload_size_bytes: 1024,
  timestamp: new Date().toISOString()
});

logger.error('Workflow execution failed', {
  workflow_id: 'github-sync',
  execution_id: 'exec-123',
  error: 'GitHub API rate limit exceeded',
  error_code: 'GITHUB_RATE_LIMIT',
  retry_count: 3,
  next_retry: '2026-01-28T15:30:00Z',
  timestamp: new Date().toISOString()
});
```

**Log Retention:**
- Application logs: 30 days
- Audit logs: 1 year
- Error logs: 90 days (searchable)
- Debug logs: 7 days

---

## Troubleshooting Guide

### Common Issues & Solutions

#### Issue 1: N8N API Authentication Failures

**Symptom:** `401 Unauthorized` on API calls

**Root Causes:**
1. Expired JWT token
2. Wrong token in environment variable
3. Token has insufficient scopes

**Solution:**
```bash
# 1. Verify token is set
echo $N8N_API_KEY

# 2. Check token expiration
# Decode JWT at jwt.io or use:
node -e "console.log(JSON.parse(Buffer.from(process.env.N8N_API_KEY.split('.')[1], 'base64').toString()))"

# 3. Regenerate token if expired
# Visit: https://loganglosser13.app.n8n.cloud/settings/api
# Create new API key and update .env

# 4. Test connection
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://loganglosser13.app.n8n.cloud/api/v1/workflows
```

---

#### Issue 2: Webhook Timeouts

**Symptom:** Workflows execute but take > 5 minutes or timeout

**Root Causes:**
1. External API slow (GitHub, Notion)
2. Database query performance
3. n8n rate limiting

**Solution:**
```typescript
// Add request timeouts
const options = {
  timeout: 10000, // 10 second timeout
  retries: 3,
  backoffMultiplier: 2
};

// Monitor GitHub API rate limit
const rateLimitResponse = await fetch('https://api.github.com/rate_limit', {
  headers: { 'Authorization': `Bearer ${GITHUB_PAT}` }
});
const remaining = rateLimitResponse.headers.get('x-ratelimit-remaining');
if (remaining < 100) {
  console.warn('GitHub API rate limit low:', remaining);
  // Implement queuing
}

// Notion batch operations
const batchUpdates = tasks.reduce((acc, task, i) => {
  if (i % 10 === 0) acc.push([]);
  acc[acc.length - 1].push(task);
  return acc;
}, []);

for (const batch of batchUpdates) {
  await notion.updatePages(batch);
  await delay(200); // Throttle requests
}
```

---

#### Issue 3: GitHub Issue Sync Not Working

**Symptom:** Issues created in GitHub but not appearing in Notion

**Diagnostics:**
```bash
# 1. Check webhook is configured
curl -H "Authorization: token $GITHUB_PAT" \
  https://api.github.com/repos/{owner}/{repo}/hooks

# 2. Check recent webhook deliveries
# In GitHub repo settings → Webhooks → Select webhook → Recent Deliveries

# 3. Verify Notion database exists and has correct schema
curl -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  https://api.notion.com/v1/databases/{DATABASE_ID}

# 4. Check n8n workflow logs
# https://loganglosser13.app.n8n.cloud/executions
# Filter by workflow name "github-issue-notion-sync"

# 5. Manually trigger webhook to isolate issue
curl -X POST http://localhost:3000/api/n8n/webhook/github-sync \
  -H "Content-Type: application/json" \
  -d '{
    "event": "github.issue.sync",
    "data": {
      "title": "Test Issue",
      "number": 999,
      "state": "open",
      "labels": ["test"]
    },
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "source": "manual-test"
  }'
```

---

#### Issue 4: CI/CD Pipeline Not Triggering

**Symptom:** Notion status changes but no CI pipeline starts

**Diagnostics:**
```bash
# 1. Verify Notion webhook is active and working
# n8n dashboard → Workflows → notion-ci-trigger → Executions

# 2. Check GitHub Actions dispatch settings
curl -H "Authorization: Bearer $GITHUB_PAT" \
  https://api.github.com/repos/{owner}/{repo}/actions/workflows

# 3. Test manual dispatch
curl -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches \
  -d '{"ref":"main","inputs":{"test":"value"}}'

# 4. Check Notion database has required fields
# Required: "Repository", "Branch", "Status", "CI System"

# 5. Verify branch exists in GitHub
git branch -a | grep feature/dark-mode
```

---

#### Issue 5: Slack Notifications Not Sending

**Symptom:** CI completes but no Slack message appears

**Diagnostics:**
```bash
# 1. Verify Slack webhook URL is valid
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-type: application/json' \
  -d '{"text":"Test message"}'

# 2. Check n8n workflow has Slack node configured
# https://loganglosser13.app.n8n.cloud/executions
# Filter: "ci-completion-slack-notify"

# 3. Verify channel exists and bot has permission
# Slack workspace → Channels → #deployments → Integrations

# 4. Check CI webhook is hitting n8n
# GitHub Actions → Workflow runs → Click run → Logs
# Look for webhook delivery indication

# 5. Test Slack message format
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-type: application/json' \
  -d '{
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "✅ *Test Message*"
        }
      }
    ]
  }'
```

---

### Workflow Health Checks

**Daily Health Check Procedure:**

```bash
#!/bin/bash
# health-check.sh

echo "=== N8N Workflow Health Check ==="
echo "Time: $(date)"

# 1. Check API connectivity
echo -n "n8n API: "
if curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://loganglosser13.app.n8n.cloud/api/v1/workflows > /dev/null; then
  echo "✅ Connected"
else
  echo "❌ Failed"
fi

# 2. Check recent execution errors
echo -n "Execution errors (24h): "
ERROR_COUNT=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://loganglosser13.app.n8n.cloud/api/v1/executions?status=error&limit=100" | \
  jq '.[] | select(.stoppedAt > (now - 86400)) | .id' | wc -l)
echo "$ERROR_COUNT"

# 3. Check workflow activation status
echo "Active workflows:"
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://loganglosser13.app.n8n.cloud/api/v1/workflows | \
  jq '.[] | select(.active == true) | {name: .name, active: .active}'

# 4. Ping webhook endpoints
echo -n "Orchestrator webhooks: "
if curl -s http://localhost:3000/api/health > /dev/null; then
  echo "✅ Up"
else
  echo "❌ Down"
fi

echo ""
echo "=== Check Complete ==="
```

---

## Appendix

### A. Environment Variable Reference

**Complete .env Configuration:**

```bash
# N8N Cloud Integration
N8N_BASE_URL=https://loganglosser13.app.n8n.cloud
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Public API JWT
N8N_MCP_SERVER_URL=https://loganglosser13.app.n8n.cloud/mcp-server/http
N8N_MCP_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # MCP API JWT

# GitHub Integration
GITHUB_PAT=ghp_xxxxxxxxxxxxx # Personal Access Token
GITHUB_WEBHOOK_SECRET=whsec_xxxxx # For webhook validation

# Notion Integration
NOTION_API_KEY=ntn_xxxxxxxxxxxxxxxx
NOTION_DATABASE_GITHUB_TASKS=xxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_PROJECTS=xxxxxxxxxxxxxxxxxxxxxxxx

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_DEFAULT_CHANNEL=#deployments

# CI/CD Systems
GITHUB_ACTIONS_TOKEN=ghp_xxxxxxxxxxxxx # For dispatch API
CIRCLECI_TOKEN=xxxxxxxxxxxxx # If using CircleCI
```

---

### B. API Endpoint Reference

**Orchestrator Webhook Endpoints:**

```
POST /api/n8n/webhook/github-sync
  Receives: GitHub issue sync notifications
  Body: {event, data, timestamp, source}
  Response: {ok: boolean, taskId?: string}

POST /api/n8n/webhook/notion-update
  Receives: Notion task change notifications
  Body: {event, data, timestamp, source}
  Response: {ok: boolean, syncId?: string}

POST /api/n8n/webhook/ci-complete
  Receives: CI/CD completion events
  Body: {event, data, timestamp, source}
  Response: {ok: boolean, notificationId?: string}

POST /api/n8n/webhook/stage-completion
  Receives: Research stage completion events
  Body: {event, data, timestamp, source}
  Response: {ok: boolean, archiveId?: string}
```

**N8N API Endpoints:**

```
GET /api/v1/workflows
  Returns: List of all workflows
  Auth: X-N8N-API-KEY header

GET /api/v1/workflows/{workflowId}
  Returns: Workflow details
  Auth: X-N8N-API-KEY header

POST /api/v1/workflows/{workflowId}/activate
  Activates workflow
  Auth: X-N8N-API-KEY header

POST /api/v1/workflows/{workflowId}/deactivate
  Deactivates workflow
  Auth: X-N8N-API-KEY header

POST /api/v1/workflows/{workflowId}/execute
  Manually execute workflow
  Auth: X-N8N-API-KEY header
  Body: {data: {...}}

GET /api/v1/executions
  List recent executions
  Auth: X-N8N-API-KEY header
  Query: ?workflowId=&status=&limit=

GET /api/v1/executions/{executionId}
  Get execution details
  Auth: X-N8N-API-KEY header
```

---

### C. Notion Database Schemas

**GitHub Tasks Database**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Issue title |
| Description | Rich Text | Issue body |
| Issue Number | Number | GitHub #123 |
| Repository | Select | repo name |
| Labels | Multi-select | GitHub labels |
| Status | Select | Backlog/In Progress/Done |
| Source | Select | GitHub/Manual |
| Source URL | URL | GitHub issue link |
| Assignee | Person | Responsible person |
| Created | Date | Creation date |
| Last Synced | Date | Last sync time |
| CI URL | URL | GitHub Actions run link |
| Last Test Status | Select | PASSED/FAILED |

**Research Projects Database**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Project name |
| Project ID | Text | Unique identifier |
| Current Stage | Select | Literature Review/etc |
| Stage Status | Select | Not Started/In Progress/Completed |
| Completion % | Number | Overall progress |
| Articles Reviewed | Number | Count from lit review |
| Last Updated | Date | Last stage completion |
| Stage Outputs | URL | Link to results |
| Metrics | Rich Text | Execution metrics |
| Team | Multi-select | Team members |

---

### D. Workflow Configuration Examples

**GitHub → Notion Sync Workflow**

```json
{
  "name": "github-issue-notion-sync",
  "nodes": [
    {
      "displayName": "GitHub Webhook",
      "name": "github_webhook",
      "type": "n8n-nodes-github.githubTrigger",
      "webhookId": "webhook-123",
      "events": ["issues"],
      "activities": ["opened", "edited", "labeled", "closed"]
    },
    {
      "displayName": "Transform Issue",
      "name": "transform_issue",
      "type": "n8n-nodes-base.code",
      "code": "return [{json: {title: $json.issue.title, ...}}]"
    },
    {
      "displayName": "Notion: Query Tasks",
      "name": "notion_query",
      "type": "n8n-nodes-notion.notion",
      "operation": "database:query",
      "databaseId": "{{$env.NOTION_DATABASE_GITHUB_TASKS}}",
      "filter": {"property": "Issue Number", "number": {"equals": $json.number}}
    },
    {
      "displayName": "Check Exists",
      "name": "check_exists",
      "type": "n8n-nodes-base.switch",
      "cases": [
        {"condition": "{{$json.results.length > 0}}", "output": 1},
        {"condition": "{{true}}", "output": 2}
      ]
    },
    {
      "displayName": "Notion: Update Page",
      "name": "notion_update",
      "type": "n8n-nodes-notion.notion",
      "operation": "page:update",
      "pageId": "{{$json.results[0].id}}",
      "properties": {
        "Status": "{{$json.status}}",
        "Last Synced": "{{new Date().toISOString()}}"
      }
    },
    {
      "displayName": "Notion: Create Page",
      "name": "notion_create",
      "type": "n8n-nodes-notion.notion",
      "operation": "page:create",
      "databaseId": "{{$env.NOTION_DATABASE_GITHUB_TASKS}}",
      "properties": {
        "Title": "{{$json.title}}",
        "Issue Number": "{{$json.number}}",
        "Labels": "{{$json.labels.join(', ')}}",
        "Source URL": "{{$json.html_url}}"
      }
    }
  ],
  "connections": {
    "github_webhook": [{"node": "transform_issue", "type": "main"}],
    "transform_issue": [{"node": "notion_query", "type": "main"}],
    "notion_query": [{"node": "check_exists", "type": "main"}],
    "check_exists": [
      {"node": "notion_update", "type": "main", "index": 1},
      {"node": "notion_create", "type": "main", "index": 2}
    ]
  }
}
```

---

### E. Testing Playbook

**Test Case: GitHub Issue Sync**

```gherkin
Feature: GitHub to Notion Synchronization
  Scenario: New GitHub issue creates Notion task
    Given a GitHub repository with webhook configured
    And Notion database is accessible
    When a new issue is created in GitHub
    Then a corresponding task appears in Notion within 30 seconds
    And all issue fields are correctly mapped
    And the Notion page contains a link back to GitHub

  Scenario: Issue update syncs to Notion
    Given an existing GitHub issue with a corresponding Notion task
    When the GitHub issue title is edited
    Then the Notion task title updates within 30 seconds
    And the "Last Synced" timestamp is updated

  Scenario: Multiple labels sync correctly
    Given a GitHub issue with multiple labels
    When the issue is synced to Notion
    Then all labels appear in the Notion task
    And they are properly formatted as comma-separated values

  Scenario: Error handling and retry
    Given a Notion API error occurs during sync
    When the workflow retries
    Then it retries up to 3 times with exponential backoff
    And logs the error for monitoring
```

---

### F. Performance Baselines

**Expected Performance Metrics:**

| Metric | Baseline | Target |
|--------|----------|--------|
| GitHub issue → Notion sync | 30s | <30s |
| Notion status → CI trigger | 60s | <60s |
| CI completion → Slack notify | 10s | <10s |
| Stage completion sync | 5s | <5s |
| Concurrent webhook capacity | 100/min | >500/min |
| Workflow error rate | <1% | <0.5% |
| API response time (p95) | 200ms | <200ms |
| Data consistency | 99% | >99.9% |

---

### G. Runbook: Emergency Procedures

**If N8N is Completely Down:**

1. Switch all webhook handlers to queue-based fallback
2. Store webhook payloads in Redis queue
3. Notify team via on-call channel
4. Begin failover to backup n8n instance (if available)
5. Replay queued events once service recovers

**If GitHub Integration Fails:**

1. Check GitHub API status at https://www.githubstatus.com
2. Verify GitHub PAT token has `public_repo` and `repo_hooks` scopes
3. Check rate limit: `curl https://api.github.com/rate_limit`
4. If rate limited, wait 60 minutes for reset
5. Manually trigger recent issues sync if delay > 30 minutes

**If Notion Integration Fails:**

1. Verify Notion API key is valid and not rotated
2. Check database permissions: Database should have "Edit" access
3. Test API directly:
   ```bash
   curl -H "Authorization: Bearer $NOTION_API_KEY" \
     -H "Notion-Version: 2022-06-28" \
     https://api.notion.com/v1/databases
   ```
4. Check for rate limiting (Notion allows 3-4 req/sec)
5. Implement request throttling if needed

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-28 | Engineering Team | Initial comprehensive plan |
| TBD | TBD | TBD | Updates during implementation |

---

## Approval & Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Engineering Lead | [Name] | [Date] | Pending |
| DevOps Lead | [Name] | [Date] | Pending |
| Product Manager | [Name] | [Date] | Pending |
| Security Team | [Name] | [Date] | Pending |

---

**End of Document**
