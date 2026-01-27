# Route Mounting Guide - ResearchFlow Orchestrator

**Last Updated**: January 27, 2026
**Status**: Track A & M Complete

---

## Overview

The ResearchFlow orchestrator uses Express.js for route handling. Routes are defined in individual files under `services/orchestrator/src/routes/` and must be explicitly imported and mounted in `services/orchestrator/routes.ts`.

**CRITICAL**: The entry point `services/orchestrator/index.ts` calls `registerRoutes()` from `routes.ts`. Routes added to `services/orchestrator/src/index.ts` will NOT be loaded by Docker.

---

## File Structure

```
services/orchestrator/
├── index.ts                    # Entry point - calls registerRoutes()
├── routes.ts                   # Route registration - ADD NEW ROUTES HERE
├── src/
│   ├── routes/
│   │   ├── manuscripts.ts      # Track M: Manuscript Studio CRUD
│   │   ├── manuscript-branches.ts
│   │   ├── manuscript-generation.ts
│   │   ├── comments.ts
│   │   ├── topics.ts
│   │   ├── governance.ts
│   │   └── ... (other routes)
│   └── services/
│       ├── phi-protection.ts   # PHI scanning service
│       └── ... (other services)
```

---

## How to Add a New Route

### Step 1: Create Route File

Create `services/orchestrator/src/routes/your-feature.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

// Health check
router.get('/ping', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'your-feature' });
});

// CRUD operations...

export default router;
```

### Step 2: Import in routes.ts

Add import near other route imports (around line 108-120):

```typescript
// In services/orchestrator/routes.ts
import yourFeatureRouter from "./src/routes/your-feature";
```

### Step 3: Mount in registerRoutes()

Add `app.use()` call inside the `registerRoutes()` function:

```typescript
// In services/orchestrator/routes.ts, inside registerRoutes()
app.use("/api/your-feature", yourFeatureRouter);
```

### Step 4: Restart Docker

```bash
docker compose restart orchestrator
```

### Step 5: Verify

```bash
curl http://localhost:3001/api/your-feature/ping
```

---

## Track M Routes (Manuscript Studio)

### Import Statement (routes.ts line ~110)

```typescript
import manuscriptBranchesRouter from "./src/routes/manuscript-branches";
import manuscriptGenerationRouter from "./src/routes/manuscript-generation";
// Track M: Canonical Manuscript Studio routes
import manuscriptsRouter from "./src/routes/manuscripts";
```

### Mount Statement (routes.ts line ~992)

```typescript
// Manuscript Generation Routes (IMRaD structure, word budgets)
app.use("/api/manuscript", manuscriptGenerationRouter);

// Track M: Canonical Manuscript Studio CRUD API
app.use("/api/manuscripts", manuscriptsRouter);
```

### Endpoints Available

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/manuscripts/ping` | Health check |
| POST | `/api/manuscripts` | Create manuscript |
| GET | `/api/manuscripts` | List manuscripts |
| GET | `/api/manuscripts/:id` | Get manuscript |
| PATCH | `/api/manuscripts/:id` | Update manuscript |
| DELETE | `/api/manuscripts/:id` | Soft delete |
| GET | `/api/manuscripts/:id/sections` | Get sections |
| GET | `/api/manuscripts/:id/doc` | Get latest doc state |
| POST | `/api/manuscripts/:id/doc/save` | Save doc snapshot |
| POST | `/api/manuscripts/:id/sections/:sectionId/generate` | Generate section |
| POST | `/api/manuscripts/:id/sections/:sectionId/refine` | AI refine (diff) |
| POST | `/api/manuscripts/:id/sections/:sectionId/validate` | Validate section |
| POST | `/api/manuscripts/:id/abstract/generate` | Generate abstract |
| GET | `/api/manuscripts/:id/events` | Provenance log |
| GET | `/api/manuscripts/:id/comments` | List comments |
| POST | `/api/manuscripts/:id/comments` | Add comment |
| PATCH | `/api/manuscripts/:id/comments/:commentId` | Update comment |
| POST | `/api/manuscripts/:id/comments/:commentId/resolve` | Resolve comment |

---

## Database Migrations

Migrations are in `migrations/` directory and must be run manually:

```bash
# From project root
cat migrations/003_create_manuscript_tables.sql | docker compose exec -T postgres psql -U ros -d ros
cat migrations/005_manuscript_docs_comments.sql | docker compose exec -T postgres psql -U ros -d ros
```

### Important: User ID Type

The `users` table uses `VARCHAR(255)` for `id`, not UUID. All foreign keys to users must use:

```sql
user_id VARCHAR(255) NOT NULL REFERENCES users(id)
```

---

## PHI Integration

Routes that handle content must scan for PHI in LIVE mode:

```typescript
import { scanForPhi, type PhiDetectionResult } from '../services/phi-protection';

// In route handler
if (isLiveMode()) {
  const phiResult = scanForPhi(contentText);
  if (phiResult.detected) {
    return res.status(400).json({
      error: 'PHI_DETECTED',
      message: 'Content contains PHI.',
      locations: phiResult.identifiers.map((id) => ({
        start: id.position.start,
        end: id.position.end,
        type: id.type,
        // Never return raw PHI value
      })),
    });
  }
}
```

---

## Verification Commands

```bash
# Check if route is mounted
curl -s http://localhost:3001/api/manuscripts/ping

# Check orchestrator health
curl -s http://localhost:3001/health

# View orchestrator logs
docker compose logs orchestrator --tail=50

# Restart orchestrator
docker compose restart orchestrator
```

---

## Common Issues

### Route Returns 404 "Cannot GET"
- Route not imported in `routes.ts`
- Route not mounted with `app.use()`
- Restart Docker after changes

### Route Returns 500
- Database table doesn't exist (run migrations)
- Import path incorrect
- Check orchestrator logs

### Type Mismatch in Migrations
- Users table uses `VARCHAR(255)` for id
- Don't use `UUID` for user foreign keys

---

## Git Commits for Track M

| Commit | Description |
|--------|-------------|
| dc441a3 | fix(Track M): mount manuscripts route and fix migration types |
| b4f3306 | feat(Track M): implement manuscript studio phases M0-M8 |

---

---

**See Also:**
- `docs/UI_WIRING_GUIDE.md` - Frontend routing and component wiring
- `docs/MANUSCRIPT_STUDIO_WIRING_AUDIT.md` - Full audit
- `docs/LOCAL_DEV.md` - Development setup

---

**Track A & M Complete - Ready for Track B**
