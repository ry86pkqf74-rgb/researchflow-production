# Demo Fixtures Inventory

This document inventories all hardcoded/demo data in the orchestrator routes that need DB-backing for production.

**Generated:** 2026-01-27
**Audit by:** Claude Coworker

---

## Summary

| Category | Count | Priority |
|----------|-------|----------|
| Mock Datasets | 1 | HIGH |
| Demo Scans | 1 | HIGH |
| Sustainability Metrics | 4 | MEDIUM |
| Custom Fields | 1 | MEDIUM |
| Ecosystem/Manuscript | 1 | MEDIUM |
| User Fallbacks | 5 | LOW |

---

## HIGH Priority Fixtures

### 1. Mock Datasets (datasets.ts)

**File:** `services/orchestrator/src/routes/datasets.ts:27-98`

**Endpoint:** `GET /api/datasets`, `POST /api/datasets`, `DELETE /api/datasets/:id`

**Mock Data:** In-memory array `mockDatasets` containing sample dataset metadata.

**Issue:** All dataset operations use in-memory array instead of database.

**Required Schema:**
```sql
-- Already exists in migrations, but routes don't use DB
-- Verify datasets table is being used instead of mockDatasets array
SELECT * FROM datasets;
```

**Fix Required:**
- Replace `mockDatasets` array with Drizzle ORM queries to `datasets` table
- Ensure uploads persist to database, not just memory


### 2. PHI Scan Store (phi-scanner.ts)

**File:** `services/orchestrator/src/routes/phi-scanner.ts:106`

**Endpoint:** `POST /api/phi/scan`, `GET /api/phi/scans/:id`

**Mock Data:** Line 106 - "In-memory store for demo (would be database in production)"

**Issue:** PHI scan results are stored in memory, lost on restart.

**Required Schema:**
```sql
CREATE TABLE IF NOT EXISTS phi_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id),
  research_id UUID REFERENCES research_projects(id),
  user_id UUID REFERENCES users(id),
  findings JSONB NOT NULL DEFAULT '[]',
  findings_count INTEGER DEFAULT 0,
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  governance_mode VARCHAR(20) NOT NULL,
  scanned_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_phi_scans_file ON phi_scans(file_id);
CREATE INDEX idx_phi_scans_research ON phi_scans(research_id);
```

**Fix Required:**
- Create `phi_scans` table migration
- Replace in-memory Map with database persistence
- Index by file_id for quick lookups

---

## MEDIUM Priority Fixtures

### 3. Sustainability Metrics (sustainability.ts)

**File:** `services/orchestrator/src/routes/sustainability.ts:68-227`

**Endpoints:**
- `GET /api/sustainability/metrics` (line 68-69)
- `GET /api/sustainability/history` (line 96)
- `GET /api/sustainability/comparison` (line 135)
- `GET /api/sustainability/goals` (line 195)

**Mock Data:** `generateMockMetrics()` function returns fabricated carbon/energy data.

**Issue:** All sustainability endpoints return hardcoded mock data.

**Required Schema:**
```sql
CREATE TABLE IF NOT EXISTS sustainability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  carbon_kg DECIMAL(10,4),
  energy_kwh DECIMAL(10,4),
  water_liters DECIMAL(10,4),
  compute_hours DECIMAL(10,2),
  model_tier VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sustainability_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  metric_type VARCHAR(50) NOT NULL,
  target_value DECIMAL(10,4),
  current_value DECIMAL(10,4),
  deadline DATE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Fix Required:**
- Create metrics collection system (track per-request carbon/energy)
- Store aggregated metrics in database
- Replace mock functions with real queries


### 4. Custom Fields Placeholder (custom-fields.ts)

**File:** `services/orchestrator/src/routes/custom-fields.ts:213`

**Endpoint:** `GET /api/custom-fields/:id/values`

**Mock Data:** Returns "placeholder" response.

**Issue:** Custom field value retrieval not implemented.

**Required Schema:**
```sql
-- custom_field_values table should exist
-- Verify and implement actual value retrieval
```


### 5. Ecosystem Mock Manuscript (ecosystemIntegrations.ts)

**File:** `services/orchestrator/src/routes/ecosystemIntegrations.ts:62`

**Endpoint:** `POST /api/ecosystem/export`

**Mock Data:** `getMockManuscript()` returns fake manuscript data.

**Issue:** Export uses mock manuscript instead of real data.

**Fix Required:**
- Replace `getMockManuscript()` with actual manuscript query
- Fetch from manuscripts table using manuscriptId

---

## LOW Priority Fixtures (User Fallbacks)

These use `'demo-user'` as fallback when no authenticated user - acceptable for demo mode but should be addressed for LIVE mode enforcement.

### 6. Tutorial Sandbox (tutorialSandbox.ts)

**Lines:** 114, 145, 160, 175

**Pattern:** `const userId = (req as any).userId ?? 'demo-user'`

**Issue:** Allows unauthenticated operations with demo-user fallback.

**Fix:** Enforce authentication in LIVE mode, reject if no userId.


### 7. API Keys (apiKeys.ts)

**Lines:** 33, 66, 81, 98, 148, 179, 215

**Pattern:** `const userId = (req as any).userId ?? 'demo-user'`

**Issue:** API key operations can proceed without real user.

**Fix:** Require authenticated user for all API key operations.

---

## Governance Mode Guards (Working Correctly)

These files properly use mode guards to block operations in DEMO mode:

- `export-bundle.ts` - Uses `blockExportInDemo` middleware
- `datasets.ts` - Uses `blockDataUploadInDemo` middleware
- `sap.ts` - Uses `blockAIInDemo` middleware
- `research-brief.ts` - Uses `blockAIInDemo` middleware

These are **working as intended** and don't need changes.

---

## Recommended Implementation Order

1. **HIGH: PHI Scans** - Security-critical, needs DB persistence
2. **HIGH: Datasets** - Core functionality, already has table
3. **MEDIUM: Ecosystem Manuscript** - Export functionality broken
4. **MEDIUM: Custom Fields** - Feature incomplete
5. **MEDIUM: Sustainability** - Nice-to-have for carbon tracking
6. **LOW: User Fallbacks** - Clean up after auth is solid

---

## Migration File Created

See `migrations/004_demo_fixtures_tables.sql` for placeholder schema.
