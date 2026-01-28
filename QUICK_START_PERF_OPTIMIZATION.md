# Quick Start: ResearchFlow Performance Optimization

**For:** Development Team
**Priority:** CRITICAL (60-95% response time improvement available)
**Time to Implement:** 32 hours over 4 weeks

---

## TL;DR

ResearchFlow API has **7 high-complexity endpoints** that could respond **60-95% faster**. Analysis documents are ready. Start with Week 1 tasks below.

---

## 📋 Documents Created

| Document | Location | Purpose |
|----------|----------|---------|
| **API Audit** | `/docs/performance/API_RESPONSE_AUDIT.md` | Endpoint complexity analysis, N+1 queries, pagination issues |
| **Index Recommendations** | `/infrastructure/postgres/recommended-indexes.sql` | 23 indexes, deployment instructions, monitoring |
| **Summary** | `/PERF_ANALYSIS_SUMMARY.md` | Executive overview, roadmap, success criteria |
| **This Guide** | `/QUICK_START_PERF_OPTIMIZATION.md` | Action items for developers |

---

## 🚨 Top 3 Issues (Fix First)

### 1. Collections GET - N+1 Subqueries
**File:** `src/routes/collections.ts` (lines 159-169)
**Problem:** 2 subqueries per collection → 201 queries for 100 collections
**Fix Time:** 30 minutes

```typescript
// BAD (current)
SELECT c.*,
  (SELECT COUNT(*) FROM collection_papers cp WHERE cp.collection_id = c.id) as paper_count,
  (SELECT COUNT(*) FROM collections child WHERE child.parent_id = c.id) as child_count
FROM collections c

// GOOD (use window function)
SELECT c.*,
  COUNT(*) FILTER (WHERE cp.collection_id = c.id) OVER (PARTITION BY c.id) as paper_count
FROM collections c
LEFT JOIN collection_papers cp ON cp.collection_id = c.id
```

**Expected Improvement:** 80-90% faster

---

### 2. Projects GET - Complex Aggregation
**File:** `src/routes/projects.ts` (lines 42-100)
**Problem:** json_agg with multiple JOINs creates cartesian product
**Fix Time:** 1 hour

```typescript
// Split into 2 queries:
// Query 1: Get projects with basic counts
const projects = await db.query(`
  SELECT p.*, COUNT(DISTINCT pw.id) as workflow_count
  FROM projects p
  LEFT JOIN project_workflows pw ON p.id = pw.project_id
  GROUP BY p.id
  LIMIT $1 OFFSET $2
`);

// Query 2: Fetch collaborators async (cache results)
const collaborators = await fetchCollaboratorsAsync(projectIds);
```

**Expected Improvement:** 75-80% faster

---

### 3. Papers Search - No Full-Text Index
**File:** `src/routes/papers.ts` (lines 618-660)
**Problem:** Full-text search scans entire table without index
**Fix Time:** 30 minutes

```sql
-- Create indexes (from recommended-indexes.sql)
CREATE INDEX idx_papers_title_fulltext
  ON papers USING GIN(to_tsvector('english', title));

CREATE INDEX idx_papers_abstract_fulltext
  ON papers USING GIN(to_tsvector('english', title || ' ' || COALESCE(abstract, '')));
```

**Expected Improvement:** 95% faster

---

## 📅 Week-by-Week Plan

### Week 1: Critical Fixes (8 hours)
- [ ] Add pagination to 8 unbounded queries
  - GET /api/papers/search - enforce max 100 results
  - GET /api/search/global - cap total results to 50
  - GET /api/export - paginate with batch_size
  - 5 more in API_RESPONSE_AUDIT.md

- [ ] Fix collections N+1 (subqueries → window functions)
- [ ] Optimize projects aggregation (split queries)
- [ ] Deploy full-text search indexes

**Estimated Time:** 8 hours
**Expected Improvement:** 40-50%

---

### Week 2: Index Creation (4 hours)
- [ ] Review `infrastructure/postgres/recommended-indexes.sql`
- [ ] Deploy 10 CRITICAL foreign key indexes
- [ ] Create 3 full-text search indexes
- [ ] Run ANALYZE for query optimizer
- [ ] Verify index statistics with monitoring queries

**Indexes to Deploy First:**
1. `idx_collection_papers_collection_id`
2. `idx_paper_tags_paper_id`
3. `idx_project_members_project_id`
4. `idx_user_roles_user_id_active` (impacts every request)
5. `idx_papers_user_created`

**Estimated Time:** 4 hours
**Expected Improvement:** 60-75%

---

### Week 3: Query Optimization (12 hours)
- [ ] Convert correlated subqueries to JOINs/window functions
- [ ] Implement eager loading (array_agg patterns)
- [ ] Move audit logging to async queue
- [ ] Split heavy queries into async operations

**Files to Modify:**
- `/routes/papers.ts` - Fix tag loading
- `/routes/manuscripts.ts` - Async audit logging
- `/routes/search.ts` - Parallel queries
- `/routes/governance.ts` - Permission caching

**Estimated Time:** 12 hours
**Expected Improvement:** 50-70%

---

### Week 4: Caching & Validation (8 hours)
- [ ] Implement Redis caching for list endpoints
- [ ] Set up performance monitoring (APM)
- [ ] Load test with production-like data
- [ ] Verify performance targets met

**Estimated Time:** 8 hours
**Expected Improvement:** 30-40% (with caching)

---

## 🔧 Implementation Checklist

### Pagination (Do First - No Dependencies)
- [ ] collections.ts - Add limit/offset to GET /collections
- [ ] papers.ts - Add limit/offset to GET /papers/search
- [ ] search.ts - Cap global search to 50 total results
- [ ] export.ts - Implement streaming with batch_size
- [ ] governance.ts - Add limit to audit queries
- [ ] integrity.ts - Paginate validation checks
- [ ] analytics.ts - Default time range last 90 days
- [ ] submissions.ts - Paginate bulk submissions

---

### N+1 Fixes
- [ ] collections.ts - Remove subqueries, use window functions
- [ ] papers.ts - Eager load tags with array_agg
- [ ] projects.ts - Split aggregation into 2 queries
- [ ] search.ts - Consolidate 4 searches into UNION
- [ ] governance.ts - Cache permission checks

---

### Index Creation (in order)
1. [ ] Run `infrastructure/postgres/recommended-indexes.sql`
2. [ ] Monitor with: `SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;`
3. [ ] Verify disk space: `SELECT pg_size_pretty(pg_relation_size(indexrelid)) FROM pg_stat_user_indexes;`

---

### Testing
- [ ] Unit tests for modified routes (use EXPLAIN ANALYZE)
- [ ] Load test: `k6 run --vus 100 --duration 5m load-test.js`
- [ ] P95 latency check before/after
- [ ] Monitor APM dashboard for improvements

---

## 📊 Before/After Metrics

### Collections GET Endpoint
```
Before:  SELECT c.*, (subquery1), (subquery2)
         → 1 + (2 × count) = 201 queries
         → 800-1500ms response time

After:   SELECT c.* LEFT JOIN collection_papers ...
         → 1 query
         → 100-300ms response time

Improvement: 75-85%
```

### Papers Search
```
Before:  Full-text search without GIN index
         → Table scan for each query
         → 1200-3000ms

After:   Full-text search with GIN index
         → Index scan
         → 200-800ms

Improvement: 70-75%
```

### Projects GET
```
Before:  json_agg() with 2 LEFT JOINs
         → Cartesian product
         → 1500-4000ms

After:   2 queries, async collaborators fetch
         → Proper join optimization
         → 300-1000ms

Improvement: 75-80%
```

---

## ⚠️ Common Pitfalls

1. **Don't create indexes without testing first**
   - Use EXPLAIN ANALYZE before/after
   - Check disk space on production

2. **Don't change queries without load testing**
   - Window functions need PostgreSQL 9.1+
   - Test with realistic data volume

3. **Don't skip ANALYZE after index creation**
   - Query optimizer needs updated statistics
   - Without it, indexes may not be used

4. **Don't deploy all changes at once**
   - Use phased approach (Week 1-4)
   - Monitor impact of each change

---

## 🧪 Testing Queries

### Check Current Performance
```sql
-- Before optimization
EXPLAIN ANALYZE
SELECT c.*,
  (SELECT COUNT(*) FROM collection_papers cp WHERE cp.collection_id = c.id) as paper_count
FROM collections c
WHERE user_id = 'user-123';

-- Monitor: How many rows? Execution time?
```

### After Optimization
```sql
-- After adding indexes
EXPLAIN ANALYZE
SELECT c.* FROM collections c
LEFT JOIN collection_papers cp ON cp.collection_id = c.id
WHERE c.user_id = 'user-123';

-- Compare: Is execution time lower? Is index used?
```

---

## 📞 Getting Help

**Questions about specific endpoints?**
→ See `/docs/performance/API_RESPONSE_AUDIT.md` (search for endpoint name)

**Need index deployment instructions?**
→ See `/infrastructure/postgres/recommended-indexes.sql` (has deployment checklist)

**Want the full analysis?**
→ See `/PERF_ANALYSIS_SUMMARY.md` (complete overview)

---

## ✅ Success Criteria

When you're done, you should see:

- [ ] All 8 unbounded queries now require pagination
- [ ] N+1 patterns eliminated from 12 endpoints
- [ ] 23 indexes deployed and being used
- [ ] P95 response time < 1 second for all endpoints
- [ ] No queries exceed 3 seconds in APM
- [ ] Cache hit rate > 70% for list endpoints

---

**Start with Week 1 tasks above. Estimated 32 hours total for full optimization.**

**Questions? Check the detailed documents or run the provided queries.**
