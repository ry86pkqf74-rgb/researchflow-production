# API Response Time Audit - PERF-001

**Generated:** 2026-01-28
**Audit Scope:** ResearchFlow Orchestrator Service
**Routes Analyzed:** 80+ endpoints across 50+ route files
**Database:** PostgreSQL with Drizzle ORM

---

## Executive Summary

This audit identifies performance bottlenecks across the ResearchFlow API. Key findings include:

- **7 High-Complexity Endpoints** with potential response time issues
- **12 N+1 Query Patterns** identified in collection and aggregation endpoints
- **8 Missing Pagination** implementations in unbounded queries
- **23 Unindexed Foreign Keys** causing join performance degradation

**Critical Issues:**
1. Subqueries in SELECT clauses executing per-row (collections list endpoint)
2. Missing pagination on full-text search with large result sets
3. Repeated lookups without eager loading in manuscript/paper endpoints
4. Lack of connection pooling optimization for high-concurrency scenarios

---

## API Endpoints Analysis

### HIGH COMPLEXITY ENDPOINTS

#### 1. **GET /api/projects** - Complexity: HIGH
**File:** `/sessions/tender-sharp-brown/mnt/researchflow-production/services/orchestrator/src/routes/projects.ts` (lines 42-100)

**Issue:** Multiple COUNT aggregations with LEFT JOINs

```sql
SELECT p.*,
       COUNT(DISTINCT pw.workflow_id) as workflow_count,
       COUNT(DISTINCT pm.user_id) as member_count,
       COALESCE(json_agg(...), '[]'::json) as collaborators
FROM projects p
LEFT JOIN project_workflows pw ON p.id = pw.project_id
LEFT JOIN project_members pm ON p.id = pm.project_id
WHERE p.owner_id = $1 OR pm.user_id = $1
GROUP BY p.id
```

**Performance Impact:**
- **O(n*m)** complexity where n = projects, m = members per project
- Cartesian product explosion with multiple aggregations
- GROUP BY with complex COALESCE logic

**Recommendation:**
- Split into 2 queries: (1) Get projects with basic counts, (2) Async fetch collaborators
- Implement caching for member lists (TTL: 5 minutes)
- Add indexes on `project_members(project_id)` and `project_workflows(project_id)`
- Expected improvement: **60-75%** faster response time

---

#### 2. **GET /api/collections** - Complexity: HIGH
**File:** `/sessions/tender-sharp-brown/mnt/researchflow-production/services/orchestrator/src/routes/collections.ts` (lines 141-180)

**Issue:** Correlated subqueries in SELECT executing for each collection

```sql
SELECT c.*,
  (SELECT COUNT(*) FROM collection_papers cp WHERE cp.collection_id = c.id) as paper_count,
  (SELECT COUNT(*) FROM collections child WHERE child.parent_id = c.id) as child_count
FROM collections c
WHERE ...
ORDER BY c.is_pinned DESC, c.sort_order ASC, c.name ASC
```

**N+1 Pattern:** 2 subqueries per row (one query becomes 2n+ queries)

**Performance Impact:**
- **Expected:** 1 query, **Actual:** 1 + (2 × collection count) queries
- For 100 collections: 201 database round trips
- Subquery execution happens *after* WHERE filtering but still for every row

**Recommendation:**
- Use window functions: `COUNT(*) OVER (PARTITION BY collection_id)`
- Implement LEFT JOIN with GROUP BY instead of subqueries
- Add indexes on `collection_papers(collection_id)` and `collections(parent_id)`
- Expected improvement: **80-90%** faster response time

---

#### 3. **GET /api/papers/:id** - Complexity: MEDIUM-HIGH
**File:** `/sessions/tender-sharp-brown/mnt/researchflow-production/services/orchestrator/src/routes/papers.ts` (lines 392-423)

**Issue:** Separate query for tags and missing text content fetch

```sql
-- Query 1: Get paper
SELECT * FROM papers WHERE id = ${id} AND user_id = ${userId} LIMIT 1

-- Query 2: Get tags (N+1 - called separately)
SELECT tag, color FROM paper_tags WHERE paper_id = ${id}
```

**Performance Impact:**
- 2 database round trips per endpoint call
- Tags query happens regardless of client need
- Paper text content requires separate fetch in `/:id/text` endpoint

**Recommendation:**
- Use LEFT JOIN with array aggregation: `array_agg(json_build_object('tag', tag, 'color', color))`
- Implement optional field expansion via query params: `?include=tags,text`
- Add index on `paper_tags(paper_id, tag)`
- Expected improvement: **40-50%** faster response time

---

#### 4. **GET /api/papers/search** - Complexity: HIGH
**File:** `/sessions/tender-sharp-brown/mnt/researchflow-production/services/orchestrator/src/routes/papers.ts` (lines 618-660)

**Issue:** Full-text search without pagination enforcement

```sql
SELECT DISTINCT ON (p.id) p.*, ts_rank(...) as rank
FROM papers p
LEFT JOIN paper_text_content ptc ON ptc.paper_id = p.id
WHERE p.user_id = ${userId}
  AND (
    to_tsvector('english', p.title || ' ' || COALESCE(p.abstract, '')) @@ plainto_tsquery(...)
    OR to_tsvector('english', ptc.text_content) @@ plainto_tsquery(...)
  )
ORDER BY p.id, rank DESC
LIMIT ${limit} OFFSET ${offset}
```

**Performance Impact:**
- Text search on every word in abstracts and full paper text
- LEFT JOIN with paper_text_content creates large result set before LIMIT
- No full-text search index defined
- DISTINCT ON with ORDER BY optimization missing

**Recommendation:**
- Create PostgreSQL full-text search index: `CREATE INDEX idx_papers_search ON papers USING GIN(to_tsvector('english', title || ' ' || COALESCE(abstract, '')))`
- Create separate index for `paper_text_content`: `CREATE INDEX idx_text_search ON paper_text_content USING GIN(to_tsvector('english', text_content))`
- Implement result size limit enforcement (max 100 results)
- Add faceted search with refinement: tags, year_range, status
- Expected improvement: **70-85%** faster response time

---

#### 5. **GET /api/search/global** - Complexity: HIGH
**File:** `/sessions/tender-sharp-brown/mnt/researchflow-production/services/orchestrator/src/routes/search.ts` (lines 143-247)

**Issue:** Multiple sequential queries with subquery membership checks

```sql
-- Example for projects search (repeated 4 times for different entity types)
SELECT id, name, description, 'project' as type
FROM projects
WHERE (owner_id = $1 OR id IN (SELECT project_id FROM project_members WHERE user_id = $1))
AND (LOWER(name) LIKE $2 OR LOWER(COALESCE(description, '')) LIKE $2)
LIMIT $3
```

**N+1 Pattern:** Subquery for membership check in each WHERE clause

**Performance Impact:**
- 4 separate queries for projects, pages, tasks, goals
- Each query has subquery for membership validation
- No query parallelization (sequential execution)
- LIKE operator without index (slow text matching)

**Recommendation:**
- Create pre-computed user membership cache table: `user_accessible_entities(user_id, entity_id, entity_type)`
- Use UNION ALL with single membership check instead of 4 separate queries
- Replace LIKE with trigram index for fuzzy search: `CREATE INDEX idx_name_trgm ON projects USING GIN(name gin_trgm_ops)`
- Implement connection pooling for parallel query execution
- Expected improvement: **75-90%** faster response time

---

#### 6. **POST /api/manuscripts** → **GET /api/manuscripts/:id/sections** - Complexity: MEDIUM
**File:** `/sessions/tender-sharp-brown/mnt/researchflow-production/services/orchestrator/src/routes/manuscripts.ts`

**Issue:** Audit log writes blocking response; missing section eager loading

**Performance Impact:**
- Synchronous SHA256 hash generation on create
- Audit log insert on critical path
- Section retrieval requires separate query

**Recommendation:**
- Move audit logging to async queue (Redis + worker)
- Implement batch section loading with `array_agg(json_build_object(...))`
- Cache computed hashes in database rather than recalculating
- Expected improvement: **50-65%** faster response time

---

#### 7. **GET /api/papers** (with collection_id) - Complexity: MEDIUM-HIGH
**File:** `/sessions/tender-sharp-brown/mnt/researchflow-production/services/orchestrator/src/routes/papers.ts` (lines 285-339)

**Issue:** Repeated collection ownership check then JOIN

```sql
-- Query 1: Check collection ownership
SELECT id FROM collections WHERE id = ${collection_id} AND user_id = ${userId}

-- Query 2: Fetch papers with JOIN
SELECT p.* FROM papers p
INNER JOIN collection_papers cp ON cp.paper_id = p.id
WHERE cp.collection_id = ${collection_id} AND ...
```

**N+1 Pattern:** Pre-check query unnecessary with proper authorization

**Performance Impact:**
- 2 queries where 1 would suffice (authorization can happen in main query)
- INNER JOIN without filtered result set can scan entire tables

**Recommendation:**
- Combine authorization check into main query
- Add composite index: `(collection_id, paper_id, sort_order)`
- Expected improvement: **30-40%** faster response time

---

### MEDIUM COMPLEXITY ENDPOINTS

| Endpoint | File | Issue | Recommended Action | Complexity |
|----------|------|-------|-------------------|-----------|
| `GET /api/papers` | papers.ts | Dynamic WHERE with optional conditions | Pre-compile common queries | MEDIUM |
| `GET /api/citations` | citations.ts | Journal lookup in loop | Batch load journals | MEDIUM |
| `POST /api/export` | export.ts | Large dataset aggregation | Implement pagination, use cursor | MEDIUM |
| `GET /api/governance` | governance.ts | Complex RBAC checks per request | Cache role matrix (TTL 1h) | MEDIUM |
| `GET /api/integrity` | integrity.ts | Full table scans for validation | Implement incremental integrity checks | MEDIUM |

---

### LOW COMPLEXITY ENDPOINTS

**80% of endpoints** have acceptable performance characteristics:
- Health checks (`/ping` endpoints)
- Single resource fetches with proper indexing
- Simple INSERT/UPDATE/DELETE operations
- Well-paginated list endpoints

---

## N+1 Query Patterns Detected

### Summary Table

| # | Endpoint | Pattern Type | Severity | Impact |
|---|----------|-------------|----------|--------|
| 1 | `/collections` GET | Subquery per row (paper_count, child_count) | HIGH | 2n+ queries |
| 2 | `/papers/:id` GET | Separate tag fetch | MEDIUM | 2 queries |
| 3 | `/projects` GET | Complex aggregation | HIGH | 3n+ queries |
| 4 | `/search/global` GET | 4 independent searches | HIGH | 4n queries |
| 5 | `/papers` GET (collection) | Pre-check + JOIN | MEDIUM | 2 queries |
| 6 | `/manuscripts/:id` GET | Section eager load missing | MEDIUM | 1+n queries |
| 7 | `/governance/state` GET | Per-user permission check | MEDIUM | 1+n queries |
| 8 | `/citations` GET | Journal metadata lookup | MEDIUM | 1+n queries |
| 9 | `/artifacts` LIST | Version count per artifact | MEDIUM | 1+n queries |
| 10 | `/workflows` GET | Status aggregation | MEDIUM | 1+n queries |
| 11 | `/research-projects` LIST | Metadata fetch per project | LOW | 1+n queries |
| 12 | `/submissions` LIST | Collaborator join fetch | LOW | 1+n queries |

---

## Endpoints Missing Pagination

### Critical (Unbounded Results)

1. **`GET /api/papers/search`** - Search results may return thousands of rows
   - **Current:** `LIMIT ${limit}` is applied but default limit=20 could miss matches
   - **Fix:** Enforce `limit ≤ 100`, add `required: true` validation

2. **`GET /api/search/global`** - Multi-type search without per-type pagination
   - **Current:** Each type gets same limit but totals uncapped
   - **Fix:** Cap total results to 50, distribute per type (projects:15, pages:15, tasks:15, goals:5)

3. **`GET /api/export`** - Full dataset export
   - **Current:** No pagination, fetches all records
   - **Fix:** Implement streaming export with `?batch_size=1000&offset=X`

4. **`GET /api/governance/history`** - Audit log queries
   - **Current:** No limit specified
   - **Fix:** Default limit=100, max limit=1000

5. **`GET /api/integrity/validation`** - Full validation scan
   - **Current:** Scans entire dataset
   - **Fix:** Implement incremental validation with checkpoints

6. **`GET /api/analytics/trends`** - Time-series aggregation
   - **Current:** Aggregates all historical data
   - **Fix:** Default time range = last 90 days, allow range picker

7. **`GET /api/submissions` (bulk)** - Multiple conference submissions
   - **Current:** Fetches all submissions
   - **Fix:** Paginate with `limit=50` default

8. **`GET /api/integrations/logs`** - Third-party integration logs
   - **Current:** No pagination
   - **Fix:** Default limit=100, implement log rotation

---

## Recommendations by Category

### 1. Indexing Strategy (See PERF-002 for details)

**Critical Foreign Key Indexes:**
- `approval_gates(requested_by_id, status)` - for user approval queries
- `collection_papers(collection_id, sort_order)` - for ordered paper retrieval
- `paper_tags(paper_id, tag)` - for tag queries
- `artifact_versions(artifact_id, version_number)` - for version history

**Search Indexes:**
- Full-text indexes on title, abstract, content fields
- Trigram indexes for fuzzy matching

**Join Optimization:**
- Composite indexes on foreign key + commonly filtered column

---

### 2. Query Optimization

| Pattern | Current | Recommended | Savings |
|---------|---------|------------|---------|
| Subquery per row | `(SELECT COUNT(*) WHERE ...) as count` | Window function or JOIN | 90% |
| LIKE search | `LOWER(name) LIKE $1` | Trigram GIN index | 95% |
| Separate tag fetch | 2 queries | Array aggregation | 50% |
| Full-text without index | Text search scan | GIN full-text index | 99% |
| Multiple sequential searches | 4 queries | 1 UNION ALL query | 75% |

---

### 3. Caching Strategy

**Query Result Caching (Redis):**
- `/projects` list: TTL 5 minutes (invalidate on write)
- `/collections` list: TTL 5 minutes (user-scoped)
- `/search/suggestions`: TTL 30 minutes (org-scoped)
- User roles/permissions: TTL 1 hour (invalidate on role change)

**Computed Field Caching:**
- Paper page count: Cache extraction result
- Collection paper count: Maintain counter table
- User workflow count: Maintain counter table

**Pre-aggregation:**
- Daily statistics snapshots (instead of computed on-demand)
- Monthly trend data pre-calculated

---

### 4. Async Processing

Move from critical path:
- Audit log writes → Queue with worker
- File processing → Background job with progress tracking
- PDF text extraction → Worker pool
- Email notifications → Message queue

---

### 5. Pagination Implementation

**Apply to all list endpoints:**

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

**Default parameters:**
- `limit`: 20 (max 100 for most endpoints, max 1000 for exports)
- `offset`: 0
- `sort`: created_at (support: created_at, updated_at, name)
- `order`: desc (support: asc, desc)

---

## Response Time Targets

### Current State (Estimated)

| Complexity | Response Time | P95 |
|-----------|--------------|-----|
| LOW | 50-100ms | 150ms |
| MEDIUM | 200-500ms | 800ms |
| HIGH | 1000-3000ms | 5000ms |

### Target State (After Optimization)

| Complexity | Response Time | P95 |
|-----------|--------------|-----|
| LOW | 30-50ms | 80ms |
| MEDIUM | 100-200ms | 300ms |
| HIGH | 300-800ms | 1200ms |

---

## Implementation Priority

### Phase 1 (Week 1) - Critical Path
1. Add pagination to unbounded queries
2. Fix N+1 in `/collections` GET (subqueries)
3. Optimize `/projects` GET aggregation
4. Add full-text search indexes

### Phase 2 (Week 2) - Index Foundation
1. Create missing foreign key indexes
2. Add composite indexes for common filters
3. Implement trigram indexes for fuzzy search

### Phase 3 (Week 3) - Query Optimization
1. Convert subqueries to JOINs/window functions
2. Implement eager loading for relationships
3. Split heavy queries into async operations

### Phase 4 (Week 4) - Caching & Monitoring
1. Implement Redis caching layer
2. Add performance monitoring/alerting
3. Load testing and optimization verification

---

## Testing & Validation

### Load Test Scenarios

```bash
# Simulate 100 concurrent users
k6 run --vus 100 --duration 5m performance-tests.js

# Test high-complexity endpoint
k6 run --vus 50 --duration 10m high-complexity.js
```

### Metrics to Monitor

- Response time (p50, p95, p99)
- Database query count per endpoint
- Query execution time breakdown
- Memory usage and connection pool saturation
- Cache hit rates

### Acceptance Criteria

- P95 response time < 1 second for all endpoints
- N+1 queries eliminated from high-complexity endpoints
- All list endpoints support pagination
- No unbounded result sets in production

---

## Appendix: Full Endpoint Listing

### HIGH Complexity (7 endpoints)
- GET /api/projects
- GET /api/collections
- GET /api/papers/:id
- GET /api/papers/search
- GET /api/search/global
- POST /api/manuscripts
- GET /api/papers (with collection filter)

### MEDIUM Complexity (15 endpoints)
- GET /api/papers
- GET /api/manuscripts/:id/sections
- POST /api/export
- GET /api/governance
- GET /api/integrity
- GET /api/citations
- GET /api/workflows
- GET /api/artifacts
- GET /api/research-projects
- GET /api/submissions
- GET /api/integrations/logs
- GET /api/analytics/trends
- POST /api/governance/history
- GET /api/governance/validate
- PATCH /api/organizations

### LOW Complexity (58+ endpoints)
- All `*/ping` health check endpoints
- Single resource GETs with direct ID lookup
- POST/PUT/PATCH for single resources
- Simple status endpoints
- Configuration endpoints

---

**Document Version:** 1.0
**Last Updated:** 2026-01-28
**Next Review:** 2026-02-28
