# ResearchFlow Comprehensive Multi-Workstream Execution Plan

## Overview
This document outlines the parallel execution strategy for making the ResearchFlow workflow fully operable.

## Active Workstreams

### 1. Figma/Replit Design System (Background)
**Status:** Continuous background work
**Agent:** Design System Agent
**Tasks:**
- Extract additional components from Figma Dev Mode
- Create Replit prototypes for new components
- Sync design tokens with codebase
- Generate responsive variants

### 2. Vercel Frontend Deployment
**Status:** Active
**Agent:** Vercel Deployment Agent
**Tasks:**
- Complete Vercel authentication
- Configure environment variables
- Set up API proxy to backend
- Deploy and verify frontend
- Configure custom domain (optional)

### 3. Chat Model Integration (All 20 Stages)
**Status:** Active
**Agent:** Chat Integration Agent
**Tasks:**
- Implement stage-specific AI agent types
- Configure context passing for each stage
- Add persistent chat history
- Enable action proposals/approvals
- Test DEMO and LIVE modes

### 4. User Frontend Assessment & Planning
**Status:** Active
**Agent:** UX Assessment Agent
**Tasks:**
- Audit current UI/UX
- Identify missing user flows
- Document accessibility gaps
- Propose improvement roadmap
- Create user testing checklist

### 5. Manuscript Ideation Implementation
**Status:** Active
**Agent:** Manuscript Ideation Agent
**Phases:**
1. Shared Zod schemas
2. Reusable ManuscriptIdeationPanel
3. Demo endpoint (/api/demo/generate-proposals)
4. Live endpoints with persistence
5. Worker LLM generation
6. Workflow stage integration
7. Docker configuration
8. Integration testing

## Execution Timeline

```
T+0min   ────────────────────────────────────────────────────────────────────
         │ All agents spawned in parallel
         │
T+5min   ────────────────────────────────────────────────────────────────────
         │ Manuscript Ideation: Phase 1 (Zod schemas) ✓
         │ Vercel: Auth complete
         │ Chat: Stage mapping complete
         │
T+15min  ────────────────────────────────────────────────────────────────────
         │ Manuscript Ideation: Phase 2 (ManuscriptIdeationPanel) ✓
         │ Vercel: Deployed to preview
         │ Chat: Stages 1-5 integrated
         │ UX: Audit complete
         │
T+30min  ────────────────────────────────────────────────────────────────────
         │ Manuscript Ideation: Phase 3-4 (Endpoints) ✓
         │ Vercel: Production deployment
         │ Chat: Stages 6-10 integrated
         │ Figma: New components extracted
         │
T+45min  ────────────────────────────────────────────────────────────────────
         │ Manuscript Ideation: Phase 5-6 (Worker + Stage) ✓
         │ Chat: All 20 stages integrated
         │ UX: Recommendations documented
         │
T+60min  ────────────────────────────────────────────────────────────────────
         │ Manuscript Ideation: Phase 7-8 (Testing) ✓
         │ All workstreams complete
         │ Integration verification
```

## Notion Integration

All tasks logged to:
- **Database:** Engineering Tasks
- **Status Tracking:** ⚪ Pending → 🟡 In Progress → 🟢 Complete
- **CI Pipeline:** Webhook triggers on status change

## Acceptance Criteria

1. **Workflow Operability**
   - All 20 stages execute with proper input passing
   - State persists between sessions
   - DEMO and LIVE modes both functional

2. **Chat Agents**
   - Stage-aware agent types (IRB, Analysis, Manuscript)
   - Action proposals working
   - History persistence

3. **Manuscript Ideation**
   - Demo mode generates stub proposals
   - Live mode generates real LLM proposals
   - Selection persists for downstream stages
   - Refine functionality works

4. **Deployment**
   - Vercel frontend accessible
   - Docker backend healthy
   - All endpoints responding

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Agent timeout | Checkpoint after each phase |
| API rate limits | Use Mercury for fast ops, Claude for complex |
| State conflicts | Sequential commits per workstream |
| LLM failures | Fallback to stub data in demo mode |
