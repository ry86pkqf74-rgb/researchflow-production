# n8n Workflow Automation Setup

**Last Updated:** January 28, 2026

---

## Overview

ResearchFlow uses n8n for workflow automation, enabling:
- GitHub ↔ Notion bidirectional sync
- Automated CI/CD pipeline triggers
- Deployment notifications to Slack
- Workflow stage completion events

---

## Prerequisites

1. **n8n Cloud Account** - Sign up at [n8n.io](https://n8n.io)
2. **API Key** - Generated from n8n settings
3. **Webhook URLs** - Created for each workflow

---

## Environment Configuration

Add these variables to your `.env` file:

```bash
# n8n Cloud Configuration
N8N_BASE_URL=https://your-instance.app.n8n.cloud
N8N_API_KEY=your-api-key-here
N8N_MCP_SERVER_URL=https://your-instance.app.n8n.cloud/mcp-server/http
N8N_MCP_TOKEN=your-mcp-token-here
```

### Getting Your API Key

1. Log into your n8n cloud instance
2. Go to **Settings** → **API**
3. Click **Create API Key**
4. Copy the key (it won't be shown again)

---

## Required Workflows

Create these 4 workflows in your n8n instance:

### 1. GitHub → Notion Sync (`github-notion-sync`)

**Purpose:** Sync GitHub issues to Notion tasks

**Trigger:** Webhook
- Path: `github-notion-sync`
- Method: POST

**Nodes:**
1. **Webhook** - Receives GitHub issue data
2. **IF** - Check if issue exists in Notion
3. **Notion** - Create or update task
4. **Respond to Webhook** - Return success

**Expected Payload:**
```json
{
  "event": "github.issue.sync",
  "data": {
    "title": "Issue title",
    "body": "Issue description",
    "number": 123,
    "labels": ["bug", "priority-high"],
    "state": "open"
  },
  "timestamp": "2026-01-28T12:00:00Z",
  "source": "researchflow-orchestrator"
}
```

---

### 2. Notion → CI Trigger (`notion-ci-trigger`)

**Purpose:** Trigger CI/CD when Notion task status changes

**Trigger:** Webhook
- Path: `notion-ci-trigger`
- Method: POST

**Nodes:**
1. **Webhook** - Receives Notion task update
2. **IF** - Check if status = "Queue CI"
3. **GitHub** - Trigger workflow dispatch
4. **Notion** - Update task status to "CI Running"
5. **Respond to Webhook** - Return execution ID

**Expected Payload:**
```json
{
  "event": "notion.task.status_change",
  "data": {
    "id": "task-uuid",
    "status": "Queue CI",
    "title": "Task title"
  },
  "timestamp": "2026-01-28T12:00:00Z",
  "source": "researchflow-orchestrator"
}
```

---

### 3. Deployment Notification (`deployment-notify`)

**Purpose:** Send Slack notifications on deployment

**Trigger:** Webhook
- Path: `deployment-notify`
- Method: POST

**Nodes:**
1. **Webhook** - Receives deployment event
2. **IF** - Check deployment status
3. **Slack** - Send success/failure message
4. **Respond to Webhook** - Confirm sent

**Expected Payload:**
```json
{
  "event": "deployment.complete",
  "data": {
    "service": "orchestrator",
    "version": "1.2.3",
    "status": "success",
    "url": "https://api.researchflow.com"
  },
  "timestamp": "2026-01-28T12:00:00Z",
  "source": "researchflow-orchestrator"
}
```

**Slack Message Template:**
```
🚀 *Deployment Complete*
Service: {{$json.data.service}}
Version: {{$json.data.version}}
Status: {{$json.data.status === 'success' ? '✅ Success' : '❌ Failed'}}
URL: {{$json.data.url}}
```

---

### 4. Stage Completion Sync (`stage-completion`)

**Purpose:** Sync workflow stage completions to external systems

**Trigger:** Webhook
- Path: `stage-completion`
- Method: POST

**Nodes:**
1. **Webhook** - Receives stage completion
2. **Notion** - Update project status
3. **Slack** - Notify team (optional)
4. **HTTP Request** - Sync to external APIs (optional)
5. **Respond to Webhook** - Confirm processed

**Expected Payload:**
```json
{
  "event": "workflow.stage.complete",
  "data": {
    "stageId": 5,
    "stageName": "Data Extraction",
    "projectId": "project-uuid",
    "status": "complete",
    "outputs": {
      "recordsProcessed": 1500,
      "artifactsGenerated": 3
    }
  },
  "timestamp": "2026-01-28T12:00:00Z",
  "source": "researchflow-orchestrator"
}
```

---

## Integration Code

The n8n client is located at:
```
services/orchestrator/src/integrations/n8n.ts
```

### Usage Examples

```typescript
import { n8nWorkflows } from './integrations/n8n';

// Sync GitHub issue to Notion
await n8nWorkflows.syncGitHubToNotion({
  title: 'Bug: Login fails',
  body: 'Users cannot login...',
  number: 456,
  labels: ['bug'],
  state: 'open'
});

// Trigger CI from Notion
await n8nWorkflows.triggerCIFromNotion({
  id: 'task-123',
  status: 'Queue CI',
  title: 'Deploy v1.2.3'
});

// Notify deployment
await n8nWorkflows.notifyDeployment({
  service: 'web',
  version: '1.2.3',
  status: 'success',
  url: 'https://researchflow.com'
});

// Sync stage completion
await n8nWorkflows.syncStageCompletion({
  stageId: 10,
  stageName: 'Statistical Analysis',
  projectId: 'proj-abc',
  status: 'complete',
  outputs: { pValue: 0.03 }
});
```

---

## Testing Workflows

### Test via curl

```bash
# Test github-notion-sync
curl -X POST https://your-instance.app.n8n.cloud/webhook/github-notion-sync \
  -H "Content-Type: application/json" \
  -d '{
    "event": "github.issue.sync",
    "data": {"title": "Test Issue", "number": 1, "labels": [], "state": "open"},
    "timestamp": "2026-01-28T12:00:00Z",
    "source": "manual-test"
  }'
```

### Test via Code

```typescript
import { n8nClient } from './integrations/n8n';

// List all workflows
const workflows = await n8nClient.listWorkflows();
console.log(workflows);

// Check execution status
const execution = await n8nClient.getExecution('exec-id');
console.log(execution);
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check N8N_API_KEY is correct |
| 404 Not Found | Verify webhook path matches |
| Workflow not triggering | Ensure workflow is activated |
| Slack not sending | Check Slack credentials in n8n |

---

## Security Notes

1. **API Key Security** - Never commit API keys to version control
2. **Webhook Authentication** - Consider adding HMAC verification
3. **Rate Limiting** - n8n cloud has execution limits per plan
4. **Data Privacy** - Don't send PHI through n8n workflows

---

## Related Documentation

- [n8n Documentation](https://docs.n8n.io/)
- [n8n API Reference](https://docs.n8n.io/api/)
- [ResearchFlow Architecture](../ARCHITECTURE_OVERVIEW.md)
