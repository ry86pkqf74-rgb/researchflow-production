# N8N Cloud Integration - Quick Start Guide

**Version:** 1.0
**Last Updated:** January 28, 2026
**Target Audience:** Engineering Team, DevOps

---

## Quick Summary

ResearchFlow now integrates with **n8n Cloud** to automate workflow orchestration across GitHub, Notion, CI/CD systems, and deployment notifications.

**Four main workflows:**
1. **GitHub → Notion Sync:** Automatically sync GitHub issues to Notion task database
2. **Notion → CI/CD Trigger:** Execute pipelines when Notion task status changes
3. **CI Completion → Slack:** Notify team of test results in Slack
4. **Stage Completion:** Sync research workflow completions to Notion and archive

---

## Getting Started in 5 Steps

### Step 1: Verify Environment Variables

```bash
# Check all required variables are set
grep -E 'N8N|NOTION|GITHUB_PAT|SLACK' .env | head -10

# Should see:
# N8N_BASE_URL=https://loganglosser13.app.n8n.cloud
# N8N_API_KEY=eyJhb...
# N8N_MCP_SERVER_URL=https://loganglosser13.app.n8n.cloud/mcp-server/http
# N8N_MCP_TOKEN=eyJhb...
```

### Step 2: Test Connection

```bash
# Run the test suite (requires Node.js)
npm run test:n8n

# Expected output:
# ✓ API is responding
# ✓ JWT token is valid
# ✓ MCP Server endpoint is reachable
```

### Step 3: Access N8N Dashboard

Open: https://loganglosser13.app.n8n.cloud
- Log in with your account
- You should see the workflows dashboard

### Step 4: Create the 4 Workflows

Use the detailed execution plan in `N8N_EXECUTION_PLAN.md` to create workflows in n8n:
- GitHub Issue → Notion Sync
- Notion Status → CI Trigger
- CI Completion → Slack Notify
- Stage Completion Sync

### Step 5: Configure Webhooks

For each workflow, you'll need to configure webhooks in:
- **GitHub:** Repository settings → Webhooks
- **Notion:** Automated workflow (polling or webhook)
- **CI System:** Repository settings → Webhooks

---

## Common Operations

### Manually Trigger a Workflow

```bash
curl -X POST \
  'https://loganglosser13.app.n8n.cloud/api/v1/workflows/{workflow-id}/execute' \
  -H 'X-N8N-API-KEY: $N8N_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "data": {
      "test": "value"
    }
  }'
```

### List All Workflows

```bash
curl -X GET \
  'https://loganglosser13.app.n8n.cloud/api/v1/workflows' \
  -H 'X-N8N-API-KEY: $N8N_API_KEY'
```

### View Recent Executions

```bash
curl -X GET \
  'https://loganglosser13.app.n8n.cloud/api/v1/executions?limit=10' \
  -H 'X-N8N-API-KEY: $N8N_API_KEY'
```

### Check Workflow Status

```bash
curl -X GET \
  'https://loganglosser13.app.n8n.cloud/api/v1/workflows/{workflow-id}' \
  -H 'X-N8N-API-KEY: $N8N_API_KEY'
```

### Activate/Deactivate Workflow

```bash
# Activate
curl -X POST \
  'https://loganglosser13.app.n8n.cloud/api/v1/workflows/{workflow-id}/activate' \
  -H 'X-N8N-API-KEY: $N8N_API_KEY'

# Deactivate
curl -X POST \
  'https://loganglosser13.app.n8n.cloud/api/v1/workflows/{workflow-id}/deactivate' \
  -H 'X-N8N-API-KEY: $N8N_API_KEY'
```

---

## Troubleshooting

### Issue: "API returned 403"

**Solution:**
1. Check API key is correct: `echo $N8N_API_KEY`
2. Verify token not expired (check JWT payload)
3. Generate new token from n8n settings if needed

### Issue: "Webhook not triggering"

**Solution:**
1. Verify webhook is active in n8n UI
2. Check GitHub/Notion webhook configuration
3. Look at n8n execution logs for errors
4. Test webhook manually: `curl -X POST {webhook-url} -d '{}'`

### Issue: "Notion API error"

**Solution:**
1. Verify NOTION_API_KEY is set correctly
2. Check Notion database permissions
3. Ensure integration has access to database
4. Check Notion API status at https://status.notion.so

### Issue: "GitHub webhook not delivering"

**Solution:**
1. Check webhook payload in GitHub repository settings
2. Look at recent deliveries and response codes
3. Verify n8n webhook URL is publicly accessible
4. Check GitHub rate limits: `curl https://api.github.com/rate_limit -H "Authorization: bearer $GITHUB_PAT"`

---

## Architecture Overview

```
┌─────────────────┐
│   GitHub API    │
│   (Webhooks)    │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │  N8N   │──→ Notion API
    │ Cloud  │──→ Slack API
    │        │──→ CI/CD API
    └────────┘
         ▲
         │
┌────────┴──────────────────┐
│   ResearchFlow            │
│   Orchestrator Service    │
│   (Express Backend)       │
└──────────────────────────┘
```

---

## Key Concepts

### Workflows
- **Definition:** Automated sequences of tasks in n8n
- **Status:** Can be "Active" or "Inactive"
- **Trigger:** What starts the workflow (webhook, schedule, manual)
- **Nodes:** Individual steps in the workflow

### Executions
- **Definition:** A single run of a workflow
- **Status:** `success`, `error`, `waiting`
- **Logs:** Detailed execution information for debugging

### Webhooks
- **GitHub:** Events like issue created/edited/closed
- **Orchestrator:** Receives notifications from n8n workflows
- **CI/CD:** Webhooks from GitHub Actions, CircleCI, etc.

---

## Files & Locations

**Main Integration:**
- `/services/orchestrator/src/integrations/n8n.ts` - N8nClient class

**Routes:**
- `/services/orchestrator/src/routes/webhooks.ts` - Webhook handlers

**Tests:**
- `/scripts/test-n8n-connection.ts` - Connection test script

**Documentation:**
- `/docs/N8N_EXECUTION_PLAN.md` - Comprehensive implementation guide
- `/docs/N8N_IMPLEMENTATION_CHECKLIST.md` - Step-by-step checklist
- `/docs/N8N_QUICK_START.md` - This file

---

## Important Security Notes

1. **Never commit API keys** - Use .env file only
2. **Rotate tokens regularly** - Every 90 days recommended
3. **Use HTTPS always** - All webhook URLs must be HTTPS
4. **Validate webhook payloads** - Check signatures and validate structure
5. **Rate limiting** - Monitor API usage to avoid rate limits

---

## Support & Resources

**Documentation:**
- N8N Docs: https://docs.n8n.io
- GitHub API: https://docs.github.com/en/rest
- Notion API: https://developers.notion.com

**Dashboard:**
- N8N Cloud: https://loganglosser13.app.n8n.cloud
- GitHub Webhooks: Repository → Settings → Webhooks
- Notion API Keys: https://www.notion.so/my-integrations

**Getting Help:**
1. Check execution logs in n8n dashboard
2. Review main execution plan document
3. Run test suite: `npm run test:n8n`
4. Check troubleshooting section above

---

## Next Steps

1. ✅ Verify environment variables (Step 1)
2. ✅ Test connection (Step 2)
3. 📋 Follow implementation checklist for each workflow
4. 🧪 Run integration tests
5. 🚀 Deploy to production

---

## Support Contacts

- **Engineering Lead:** [Name]
- **DevOps Lead:** [Name]
- **On-Call:** Check #engineering Slack channel

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-28 | Initial quick start guide |

---

**Last Updated:** January 28, 2026
**Status:** Ready for Implementation
