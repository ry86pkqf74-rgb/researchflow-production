# ResearchFlow Parallel Execution Plan

## Architecture Decision: Hybrid Deployment

### Recommendation: **Vercel for Frontend + Docker for Backend**

| Component | Platform | Rationale |
|-----------|----------|-----------|
| Frontend (web) | **Vercel** | Instant preview URLs, edge CDN, automatic CI/CD |
| Backend Services | **Docker Compose** | Local dev, service orchestration, database |
| Prototypes | **Replit** | Rapid iteration, burn unused credits |
| Design | **Figma MCP** | Design-to-code pipeline |

### Why Not All Docker?
- Frontend rebuilds are slow in Docker
- No preview URLs for stakeholder review
- Vercel provides automatic HTTPS, CDN, analytics
- Keep Docker for backend where it excels

---

## Parallel Execution Streams

### Stream 1: Frontend Deployment (Vercel)
**Tool**: Vercel CLI / MCP
**Tasks**:
1. Create vercel.json config
2. Configure environment variables
3. Set up API proxy to backend
4. Deploy to Vercel
5. Get preview URL

### Stream 2: Backend Optimization (Docker)
**Tool**: Docker Compose
**Tasks**:
1. Optimize docker-compose for backend-only
2. Add health checks
3. Configure production Redis
4. Set up proper networking

### Stream 3: Testing & Validation (Playwright)
**Tool**: Playwright
**Tasks**:
1. Run e2e tests
2. Generate test reports
3. Validate all integrations
4. Screenshot critical flows

### Stream 4: AI Tool Integration (Mercury/Sourcegraph)
**Tool**: Mercury + Sourcegraph
**Tasks**:
1. Test Mercury autocomplete
2. Verify Sourcegraph codebase search
3. Log usage to Notion
4. Validate cost tracking

### Stream 5: Design System (Figma → Replit)
**Tool**: Figma + Replit
**Tasks**:
1. Extract remaining components
2. Deploy interactive prototype
3. Generate component documentation
4. Burn Replit credits on live demos

---

## Execution Matrix

| Stream | Agent Type | Priority | Dependencies | Est. Time |
|--------|-----------|----------|--------------|-----------|
| 1. Vercel Deploy | general-purpose | P0 | None | 5 min |
| 2. Docker Optimize | Bash | P1 | None | 3 min |
| 3. Playwright Tests | Bash | P1 | Stream 2 | 5 min |
| 4. AI Integration | general-purpose | P2 | None | 3 min |
| 5. Design Prototype | Explore | P2 | None | 5 min |

---

## Environment Configuration

### Vercel Environment Variables
```
VITE_API_URL=http://localhost:3001  # Dev
VITE_API_URL=https://api.researchflow.app  # Prod
VITE_WS_URL=ws://localhost:1235
```

### Docker Backend Services
```yaml
services:
  - orchestrator (port 3001)
  - worker (port 8000)
  - collab (port 1235)
  - guideline-engine (port 8001)
  - postgres (port 5432)
  - redis (port 6379)
```

---

## Success Criteria

- [ ] Frontend deployed to Vercel with preview URL
- [ ] Backend services healthy in Docker
- [ ] Playwright tests passing
- [ ] Mercury/Sourcegraph responding
- [ ] Design prototype live on Replit
- [ ] All usage logged to Notion

---

## Rollback Plan

If Vercel deployment fails:
1. Fall back to Docker Compose for frontend
2. Use `docker-compose up web`
3. Access at http://localhost:5173
