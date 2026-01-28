# N8N Workflow Implementation Checklist

**Project:** ResearchFlow Production
**Date Started:** January 28, 2026
**Target Completion:** February 28, 2026
**Owner:** Engineering Team

---

## Pre-Implementation Setup

### Phase 0: Environment & Access

- [ ] Verify n8n cloud instance access
  - [ ] Account created and verified
  - [ ] Team members have appropriate permissions
  - [ ] Can access https://loganglosser13.app.n8n.cloud

- [ ] Validate API credentials
  - [ ] N8N_API_KEY verified and in .env
  - [ ] N8N_MCP_TOKEN verified and in .env
  - [ ] Run test script: `npm run test:n8n`

- [ ] Set up GitHub integration
  - [ ] GitHub PAT token created with correct scopes
  - [ ] `repo_hooks`, `read:repo_hook`, `repo` scopes verified
  - [ ] Token stored securely in .env

- [ ] Set up Notion integration
  - [ ] Notion API key obtained from https://www.notion.so/my-integrations
  - [ ] Integration added to relevant Notion workspace
  - [ ] Token stored securely in .env

- [ ] Set up Slack integration (optional)
  - [ ] Create Slack app at https://api.slack.com/apps
  - [ ] Generate incoming webhook URL
  - [ ] Store in .env as SLACK_WEBHOOK_URL

**Owner:** DevOps Lead
**Timeline:** Days 1-2

---

## Workflow 1: GitHub → Notion Sync

### Setup Phase

- [ ] Create Notion database for GitHub tasks
  - [ ] Database name: "GitHub Tasks"
  - [ ] Properties created (see schema in main plan)
  - [ ] Database ID stored in `.env` as `NOTION_DATABASE_GITHUB_TASKS`

- [ ] Configure GitHub webhook
  - [ ] Log into GitHub repository settings
  - [ ] Create webhook pointing to n8n instance
  - [ ] Events: Issues
  - [ ] Active: Checked
  - [ ] Individual webhook secret configured (optional but recommended)

- [ ] Prepare orchestrator webhook endpoint
  - [ ] Endpoint created: `/api/n8n/webhook/github-sync`
  - [ ] Middleware configured for JSON parsing
  - [ ] Signature verification implemented (if using GitHub secret)
  - [ ] Logging added for all requests

### N8N Workflow Creation

- [ ] Create new workflow in n8n
  - [ ] Name: `github-issue-notion-sync`
  - [ ] Description: "Automatically sync GitHub issues to Notion task database"
  - [ ] Active: Yes

- [ ] Add GitHub webhook trigger node
  - [ ] Node name: "GitHub Webhook"
  - [ ] Events: `issues`
  - [ ] Activities: `opened`, `closed`, `edited`, `labeled`, `unlabeled`
  - [ ] Generate webhook URL and configure in GitHub

- [ ] Add data transformation node
  - [ ] Node name: "Transform Issue"
  - [ ] Type: Function/Code node
  - [ ] Maps GitHub issue fields to Notion schema
  - [ ] Handles null/undefined values gracefully

- [ ] Add Notion query node
  - [ ] Node name: "Check if Task Exists"
  - [ ] Operation: Database query
  - [ ] Database ID: `{{$env.NOTION_DATABASE_GITHUB_TASKS}}`
  - [ ] Filter: Issue Number equals GitHub issue number

- [ ] Add conditional routing
  - [ ] Node name: "Task Exists?"
  - [ ] Type: If/Switch node
  - [ ] Branch 1: Task exists → Update
  - [ ] Branch 2: Task doesn't exist → Create

- [ ] Add Notion update node
  - [ ] Node name: "Update Notion Task"
  - [ ] Operation: Page update
  - [ ] Maps transformed fields to Notion properties
  - [ ] Updates: Status, Description, Labels, Last Synced

- [ ] Add Notion create node
  - [ ] Node name: "Create Notion Task"
  - [ ] Operation: Page create
  - [ ] Database ID: `{{$env.NOTION_DATABASE_GITHUB_TASKS}}`
  - [ ] All properties mapped from transformed issue

- [ ] Add confirmation webhook
  - [ ] Node name: "Confirm Sync"
  - [ ] Type: HTTP Request
  - [ ] Method: POST
  - [ ] URL: `{{$env.ORCHESTRATOR_URL}}/api/n8n/webhook/github-sync`
  - [ ] Sends task ID and timestamp

### Testing

- [ ] Test with sample GitHub issue
  - [ ] Create test issue in repository
  - [ ] Wait 30 seconds
  - [ ] Verify Notion task created
  - [ ] Verify all fields correctly mapped
  - [ ] Check "Last Synced" timestamp

- [ ] Test issue update
  - [ ] Edit GitHub issue title
  - [ ] Wait 30 seconds
  - [ ] Verify Notion task updated
  - [ ] Verify "Last Synced" timestamp updated

- [ ] Test label synchronization
  - [ ] Add labels to GitHub issue
  - [ ] Remove labels from GitHub issue
  - [ ] Verify Notion task labels updated

- [ ] Test error handling
  - [ ] Disable Notion API key temporarily
  - [ ] Trigger GitHub issue event
  - [ ] Verify workflow retries
  - [ ] Verify error logged
  - [ ] Re-enable API key and test retry

- [ ] Test concurrent operations
  - [ ] Create multiple issues simultaneously
  - [ ] Verify all sync to Notion without conflicts

**Owner:** Integration Team
**Timeline:** Days 3-7

---

## Workflow 2: Notion Status → CI/CD Trigger

### Setup Phase

- [ ] Add required fields to Notion GitHub Tasks database
  - [ ] Field: "Repository" (Text)
  - [ ] Field: "Branch" (Text)
  - [ ] Field: "CI System" (Select: GitHub Actions, CircleCI, etc.)
  - [ ] Field: "Workflow Name" (Text)
  - [ ] Field: "CI URL" (URL)

- [ ] Update GitHub Tasks database schema
  - [ ] Modify Status select values to match workflow states
  - [ ] Values: `Backlog`, `Ready for Testing`, `Testing in Progress`, `Testing Complete`, `Testing Failed`, `Ready for Deploy`, `Deployed`

- [ ] Configure GitHub Actions for manual dispatch
  - [ ] Ensure test workflow has `workflow_dispatch` trigger
  - [ ] Define inputs for task_id, test_suite, etc.
  - [ ] Example: `.github/workflows/test.yml`

### N8N Workflow Creation

- [ ] Create new workflow in n8n
  - [ ] Name: `notion-ci-trigger`
  - [ ] Description: "Trigger CI/CD pipelines from Notion status changes"
  - [ ] Active: Yes

- [ ] Add Notion trigger node
  - [ ] Type: Polling trigger on Notion database
  - [ ] Database: GitHub Tasks
  - [ ] Poll interval: 30 seconds
  - [ ] Trigger on: Status field changes
  - [ ] Listen for: `Backlog` → `Ready for Testing`

- [ ] Add task details query
  - [ ] Node name: "Get Task Details"
  - [ ] Query specific Notion page for full context
  - [ ] Extract: Repository, Branch, CI System, Workflow Name

- [ ] Add CI system selector
  - [ ] Node name: "Select CI System"
  - [ ] Type: Switch node based on CI System field
  - [ ] GitHub Actions branch
  - [ ] CircleCI branch (if applicable)

- [ ] Add GitHub Actions dispatch node
  - [ ] Node name: "Dispatch GitHub Actions"
  - [ ] HTTP method: POST
  - [ ] Endpoint: `/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`
  - [ ] Auth: GitHub PAT token
  - [ ] Payload includes task_id in inputs

- [ ] Add status update node
  - [ ] Node name: "Update Notion Status"
  - [ ] Update Status field to "Testing in Progress"
  - [ ] Update CI URL with GitHub Actions run link

- [ ] Add orchestrator webhook
  - [ ] Node name: "Notify Orchestrator"
  - [ ] POST to `/api/n8n/webhook/ci-complete`
  - [ ] Sends task ID, workflow URL, expected completion time

### Testing

- [ ] Test manual status change
  - [ ] Open Notion task
  - [ ] Change Status to "Ready for Testing"
  - [ ] Wait 60 seconds
  - [ ] Verify GitHub Actions workflow triggered
  - [ ] Check CI URL appears in Notion

- [ ] Test with different branches
  - [ ] Create task with multiple branches
  - [ ] Change status for each
  - [ ] Verify correct branch tested in each workflow

- [ ] Test error scenarios
  - [ ] Invalid branch name (should fail gracefully)
  - [ ] Missing repository (should fail gracefully)
  - [ ] Rate limiting (should queue and retry)

- [ ] Test concurrent triggers
  - [ ] Change status on multiple tasks simultaneously
  - [ ] Verify all trigger without conflicts

**Owner:** DevOps Team
**Timeline:** Days 8-12

---

## Workflow 3: CI Completion → Slack Notification

### Setup Phase

- [ ] Create Slack webhook
  - [ ] Log into Slack workspace settings
  - [ ] Create incoming webhook
  - [ ] Select target channel (#deployments)
  - [ ] Copy webhook URL to .env as SLACK_WEBHOOK_URL

- [ ] Configure CI completion webhooks
  - [ ] GitHub Actions: Add webhook in repository settings
  - [ ] CircleCI: Add webhook in project settings (if applicable)
  - [ ] Events: `workflow_run` (GitHub) or `job-completed` (CircleCI)

- [ ] Prepare orchestrator webhook endpoint
  - [ ] Endpoint created: `/api/n8n/webhook/ci-complete`
  - [ ] Receives CI completion events
  - [ ] Validates webhook signatures
  - [ ] Forwards to n8n workflow

### N8N Workflow Creation

- [ ] Create new workflow in n8n
  - [ ] Name: `ci-completion-slack-notify`
  - [ ] Description: "Send Slack notifications on CI pipeline completion"
  - [ ] Active: Yes

- [ ] Add CI webhook trigger node
  - [ ] Type: HTTP webhook trigger
  - [ ] Listen on path: `/github-ci-complete` or `/circleci-complete`
  - [ ] Methods: POST

- [ ] Add CI data extraction node
  - [ ] Node name: "Extract CI Data"
  - [ ] Extracts: Status, commit SHA, duration, logs URL
  - [ ] Handles both GitHub and CircleCI formats

- [ ] Add Notion task lookup
  - [ ] Node name: "Find Task in Notion"
  - [ ] Query Notion GitHub Tasks by branch name
  - [ ] Retrieves: Task ID, Title, Assignee

- [ ] Add message builder node
  - [ ] Node name: "Build Slack Message"
  - [ ] Type: Function/Code node
  - [ ] Creates rich message blocks:
    - [ ] Status header (✅ PASSED or ❌ FAILED)
    - [ ] Metadata fields (duration, commit, task)
    - [ ] Action buttons (View Logs, Mark Ready)

- [ ] Add conditional formatting
  - [ ] Green color for successful builds
  - [ ] Red color for failed builds
  - [ ] Include error logs in message for failures

- [ ] Add Slack send node
  - [ ] Node name: "Send to Slack"
  - [ ] Webhook URL: `{{$env.SLACK_WEBHOOK_URL}}`
  - [ ] Channel: #deployments (or dynamic from task)
  - [ ] Blocks: Rich formatted message

- [ ] Add Notion status update
  - [ ] Node name: "Update Notion Task"
  - [ ] Updates Status field based on CI result
  - [ ] Success: "Testing Complete"
  - [ ] Failure: "Testing Failed"
  - [ ] Updates CI URL

- [ ] Add analytics event
  - [ ] Node name: "Send Analytics"
  - [ ] Tracks: CI completion, duration, status
  - [ ] Sends to analytics backend (if configured)

### Testing

- [ ] Test successful CI run
  - [ ] Trigger CI pipeline manually
  - [ ] Complete successfully
  - [ ] Verify Slack message appears
  - [ ] Check message formatting
  - [ ] Verify buttons work

- [ ] Test failed CI run
  - [ ] Create branch that fails tests
  - [ ] Trigger CI pipeline
  - [ ] Verify Slack notification sent
  - [ ] Check error details in message
  - [ ] Verify Notion status updated to "Testing Failed"

- [ ] Test message formatting
  - [ ] Verify all fields present
  - [ ] Check colors (green/red)
  - [ ] Test button interactions

- [ ] Test concurrent notifications
  - [ ] Trigger multiple CI pipelines simultaneously
  - [ ] Verify all Slack messages sent
  - [ ] Check message ordering and completeness

**Owner:** Frontend/UX Team
**Timeline:** Days 13-18

---

## Workflow 4: Research Stage Completion Sync

### Setup Phase

- [ ] Create Notion database for Research Projects
  - [ ] Database name: "Research Projects"
  - [ ] Properties created (see schema in main plan)
  - [ ] Database ID stored in `.env` as `NOTION_DATABASE_PROJECTS`

- [ ] Prepare orchestrator webhook endpoint
  - [ ] Endpoint created: `/api/n8n/webhook/stage-completion`
  - [ ] Receives stage completion events from research pipeline
  - [ ] Validates payload format
  - [ ] Forwards to n8n workflow

- [ ] Configure S3 or storage for artifact archival
  - [ ] S3 bucket created: `researchflow-artifact-archive`
  - [ ] IAM role configured with put/list permissions
  - [ ] Bucket versioning enabled (optional)
  - [ ] Lifecycle policy set to archive to Glacier after 90 days

### N8N Workflow Creation

- [ ] Create new workflow in n8n
  - [ ] Name: `workflow-stage-completion-sync`
  - [ ] Description: "Sync research workflow stage completions to Notion and archives"
  - [ ] Active: Yes

- [ ] Add webhook trigger node
  - [ ] Type: HTTP webhook trigger
  - [ ] Listen on path: `/stage-completion`
  - [ ] Methods: POST
  - [ ] Validates payload schema

- [ ] Add stage data extraction
  - [ ] Node name: "Extract Stage Data"
  - [ ] Maps webhook payload fields
  - [ ] Handles variable output schemas

- [ ] Add Notion project update
  - [ ] Node name: "Update Notion Project"
  - [ ] Looks up project by projectId
  - [ ] Updates:
    - [ ] Current Stage
    - [ ] Stage Status: "Completed"
    - [ ] Completion %
    - [ ] Stage Output URL
    - [ ] Metrics (JSON)

- [ ] Add artifact archival node
  - [ ] Node name: "Archive Artifacts"
  - [ ] Type: AWS S3 or cloud storage
  - [ ] Destination: `s3://bucket/proj-{projectId}/stage-{stageId}/`
  - [ ] Create manifest file with metadata

- [ ] Add analytics event
  - [ ] Node name: "Track Stage Completion"
  - [ ] Event type: `stage_completed`
  - [ ] Properties: project_id, stage_id, duration, tokens_used, cost

- [ ] Add downstream trigger
  - [ ] Node name: "Check Next Stage Ready"
  - [ ] Queries Notion for prerequisites
  - [ ] IF prerequisites met, execute next stage workflow
  - [ ] ELSE, just log completion

- [ ] Add notification
  - [ ] Node name: "Notify Team"
  - [ ] Sends Slack notification (optional)
  - [ ] Or email to project stakeholders

### Testing

- [ ] Test stage completion webhook
  - [ ] Craft test payload with all required fields
  - [ ] Send to `/api/n8n/webhook/stage-completion`
  - [ ] Verify Notion project updated
  - [ ] Check all fields populated correctly

- [ ] Test artifact archival
  - [ ] Include sample artifacts in test payload
  - [ ] Verify files archived to S3
  - [ ] Check manifest file created
  - [ ] Verify metadata complete

- [ ] Test with multiple stages
  - [ ] Complete stage 1
  - [ ] Verify stage 2 triggered (if prerequisites met)
  - [ ] Verify stage 2 skipped (if prerequisites not met)

- [ ] Test large payloads
  - [ ] Include large artifact counts
  - [ ] Include long text outputs
  - [ ] Verify no timeouts
  - [ ] Check S3 upload completes

- [ ] Test error scenarios
  - [ ] Invalid projectId (should fail gracefully)
  - [ ] Missing required fields (should return error)
  - [ ] S3 unavailable (should retry)

**Owner:** Data Team
**Timeline:** Days 19-24

---

## Integration & End-to-End Testing

### Smoke Tests

- [ ] All 4 workflows present in n8n
- [ ] All workflows are "Active"
- [ ] All webhook endpoints responding
- [ ] All environment variables set correctly

### Integration Tests

- [ ] Complete GitHub → Notion → CI flow
  - [ ] Create GitHub issue
  - [ ] Verify synced to Notion
  - [ ] Change status to "Ready for Testing"
  - [ ] Verify CI triggered
  - [ ] Verify CI completion notification sent
  - [ ] Verify Notion updated with results

- [ ] Verify no data loss
  - [ ] Test with concurrent operations
  - [ ] Verify no duplicate tasks created
  - [ ] Check data consistency across systems

- [ ] Verify error recovery
  - [ ] Simulate network interruptions
  - [ ] Verify workflows retry
  - [ ] Check error logs comprehensive

### Performance Tests

- [ ] Measure workflow execution times
  - [ ] GitHub → Notion: Target < 30s
  - [ ] Notion → CI: Target < 60s
  - [ ] CI → Slack: Target < 10s
  - [ ] Stage completion: Target < 5s

- [ ] Measure throughput
  - [ ] 100 concurrent GitHub webhook calls
  - [ ] Verify success rate > 99%
  - [ ] Monitor error rates

- [ ] Monitor resource usage
  - [ ] Check n8n CPU/memory
  - [ ] Monitor API rate limits
  - [ ] Check database query performance

### Security Tests

- [ ] Verify webhook signature validation
- [ ] Test token expiration handling
- [ ] Verify no secrets in logs
- [ ] Test rate limiting
- [ ] Verify HTTPS only

**Owner:** QA Team
**Timeline:** Days 25-28

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All workflows tested and passing
- [ ] Documentation complete and reviewed
- [ ] Team trained on operations
- [ ] Monitoring dashboards created
- [ ] Alerting rules configured
- [ ] Incident response procedures documented

### Deployment Steps

- [ ] Backup n8n configuration
  - [ ] Export all workflows
  - [ ] Export credentials
  - [ ] Store in secure repository

- [ ] Monitor initial rollout
  - [ ] Watch logs for errors
  - [ ] Monitor webhook response times
  - [ ] Check success rates

- [ ] Gradual activation (optional)
  - [ ] Start with 10% of events
  - [ ] Monitor for 24 hours
  - [ ] Increase to 50%
  - [ ] Monitor for 24 hours
  - [ ] Increase to 100%

- [ ] Verify all integrations working
  - [ ] GitHub issues syncing
  - [ ] Notion tasks updating
  - [ ] CI pipelines triggering
  - [ ] Slack notifications sending
  - [ ] Stage completions syncing

### Post-Deployment

- [ ] Announce to team
- [ ] Monitor for first week
- [ ] Collect feedback
- [ ] Document any issues found
- [ ] Plan next iterations

**Owner:** DevOps Lead
**Timeline:** Day 29

---

## Monitoring & Maintenance

### Daily Tasks

- [ ] Check workflow execution logs
- [ ] Monitor error rates
- [ ] Verify webhook deliveries
- [ ] Check N8N dashboard

### Weekly Tasks

- [ ] Review workflow statistics
- [ ] Check API rate limits usage
- [ ] Review error patterns
- [ ] Update metrics dashboard

### Monthly Tasks

- [ ] Full system health check
- [ ] Performance analysis
- [ ] Token rotation (if applicable)
- [ ] Capacity planning review

---

## Issues & Resolutions Log

| Date | Issue | Resolution | Status |
|------|-------|-----------|--------|
| TBD  | TBD   | TBD       | TBD    |

---

## Approval & Sign-off

**Prepared By:** Engineering Team
**Date:** January 28, 2026

**Approved By:**

- [ ] Engineering Lead: _____________ Date: _______
- [ ] DevOps Lead: _____________ Date: _______
- [ ] Product Manager: _____________ Date: _______
- [ ] Security Team: _____________ Date: _______

---

## Timeline Summary

| Phase | Duration | Dates | Status |
|-------|----------|-------|--------|
| Phase 0: Setup | 2 days | Jan 29-30 | Pending |
| Workflow 1: GitHub Sync | 5 days | Jan 31 - Feb 4 | Pending |
| Workflow 2: CI Trigger | 5 days | Feb 5-9 | Pending |
| Workflow 3: Slack Notify | 6 days | Feb 10-15 | Pending |
| Workflow 4: Stage Sync | 6 days | Feb 16-21 | Pending |
| Testing & QA | 4 days | Feb 22-25 | Pending |
| Deployment | 1 day | Feb 26 | Pending |
| Monitoring | Ongoing | Feb 27+ | Pending |

**Total Timeline:** 4 weeks
**Target Completion:** February 26, 2026

---

**End of Checklist**
