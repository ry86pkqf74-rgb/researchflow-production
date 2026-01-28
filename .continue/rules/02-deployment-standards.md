---
name: Deployment standards
alwaysApply: true
---

# ResearchFlow Deployment Standards

## Deployment Architecture
- **Local Dev**: Docker Compose (all services)
- **Frontend Production**: Vercel (React + Vite)
- **Backend Production**: Docker containers on cloud VM
- **CI/CD**: GitHub Actions → Notion status updates

## Security Requirements
- NO secrets committed to git (use .env + .env.example)
- All API keys in environment variables
- Redis must have authentication enabled
- JWT secrets must be strong (32+ chars) in production
- PHI scanning enabled for all AI outputs

## Service Health Requirements
Each service MUST have:
- `/health` endpoint returning JSON `{"status": "healthy", ...}`
- Structured logging (JSON format)
- Graceful shutdown handling
- Clear start command in Dockerfile

## CI Pipeline
When `Status` = "Queue CI" in Notion Engineering Tasks:
1. Webhook triggers GitHub Actions
2. Run tests + lint
3. Build Docker images
4. Update Notion with results (Pass/Fail)
5. Deploy to staging if passed

## Notion Integration
- Engineering Tasks DB tracks all CI runs
- Integration Matrix DB tracks service health
- All deployments logged with run URL

## Environment Variables Required
```
# AI Providers
OPENAI_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY, MERCURY_API_KEY

# Database
DATABASE_URL, REDIS_URL, REDIS_PASSWORD

# Auth
JWT_SECRET, CLIENT_URL

# Integrations
NOTION_API_KEY, FIGMA_API_KEY, SOURCEGRAPH_API_KEY
```

## If You Change Deployment Files
1. Update docker-compose.yml health checks
2. Update DEPLOYMENT.md with exact steps
3. Add/adjust GitHub Actions workflows
4. Verify all services start correctly
