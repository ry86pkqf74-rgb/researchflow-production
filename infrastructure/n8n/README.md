# ResearchFlow n8n Workflows

This directory contains n8n workflow JSON configuration files for ResearchFlow automation. These workflows integrate GitHub, Notion, Slack, and GitHub Actions to create a seamless research execution pipeline.

## Workflows

### 1. github-notion-sync.json
**GitHub → Notion Task Synchronization**

Automatically creates Notion tasks from GitHub issues.

- **Webhook path**: `github-notion-sync`
- **Event trigger**: `github.issue.sync`
- **Flow**:
  1. Receives webhook from GitHub
  2. Validates event type
  3. Creates corresponding Notion database page
  4. Assigns Task ID (GH-#)
  5. Sets initial status to "🟡 In Progress"

**Required credentials**: Notion API
**Database ID**: `52e84cac-8ed0-4231-b9c8-5b854d042b9b` (configure as needed)

---

### 2. notion-ci-trigger.json
**Notion Status Change → GitHub Actions CI Trigger**

Triggers CI/CD pipelines when Notion tasks change status to "Queue CI".

- **Webhook path**: `notion-ci-trigger`
- **Event trigger**: `status === "Queue CI"`
- **Flow**:
  1. Receives webhook with task status change
  2. Checks if status is "Queue CI"
  3. Triggers GitHub Actions workflow (`ci-pipeline.yml`)
  4. Updates Notion task to "🔄 CI Running"
  5. Returns workflow run ID

**Required credentials**: GitHub API, Notion API
**Default branch**: `main` (configurable per request)

---

### 3. deployment-notify.json
**Deployment Completion Notifications**

Sends formatted Slack notifications when deployments complete.

- **Webhook path**: `deployment-notify`
- **Event trigger**: `deployment.complete`
- **Message format**: `🚀 Deployment Complete - Service: X, Version: Y, Status: ✅/❌`
- **Flow**:
  1. Receives deployment completion event
  2. Validates event type
  3. Determines status icon (✅ success / ❌ failure)
  4. Formats message with service details
  5. Sends formatted Slack notification with metadata blocks
  6. Returns confirmation

**Required credentials**: Slack API (or Slack webhook URL in payload)

**Payload format**:
```json
{
  "event": "deployment.complete",
  "service": "research-api",
  "version": "1.2.3",
  "status": "success",
  "environment": "production",
  "timestamp": "2024-01-28T10:30:00Z",
  "details": "Optional deployment notes",
  "slackWebhookUrl": "https://hooks.slack.com/services/..."
}
```

---

### 4. stage-completion.json
**Workflow Stage Completion Handler**

Logs stage completions to Notion and notifies Slack for milestone stages.

- **Webhook path**: `stage-completion`
- **Event trigger**: `workflow.stage.complete`
- **Flow**:
  1. Receives stage completion event
  2. Validates event type
  3. Adds entry to Notion execution log with:
     - Timestamp
     - Stage name
     - Workflow ID
     - Status (success/failure)
     - Duration
     - Execution details
  4. Checks if stage is marked as milestone
  5. Sends Slack milestone alert (if applicable)
  6. Returns confirmation

**Required credentials**: Notion API, Slack API

**Payload format**:
```json
{
  "event": "workflow.stage.complete",
  "workflowId": "workflow-123",
  "workflowName": "Research Execution Pipeline",
  "stageName": "Data Processing",
  "stageStatus": "success",
  "duration": "45m 30s",
  "isMilestone": true,
  "executionDetails": "Processed 1000 records successfully",
  "slackWebhookUrl": "https://hooks.slack.com/services/..."
}
```

---

## Installation & Import

### Step 1: Access n8n Cloud
1. Go to [n8n.cloud](https://n8n.cloud)
2. Log in to your ResearchFlow workspace
3. Navigate to **Workflows** section

### Step 2: Import Workflows

#### Option A: Import via UI
1. Click **"+ Create workflow"** or **"Import"**
2. Select **"Import from file"**
3. Choose one of the JSON files from this directory
4. Click **Import**

#### Option B: Bulk Import
1. Click **Settings** (gear icon)
2. Go to **Import/Export**
3. Click **Import workflows**
4. Select all 4 JSON files at once
5. Click **Import all**

### Step 3: Configure Credentials

After importing, configure the required credentials for each workflow:

#### GitHub API Credential
1. Go to **Settings → Credentials**
2. Click **"+ New"** and select **GitHub**
3. Authenticate with your GitHub account
4. Select this credential in the GitHub nodes

#### Notion API Credential
1. Go to **Settings → Credentials**
2. Click **"+ New"** and select **Notion**
3. Authorize the Notion integration
4. Select this credential in the Notion nodes

#### Slack API Credential (if using Slack node)
1. Go to **Settings → Credentials**
2. Click **"+ New"** and select **Slack**
3. Choose authentication method:
   - **Option 1**: OAuth (recommended for production)
   - **Option 2**: Webhook URL (simpler setup)
4. Select this credential in the Slack nodes

### Step 4: Configure Database & Workflow IDs

Update the following IDs in the workflows:

| Workflow | Configuration | Current Value | Update to |
|----------|---------------|---------------|-----------|
| `github-notion-sync.json` | Notion Database ID | `52e84cac-8ed0-4231-b9c8-5b854d042b9b` | Your Tasks DB ID |
| `stage-completion.json` | Notion Database ID | `7f9a2c1d-5e8b-4a6f-9c3d-2b1e8f5a7c9d` | Your Execution Log DB ID |
| `notion-ci-trigger.json` | GitHub Repo Owner | `$json.github.owner` | Configure per event |
| `notion-ci-trigger.json` | GitHub Workflow File | `ci-pipeline.yml` | Your workflow file name |

**How to find Notion Database ID**:
1. Open the Notion database in your browser
2. The URL format is: `notion.so/<workspace-id>/<database-id>`
3. Copy the database ID (36 characters after the last `/`)

### Step 5: Test Webhook Endpoints

After activation, test each webhook:

```bash
# Test GitHub → Notion Sync
curl -X POST https://n8n-your-instance.n8n.cloud/webhook/github-notion-sync \
  -H "Content-Type: application/json" \
  -d '{
    "event": "github.issue.sync",
    "data": {
      "title": "Test Issue",
      "number": 42
    }
  }'

# Test Notion → CI Trigger
curl -X POST https://n8n-your-instance.n8n.cloud/webhook/notion-ci-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Queue CI",
    "taskId": "GH-42",
    "pageId": "notion-page-id",
    "github": {
      "owner": "your-org",
      "repo": "your-repo",
      "branch": "main"
    }
  }'

# Test Deployment Notify
curl -X POST https://n8n-your-instance.n8n.cloud/webhook/deployment-notify \
  -H "Content-Type: application/json" \
  -d '{
    "event": "deployment.complete",
    "service": "research-api",
    "version": "1.0.0",
    "status": "success"
  }'

# Test Stage Completion
curl -X POST https://n8n-your-instance.n8n.cloud/webhook/stage-completion \
  -H "Content-Type: application/json" \
  -d '{
    "event": "workflow.stage.complete",
    "workflowId": "wf-123",
    "stageName": "Test Stage",
    "stageStatus": "success",
    "isMilestone": false
  }'
```

### Step 6: Activate Workflows

1. Open each workflow
2. Click **Activate** (top right)
3. Confirm activation
4. Test with sample webhook requests

## Webhook Details

### Base Webhook URL Format
```
https://n8n-your-instance.n8n.cloud/webhook/{workflow-path}
```

### Authentication
By default, webhooks are public (no authentication required). To secure:

1. Open workflow settings
2. Go to **Trigger configuration**
3. Enable **Require authentication**
4. Copy the authentication token
5. Include in webhook calls:
   ```
   Authorization: Bearer <token>
   ```

## Troubleshooting

### Workflow Not Triggering
- Verify webhook is **Active** (status indicator shows green)
- Check webhook URL in browser (should return 200)
- Review execution logs for errors

### Credential Errors
- Confirm credentials are authorized in **Settings → Credentials**
- Check credential expiration dates
- Re-authorize if needed

### Notion Update Failures
- Verify Notion database ID is correct
- Check that database properties match workflow property names
- Ensure Notion API token has write permissions

### Slack Message Not Sending
- Confirm Slack webhook URL is valid and active
- Verify webhook channel still exists
- Check message payload format

### GitHub Actions Not Triggering
- Confirm workflow file exists and is in default branch
- Verify GitHub API token has `workflow` permission
- Check workflow is not disabled in GitHub

## Monitoring & Logs

### View Execution History
1. Open workflow
2. Click **View executions** (left panel)
3. See all trigger events and results
4. Click execution to view detailed logs

### Enable Debug Logging
1. Open workflow **Settings**
2. Toggle **Save execution data**
3. Select **On all runs** or **On failure**
4. Logs persist for 30 days

## Best Practices

1. **Test before activation**: Use webhook testing endpoint before activating
2. **Monitor executions**: Regularly check execution logs for failures
3. **Use dynamic credentials**: Store API keys in n8n Credentials, not in JSON
4. **Version control**: Keep workflow JSON files in git with change tracking
5. **Error handling**: Configure error webhooks for failure notifications
6. **Rate limiting**: Be aware of API rate limits for GitHub, Notion, and Slack
7. **Backup**: Export workflows regularly as JSON backup

## Support & Documentation

- **n8n Docs**: https://docs.n8n.io
- **n8n Community**: https://community.n8n.io
- **ResearchFlow Issues**: https://github.com/your-org/researchflow/issues

---

**Last Updated**: January 28, 2024
**Version**: 1.0.0
