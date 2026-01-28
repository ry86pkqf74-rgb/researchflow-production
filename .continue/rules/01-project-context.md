---
name: Project context
alwaysApply: true
---

# ResearchFlow - Research Automation Platform

## Overview
ResearchFlow is an AI-powered research automation platform designed for clinicians and biologists. It transforms research workflows from data upload to manuscript draft in hours, not months.

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Radix UI
- **Backend Orchestrator**: Node.js + Express + TypeScript
- **Worker Service**: Python + FastAPI
- **Database**: PostgreSQL + Drizzle ORM
- **Cache/Queue**: Redis
- **Real-time**: WebSocket (Collab service)

## Project Structure
```
researchflow-production/
├── services/
│   ├── web/           # React frontend (port 5173)
│   ├── orchestrator/  # Node.js API (port 3001)
│   ├── worker/        # Python worker (port 8000)
│   ├── collab/        # WebSocket service (port 1235)
│   └── guideline-engine/ # Guidelines (port 8001)
├── packages/
│   ├── core/          # Shared types and schemas
│   ├── ai-agents/     # AI agent implementations
│   └── manuscript-engine/ # Document generation
└── docker-compose.yml
```

## Commands
- **Build**: `npm run build` (monorepo)
- **Test**: `npm run test` or `npx vitest run`
- **Lint**: `npm run lint`
- **Dev**: `docker compose up -d`
- **E2E**: `npx playwright test`

## Key Features
- Multi-stage research workflow (Planning → Data Collection → Analysis → Writing → Review)
- AI chat agents for each workflow stage
- PHI-safe processing with LM Studio for sensitive data
- Real-time collaboration
- HIPAA compliance features
