# ResearchFlow: Collaboration, Provenance & Conference Prep - Design Document

## Executive Summary

This document specifies the architecture for adding real-time collaboration, artifact provenance tracking, and enhanced conference preparation capabilities to ResearchFlow. The design preserves HIPAA compliance, follows existing audit patterns, and integrates seamlessly with the current manuscript engine.

**Status**: Implementation Ready
**Target**: Phase 4.5 (bridges Writing Assistance and Review/Export)
**Complexity**: High
**Risk**: Medium (CRDT complexity, PHI surface area expansion)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Model Changes](#data-model-changes)
3. [API Design](#api-design)
4. [Real-time Collaboration](#real-time-collaboration)
5. [Comment System](#comment-system)
6. [Version Control Enhancement](#version-control-enhancement)
7. [Artifact Graph & Provenance](#artifact-graph--provenance)
8. [Conference Prep Enhancement](#conference-prep-enhancement)
9. [PHI & Security Considerations](#phi--security-considerations)
10. [Testing Strategy](#testing-strategy)

---

## 1. Architecture Overview

### Current State

```
┌─────────────┐
│   Browser   │
│   (React)   │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────────────────────┐
│   Node.js Orchestrator      │
│   - REST API                │
│   - Version Control (mem)  │
└──────┬──────────────────────┘
       │ Job Specs
       ▼
┌─────────────────────────────┐
│   Python Worker             │
│   - Manuscript Generation   │
│   - Conference Prep         │
└─────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────┐
│   Browser (React)                        │
│   - ProseMirror Editor                   │
│   - Yjs CRDT                            │
│   - WebSocket Client                     │
│   - D3 Graph Visualization              │
└──────┬──────────────────────────────────┘
       │ HTTP + WebSocket
       ▼
┌─────────────────────────────────────────┐
│   Node.js Orchestrator                   │
│   - REST API (versioned)                │
│   - WebSocket Server (Yjs sync)         │
│   - Presence Service                     │
│   - Comment Service                      │
│   - Artifact Graph Service              │
│   - PostgreSQL (persistent storage)     │
└──────┬──────────────────────────────────┘
       │ Job Specs + Artifact Requests
       ▼
┌─────────────────────────────────────────┐
│   Python Worker                          │
│   - Conference Material Generation       │
│   - PPTX → PDF Conversion               │
│   - PHI Text Extraction                 │
│   - Artifact Storage (S3/FS)            │
└─────────────────────────────────────────┘
```

---

## 2. Data Model Changes

### 2.1 Core Artifact Model

**Purpose**: Unified representation of all research pipeline entities

```sql
-- Core artifact table
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'topic', 'literature', 'dataset', 'analysis',
    'manuscript', 'conference_poster', 'conference_slides',
    'conference_abstract', 'figure', 'table'
  )),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
    'draft', 'active', 'review', 'approved', 'archived'
  )),

  -- PHI tracking
  phi_scanned BOOLEAN DEFAULT FALSE,
  phi_status VARCHAR(20) CHECK (phi_status IN (
    'PASS', 'FAIL', 'PENDING', 'OVERRIDE'
  )),
  phi_scan_date TIMESTAMP,
  phi_findings_count INT DEFAULT 0,

  -- Ownership and permissions
  owner_user_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP, -- Soft delete

  -- Flexible metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT artifacts_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_status ON artifacts(status);
CREATE INDEX idx_artifacts_owner ON artifacts(owner_user_id);
CREATE INDEX idx_artifacts_phi_status ON artifacts(phi_status);
CREATE INDEX idx_artifacts_updated_at ON artifacts(updated_at DESC);
CREATE INDEX idx_artifacts_metadata_gin ON artifacts USING gin(metadata);
```

### 2.2 Artifact Relationships

**Purpose**: Track provenance and dependencies

```sql
CREATE TABLE artifact_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  target_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,

  -- Relationship semantics
  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN (
    'derived_from',      -- Analysis derived from Dataset
    'references',        -- Manuscript references Literature
    'supersedes',        -- New version supersedes old
    'uses',             -- Poster uses Figure
    'generated_from',   -- Conference material from Manuscript
    'exported_to',      -- PPTX exported to PDF
    'annotates'         -- Comment annotates Text
  )),

  -- Transformation metadata
  transformation_type VARCHAR(100), -- 'literature_search', 'statistical_analysis', 'export'
  transformation_config JSONB,      -- Parameters used in transformation

  -- Versioning
  source_version_id UUID,           -- Which version of source was used
  target_version_id UUID,           -- Which version of target was created

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT artifact_edges_pkey PRIMARY KEY (id),
  CONSTRAINT no_self_loops CHECK (source_artifact_id != target_artifact_id)
);

CREATE INDEX idx_artifact_edges_source ON artifact_edges(source_artifact_id);
CREATE INDEX idx_artifact_edges_target ON artifact_edges(target_artifact_id);
CREATE INDEX idx_artifact_edges_relation_type ON artifact_edges(relation_type);
CREATE UNIQUE INDEX idx_artifact_edges_unique ON artifact_edges(
  source_artifact_id, target_artifact_id, relation_type
) WHERE deleted_at IS NULL;
```

### 2.3 Enhanced Version Control

**Purpose**: Persistent storage for manuscript versions with Yjs support

```sql
CREATE TABLE manuscript_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  -- Content storage (dual model)
  content_json JSONB NOT NULL,              -- IMRaD structured content
  yjs_snapshot BYTEA,                        -- Yjs binary state snapshot

  -- Provenance
  created_by VARCHAR(255) NOT NULL,
  change_description TEXT,
  data_snapshot_hash VARCHAR(64),            -- SHA-256 of source data

  -- Metadata
  word_count INT,
  section_counts JSONB,                      -- {"introduction": 450, "methods": 890}

  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT manuscript_versions_pkey PRIMARY KEY (id),
  CONSTRAINT manuscript_versions_unique_number UNIQUE (manuscript_id, version_number)
);

CREATE INDEX idx_manuscript_versions_manuscript ON manuscript_versions(manuscript_id, version_number DESC);
CREATE INDEX idx_manuscript_versions_created_at ON manuscript_versions(created_at DESC);
```

### 2.4 Yjs Real-time Updates

**Purpose**: Store incremental Yjs updates for real-time collaboration

```sql
CREATE TABLE manuscript_yjs_updates (
  id BIGSERIAL PRIMARY KEY,
  manuscript_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,

  -- Yjs update data
  clock BIGINT NOT NULL,                     -- Yjs logical clock
  update_data BYTEA NOT NULL,                -- Yjs binary update

  -- Metadata
  user_id VARCHAR(255),
  applied_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT manuscript_yjs_updates_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_yjs_updates_manuscript ON manuscript_yjs_updates(manuscript_id, clock);
CREATE INDEX idx_yjs_updates_applied_at ON manuscript_yjs_updates(applied_at);

-- Partition by manuscript_id for scalability
-- CREATE TABLE manuscript_yjs_updates_partition_001 PARTITION OF manuscript_yjs_updates
-- FOR VALUES IN ('manuscript-uuid-1', 'manuscript-uuid-2', ...);
```

### 2.5 Comment System

**Purpose**: Inline comments with polymorphic anchoring

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_id UUID REFERENCES manuscript_versions(id) ON DELETE SET NULL,

  -- Comment hierarchy (threading)
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL,                   -- Root comment ID for grouping

  -- Anchor (polymorphic)
  anchor_type VARCHAR(50) NOT NULL CHECK (anchor_type IN (
    'text_selection',   -- Character range in text
    'table_cell',       -- Specific table cell
    'figure_region',    -- Region in figure image
    'slide_region',     -- Region in slide
    'entire_section'    -- Whole section comment
  )),
  anchor_data JSONB NOT NULL,                -- Type-specific anchor info

  -- Content
  body TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,

  -- Assignment
  assigned_to VARCHAR(255),

  -- Authorship
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT comments_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_comments_artifact ON comments(artifact_id);
CREATE INDEX idx_comments_version ON comments(version_id);
CREATE INDEX idx_comments_thread ON comments(thread_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_resolved ON comments(resolved) WHERE NOT resolved;
CREATE INDEX idx_comments_assigned ON comments(assigned_to) WHERE assigned_to IS NOT NULL;

-- Anchor data examples:
-- text_selection: {"start": 1234, "end": 1456, "section": "introduction"}
-- table_cell: {"tableId": "table-1", "row": 3, "column": "mean_age"}
-- figure_region: {"figureId": "fig-2", "x": 100, "y": 150, "width": 200, "height": 100}
-- slide_region: {"slideNumber": 5, "x": 50, "y": 75, "width": 300, "height": 150}
```

### 2.6 Presence Tracking

**Purpose**: Show who's currently editing

```sql
CREATE TABLE user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),

  -- Location in document
  section VARCHAR(100),                      -- IMRaD section
  cursor_position INT,                       -- Character offset
  selection_start INT,
  selection_end INT,

  -- Activity
  last_activity TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  -- Session
  session_id VARCHAR(255) NOT NULL,

  CONSTRAINT user_presence_pkey PRIMARY KEY (id),
  CONSTRAINT user_presence_unique_session UNIQUE (artifact_id, user_id, session_id)
);

CREATE INDEX idx_user_presence_artifact ON user_presence(artifact_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_presence_last_activity ON user_presence(last_activity);

-- Auto-cleanup: Mark inactive after 5 minutes
-- Trigger or cron job: UPDATE user_presence SET is_active = FALSE WHERE last_activity < NOW() - INTERVAL '5 minutes'
```

### 2.7 Audit Log Enhancement

**Purpose**: Comprehensive audit trail for compliance

```sql
CREATE TABLE artifact_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,

  -- Action tracking
  action VARCHAR(100) NOT NULL,              -- 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'COMMENT', 'RESOLVE_COMMENT'
  action_category VARCHAR(50),               -- 'CONTENT', 'METADATA', 'PHI', 'VERSION', 'COLLABORATION'

  -- Actor
  user_id VARCHAR(255) NOT NULL,
  user_role VARCHAR(50),

  -- Details
  details JSONB NOT NULL,
  before_state JSONB,                        -- State before change
  after_state JSONB,                         -- State after change

  -- Hash chain (tamper detection)
  previous_hash VARCHAR(64),                 -- SHA-256 of previous audit entry
  current_hash VARCHAR(64) NOT NULL,         -- SHA-256 of this entry

  -- PHI tracking
  phi_scanned BOOLEAN DEFAULT FALSE,
  phi_findings INT DEFAULT 0,

  -- Timestamps
  timestamp TIMESTAMP DEFAULT NOW(),

  CONSTRAINT artifact_audit_log_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_audit_log_artifact ON artifact_audit_log(artifact_id, timestamp DESC);
CREATE INDEX idx_audit_log_user ON artifact_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_log_action ON artifact_audit_log(action);
CREATE INDEX idx_audit_log_timestamp ON artifact_audit_log(timestamp DESC);
```

---

## 3. API Design

### 3.1 Artifact Graph API

**Base Path**: `/api/v2/artifacts`

```typescript
// GET /api/v2/artifacts/:id
interface GetArtifactResponse {
  artifact: Artifact;
  metadata: {
    upstreamCount: number;
    downstreamCount: number;
    phiStatus: PHIStatus;
  };
}

// GET /api/v2/artifacts/:id/graph?depth=3&direction=both
interface GetArtifactGraphResponse {
  nodes: Artifact[];
  edges: ArtifactEdge[];
  outdatedNodes: string[]; // IDs of nodes that need refresh
}

// POST /api/v2/artifacts/:id/link
interface CreateArtifactLinkRequest {
  targetArtifactId: string;
  relationType: RelationType;
  transformationType?: string;
  transformationConfig?: Record<string, unknown>;
}

// GET /api/v2/artifacts/:id/outdated-check
interface OutdatedCheckResponse {
  isOutdated: boolean;
  reasons: Array<{
    sourceArtifact: Artifact;
    reason: string; // "source_updated" | "version_mismatch" | "manual_flag"
    sourceUpdatedAt: Date;
    edgeCreatedAt: Date;
  }>;
  suggestedActions: string[];
}
```

### 3.2 Version Control API

**Base Path**: `/api/v2/manuscripts/:manuscriptId/versions`

```typescript
// GET /api/v2/manuscripts/:manuscriptId/versions
interface ListVersionsResponse {
  versions: ManuscriptVersion[];
  total: number;
  currentVersion: number;
}

// POST /api/v2/manuscripts/:manuscriptId/versions
interface CreateVersionRequest {
  changeDescription: string;
  includeYjsSnapshot?: boolean;
}

// POST /api/v2/manuscripts/:manuscriptId/versions/diff
interface VersionDiffRequest {
  fromVersionId: string;
  toVersionId: string;
  options?: {
    diffGranularity: 'word' | 'sentence' | 'paragraph';
    includeMetadata: boolean;
  };
}

interface VersionDiffResponse {
  sections: Array<{
    section: IMRaDSection;
    changes: Array<{
      type: 'added' | 'removed' | 'modified';
      fromText: string;
      toText: string;
      wordCountDelta: number;
    }>;
  }>;
  metadata: {
    totalWordCountDelta: number;
    sectionsChanged: string[];
  };
}

// POST /api/v2/manuscripts/:manuscriptId/versions/:versionId/restore
interface RestoreVersionRequest {
  changeDescription: string;
  phiOverride?: boolean; // Requires admin role
}
```

### 3.3 Comment API

**Base Path**: `/api/v2/comments`

```typescript
// POST /api/v2/comments
interface CreateCommentRequest {
  artifactId: string;
  versionId?: string;
  parentCommentId?: string;
  anchorType: AnchorType;
  anchorData: Record<string, unknown>;
  body: string;
  assignedTo?: string;
}

// GET /api/v2/artifacts/:artifactId/comments?status=open&anchor_type=text_selection
interface ListCommentsResponse {
  comments: Comment[];
  threads: Array<{
    threadId: string;
    rootComment: Comment;
    replies: Comment[];
    unresolvedCount: number;
  }>;
}

// PATCH /api/v2/comments/:commentId
interface UpdateCommentRequest {
  body?: string;
  resolved?: boolean;
  assignedTo?: string;
}

// DELETE /api/v2/comments/:commentId
// Soft delete only
```

### 3.4 Real-time Collaboration API (WebSocket)

**WebSocket Endpoint**: `wss://api.researchflow.com/collab/:manuscriptId`

```typescript
// Client → Server messages
type CollabClientMessage =
  | { type: 'SYNC_REQUEST'; clock: number }
  | { type: 'UPDATE'; update: Uint8Array; clock: number }
  | { type: 'AWARENESS_UPDATE'; state: AwarenessState }
  | { type: 'CURSOR_MOVE'; section: string; position: number };

// Server → Client messages
type CollabServerMessage =
  | { type: 'SYNC_RESPONSE'; updates: Uint8Array[]; clock: number }
  | { type: 'UPDATE'; update: Uint8Array; userId: string; clock: number }
  | { type: 'PRESENCE_UPDATE'; users: PresenceUser[] }
  | { type: 'SYNC_ERROR'; error: string };

interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor: {
    section: string;
    position: number;
    selection?: { start: number; end: number };
  };
}

interface PresenceUser {
  userId: string;
  userName: string;
  color: string;
  section: string;
  isActive: boolean;
}
```

### 3.5 Export API Enhancement

**Base Path**: `/api/v2/manuscripts/:manuscriptId/export`

```typescript
// POST /api/v2/manuscripts/:manuscriptId/export
interface ExportRequest {
  format: 'docx' | 'pdf' | 'latex' | 'markdown';
  options: {
    includeTrackChanges?: boolean;      // DOCX only
    fromVersionId?: string;              // For track-changes diff
    toVersionId?: string;
    includeComments?: boolean;
    phiRedaction?: 'none' | 'mask' | 'remove';
  };
}

interface ExportResponse {
  exportId: string;
  artifactId: string;                    // Created artifact for export
  downloadUrl: string;
  expiresAt: Date;
  phiStatus: PHIStatus;
  metadata: {
    format: string;
    fileSize: number;
    generatedAt: Date;
  };
}

// GET /api/v2/exports/:exportId/download
// Returns file buffer with appropriate Content-Type
```

---

## 4. Real-time Collaboration

### 4.1 Technology Stack

**CRDT Library**: Yjs (https://github.com/yjs/yjs)
- Conflict-free replicated data type
- Proven in production (Google Docs-like experience)
- Small binary format for updates
- Offline support with eventual consistency

**Transport**: y-websocket
- WebSocket provider for Yjs
- Handles connection management
- Automatic reconnection

**Editor**: ProseMirror + y-prosemirror
- Rich text editing
- Collaborative editing binding
- Plugin ecosystem

### 4.2 Architecture

```
┌─────────────────────────────────────────────────┐
│   Client 1 Browser                               │
│   ┌──────────────┐    ┌──────────────┐         │
│   │ ProseMirror  │◄──►│ Yjs Document │         │
│   │   Editor     │    │   (Y.Doc)    │         │
│   └──────────────┘    └───────┬──────┘         │
│                               │                 │
│                         ┌─────▼──────┐          │
│                         │ WebSocket  │          │
│                         │   Client   │          │
│                         └─────┬──────┘          │
└───────────────────────────────┼──────────────────┘
                                │ wss://
                                │
┌───────────────────────────────▼──────────────────┐
│   Node.js Orchestrator                           │
│   ┌──────────────────────────────────┐          │
│   │  WebSocket Server (ws library)   │          │
│   │  ┌────────────────────────────┐  │          │
│   │  │ Y.Doc per manuscript room  │  │          │
│   │  │ (in-memory Yjs state)      │  │          │
│   │  └────────────┬───────────────┘  │          │
│   └───────────────┼──────────────────┘          │
│                   │                              │
│   ┌───────────────▼───────────────┐             │
│   │  Persistence Layer             │             │
│   │  - Save Yjs updates to DB      │             │
│   │  - Create snapshots every N    │             │
│   │  - Compact old updates         │             │
│   └───────────────┬────────────────┘             │
│                   │                              │
└───────────────────┼──────────────────────────────┘
                    │
        ┌───────────▼────────────┐
        │   PostgreSQL           │
        │   manuscript_yjs_      │
        │   updates table        │
        └────────────────────────┘
```

### 4.3 WebSocket Server Implementation

**File**: `services/orchestrator/src/collaboration/websocket-server.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { createServer } from 'http';
import { db } from '../db';

const docMap = new Map<string, Y.Doc>();

export function createCollaborationServer(httpServer: ReturnType<typeof createServer>) {
  const wss = new WebSocketServer({ server: httpServer, path: '/collab' });

  wss.on('connection', async (ws: WebSocket, req) => {
    const manuscriptId = extractManuscriptId(req.url);

    if (!manuscriptId) {
      ws.close(1008, 'Missing manuscript ID');
      return;
    }

    // Get or create Yjs doc for this manuscript
    let doc = docMap.get(manuscriptId);
    if (!doc) {
      doc = await loadOrCreateDoc(manuscriptId);
      docMap.set(manuscriptId, doc);
    }

    // Setup y-websocket connection
    setupWSConnection(ws, req, { docName: manuscriptId, gc: true });

    // Persist updates to database
    doc.on('update', async (update: Uint8Array, origin: any) => {
      if (origin !== 'db-load') {
        await persistUpdate(manuscriptId, update);
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      // If no more connections, save snapshot and remove from memory
      const connections = Array.from(wss.clients).filter(
        client => client.readyState === WebSocket.OPEN
      );
      if (connections.length === 0) {
        saveSnapshot(manuscriptId, doc!);
        docMap.delete(manuscriptId);
      }
    });
  });

  return wss;
}

async function loadOrCreateDoc(manuscriptId: string): Promise<Y.Doc> {
  const doc = new Y.Doc();

  // Load latest snapshot
  const snapshot = await db.query(
    'SELECT yjs_snapshot FROM manuscript_versions WHERE manuscript_id = $1 ORDER BY version_number DESC LIMIT 1',
    [manuscriptId]
  );

  if (snapshot.rows.length > 0 && snapshot.rows[0].yjs_snapshot) {
    Y.applyUpdate(doc, snapshot.rows[0].yjs_snapshot, 'db-load');
  }

  // Load incremental updates since snapshot
  const updates = await db.query(
    'SELECT update_data FROM manuscript_yjs_updates WHERE manuscript_id = $1 ORDER BY clock ASC',
    [manuscriptId]
  );

  for (const row of updates.rows) {
    Y.applyUpdate(doc, row.update_data, 'db-load');
  }

  return doc;
}

async function persistUpdate(manuscriptId: string, update: Uint8Array) {
  const clock = Date.now(); // Use high-resolution timestamp
  await db.query(
    'INSERT INTO manuscript_yjs_updates (manuscript_id, clock, update_data) VALUES ($1, $2, $3)',
    [manuscriptId, clock, Buffer.from(update)]
  );
}

async function saveSnapshot(manuscriptId: string, doc: Y.Doc) {
  const snapshot = Y.encodeStateAsUpdate(doc);
  // Create new version with snapshot
  await db.query(
    'UPDATE manuscript_versions SET yjs_snapshot = $1 WHERE manuscript_id = $2 AND version_number = (SELECT MAX(version_number) FROM manuscript_versions WHERE manuscript_id = $2)',
    [Buffer.from(snapshot), manuscriptId]
  );
}
```

### 4.4 Client Integration

**File**: `services/web/src/components/editor/CollaborativeEditor.tsx`

```typescript
import { useEffect, useRef, useState } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

interface CollaborativeEditorProps {
  manuscriptId: string;
  section: string;
  userId: string;
  userName: string;
}

export function CollaborativeEditor({ manuscriptId, section, userId, userName }: CollaborativeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Create Yjs document
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText(section); // Separate Y.Text per section

    // Setup WebSocket provider
    const provider = new WebsocketProvider(
      `wss://${window.location.host}/collab`,
      manuscriptId,
      ydoc,
      {
        params: { userId, userName }
      }
    );

    // Awareness (presence)
    const awareness = provider.awareness;
    awareness.setLocalStateField('user', {
      name: userName,
      color: generateUserColor(userId)
    });

    // Create ProseMirror editor
    const state = EditorState.create({
      schema,
      plugins: [
        ySyncPlugin(ytext),
        yCursorPlugin(awareness),
        yUndoPlugin(),
      ],
    });

    const view = new EditorView(editorRef.current, {
      state,
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr);
        view.updateState(newState);

        // Update cursor position in awareness
        if (tr.selection) {
          awareness.setLocalStateField('cursor', {
            section,
            position: tr.selection.from,
            selection: { start: tr.selection.from, end: tr.selection.to }
          });
        }
      },
    });

    setView(view);

    return () => {
      provider.destroy();
      view.destroy();
    };
  }, [manuscriptId, section, userId, userName]);

  return (
    <div>
      <div ref={editorRef} className="prose-editor" />
      <PresenceIndicators manuscriptId={manuscriptId} />
    </div>
  );
}

function generateUserColor(userId: string): string {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
```

---

## 5. Comment System

### 5.1 Anchor Types

**Text Selection Anchor**:
```typescript
interface TextSelectionAnchor {
  type: 'text_selection';
  section: IMRaDSection;       // 'introduction', 'methods', etc.
  start: number;               // Character offset from section start
  end: number;                 // Character offset (exclusive)
  selectedText: string;        // First 100 chars for preview
}
```

**Table Cell Anchor**:
```typescript
interface TableCellAnchor {
  type: 'table_cell';
  tableId: string;
  row: number;                 // 0-indexed row
  column: string | number;     // Column name or index
  cellValue: string;           // Cell content for preview
}
```

**Figure Region Anchor**:
```typescript
interface FigureRegionAnchor {
  type: 'figure_region';
  figureId: string;
  x: number;                   // Pixels from left
  y: number;                   // Pixels from top
  width: number;
  height: number;
}
```

**Slide Region Anchor**:
```typescript
interface SlideRegionAnchor {
  type: 'slide_region';
  slideNumber: number;
  x: number;                   // Percentage from left (0-100)
  y: number;                   // Percentage from top (0-100)
  width: number;               // Percentage width
  height: number;              // Percentage height
}
```

### 5.2 Comment UI Components

**InlineComment**: Highlights text with comment indicator
**CommentThread**: Displays threaded conversation
**CommentPanel**: Sidebar showing all comments
**ResolveButton**: Mark comment as resolved

---

## 6. Version Control Enhancement

### 6.1 Diff Algorithm

**Text Diff**: Use `diff-match-patch` for word-level diff
- Generate operations: [INSERT, DELETE, EQUAL]
- Highlight additions in green, deletions in red
- Calculate word count delta per section

**Structured Diff**: Custom algorithm for tables/figures
- Compare cell-by-cell for tables
- Image comparison for figures (pixel diff or hash)

### 6.2 Restore Workflow

1. User selects previous version
2. System creates NEW version (immutable history)
3. New version has `restoredFrom: previousVersionId` in metadata
4. PHI status inherited from restored version
5. Audit log records: `RESTORE_VERSION` action

---

## 7. Artifact Graph & Provenance

### 7.1 Graph Traversal Algorithms

**Upstream Traversal** (get ancestors):
```sql
WITH RECURSIVE upstream AS (
  SELECT source_artifact_id, target_artifact_id, relation_type, 1 as depth
  FROM artifact_edges
  WHERE target_artifact_id = $1

  UNION ALL

  SELECT e.source_artifact_id, e.target_artifact_id, e.relation_type, u.depth + 1
  FROM artifact_edges e
  INNER JOIN upstream u ON e.target_artifact_id = u.source_artifact_id
  WHERE u.depth < $2  -- max depth limit
)
SELECT DISTINCT a.*
FROM artifacts a
INNER JOIN upstream u ON a.id = u.source_artifact_id;
```

**Downstream Traversal** (get descendants):
```sql
WITH RECURSIVE downstream AS (
  SELECT source_artifact_id, target_artifact_id, relation_type, 1 as depth
  FROM artifact_edges
  WHERE source_artifact_id = $1

  UNION ALL

  SELECT e.source_artifact_id, e.target_artifact_id, e.relation_type, d.depth + 1
  FROM artifact_edges e
  INNER JOIN downstream d ON e.source_artifact_id = d.target_artifact_id
  WHERE d.depth < $2
)
SELECT DISTINCT a.*
FROM artifacts a
INNER JOIN downstream d ON a.id = d.target_artifact_id;
```

### 7.2 Outdated Detection

**Algorithm**:
1. For each edge where artifact is target:
   - Compare `source.updated_at` with `edge.created_at`
   - If source updated after edge created → OUTDATED
2. Check if source has newer version than `edge.source_version_id`
3. Check manual "needs_refresh" flag in metadata

### 7.3 Graph Visualization

**Library**: React Flow (https://reactflow.dev/)
- Drag-and-drop nodes
- Auto-layout (Dagre algorithm)
- Zoom/pan controls
- Custom node rendering

**Node Colors**:
- Blue: Topic
- Green: Literature
- Yellow: Dataset
- Orange: Analysis
- Purple: Manuscript
- Red: Outdated
- Gray: Archived

---

## 8. Conference Prep Enhancement

### 8.1 Material Versioning

**Artifact Types**:
- `conference_poster_source` (PPTX editable)
- `conference_poster_export` (PDF final)
- `conference_slides_source` (PPTX editable)
- `conference_slides_export` (PDF final)

**Edges**:
- Manuscript --[generated_from]--> Poster Source
- Poster Source --[exported_to]--> Poster Export

### 8.2 Requirements Schema

```typescript
interface ConferenceRequirements {
  id: string;
  conferenceName: string;
  abstractWordLimit: number;
  posterDimensions: {
    width: number;
    height: number;
    unit: 'inches' | 'cm';
  };
  slideCountLimit?: number;
  presentationDuration?: number; // minutes
  requiredSections: string[];
  fileFormats: string[];
  submissionDeadline: Date;
  metadata: Record<string, unknown>;
}
```

Stored as artifact type `conference_requirements`

### 8.3 Validation Service

**File**: `services/orchestrator/src/conference/validation.service.ts`

```typescript
export async function validateConferenceMaterial(
  materialArtifactId: string,
  requirementsArtifactId: string
): Promise<ValidationReport> {
  const material = await getArtifact(materialArtifactId);
  const requirements = await getArtifact(requirementsArtifactId);

  const checks: ValidationCheck[] = [];

  // Word count check for abstracts
  if (material.type === 'conference_abstract') {
    const wordCount = countWords(material.metadata.content);
    checks.push({
      id: 'word_count',
      passed: wordCount <= requirements.metadata.abstractWordLimit,
      message: `Abstract has ${wordCount} words (limit: ${requirements.metadata.abstractWordLimit})`
    });
  }

  // Dimension check for posters
  if (material.type === 'conference_poster_export') {
    const dims = material.metadata.dimensions;
    const reqDims = requirements.metadata.posterDimensions;
    checks.push({
      id: 'poster_dimensions',
      passed: dims.width === reqDims.width && dims.height === reqDims.height,
      message: `Poster dimensions: ${dims.width}x${dims.height} ${dims.unit}`
    });
  }

  // PHI check
  checks.push({
    id: 'phi_scan',
    passed: material.phi_status === 'PASS',
    message: material.phi_status === 'PASS' ? 'No PHI detected' : 'PHI detected - cannot submit'
  });

  return {
    materialId: materialArtifactId,
    requirementsId: requirementsArtifactId,
    checks,
    overallStatus: checks.every(c => c.passed) ? 'PASS' : 'FAIL',
    timestamp: new Date()
  };
}
```

---

## 9. PHI & Security Considerations

### 9.1 PHI Scanning Points

**New Scan Points**:
1. **Comment Creation**: Scan comment body before save
2. **Yjs Update**: Sample every Nth update and scan
3. **Version Restore**: Inherit PHI status from source version
4. **Export**: Final scan before file generation
5. **Conference Material**: Scan PPTX text extraction

### 9.2 Scan Integration Pattern

```typescript
async function createComment(req: CreateCommentRequest): Promise<Comment> {
  // PHI scan
  const scanResult = await phiGuard.scanBeforeInsertion(
    req.body,
    { context: 'comment', userId: req.userId }
  );

  if (scanResult.findings.length > 0 && !req.phiOverride) {
    throw new PHIDetectedError(scanResult.findings);
  }

  // Create comment
  const comment = await db.query(
    'INSERT INTO comments (...) VALUES (...) RETURNING *',
    [...]
  );

  // Audit log
  await auditLog.log({
    action: 'CREATE_COMMENT',
    artifactId: req.artifactId,
    userId: req.userId,
    details: { commentId: comment.id, phiScanned: true }
  });

  return comment;
}
```

### 9.3 Role-Based Access Control

**Roles**:
- `OWNER`: Full control
- `EDITOR`: Edit + comment
- `REVIEWER`: Comment only
- `VIEWER`: Read only

**Permission Check**:
```typescript
function canEditArtifact(userId: string, artifactId: string): Promise<boolean> {
  return db.query(
    `SELECT 1 FROM artifact_permissions
     WHERE artifact_id = $1 AND user_id = $2 AND role IN ('OWNER', 'EDITOR')`,
    [artifactId, userId]
  ).then(res => res.rows.length > 0);
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Version Diff Tests**:
- Word-level diff accuracy
- Section-by-section comparison
- Word count delta calculation

**Comment Anchor Tests**:
- Text selection validation
- Table cell reference resolution
- Figure region bounds checking

**Graph Traversal Tests**:
- Upstream query correctness
- Downstream query correctness
- Cycle detection
- Depth limiting

### 10.2 Integration Tests

**CRDT Sync Tests**:
- Two clients editing simultaneously
- Conflict resolution
- Offline editing + reconnect
- Large document performance

**PHI Scan Tests**:
- Comment PHI detection
- Yjs update sampling
- Export final scan

### 10.3 E2E Test Scenario

```typescript
test('Collaborative editing workflow', async () => {
  // 1. Create manuscript
  const manuscript = await createManuscript({ title: 'Test Manuscript' });

  // 2. User A starts editing
  const editorA = await openCollaborativeEditor(manuscript.id, 'user-a');
  await editorA.type('Introduction text');

  // 3. User B joins and edits different section
  const editorB = await openCollaborativeEditor(manuscript.id, 'user-b');
  await editorB.selectSection('methods');
  await editorB.type('Methods text');

  // 4. User A adds comment
  await editorA.selectText('Introduction', 0, 10);
  await editorA.addComment('This needs citation');

  // 5. Create version
  await createVersion(manuscript.id, 'Initial draft complete');

  // 6. Edit more
  await editorA.type(' Additional text');

  // 7. Create new version
  await createVersion(manuscript.id, 'Added more details');

  // 8. View diff
  const diff = await getVersionDiff(manuscript.id, version1.id, version2.id);
  expect(diff.sections[0].changes).toHaveLength(1);
  expect(diff.sections[0].changes[0].type).toBe('added');

  // 9. Export with track changes
  const exportResult = await exportManuscript(manuscript.id, {
    format: 'docx',
    includeTrackChanges: true,
    fromVersionId: version1.id,
    toVersionId: version2.id,
  });

  // 10. Download and verify
  const file = await downloadExport(exportResult.exportId);
  expect(file.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // 11. Check artifact graph
  const graph = await getArtifactGraph(manuscript.id);
  expect(graph.nodes).toHaveLength(2); // manuscript + export artifact
  expect(graph.edges).toHaveLength(1); // manuscript --[exported_to]--> export
});
```

---

## 11. Performance Considerations

### 11.1 Scalability

**Yjs Update Compaction**:
- Compact updates older than 30 days
- Keep snapshots every 100 versions
- Archive old updates to cold storage

**Database Partitioning**:
- Partition `manuscript_yjs_updates` by manuscript_id
- Partition `artifact_audit_log` by timestamp (monthly)

**Caching**:
- Cache artifact graph in Redis (TTL 5 minutes)
- Cache presence data in Redis (TTL 30 seconds)

### 11.2 Rate Limiting

**WebSocket Updates**: Max 10 updates/sec per client
**Comment Creation**: Max 30 comments/min per user
**Export Generation**: Max 5 exports/hour per manuscript

---

## 12. Migration Plan

### 12.1 Phase 1: Database Schema (Week 1)

1. Create migration files
2. Run in staging environment
3. Backfill existing manuscripts to artifacts table
4. Verify data integrity

### 12.2 Phase 2: API Implementation (Week 2-3)

1. Implement artifact graph endpoints
2. Implement comment CRUD endpoints
3. Add version diff endpoint
4. Enhance export endpoint

### 12.3 Phase 3: Real-time Collaboration (Week 4-5)

1. Setup WebSocket server
2. Integrate Yjs persistence
3. Build ProseMirror editor component
4. Deploy to staging

### 12.4 Phase 4: UI Components (Week 6-7)

1. Artifact graph visualization
2. Comment panel
3. Version diff viewer
4. Track-changes export integration

### 12.5 Phase 5: Testing & Rollout (Week 8)

1. E2E test suite
2. Load testing
3. Feature flag rollout
4. Monitor metrics

---

## 13. Rollback Strategy

**Feature Flags**:
- `ENABLE_COLLABORATION`: Toggle CRDT editor
- `ENABLE_COMMENTS`: Toggle comment system
- `ENABLE_ARTIFACT_GRAPH`: Toggle graph visualization

**Data Safety**:
- Dual-write to old and new version systems during migration
- Keep in-memory version control as fallback
- Database backups before each migration step

**Monitoring**:
- Alert on WebSocket connection failures
- Alert on PHI scan failures
- Alert on export generation errors
- Track collaboration latency (p95 < 200ms)

---

## Appendix A: Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| CRDT | Yjs | Industry standard, proven at scale |
| Editor | ProseMirror | Rich ecosystem, extensible |
| WebSocket | ws library | Lightweight, Node.js native |
| Diff | diff-match-patch | Accurate word-level diffs |
| Graph Viz | React Flow | Interactive, customizable |
| DOCX Export | docx library | Track-changes support |

---

## Appendix B: Open Questions

1. **Yjs Persistence Strategy**: Should we use y-indexeddb on client for offline?
2. **Comment Notifications**: Email or in-app only?
3. **Graph Layout**: Manual or auto-layout by default?
4. **Export Retention**: How long to keep generated exports?
5. **Presence Timeout**: Mark inactive after how many seconds?

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Author**: Engineering Team
**Status**: Ready for Implementation
