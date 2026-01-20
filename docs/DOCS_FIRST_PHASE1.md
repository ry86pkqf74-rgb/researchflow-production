# Docs-First Phase 1: Implementation Guide

## Overview

The **Docs-First** workflow enables researchers to start with ideas, systematically develop topic briefs with PICO framework, and prepare venue-specific documentation kits BEFORE beginning manuscript authoring. This approach ensures research goals are well-defined, scoped, and aligned with target venues early in the process.

## Concepts

### 1. Ideas Backlog
A managed repository of research ideas with structured evaluation through scorecards.

**Lifecycle:**
1. **BACKLOG** - Initial capture
2. **EVALUATING** - Under review with scorecard
3. **APPROVED** - Ready to convert to Topic Brief
4. **REJECTED** - Not pursuing
5. **CONVERTED** - Promoted to Topic Brief

**Scorecard Dimensions (1-5 scale):**
- **Novelty**: How original is the research question?
- **Feasibility**: Can this be executed with available resources?
- **Impact**: Potential significance of findings
- **Alignment**: Fits team/organization strategic goals

### 2. Topic Briefs
Structured research planning documents using the **PICO framework** (Population, Intervention, Comparison, Outcomes).

**Key Fields:**
- **PICO Framework**
  - Population: Who is being studied?
  - Intervention: What is being applied/tested?
  - Comparison: What is the control/baseline?
  - Outcomes: What metrics determine success?

- **Research Structure**
  - Research Question
  - Hypothesis
  - Background/Rationale
  - Methods Overview
  - Expected Findings

**Versioning:**
- Auto-increments when key fields (research question, hypothesis, PICO) change
- Immutable once frozen

### 3. Scope Freeze
Creates an **immutable snapshot** of a Topic Brief using blockchain-style hash chaining.

**Hash Chain Pattern:**
```
Block 1 (GENESIS)                    Block 2 (v1)                      Block 3 (v2)
previous_hash: "GENESIS"      -->    previous_hash: <Block1Hash>  -->  previous_hash: <Block2Hash>
current_hash:  <SHA256(data)>        current_hash:  <SHA256(data+prev)> current_hash:  <SHA256(data+prev)>
```

**Purpose:**
- Audit trail for scope changes
- Regulatory compliance (IRB, ethics boards)
- Tamper detection
- Reproducibility anchors

**Permissions:**
- Only **STEWARD** role can freeze scopes
- Frozen briefs cannot be edited

### 4. Venues
Target publication/presentation outlets with submission requirements.

**Types:**
- JOURNAL
- CONFERENCE
- WORKSHOP
- PREPRINT

**Metadata:**
- Impact factor
- Acceptance rate
- Word/abstract limits
- Submission deadlines
- Guidelines URL

### 5. Doc Kits
Auto-generated document checklists based on venue type.

**Journal Kit Items:**
- Abstract (required)
- Submission Checklist (required)
- Cover Letter (required)
- Figures List (required)
- Tables List (optional)
- Research Highlights (optional)

**Conference Kit Items:**
- Abstract (required)
- Submission Checklist (required)
- Speaker Biography (required)
- Poster Outline (optional)

**Completion Tracking:**
- Percentage based on required items
- Status per item: NOT_STARTED → IN_PROGRESS → COMPLETE

## API Reference

### Ideas

```
POST   /api/docs-first/ideas                     Create idea
GET    /api/docs-first/ideas                     List ideas (?status=BACKLOG&researchId=...)
GET    /api/docs-first/ideas/:id                 Get idea
PATCH  /api/docs-first/ideas/:id                 Update idea
DELETE /api/docs-first/ideas/:id                 Soft delete
POST   /api/docs-first/ideas/:id/scorecard       Create/update scorecard
GET    /api/docs-first/ideas/:id/scorecard       Get scorecard
POST   /api/docs-first/ideas/:id/convert         Convert to Topic Brief
```

**Example: Create Idea**
```bash
curl -X POST http://localhost:3001/api/docs-first/ideas \
  -H "Content-Type: application/json" \
  -d '{
    "researchId": "project-123",
    "title": "Impact of AI-driven care coordination on readmission rates",
    "description": "Investigate whether ML-based care pathways reduce 30-day readmissions"
  }'
```

### Topic Briefs

```
POST   /api/docs-first/topic-briefs              Create brief
GET    /api/docs-first/topic-briefs              List briefs
GET    /api/docs-first/topic-briefs/:id          Get brief
PATCH  /api/docs-first/topic-briefs/:id          Update (increments version if key fields change)
DELETE /api/docs-first/topic-briefs/:id          Soft delete
POST   /api/docs-first/topic-briefs/:id/freeze   Freeze scope (STEWARD only)
GET    /api/docs-first/topic-briefs/:id/snapshot Get frozen snapshot
GET    /api/docs-first/anchors/:id/verify        Verify hash integrity
```

**Example: Create Topic Brief**
```bash
curl -X POST http://localhost:3001/api/docs-first/topic-briefs \
  -H "Content-Type: application/json" \
  -d '{
    "researchId": "project-123",
    "title": "AI Care Coordination RCT",
    "population": "Adult patients (18+) discharged from cardiology unit",
    "intervention": "ML-based care pathway recommendation system",
    "comparison": "Standard discharge planning",
    "outcomes": ["30-day readmission rate", "Patient satisfaction", "Care team burden"],
    "researchQuestion": "Does AI-driven care coordination reduce readmissions compared to standard care?"
  }'
```

### Venues

```
GET    /api/docs-first/venues                    List venues (?type=JOURNAL&search=...)
GET    /api/docs-first/venues/:id                Get venue
POST   /api/docs-first/venues                    Create venue (ADMIN only)
PATCH  /api/docs-first/venues/:id                Update venue (ADMIN only)
```

### Doc Kits

```
POST   /api/docs-first/doc-kits                  Create kit (auto-generates items)
GET    /api/docs-first/doc-kits/:id              Get kit with items + completion %
PATCH  /api/docs-first/doc-kit-items/:id         Update item status
```

**Example: Create Doc Kit**
```bash
curl -X POST http://localhost:3001/api/docs-first/doc-kits \
  -H "Content-Type: application/json" \
  -d '{
    "topicBriefId": "brief-uuid",
    "venueId": "venue-uuid"
  }'

# Response includes auto-generated items:
{
  "kit": { "id": "kit-123", "status": "IN_PROGRESS" },
  "items": [
    { "id": "item-1", "title": "Abstract", "required": true, "status": "NOT_STARTED" },
    { "id": "item-2", "title": "Cover Letter", "required": true, "status": "NOT_STARTED" },
    ...
  ]
}
```

## Database Schema

### Tables

**ideas**
- `id` UUID (PK)
- `research_id` VARCHAR(255)
- `title` VARCHAR(500)
- `description` TEXT
- `status` ENUM (BACKLOG, EVALUATING, APPROVED, REJECTED, CONVERTED)
- `created_by`, `org_id`, `metadata` JSONB
- Soft delete: `deleted_at` TIMESTAMP

**idea_scorecards**
- `id` UUID (PK)
- `idea_id` UUID (FK → ideas, CASCADE)
- `novelty_score`, `feasibility_score`, `impact_score`, `alignment_score` INT(1-5)
- `total_score` INT (GENERATED ALWAYS AS computed)
- `notes` TEXT
- UNIQUE constraint on `idea_id`

**topic_briefs**
- `id` UUID (PK)
- `research_id` VARCHAR(255)
- `idea_id` UUID (FK → ideas, SET NULL)
- `version_number` INT (auto-incremented by trigger)
- PICO: `population`, `intervention`, `comparison`, `outcomes` TEXT[]
- Research: `research_question`, `hypothesis`, `background`, `methods_overview`, `expected_findings` TEXT
- `status` ENUM (DRAFT, ACTIVE, FROZEN, ARCHIVED)
- `frozen_at`, `frozen_by` (when scope freeze happens)

**venues**
- `id` UUID (PK)
- `name`, `type` (JOURNAL/CONFERENCE/WORKSHOP/PREPRINT)
- `impact_factor` DECIMAL, `acceptance_rate` DECIMAL
- `word_limit`, `abstract_limit` INT
- `guidelines_url` TEXT, `submission_deadline` DATE

**doc_kits**
- `id` UUID (PK)
- `topic_brief_id` UUID (FK → topic_briefs, CASCADE)
- `venue_id` UUID (FK → venues, CASCADE)
- `status` ENUM (NOT_STARTED, IN_PROGRESS, COMPLETE, SUBMITTED)

**doc_kit_items**
- `id` UUID (PK)
- `doc_kit_id` UUID (FK → doc_kits, CASCADE)
- `item_type` VARCHAR (ABSTRACT, COVER_LETTER, CHECKLIST, etc.)
- `content` TEXT
- `artifact_id` UUID (FK → artifacts, SET NULL) - links to artifact system
- `status` ENUM (NOT_STARTED, IN_PROGRESS, COMPLETE)
- `required` BOOLEAN
- `display_order` INT

**doc_anchors**
- `id` UUID (PK)
- `topic_brief_id` UUID (FK → topic_briefs, CASCADE)
- `version_number` INT
- `snapshot_data` JSONB (complete brief state)
- `previous_hash` VARCHAR(64), `current_hash` VARCHAR(64)
- UNIQUE(topic_brief_id, version_number)

### Triggers

**topic_brief_version_increment**
- Auto-increments `version_number` when key fields change
- Only if status != 'FROZEN'
- Monitors: `research_question`, `hypothesis`, `population`, `intervention`, `comparison`

## Governance Behavior

### STANDBY Mode
- ❌ All write operations blocked (POST, PATCH, DELETE)
- ✅ Read operations allowed (GET)
- Error response: `{ error: "System is in STANDBY mode", code: "STANDBY_MODE_ACTIVE" }`

### LIVE Mode
- ✅ All operations enabled
- PHI scanning on text fields (research questions, populations, etc.)
- Approval gates for large operations
- Rate limiting enforced

### RBAC Requirements

| Operation | Required Role |
|-----------|--------------|
| Create/Edit Idea | RESEARCHER |
| View Ideas/Briefs | VIEWER |
| Create/Edit Topic Brief | RESEARCHER |
| **Freeze Topic Brief** | **STEWARD** |
| Create Venue | ADMIN |
| Create Doc Kit | RESEARCHER |
| Update Kit Items | RESEARCHER |

## Integration Points

### 1. Artifact System
Doc Kit items can link to artifacts via `artifact_id` field. When manuscript/figure is generated, store artifact ID for provenance tracking.

**Example:**
```sql
UPDATE doc_kit_items
SET artifact_id = 'artifact-uuid-123'
WHERE id = 'item-uuid'
  AND item_type = 'ABSTRACT';
```

### 2. Hash Chain Audit
Doc Anchors use the same hash chain pattern as `audit_logs`:
- Genesis block for first anchor
- Each anchor links to previous via hash
- Tamper detection via hash recomputation

**Verification:**
```typescript
GET /api/docs-first/anchors/:id/verify

Response:
{
  "valid": true,
  "details": "Anchor verified successfully"
}
```

### 3. PHI Protection
All text fields scanned for PHI before storage:
- Research questions
- Hypotheses
- Population descriptions
- Background/methods content

## Workflows

### Workflow 1: Idea → Topic Brief

```
1. Researcher creates Idea
   POST /api/docs-first/ideas
   → Status: BACKLOG

2. Team evaluates via Scorecard
   POST /api/docs-first/ideas/:id/scorecard
   → Calculate total score (novelty + feasibility + impact + alignment)

3. If approved, convert to Topic Brief
   POST /api/docs-first/ideas/:id/convert
   → Idea status: CONVERTED
   → Topic Brief created with pre-filled title, background

4. Researcher fills PICO framework
   PATCH /api/docs-first/topic-briefs/:id
   → Version increments automatically on major field changes

5. STEWARD freezes scope
   POST /api/docs-first/topic-briefs/:id/freeze
   → Status: FROZEN
   → Creates immutable hash-chained snapshot
```

### Workflow 2: Venue Selection → Doc Kit

```
1. Select target venue
   GET /api/docs-first/venues?type=JOURNAL
   → Browse venues by type

2. Create doc kit for venue
   POST /api/docs-first/doc-kits
   {
     "topicBriefId": "brief-123",
     "venueId": "venue-456"
   }
   → Auto-generates items based on venue type

3. Complete each item
   PATCH /api/docs-first/doc-kit-items/:id
   { "status": "IN_PROGRESS", "content": "..." }
   → Update status per item

4. Track completion
   GET /api/docs-first/doc-kits/:id
   → Returns completion percentage
   → Required items: 4/6 complete = 67%
```

## Testing

### Manual Testing

```bash
# 1. Create Idea
curl -X POST http://localhost:3001/api/docs-first/ideas \
  -H "Content-Type: application/json" \
  -d '{"researchId": "test", "title": "Test Idea"}'

# 2. Add Scorecard
curl -X POST http://localhost:3001/api/docs-first/ideas/:id/scorecard \
  -H "Content-Type: application/json" \
  -d '{"noveltyScore": 4, "feasibilityScore": 3, "impactScore": 5, "alignmentScore": 4}'

# 3. Convert to Brief
curl -X POST http://localhost:3001/api/docs-first/ideas/:id/convert

# 4. Update Brief
curl -X PATCH http://localhost:3001/api/docs-first/topic-briefs/:id \
  -H "Content-Type: application/json" \
  -d '{"population": "Adults 18+", "researchQuestion": "Does intervention X reduce outcome Y?"}'

# 5. Freeze Scope (requires STEWARD role)
curl -X POST http://localhost:3001/api/docs-first/topic-briefs/:id/freeze

# 6. Verify Hash
curl http://localhost:3001/api/docs-first/anchors/:anchorId/verify
```

### Integration Tests

See `/services/orchestrator/src/services/__tests__/` for:
- `ideas.service.test.ts`
- `topic-briefs.service.test.ts`
- `scope-freeze.service.test.ts`
- `doc-kits.service.test.ts`

**Run tests:**
```bash
cd services/orchestrator
npm run test -- docs-first
```

## Next Steps (Future Phases)

### Phase 2 - Enhanced Automation
- AI-assisted scorecard generation
- Auto-suggest venues based on Topic Brief
- Template library for cover letters
- Collaboration features (co-authors)

### Phase 3 - Manuscript Integration
- Export Topic Brief → Manuscript engine
- Pre-populate IMRaD sections from Topic Brief
- Link Doc Kit items to manuscript sections

### Phase 4 - Workflow Tracking
- Timeline/deadline tracking
- Email notifications for milestones
- Integration with calendar systems

## FAQ

**Q: Can I edit a frozen Topic Brief?**
A: No. Once frozen, the brief is immutable. You must create a new brief or version.

**Q: What happens if I delete an Idea that's been converted?**
A: The Topic Brief retains a reference (`idea_id`) but won't break if the Idea is soft-deleted. The link is preserved in metadata.

**Q: How do I add a custom venue?**
A: Only ADMIN role can create venues via `POST /api/docs-first/venues`.

**Q: Can I create a Doc Kit without a frozen Topic Brief?**
A: Yes. Freezing is recommended but not required for kit creation.

**Q: How is completion percentage calculated?**
A: `(completed_required_items / total_required_items) * 100`. Optional items don't affect percentage.

## File Locations

**Migration:**
- `/services/orchestrator/migrations/010_docs_first_tables.sql`

**Schema:**
- `/packages/core/types/schema.ts` (tables: ideas, ideaScorecards, topicBriefs, venues, docKits, docKitItems, docAnchors)

**Services:**
- `/services/orchestrator/src/services/docs-first/ideas.service.ts`
- `/services/orchestrator/src/services/docs-first/topic-briefs.service.ts`
- `/services/orchestrator/src/services/docs-first/scope-freeze.service.ts`
- `/services/orchestrator/src/services/docs-first/doc-kits.service.ts`

**Routes:**
- `/services/orchestrator/src/routes/docs-first/ideas.ts`
- `/services/orchestrator/src/routes/docs-first/topic-briefs.ts`
- `/services/orchestrator/src/routes/docs-first/venues.ts`
- `/services/orchestrator/src/routes/docs-first/doc-kits.ts`

**Registration:**
- `/services/orchestrator/src/index.ts` (lines 74-77)

## Success Metrics

- ✅ All 7 tables created with indexes
- ✅ All CRUD endpoints functional
- ✅ Scorecard auto-calculation working
- ✅ Version auto-increment trigger active
- ✅ Scope freeze creates valid hash chain
- ✅ Doc kit auto-generation by venue type
- ✅ Completion percentage accurate
- ✅ STANDBY mode blocks writes
- ✅ RBAC enforced (STEWARD for freeze, ADMIN for venues)
- ✅ Audit logs created for all mutations

---

**For Support:** Report issues at https://github.com/anthropics/researchflow/issues
