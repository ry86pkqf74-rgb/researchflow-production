# ResearchFlow Improvements - Detailed Backlog

## Priority Classification
- **P0**: Critical path features - block user workflows
- **P1**: High-value features - significantly improve UX
- **P2**: Quality-of-life improvements
- **P3**: Nice-to-have enhancements

---

## P0: Collaboration & Editing Foundation

### P0-1: Real-time Collaborative Editor (CRDT)
**Why**: Multiple researchers need to edit manuscripts simultaneously without conflicts
**Requirements**:
- [ ] Yjs-based CRDT for manuscript sections
- [ ] WebSocket transport for real-time sync
- [ ] Presence indicators (who's editing what section)
- [ ] Rich text formatting (bold, italic, headings, lists)
- [ ] Cursor position sharing
- [ ] Conflict-free merge for concurrent edits
- [ ] Offline editing with sync-on-reconnect
- [ ] PHI protection: scan on every edit operation

**Technical Specs**:
- Use `y-prosemirror` + `yjs` for CRDT
- Store Yjs binary updates in `manuscript_yjs_updates` table
- WebSocket server in orchestrator with rooms per manuscript
- Presence service tracking active users per section

---

### P0-2: Inline Comments & Threads
**Why**: Reviewers and collaborators need to annotate specific parts of manuscripts
**Requirements**:
- [ ] Comment anchored to text selections (character offsets)
- [ ] Comment anchored to tables (table ID + row/column)
- [ ] Comment anchored to figures (figure ID + region coords)
- [ ] Comment anchored to slides (slide number + region)
- [ ] Threaded replies on comments
- [ ] Resolve/unresolve comments
- [ ] Assign comments to users
- [ ] Filter comments by status (open/resolved)
- [ ] PHI protection: scan comment text before save

**Technical Specs**:
- `comments` table with anchor polymorphism
- Anchor types: `text_selection`, `table_cell`, `figure_region`, `slide_region`
- Store anchor as JSONB: `{ type, start, end, tableId, cellRef, figureId, coords }`
- Thread hierarchy via `parent_comment_id` FK
- Real-time comment notifications via WebSocket

---

### P0-3: True Version History + Diff + Restore
**Why**: Research requires audit trail and ability to revert changes
**Requirements**:
- [ ] Automatic version creation on significant edits
- [ ] Manual "Save Version" with description
- [ ] Side-by-side diff viewer (added/removed/modified highlighting)
- [ ] Word-level diff for text sections
- [ ] Table diff showing cell changes
- [ ] Figure diff showing image comparison
- [ ] Restore to previous version (creates new version, immutable history)
- [ ] Version metadata: timestamp, author, change description
- [ ] PHI protection: versions inherit parent PHI scan status

**Technical Specs**:
- Extend `ManuscriptVersion` to include Yjs snapshot
- Diff algorithm: `diff-match-patch` for text, custom for structured data
- Version timeline UI component
- Restore creates new version with `restoredFrom` metadata

---

### P0-4: Track-Changes DOCX Export
**Why**: Reviewers need Word documents with tracked changes for editorial review
**Requirements**:
- [ ] Export manuscript as DOCX with actual Word track-changes markup
- [ ] Map version diffs to Word insertions/deletions/formatting
- [ ] Preserve comments as Word comments
- [ ] Author attribution per change
- [ ] Timestamp metadata
- [ ] PHI redaction markers visible in export
- [ ] Export includes "Accept All" and "Reject All" ready state

**Technical Specs**:
- Use `docx` library with `TrackRevisions` API
- Map diff operations to Word change tracking elements
- Convert inline comments to Word comment balloons
- Generate unique author IDs per user
- PHI scan before export, fail if high-risk PHI detected

---

## P0: Artifact Graph & Provenance

### P0-5: Artifact Graph Data Model
**Why**: Track how artifacts are related and flow through the pipeline
**Requirements**:
- [ ] Unified artifact entity (Topic, Literature, Dataset, Analysis, Manuscript, Conference Asset)
- [ ] Edge relationships (derived_from, references, supersedes, uses)
- [ ] Metadata per edge (transformation type, timestamp, hash)
- [ ] Cycle detection (prevent circular dependencies)
- [ ] PHI propagation tracking (if source has PHI, flag downstream)

**Technical Specs**:
```sql
CREATE TABLE artifacts (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- topic|literature|dataset|analysis|manuscript|conference
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50), -- draft|active|archived
  phi_scanned BOOLEAN DEFAULT FALSE,
  phi_status VARCHAR(20), -- PASS|FAIL|PENDING
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  metadata JSONB
);

CREATE TABLE artifact_edges (
  id UUID PRIMARY KEY,
  source_artifact_id UUID NOT NULL REFERENCES artifacts(id),
  target_artifact_id UUID NOT NULL REFERENCES artifacts(id),
  relation_type VARCHAR(50) NOT NULL, -- derived_from|references|supersedes|uses
  transformation_type VARCHAR(100), -- literature_search|statistical_analysis|export
  metadata JSONB,
  created_at TIMESTAMP
);

CREATE INDEX idx_artifact_edges_source ON artifact_edges(source_artifact_id);
CREATE INDEX idx_artifact_edges_target ON artifact_edges(target_artifact_id);
```

---

### P0-6: Artifact Graph API
**Why**: Query and visualize artifact relationships
**Requirements**:
- [ ] GET /api/artifacts/:id/graph - Get full dependency graph
- [ ] GET /api/artifacts/:id/upstream - Get ancestors
- [ ] GET /api/artifacts/:id/downstream - Get descendants
- [ ] POST /api/artifacts/:id/link - Create edge relationship
- [ ] DELETE /api/artifact-edges/:edgeId - Remove relationship
- [ ] GET /api/artifacts/:id/outdated - Check if downstream artifacts need refresh

**Outdated Detection Algorithm**:
```
An artifact is outdated if:
1. Source artifact has newer updated_at than edge created_at
2. Source artifact has new version that wasn't used in derivation
3. Manual "mark outdated" flag set
```

---

### P0-7: Artifact Graph UI
**Why**: Visualize research workflow and dependencies
**Requirements**:
- [ ] Interactive graph visualization (D3.js or React Flow)
- [ ] Nodes colored by artifact type
- [ ] Edges labeled with relationship type
- [ ] Click node to view artifact details
- [ ] Highlight outdated artifacts in red/orange
- [ ] Show PHI status badges on nodes
- [ ] Filter by artifact type
- [ ] Zoom and pan controls
- [ ] Export graph as PNG/SVG

---

## P0: Conference Prep Editable & Traceable

### P0-8: Conference Material Versioning
**Why**: Posters and slides need iterative editing with history
**Requirements**:
- [ ] Store PPTX source files as artifacts with versions
- [ ] Store PDF/PNG exports as separate artifact versions
- [ ] Track edits to PPTX (binary diff or snapshot versioning)
- [ ] Link PPTX source → PDF export relationship in artifact graph
- [ ] Enable "Regenerate PDF from PPTX" workflow
- [ ] PHI scan on PPTX text extraction before export

**Technical Specs**:
- Artifact types: `conference_poster_source`, `conference_poster_export`
- Store PPTX in artifact storage (S3 or filesystem)
- On export, create edge: source → export with `exported_to` relation
- Use python-pptx for text extraction + PHI scan

---

### P0-9: Conference Requirements Ingestion
**Why**: Automate compliance checking against conference guidelines
**Requirements**:
- [ ] Conference requirements schema (abstract word limit, poster dimensions, etc.)
- [ ] Manual input form for requirements
- [ ] Auto-parse requirements from conference website (future)
- [ ] Store requirements as conference_template artifact
- [ ] Validation service: check poster/abstract against requirements
- [ ] Show validation errors in UI before submission

**Technical Specs**:
```typescript
interface ConferenceRequirements {
  conferenceName: string;
  abstractWordLimit: number;
  posterDimensions: { width: number; height: number; unit: 'inches'|'cm' };
  slideCountLimit?: number;
  requiredSections: string[];
  fileFormats: string[]; // ['pdf', 'pptx']
  submissionDeadline: Date;
}
```

---

### P0-10: Templating System
**Why**: Generate consistent conference materials from manuscript
**Requirements**:
- [ ] Template library: poster templates, slide templates
- [ ] Variable substitution: {{manuscript.title}}, {{author.name}}
- [ ] Section mapping: manuscript.results → poster.results
- [ ] Figure auto-inclusion with scaling
- [ ] Style preservation (fonts, colors, logos)
- [ ] Preview before export

**Technical Specs**:
- PPTX templates with placeholder text
- Template engine: Mustache or Handlebars
- Parse PPTX, replace placeholders, save new PPTX
- Artifact graph: manuscript → conference_material with `generated_from` edge

---

## P1: Enhanced Features

### P1-1: External Link Tracking
**Why**: Sync with Google Docs, Overleaf, etc.
- [ ] Google Docs OAuth integration
- [ ] Bidirectional sync (import/export)
- [ ] Conflict resolution UI
- [ ] Sync status indicators

### P1-2: Figure Annotation
**Why**: Add arrows, labels, highlights to figures
- [ ] Canvas-based annotation tool
- [ ] Save annotations as overlay layer
- [ ] Version control for annotated figures

### P1-3: Citation Manager Integration
**Why**: Import from Zotero, Mendeley
- [ ] Zotero API integration
- [ ] Citation import/export
- [ ] Auto-format citations per journal style

---

## P2: Quality of Life

### P2-1: Keyboard Shortcuts
- [ ] Ctrl+S: Save version
- [ ] Ctrl+K: Insert citation
- [ ] Ctrl+/: Comment selection
- [ ] Ctrl+Shift+V: View version history

### P2-2: Mobile Preview
- [ ] Responsive manuscript viewer
- [ ] Read-only editing on mobile
- [ ] Comment viewing on mobile

---

## P3: Advanced Features

### P3-1: AI Suggestion Mode
- [ ] Inline AI writing suggestions
- [ ] Accept/reject workflow
- [ ] Track AI-generated content

### P3-2: Multi-language Support
- [ ] i18n for UI
- [ ] Translation service integration

---

## Non-Functional Requirements

### Security
- [ ] All mutations audit-logged
- [ ] PHI scan on all text inputs
- [ ] Role-based access control per artifact
- [ ] Encryption at rest for artifacts

### Performance
- [ ] Lazy-load artifact graph (>100 nodes)
- [ ] Debounce CRDT sync (max 10 ops/sec)
- [ ] Pagination for comment threads (20 per page)
- [ ] CDN for exported artifacts

### Testing
- [ ] Unit tests for diff algorithm (>90% coverage)
- [ ] Integration tests for CRDT sync
- [ ] E2E test: create → edit → version → export → download
- [ ] Load test: 50 concurrent editors on same manuscript

---

## Migration Strategy

### Database Migrations
1. Create `artifacts`, `artifact_edges` tables
2. Migrate existing manuscripts to artifacts table
3. Create `comments`, `comment_threads` tables
4. Create `manuscript_yjs_updates` table
5. Add audit log foreign keys

### Backward Compatibility
- Keep existing version control in-memory for 1 release
- Dual-write to DB and memory during migration
- Feature flag new UI components
- Gradual rollout per organization

---

## Success Metrics

### P0 Completion Criteria
- [ ] 2+ users can edit same manuscript simultaneously
- [ ] Comments can be added to any artifact type
- [ ] Version diff shows word-level changes
- [ ] DOCX export contains actual track-changes markup
- [ ] Artifact graph displays all relationships
- [ ] Conference materials have version history

### User Satisfaction
- [ ] <2 sec latency for collaborative edits
- [ ] 0 data loss incidents during sync
- [ ] 95% PHI scan accuracy
- [ ] >80% user satisfaction with diff UI
