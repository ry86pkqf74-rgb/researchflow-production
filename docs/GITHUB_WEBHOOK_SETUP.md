# GitHub Webhook Setup for n8n Integration

This document provides instructions for setting up a GitHub webhook to connect the researchflow-production repository to n8n.

## Webhook Configuration Details

- **Repository**: `ry86pkqf74-rgb/researchflow-production`
- **n8n Webhook URL**: `https://loganglosser13.app.n8n.cloud/webhook/github-events`
- **Events**: push, issues, pull_request
- **Content Type**: application/json

## Option 1: Automated Setup with curl

Use this script to create the webhook programmatically via the GitHub API.

### Prerequisites

1. A GitHub Personal Access Token with `admin:repo_hook` scope
2. `curl` command-line tool installed
3. The token saved as an environment variable (or replace `$GITHUB_TOKEN` in the script)

### Generate a Personal Access Token

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Set the following:
   - **Token name**: `n8n-webhook-setup`
   - **Expiration**: Select appropriate expiration (e.g., 90 days or custom)
   - **Scopes**: Check `admin:repo_hook` and `repo` (full control of private repositories)
4. Click "Generate token"
5. Copy the token immediately (you won't see it again)

### Set Environment Variable

```bash
export GITHUB_TOKEN="your_personal_access_token_here"
```

### Run the Webhook Setup Script

Create a file `setup-webhook.sh`:

```bash
#!/bin/bash

# GitHub Webhook Setup Script for n8n Integration

# Configuration
REPO_OWNER="ry86pkqf74-rgb"
REPO_NAME="researchflow-production"
WEBHOOK_URL="https://loganglosser13.app.n8n.cloud/webhook/github-events"
GITHUB_TOKEN="${GITHUB_TOKEN}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GITHUB_TOKEN environment variable is not set${NC}"
    echo "Please set it with: export GITHUB_TOKEN='your_token_here'"
    exit 1
fi

echo -e "${YELLOW}Starting GitHub Webhook Setup${NC}"
echo "Repository: $REPO_OWNER/$REPO_NAME"
echo "Webhook URL: $WEBHOOK_URL"
echo ""

# Create webhook via GitHub API
echo -e "${YELLOW}Creating webhook...${NC}"

RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "name": "web",
    "active": true,
    "events": ["push", "issues", "pull_request"],
    "config": {
      "url": "'"$WEBHOOK_URL"'",
      "content_type": "json",
      "insecure_ssl": "0"
    }
  }' \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/hooks")

# Check if webhook was created successfully
if echo "$RESPONSE" | grep -q '"id"'; then
    HOOK_ID=$(echo "$RESPONSE" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
    echo -e "${GREEN}✓ Webhook created successfully!${NC}"
    echo "Webhook ID: $HOOK_ID"
    echo ""
    echo "Webhook Details:"
    echo "  - URL: $WEBHOOK_URL"
    echo "  - Events: push, issues, pull_request"
    echo "  - Content Type: application/json"
    echo "  - Status: Active"
    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
    exit 0
else
    echo -e "${RED}Error creating webhook${NC}"
    echo "Response:"
    echo "$RESPONSE" | head -20
    exit 1
fi
```

### Execute the Script

```bash
chmod +x setup-webhook.sh
./setup-webhook.sh
```

### Direct curl Command

If you prefer to run it directly without a script:

```bash
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{
    "name": "web",
    "active": true,
    "events": ["push", "issues", "pull_request"],
    "config": {
      "url": "https://loganglosser13.app.n8n.cloud/webhook/github-events",
      "content_type": "json",
      "insecure_ssl": "0"
    }
  }' \
  "https://api.github.com/repos/ry86pkqf74-rgb/researchflow-production/hooks"
```

Replace `$GITHUB_TOKEN` with your actual personal access token.

## Option 2: Manual Setup via GitHub Web UI

Follow these steps to create the webhook manually through GitHub's web interface:

### Steps

1. **Navigate to Repository Settings**
   - Go to: https://github.com/ry86pkqf74-rgb/researchflow-production
   - Click the "Settings" tab

2. **Access Webhooks**
   - In the left sidebar, click "Webhooks"
   - Click the green "Add webhook" button

3. **Configure Webhook**
   - **Payload URL**: `https://loganglosser13.app.n8n.cloud/webhook/github-events`
   - **Content type**: Select "application/json"
   - **Secret**: Leave empty (unless n8n requires one)
   - **SSL verification**: Keep "Enable SSL verification" checked (recommended)

4. **Select Events**
   - Choose "Let me select individual events"
   - Check the following events:
     - ✓ Push
     - ✓ Issues
     - ✓ Pull requests

5. **Activate Webhook**
   - Ensure "Active" checkbox is checked (should be by default)
   - Click "Add webhook" to create

### Verification

After creating the webhook:

1. You should see it listed under "Webhooks" in Settings
2. Click on the webhook to view delivery history
3. Test by pushing a change to the repository
4. Check Recent Deliveries to see the webhook trigger

## Webhook Payload Format

The webhook will send JSON payloads with the following structure for different event types:

### Push Event
```json
{
  "ref": "refs/heads/main",
  "before": "abc123...",
  "after": "def456...",
  "repository": {
    "id": 123456,
    "name": "researchflow-production",
    "full_name": "ry86pkqf74-rgb/researchflow-production"
  },
  "pusher": {
    "name": "username",
    "email": "user@example.com"
  },
  "commits": [
    {
      "id": "abc123...",
      "message": "Commit message",
      "timestamp": "2024-01-28T12:00:00Z",
      "author": {
        "name": "Author Name",
        "email": "author@example.com"
      }
    }
  ]
}
```

### Issues Event
```json
{
  "action": "opened|closed|edited",
  "issue": {
    "number": 123,
    "title": "Issue title",
    "body": "Issue description",
    "state": "open|closed"
  },
  "repository": {
    "name": "researchflow-production",
    "full_name": "ry86pkqf74-rgb/researchflow-production"
  }
}
```

### Pull Request Event
```json
{
  "action": "opened|closed|synchronize|edited",
  "pull_request": {
    "number": 456,
    "title": "PR title",
    "body": "PR description",
    "state": "open|closed",
    "head": {
      "ref": "feature-branch",
      "sha": "abc123..."
    },
    "base": {
      "ref": "main",
      "sha": "def456..."
    }
  },
  "repository": {
    "name": "researchflow-production",
    "full_name": "ry86pkqf74-rgb/researchflow-production"
  }
}
```

## Testing the Webhook

### Test via GitHub UI

1. Navigate to the webhook in Settings → Webhooks
2. Click on the webhook to view details
3. Scroll down to "Recent Deliveries"
4. Click the "Redeliver" button on any past delivery to test
5. Check the "Response" tab to see if n8n received the payload

### Test via curl

Make a test push to the repository:

```bash
git commit --allow-empty -m "Test webhook trigger"
git push origin main
```

Then check the webhook delivery history in GitHub Settings.

## Troubleshooting

### Webhook Not Triggering

1. **Check webhook status in GitHub**
   - Settings → Webhooks → Click on the webhook
   - Review "Recent Deliveries" for errors
   - Check the HTTP response status code

2. **Verify n8n webhook is active**
   - Log into n8n
   - Confirm the workflow with the webhook trigger is active
   - Check n8n logs for any errors

3. **Check network connectivity**
   - Ensure n8n URL is accessible from GitHub
   - Try accessing the URL directly in a browser: `https://loganglosser13.app.n8n.cloud/webhook/github-events`

### 404 or Connection Errors

- Verify the webhook URL is correct and accessible
- Check that the n8n instance is running
- Ensure there are no firewall rules blocking GitHub's IP addresses

### Webhook Receiving Wrong Event Type

- Review the webhook configuration in GitHub Settings
- Ensure correct events are selected (push, issues, pull_request)
- Check n8n workflow is configured to handle the correct event types

## Deleting the Webhook

If you need to remove the webhook:

### Via GitHub UI
1. Go to Settings → Webhooks
2. Click on the webhook to view details
3. Click the red "Delete" button at the bottom

### Via curl
```bash
curl -X DELETE \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/ry86pkqf74-rgb/researchflow-production/hooks/HOOK_ID"
```

Replace `HOOK_ID` with the actual webhook ID (visible in GitHub Settings).

## Security Considerations

1. **Token Security**
   - Never commit tokens to version control
   - Use environment variables or secure secret management
   - Rotate tokens periodically
   - Use minimal scopes (only `admin:repo_hook` is needed)

2. **Webhook Validation**
   - GitHub can send a signature header (`X-Hub-Signature-256`)
   - Validate webhook payloads in n8n to ensure they're from GitHub
   - Configure n8n to verify GitHub signatures if available

3. **Payload Data**
   - Be cautious with sensitive information in commit messages or PR descriptions
   - Don't log full payloads without sanitizing
   - Restrict access to webhook logs

## References

- GitHub Webhooks Documentation: https://docs.github.com/en/developers/webhooks-and-events/webhooks
- GitHub API - Create a Repository Webhook: https://docs.github.com/en/rest/webhooks/repos
- n8n Documentation: https://docs.n8n.io/
