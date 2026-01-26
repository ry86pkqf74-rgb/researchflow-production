# ResearchFlow P0 Features - Implementation Plan

## Overview

This document breaks down P0 features into 4 incremental PRs, each deliverable and testable independently.

**Timeline**: 8 weeks (2 weeks per PR)
**Team**: 2-3 engineers
**Risk**: Medium (CRDT complexity, PHI compliance)

---

## PR #1: Foundation - Database Schema & Artifact Graph API

**Goal**: Establish persistent storage and artifact graph infrastructure
**Duration**: 2 weeks
**Dependencies**: None
**Reviewers**: Tech Lead, Security Engineer

### Changes

#### 1.1 Database Migrations

**File**: `services/orchestrator/migrations/001_artifacts_and_graph.sql`

```sql
-- Migration: Create artifacts and graph tables
-- Created: 2026-01-20

BEGIN;

-- Core artifacts table
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

  -- Ownership
  owner_user_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_status ON artifacts(status);
CREATE INDEX idx_artifacts_owner ON artifacts(owner_user_id);
CREATE INDEX idx_artifacts_phi_status ON artifacts(phi_status);
CREATE INDEX idx_artifacts_updated_at ON artifacts(updated_at DESC);
CREATE INDEX idx_artifacts_metadata_gin ON artifacts USING gin(metadata);

-- Artifact relationships
CREATE TABLE artifact_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  target_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,

  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN (
    'derived_from', 'references', 'supersedes', 'uses',
    'generated_from', 'exported_to', 'annotates'
  )),

  transformation_type VARCHAR(100),
  transformation_config JSONB,

  source_version_id UUID,
  target_version_id UUID,

  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT no_self_loops CHECK (source_artifact_id != target_artifact_id)
);

CREATE INDEX idx_artifact_edges_source ON artifact_edges(source_artifact_id);
CREATE INDEX idx_artifact_edges_target ON artifact_edges(target_artifact_id);
CREATE INDEX idx_artifact_edges_relation_type ON artifact_edges(relation_type);
CREATE UNIQUE INDEX idx_artifact_edges_unique ON artifact_edges(
  source_artifact_id, target_artifact_id, relation_type
);

-- Audit log
CREATE TABLE artifact_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,

  action VARCHAR(100) NOT NULL,
  action_category VARCHAR(50),

  user_id VARCHAR(255) NOT NULL,
  user_role VARCHAR(50),

  details JSONB NOT NULL,
  before_state JSONB,
  after_state JSONB,

  previous_hash VARCHAR(64),
  current_hash VARCHAR(64) NOT NULL,

  phi_scanned BOOLEAN DEFAULT FALSE,
  phi_findings INT DEFAULT 0,

  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_artifact ON artifact_audit_log(artifact_id, timestamp DESC);
CREATE INDEX idx_audit_log_user ON artifact_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_log_action ON artifact_audit_log(action);
CREATE INDEX idx_audit_log_timestamp ON artifact_audit_log(timestamp DESC);

COMMIT;
```

**File**: `services/orchestrator/migrations/002_manuscript_versions.sql`

```sql
-- Migration: Enhanced version control with Yjs support
BEGIN;

CREATE TABLE manuscript_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  content_json JSONB NOT NULL,
  yjs_snapshot BYTEA,

  created_by VARCHAR(255) NOT NULL,
  change_description TEXT,
  data_snapshot_hash VARCHAR(64),

  word_count INT,
  section_counts JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT manuscript_versions_unique_number UNIQUE (manuscript_id, version_number)
);

CREATE INDEX idx_manuscript_versions_manuscript ON manuscript_versions(manuscript_id, version_number DESC);
CREATE INDEX idx_manuscript_versions_created_at ON manuscript_versions(created_at DESC);

-- Yjs updates
CREATE TABLE manuscript_yjs_updates (
  id BIGSERIAL PRIMARY KEY,
  manuscript_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,

  clock BIGINT NOT NULL,
  update_data BYTEA NOT NULL,

  user_id VARCHAR(255),
  applied_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_yjs_updates_manuscript ON manuscript_yjs_updates(manuscript_id, clock);
CREATE INDEX idx_yjs_updates_applied_at ON manuscript_yjs_updates(applied_at);

COMMIT;
```

#### 1.2 Backend Services

**File**: `services/orchestrator/src/services/artifact-graph.service.ts`

```typescript
import { db } from '../db';
import { Artifact, ArtifactEdge, ArtifactGraph } from '@packages/core/types/artifacts';

export class ArtifactGraphService {
  async getArtifact(id: string): Promise<Artifact | null> {
    const result = await db.query(
      'SELECT * FROM artifacts WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async createArtifact(data: CreateArtifactInput): Promise<Artifact> {
    const result = await db.query(
      `INSERT INTO artifacts (type, name, description, owner_user_id, organization_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.type, data.name, data.description, data.ownerUserId, data.organizationId, data.metadata || {}]
    );
    return result.rows[0];
  }

  async linkArtifacts(data: LinkArtifactsInput): Promise<ArtifactEdge> {
    // Check for cycles
    if (await this.wouldCreateCycle(data.sourceArtifactId, data.targetArtifactId)) {
      throw new Error('Cannot create link: would create cycle');
    }

    const result = await db.query(
      `INSERT INTO artifact_edges (
        source_artifact_id, target_artifact_id, relation_type,
        transformation_type, transformation_config, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        data.sourceArtifactId,
        data.targetArtifactId,
        data.relationType,
        data.transformationType,
        data.transformationConfig || {},
        data.metadata || {}
      ]
    );

    await this.auditLog('CREATE_EDGE', data);
    return result.rows[0];
  }

  async getArtifactGraph(artifactId: string, depth: number = 3, direction: 'both' | 'upstream' | 'downstream' = 'both'): Promise<ArtifactGraph> {
    const nodes: Artifact[] = [];
    const edges: ArtifactEdge[] = [];

    if (direction === 'upstream' || direction === 'both') {
      const upstream = await this.getUpstream(artifactId, depth);
      nodes.push(...upstream.nodes);
      edges.push(...upstream.edges);
    }

    if (direction === 'downstream' || direction === 'both') {
      const downstream = await this.getDownstream(artifactId, depth);
      nodes.push(...downstream.nodes);
      edges.push(...downstream.edges);
    }

    // Add root node
    const root = await this.getArtifact(artifactId);
    if (root) nodes.push(root);

    // Deduplicate
    const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
    const uniqueEdges = Array.from(new Map(edges.map(e => [e.id, e])).values());

    // Check outdated status
    const outdatedNodes = await this.checkOutdated(uniqueNodes, uniqueEdges);

    return {
      nodes: uniqueNodes,
      edges: uniqueEdges,
      outdatedNodes,
      rootArtifactId: artifactId
    };
  }

  private async getUpstream(artifactId: string, depth: number): Promise<{ nodes: Artifact[], edges: ArtifactEdge[] }> {
    const query = `
      WITH RECURSIVE upstream AS (
        SELECT e.id, e.source_artifact_id, e.target_artifact_id, e.relation_type, e.created_at, e.metadata, 1 as depth
        FROM artifact_edges e
        WHERE e.target_artifact_id = $1

        UNION ALL

        SELECT e.id, e.source_artifact_id, e.target_artifact_id, e.relation_type, e.created_at, e.metadata, u.depth + 1
        FROM artifact_edges e
        INNER JOIN upstream u ON e.target_artifact_id = u.source_artifact_id
        WHERE u.depth < $2
      )
      SELECT
        a.id, a.type, a.name, a.description, a.status, a.phi_scanned, a.phi_status,
        a.owner_user_id, a.organization_id, a.created_at, a.updated_at, a.metadata,
        u.id as edge_id, u.relation_type, u.created_at as edge_created_at
      FROM artifacts a
      INNER JOIN upstream u ON a.id = u.source_artifact_id
      WHERE a.deleted_at IS NULL
    `;

    const result = await db.query(query, [artifactId, depth]);

    const nodes: Artifact[] = [];
    const edges: ArtifactEdge[] = [];
    const seenNodes = new Set<string>();
    const seenEdges = new Set<string>();

    for (const row of result.rows) {
      if (!seenNodes.has(row.id)) {
        nodes.push({
          id: row.id,
          type: row.type,
          name: row.name,
          description: row.description,
          status: row.status,
          phiScanned: row.phi_scanned,
          phiStatus: row.phi_status,
          ownerUserId: row.owner_user_id,
          organizationId: row.organization_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          metadata: row.metadata
        });
        seenNodes.add(row.id);
      }

      if (!seenEdges.has(row.edge_id)) {
        edges.push({
          id: row.edge_id,
          sourceArtifactId: row.id,
          targetArtifactId: artifactId,
          relationType: row.relation_type,
          createdAt: row.edge_created_at
        });
        seenEdges.add(row.edge_id);
      }
    }

    return { nodes, edges };
  }

  private async getDownstream(artifactId: string, depth: number): Promise<{ nodes: Artifact[], edges: ArtifactEdge[] }> {
    const query = `
      WITH RECURSIVE downstream AS (
        SELECT e.id, e.source_artifact_id, e.target_artifact_id, e.relation_type, e.created_at, e.metadata, 1 as depth
        FROM artifact_edges e
        WHERE e.source_artifact_id = $1

        UNION ALL

        SELECT e.id, e.source_artifact_id, e.target_artifact_id, e.relation_type, e.created_at, e.metadata, d.depth + 1
        FROM artifact_edges e
        INNER JOIN downstream d ON e.source_artifact_id = d.target_artifact_id
        WHERE d.depth < $2
      )
      SELECT
        a.id, a.type, a.name, a.description, a.status, a.phi_scanned, a.phi_status,
        a.owner_user_id, a.organization_id, a.created_at, a.updated_at, a.metadata,
        d.id as edge_id, d.relation_type, d.created_at as edge_created_at
      FROM artifacts a
      INNER JOIN downstream d ON a.id = d.target_artifact_id
      WHERE a.deleted_at IS NULL
    `;

    const result = await db.query(query, [artifactId, depth]);

    const nodes: Artifact[] = [];
    const edges: ArtifactEdge[] = [];
    const seenNodes = new Set<string>();
    const seenEdges = new Set<string>();

    for (const row of result.rows) {
      if (!seenNodes.has(row.id)) {
        nodes.push({
          id: row.id,
          type: row.type,
          name: row.name,
          description: row.description,
          status: row.status,
          phiScanned: row.phi_scanned,
          phiStatus: row.phi_status,
          ownerUserId: row.owner_user_id,
          organizationId: row.organization_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          metadata: row.metadata
        });
        seenNodes.add(row.id);
      }

      if (!seenEdges.has(row.edge_id)) {
        edges.push({
          id: row.edge_id,
          sourceArtifactId: artifactId,
          targetArtifactId: row.id,
          relationType: row.relation_type,
          createdAt: row.edge_created_at
        });
        seenEdges.add(row.edge_id);
      }
    }

    return { nodes, edges };
  }

  private async checkOutdated(nodes: Artifact[], edges: ArtifactEdge[]): Promise<string[]> {
    const outdated: string[] = [];

    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.id === edge.sourceArtifactId);
      if (!sourceNode) continue;

      // Check if source was updated after edge creation
      if (new Date(sourceNode.updatedAt) > new Date(edge.createdAt)) {
        const targetNode = nodes.find(n => n.id === edge.targetArtifactId);
        if (targetNode && !outdated.includes(targetNode.id)) {
          outdated.push(targetNode.id);
        }
      }
    }

    return outdated;
  }

  private async wouldCreateCycle(sourceId: string, targetId: string): Promise<boolean> {
    // Check if adding edge source -> target would create cycle
    // by checking if there's already a path from target to source
    const query = `
      WITH RECURSIVE paths AS (
        SELECT source_artifact_id, target_artifact_id, 1 as depth
        FROM artifact_edges
        WHERE source_artifact_id = $1

        UNION ALL

        SELECT e.source_artifact_id, e.target_artifact_id, p.depth + 1
        FROM artifact_edges e
        INNER JOIN paths p ON e.source_artifact_id = p.target_artifact_id
        WHERE p.depth < 10
      )
      SELECT 1 FROM paths WHERE target_artifact_id = $2 LIMIT 1
    `;

    const result = await db.query(query, [targetId, sourceId]);
    return result.rows.length > 0;
  }

  private async auditLog(action: string, data: any): Promise<void> {
    // Implement audit logging (hash chain pattern)
    // TODO: Full implementation
  }
}
```

#### 1.3 API Routes

**File**: `services/orchestrator/src/routes/v2/artifacts.routes.ts`

```typescript
import { Router } from 'express';
import { ArtifactGraphService } from '../../services/artifact-graph.service';
import { authenticateToken } from '../../middleware/auth';

const router = Router();
const artifactService = new ArtifactGraphService();

// GET /api/v2/artifacts/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const artifact = await artifactService.getArtifact(req.params.id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json({ artifact });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/artifacts/:id/graph
router.get('/:id/graph', authenticateToken, async (req, res) => {
  try {
    const depth = parseInt(req.query.depth as string) || 3;
    const direction = (req.query.direction as string) || 'both';

    const graph = await artifactService.getArtifactGraph(
      req.params.id,
      depth,
      direction as 'both' | 'upstream' | 'downstream'
    );

    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/artifacts/:id/link
router.post('/:id/link', authenticateToken, async (req, res) => {
  try {
    const edge = await artifactService.linkArtifacts({
      sourceArtifactId: req.params.id,
      targetArtifactId: req.body.targetArtifactId,
      relationType: req.body.relationType,
      transformationType: req.body.transformationType,
      transformationConfig: req.body.transformationConfig,
      metadata: req.body.metadata
    });

    res.status(201).json({ edge });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/v2/artifact-edges/:edgeId
router.delete('/edges/:edgeId', authenticateToken, async (req, res) => {
  try {
    await artifactService.deleteEdge(req.params.edgeId);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

#### 1.4 Types

**File**: `packages/core/types/artifacts.ts`

```typescript
export type ArtifactType =
  | 'topic'
  | 'literature'
  | 'dataset'
  | 'analysis'
  | 'manuscript'
  | 'conference_poster'
  | 'conference_slides'
  | 'conference_abstract'
  | 'figure'
  | 'table';

export type ArtifactStatus = 'draft' | 'active' | 'review' | 'approved' | 'archived';

export type PHIStatus = 'PASS' | 'FAIL' | 'PENDING' | 'OVERRIDE';

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  description?: string;
  status: ArtifactStatus;
  phiScanned: boolean;
  phiStatus?: PHIStatus;
  phiScanDate?: Date;
  phiFindingsCount: number;
  ownerUserId: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  metadata: Record<string, unknown>;
}

export type RelationType =
  | 'derived_from'
  | 'references'
  | 'supersedes'
  | 'uses'
  | 'generated_from'
  | 'exported_to'
  | 'annotates';

export interface ArtifactEdge {
  id: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  relationType: RelationType;
  transformationType?: string;
  transformationConfig?: Record<string, unknown>;
  sourceVersionId?: string;
  targetVersionId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface ArtifactGraph {
  nodes: Artifact[];
  edges: ArtifactEdge[];
  outdatedNodes: string[];
  rootArtifactId: string;
}
```

#### 1.5 Tests

**File**: `services/orchestrator/src/services/__tests__/artifact-graph.service.test.ts`

```typescript
import { ArtifactGraphService } from '../artifact-graph.service';
import { db } from '../../db';

describe('ArtifactGraphService', () => {
  let service: ArtifactGraphService;

  beforeAll(async () => {
    service = new ArtifactGraphService();
    await db.query('BEGIN');
  });

  afterAll(async () => {
    await db.query('ROLLBACK');
  });

  describe('createArtifact', () => {
    it('should create an artifact', async () => {
      const artifact = await service.createArtifact({
        type: 'manuscript',
        name: 'Test Manuscript',
        ownerUserId: 'user-1',
        metadata: {}
      });

      expect(artifact.id).toBeDefined();
      expect(artifact.type).toBe('manuscript');
      expect(artifact.name).toBe('Test Manuscript');
    });
  });

  describe('linkArtifacts', () => {
    it('should create an edge', async () => {
      const source = await service.createArtifact({
        type: 'dataset',
        name: 'Dataset 1',
        ownerUserId: 'user-1',
        metadata: {}
      });

      const target = await service.createArtifact({
        type: 'analysis',
        name: 'Analysis 1',
        ownerUserId: 'user-1',
        metadata: {}
      });

      const edge = await service.linkArtifacts({
        sourceArtifactId: source.id,
        targetArtifactId: target.id,
        relationType: 'derived_from'
      });

      expect(edge.sourceArtifactId).toBe(source.id);
      expect(edge.targetArtifactId).toBe(target.id);
    });

    it('should prevent cycles', async () => {
      const a1 = await service.createArtifact({
        type: 'manuscript',
        name: 'A1',
        ownerUserId: 'user-1',
        metadata: {}
      });

      const a2 = await service.createArtifact({
        type: 'manuscript',
        name: 'A2',
        ownerUserId: 'user-1',
        metadata: {}
      });

      await service.linkArtifacts({
        sourceArtifactId: a1.id,
        targetArtifactId: a2.id,
        relationType: 'derived_from'
      });

      await expect(
        service.linkArtifacts({
          sourceArtifactId: a2.id,
          targetArtifactId: a1.id,
          relationType: 'derived_from'
        })
      ).rejects.toThrow('would create cycle');
    });
  });

  describe('getArtifactGraph', () => {
    it('should return upstream and downstream nodes', async () => {
      // Create chain: dataset -> analysis -> manuscript
      const dataset = await service.createArtifact({
        type: 'dataset',
        name: 'Dataset',
        ownerUserId: 'user-1',
        metadata: {}
      });

      const analysis = await service.createArtifact({
        type: 'analysis',
        name: 'Analysis',
        ownerUserId: 'user-1',
        metadata: {}
      });

      const manuscript = await service.createArtifact({
        type: 'manuscript',
        name: 'Manuscript',
        ownerUserId: 'user-1',
        metadata: {}
      });

      await service.linkArtifacts({
        sourceArtifactId: dataset.id,
        targetArtifactId: analysis.id,
        relationType: 'derived_from'
      });

      await service.linkArtifacts({
        sourceArtifactId: analysis.id,
        targetArtifactId: manuscript.id,
        relationType: 'derived_from'
      });

      const graph = await service.getArtifactGraph(analysis.id, 3, 'both');

      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(2);
      expect(graph.nodes.find(n => n.id === dataset.id)).toBeDefined();
      expect(graph.nodes.find(n => n.id === manuscript.id)).toBeDefined();
    });
  });

  describe('checkOutdated', () => {
    it('should detect outdated artifacts', async () => {
      const source = await service.createArtifact({
        type: 'dataset',
        name: 'Dataset',
        ownerUserId: 'user-1',
        metadata: {}
      });

      const target = await service.createArtifact({
        type: 'analysis',
        name: 'Analysis',
        ownerUserId: 'user-1',
        metadata: {}
      });

      await service.linkArtifacts({
        sourceArtifactId: source.id,
        targetArtifactId: target.id,
        relationType: 'derived_from'
      });

      // Update source artifact
      await db.query('UPDATE artifacts SET updated_at = NOW() WHERE id = $1', [source.id]);

      const graph = await service.getArtifactGraph(target.id, 3, 'upstream');

      expect(graph.outdatedNodes).toContain(target.id);
    });
  });
});
```

### Checklist

- [ ] Create migration files
- [ ] Run migrations in local dev environment
- [ ] Implement ArtifactGraphService
- [ ] Implement artifact routes
- [ ] Add types to @packages/core
- [ ] Write unit tests (target >85% coverage)
- [ ] Test cycle detection
- [ ] Test outdated detection
- [ ] Document API endpoints (OpenAPI spec)
- [ ] PR review and merge

---

## PR #2: Comments & Version Control Enhancement

**Goal**: Add inline comments and persistent version control
**Duration**: 2 weeks
**Dependencies**: PR #1 merged
**Reviewers**: Tech Lead, Product Manager

### Changes

#### 2.1 Database Migrations

**File**: `services/orchestrator/migrations/003_comments.sql`

```sql
BEGIN;

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_id UUID REFERENCES manuscript_versions(id) ON DELETE SET NULL,

  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL,

  anchor_type VARCHAR(50) NOT NULL CHECK (anchor_type IN (
    'text_selection', 'table_cell', 'figure_region', 'slide_region', 'entire_section'
  )),
  anchor_data JSONB NOT NULL,

  body TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,

  assigned_to VARCHAR(255),

  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_comments_artifact ON comments(artifact_id);
CREATE INDEX idx_comments_version ON comments(version_id);
CREATE INDEX idx_comments_thread ON comments(thread_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_resolved ON comments(resolved) WHERE NOT resolved;
CREATE INDEX idx_comments_assigned ON comments(assigned_to) WHERE assigned_to IS NOT NULL;

COMMIT;
```

#### 2.2 Comment Service

**File**: `services/orchestrator/src/services/comment.service.ts`

```typescript
import { db } from '../db';
import { phiGuard } from '../phi/phi-guard.service';
import { Comment, CreateCommentInput, AnchorType } from '@packages/core/types/comments';

export class CommentService {
  async createComment(input: CreateCommentInput): Promise<Comment> {
    // PHI scan
    const scanResult = await phiGuard.scanBeforeInsertion(input.body, {
      context: 'comment',
      userId: input.createdBy
    });

    if (scanResult.findings.length > 0 && !input.phiOverride) {
      throw new Error('PHI detected in comment');
    }

    // Generate thread_id if root comment
    const threadId = input.parentCommentId
      ? await this.getThreadId(input.parentCommentId)
      : crypto.randomUUID();

    const result = await db.query(
      `INSERT INTO comments (
        artifact_id, version_id, parent_comment_id, thread_id,
        anchor_type, anchor_data, body, created_by, assigned_to
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.artifactId,
        input.versionId,
        input.parentCommentId,
        threadId,
        input.anchorType,
        input.anchorData,
        input.body,
        input.createdBy,
        input.assignedTo
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async getCommentThreads(artifactId: string, filters?: CommentFilters): Promise<CommentThread[]> {
    let query = `
      WITH root_comments AS (
        SELECT * FROM comments
        WHERE artifact_id = $1 AND parent_comment_id IS NULL AND deleted_at IS NULL
    `;

    const params: any[] = [artifactId];
    let paramIndex = 2;

    if (filters?.resolved !== undefined) {
      query += ` AND resolved = $${paramIndex}`;
      params.push(filters.resolved);
      paramIndex++;
    }

    if (filters?.anchorType) {
      query += ` AND anchor_type = $${paramIndex}`;
      params.push(filters.anchorType);
      paramIndex++;
    }

    query += `
      ),
      replies AS (
        SELECT * FROM comments
        WHERE parent_comment_id IN (SELECT id FROM root_comments)
          AND deleted_at IS NULL
      )
      SELECT
        root.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', r.id,
              'body', r.body,
              'created_by', r.created_by,
              'created_at', r.created_at
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as replies
      FROM root_comments root
      LEFT JOIN replies r ON r.parent_comment_id = root.id
      GROUP BY root.id
      ORDER BY root.created_at DESC
    `;

    const result = await db.query(query, params);

    return result.rows.map(row => ({
      threadId: row.thread_id,
      rootComment: this.mapRow(row),
      replies: row.replies.map((r: any) => this.mapRow(r)),
      unresolvedCount: row.resolved ? 0 : 1 + row.replies.filter((r: any) => !r.resolved).length
    }));
  }

  async resolveComment(commentId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE comments
       SET resolved = TRUE, resolved_by = $1, resolved_at = NOW()
       WHERE id = $2`,
      [userId, commentId]
    );
  }

  private async getThreadId(commentId: string): Promise<string> {
    const result = await db.query('SELECT thread_id FROM comments WHERE id = $1', [commentId]);
    return result.rows[0]?.thread_id;
  }

  private mapRow(row: any): Comment {
    return {
      id: row.id,
      artifactId: row.artifact_id,
      versionId: row.version_id,
      parentCommentId: row.parent_comment_id,
      threadId: row.thread_id,
      anchorType: row.anchor_type,
      anchorData: row.anchor_data,
      body: row.body,
      resolved: row.resolved,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      assignedTo: row.assigned_to,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
```

#### 2.3 Version Control Migration

**File**: `services/orchestrator/src/services/version-control-persistent.service.ts`

```typescript
import { db } from '../db';
import { ManuscriptVersion } from '@packages/core/types/manuscript';
import * as Y from 'yjs';

export class VersionControlPersistentService {
  async createVersion(manuscriptId: string, input: CreateVersionInput): Promise<ManuscriptVersion> {
    // Get current version number
    const maxVersionResult = await db.query(
      'SELECT MAX(version_number) as max_version FROM manuscript_versions WHERE manuscript_id = $1',
      [manuscriptId]
    );
    const versionNumber = (maxVersionResult.rows[0]?.max_version || 0) + 1;

    // Get current content (from latest Yjs state or JSON)
    const content = await this.getCurrentContent(manuscriptId);

    // Optional: Generate Yjs snapshot
    let yjsSnapshot: Buffer | null = null;
    if (input.includeYjsSnapshot) {
      const doc = await this.loadYjsDoc(manuscriptId);
      yjsSnapshot = Buffer.from(Y.encodeStateAsUpdate(doc));
    }

    // Calculate word count
    const wordCount = this.calculateWordCount(content);
    const sectionCounts = this.calculateSectionCounts(content);

    const result = await db.query(
      `INSERT INTO manuscript_versions (
        manuscript_id, version_number, content_json, yjs_snapshot,
        created_by, change_description, word_count, section_counts
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        manuscriptId,
        versionNumber,
        content,
        yjsSnapshot,
        input.createdBy,
        input.changeDescription,
        wordCount,
        sectionCounts
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async getVersionDiff(manuscriptId: string, fromVersionId: string, toVersionId: string): Promise<VersionDiff> {
    const fromVersion = await this.getVersion(fromVersionId);
    const toVersion = await this.getVersion(toVersionId);

    if (!fromVersion || !toVersion) {
      throw new Error('Version not found');
    }

    // Perform diff
    const sections = this.diffSections(fromVersion.contentJson, toVersion.contentJson);

    return {
      fromVersionId,
      toVersionId,
      sections,
      metadata: {
        totalWordCountDelta: (toVersion.wordCount || 0) - (fromVersion.wordCount || 0),
        sectionsChanged: sections.map(s => s.section)
      }
    };
  }

  async restoreVersion(manuscriptId: string, versionId: string, userId: string): Promise<ManuscriptVersion> {
    const sourceVersion = await this.getVersion(versionId);
    if (!sourceVersion) {
      throw new Error('Version not found');
    }

    // Create new version with content from source
    return this.createVersion(manuscriptId, {
      createdBy: userId,
      changeDescription: `Restored from version ${sourceVersion.versionNumber}`,
      includeYjsSnapshot: false,
      content: sourceVersion.contentJson,
      metadata: { restoredFrom: versionId }
    });
  }

  private diffSections(from: any, to: any): SectionDiff[] {
    // Implement diff algorithm (use diff-match-patch)
    // TODO: Full implementation
    return [];
  }

  private calculateWordCount(content: any): number {
    // Count words across all sections
    let total = 0;
    for (const section in content) {
      if (typeof content[section].content === 'string') {
        total += content[section].content.split(/\s+/).length;
      }
    }
    return total;
  }

  private calculateSectionCounts(content: any): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const section in content) {
      if (typeof content[section].content === 'string') {
        counts[section] = content[section].content.split(/\s+/).length;
      }
    }
    return counts;
  }

  private async getCurrentContent(manuscriptId: string): Promise<any> {
    // Get from latest version or Yjs state
    const latest = await db.query(
      'SELECT content_json FROM manuscript_versions WHERE manuscript_id = $1 ORDER BY version_number DESC LIMIT 1',
      [manuscriptId]
    );
    return latest.rows[0]?.content_json || {};
  }

  private async getVersion(versionId: string): Promise<ManuscriptVersion | null> {
    const result = await db.query('SELECT * FROM manuscript_versions WHERE id = $1', [versionId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private async loadYjsDoc(manuscriptId: string): Promise<Y.Doc> {
    // Load Yjs document from database
    const doc = new Y.Doc();
    // TODO: Load updates
    return doc;
  }

  private mapRow(row: any): ManuscriptVersion {
    return {
      id: row.id,
      manuscriptId: row.manuscript_id,
      versionNumber: row.version_number,
      contentJson: row.content_json,
      yjsSnapshot: row.yjs_snapshot,
      createdBy: row.created_by,
      changeDescription: row.change_description,
      wordCount: row.word_count,
      sectionCounts: row.section_counts,
      createdAt: row.created_at
    };
  }
}
```

### Checklist

- [ ] Create comments migration
- [ ] Implement CommentService with PHI scanning
- [ ] Implement comment routes
- [ ] Migrate VersionControlService to database
- [ ] Implement diff algorithm (diff-match-patch)
- [ ] Implement restore functionality
- [ ] Write unit tests for comments
- [ ] Write unit tests for version diff
- [ ] Integration test: create comment → resolve → check PHI scan
- [ ] PR review and merge

---

## PR #3: Real-time Collaboration (CRDT)

**Goal**: Enable simultaneous editing with Yjs
**Duration**: 2 weeks
**Dependencies**: PR #2 merged
**Reviewers**: Tech Lead, Senior Engineer

### Changes

#### 3.1 WebSocket Server

**File**: `services/orchestrator/src/collaboration/websocket-server.ts`

(Implemented in design doc - see section 4.3)

#### 3.2 Presence Service

**File**: `services/orchestrator/migrations/004_presence.sql`

```sql
BEGIN;

CREATE TABLE user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),

  section VARCHAR(100),
  cursor_position INT,
  selection_start INT,
  selection_end INT,

  last_activity TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  session_id VARCHAR(255) NOT NULL,

  CONSTRAINT user_presence_unique_session UNIQUE (artifact_id, user_id, session_id)
);

CREATE INDEX idx_user_presence_artifact ON user_presence(artifact_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_presence_last_activity ON user_presence(last_activity);

COMMIT;
```

#### 3.3 Client Editor Component

**File**: `services/web/src/components/editor/CollaborativeEditor.tsx`

(Implemented in design doc - see section 4.4)

#### 3.4 Yjs Persistence

**File**: `services/orchestrator/src/collaboration/yjs-persistence.ts`

```typescript
import * as Y from 'yjs';
import { db } from '../db';

export async function persistUpdate(manuscriptId: string, update: Uint8Array): Promise<void> {
  const clock = Date.now();
  await db.query(
    'INSERT INTO manuscript_yjs_updates (manuscript_id, clock, update_data) VALUES ($1, $2, $3)',
    [manuscriptId, clock, Buffer.from(update)]
  );
}

export async function loadOrCreateDoc(manuscriptId: string): Promise<Y.Doc> {
  const doc = new Y.Doc();

  // Load latest snapshot
  const snapshot = await db.query(
    'SELECT yjs_snapshot FROM manuscript_versions WHERE manuscript_id = $1 ORDER BY version_number DESC LIMIT 1',
    [manuscriptId]
  );

  if (snapshot.rows.length > 0 && snapshot.rows[0].yjs_snapshot) {
    Y.applyUpdate(doc, snapshot.rows[0].yjs_snapshot, 'db-load');
  }

  // Load incremental updates
  const updates = await db.query(
    'SELECT update_data FROM manuscript_yjs_updates WHERE manuscript_id = $1 ORDER BY clock ASC',
    [manuscriptId]
  );

  for (const row of updates.rows) {
    Y.applyUpdate(doc, row.update_data, 'db-load');
  }

  return doc;
}

export async function saveSnapshot(manuscriptId: string, doc: Y.Doc): Promise<void> {
  const snapshot = Y.encodeStateAsUpdate(doc);
  await db.query(
    'UPDATE manuscript_versions SET yjs_snapshot = $1 WHERE manuscript_id = $2 AND version_number = (SELECT MAX(version_number) FROM manuscript_versions WHERE manuscript_id = $2)',
    [Buffer.from(snapshot), manuscriptId]
  );
}
```

### Checklist

- [ ] Install yjs, y-prosemirror, y-websocket dependencies
- [ ] Implement WebSocket server with Yjs integration
- [ ] Implement presence tracking
- [ ] Create CollaborativeEditor React component
- [ ] Implement Yjs persistence layer
- [ ] Add presence indicators UI
- [ ] Test with 2+ concurrent editors
- [ ] Test offline editing + sync
- [ ] Load test: 10 concurrent editors
- [ ] PR review and merge

---

## PR #4: UI Integration & Export Enhancement

**Goal**: Complete UI for graph, comments, diff, and DOCX track-changes export
**Duration**: 2 weeks
**Dependencies**: PR #3 merged
**Reviewers**: Product Manager, Design Lead

### Changes

#### 4.1 Artifact Graph Visualization

**File**: `services/web/src/components/graph/ArtifactGraphViewer.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ArtifactGraphViewerProps {
  artifactId: string;
  depth?: number;
}

export function ArtifactGraphViewer({ artifactId, depth = 3 }: ArtifactGraphViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { data: graph, isLoading } = useQuery({
    queryKey: ['artifact-graph', artifactId, depth],
    queryFn: () =>
      apiRequest<ArtifactGraph>(`/api/v2/artifacts/${artifactId}/graph?depth=${depth}`)
  });

  useEffect(() => {
    if (!graph) return;

    // Convert artifacts to React Flow nodes
    const flowNodes: Node[] = graph.nodes.map((artifact, index) => ({
      id: artifact.id,
      type: 'default',
      data: {
        label: artifact.name,
        type: artifact.type,
        phiStatus: artifact.phiStatus,
        isOutdated: graph.outdatedNodes.includes(artifact.id)
      },
      position: { x: index * 200, y: index * 100 }, // Simple layout, use Dagre for better layout
      style: {
        background: getNodeColor(artifact.type, graph.outdatedNodes.includes(artifact.id)),
        border: artifact.id === artifactId ? '2px solid #000' : '1px solid #ccc',
        borderRadius: '8px',
        padding: '10px'
      }
    }));

    // Convert edges
    const flowEdges: Edge[] = graph.edges.map(edge => ({
      id: edge.id,
      source: edge.sourceArtifactId,
      target: edge.targetArtifactId,
      label: edge.relationType.replace('_', ' '),
      animated: false,
      style: { stroke: '#888' }
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graph]);

  if (isLoading) return <div>Loading graph...</div>;

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

function getNodeColor(type: string, isOutdated: boolean): string {
  if (isOutdated) return '#FF6B6B'; // Red for outdated

  const colors: Record<string, string> = {
    topic: '#4A90E2',
    literature: '#50C878',
    dataset: '#FFB347',
    analysis: '#FF7F50',
    manuscript: '#9B59B6',
    conference_poster: '#E91E63',
    conference_slides: '#9C27B0'
  };

  return colors[type] || '#95A5A6';
}
```

#### 4.2 Comment Panel

**File**: `services/web/src/components/comments/CommentPanel.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Comment, CommentThread } from '@packages/core/types/comments';

interface CommentPanelProps {
  artifactId: string;
  versionId?: string;
}

export function CommentPanel({ artifactId, versionId }: CommentPanelProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');

  const { data: threads, isLoading } = useQuery({
    queryKey: ['comments', artifactId, filter],
    queryFn: () =>
      apiRequest<{ threads: CommentThread[] }>(
        `/api/v2/artifacts/${artifactId}/comments?status=${filter === 'all' ? '' : filter === 'open' ? 'open' : 'resolved'}`
      ).then(res => res.threads)
  });

  const resolveMutation = useMutation({
    mutationFn: (commentId: string) =>
      apiRequest(`/api/v2/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved: true })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', artifactId] });
    }
  });

  if (isLoading) return <div>Loading comments...</div>;

  return (
    <div className="comment-panel">
      <div className="filter-tabs">
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
          All
        </button>
        <button onClick={() => setFilter('open')} className={filter === 'open' ? 'active' : ''}>
          Open
        </button>
        <button onClick={() => setFilter('resolved')} className={filter === 'resolved' ? 'active' : ''}>
          Resolved
        </button>
      </div>

      <div className="threads">
        {threads?.map(thread => (
          <div key={thread.threadId} className="thread">
            <CommentView comment={thread.rootComment} onResolve={resolveMutation.mutate} />
            {thread.replies.map(reply => (
              <div key={reply.id} className="reply">
                <CommentView comment={reply} onResolve={resolveMutation.mutate} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentView({ comment, onResolve }: { comment: Comment; onResolve: (id: string) => void }) {
  return (
    <div className="comment">
      <div className="comment-header">
        <span className="author">{comment.createdBy}</span>
        <span className="timestamp">{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      <div className="comment-body">{comment.body}</div>
      <div className="comment-actions">
        {!comment.resolved && (
          <button onClick={() => onResolve(comment.id)}>Resolve</button>
        )}
      </div>
    </div>
  );
}
```

#### 4.3 Version Diff Viewer

**File**: `services/web/src/components/version/VersionDiffViewer.tsx`

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { VersionDiff } from '@packages/core/types/version';

interface VersionDiffViewerProps {
  manuscriptId: string;
  fromVersionId: string;
  toVersionId: string;
}

export function VersionDiffViewer({ manuscriptId, fromVersionId, toVersionId }: VersionDiffViewerProps) {
  const { data: diff, isLoading } = useQuery({
    queryKey: ['version-diff', manuscriptId, fromVersionId, toVersionId],
    queryFn: () =>
      apiRequest<VersionDiff>(`/api/v2/manuscripts/${manuscriptId}/versions/diff`, {
        method: 'POST',
        body: JSON.stringify({ fromVersionId, toVersionId })
      })
  });

  if (isLoading) return <div>Loading diff...</div>;
  if (!diff) return <div>No diff data</div>;

  return (
    <div className="version-diff">
      <div className="diff-metadata">
        <p>Total word count change: {diff.metadata.totalWordCountDelta > 0 ? '+' : ''}{diff.metadata.totalWordCountDelta}</p>
        <p>Sections changed: {diff.metadata.sectionsChanged.join(', ')}</p>
      </div>

      {diff.sections.map(section => (
        <div key={section.section} className="section-diff">
          <h3>{section.section}</h3>
          {section.changes.map((change, idx) => (
            <div key={idx} className={`change change-${change.type}`}>
              {change.type === 'added' && <span className="added">+ {change.toText}</span>}
              {change.type === 'removed' && <span className="removed">- {change.fromText}</span>}
              {change.type === 'modified' && (
                <>
                  <span className="removed">- {change.fromText}</span>
                  <span className="added">+ {change.toText}</span>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

#### 4.4 Track-Changes DOCX Export

**File**: `services/orchestrator/src/export/docx-track-changes.service.ts`

```typescript
import {
  Document,
  Paragraph,
  TextRun,
  TrackRevisions,
  AlignmentType,
  HeadingLevel
} from 'docx';
import { VersionDiff } from '@packages/core/types/version';

export async function generateTrackChangesDocx(
  manuscript: Manuscript,
  fromVersion: ManuscriptVersion,
  toVersion: ManuscriptVersion,
  diff: VersionDiff
): Promise<Buffer> {
  const doc = new Document({
    features: {
      trackRevisions: true
    },
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: manuscript.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER
          }),

          // Process each section with track changes
          ...generateSectionsWithTrackChanges(diff)
        ]
      }
    ]
  });

  return await Packer.toBuffer(doc);
}

function generateSectionsWithTrackChanges(diff: VersionDiff): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const section of diff.sections) {
    // Section heading
    paragraphs.push(
      new Paragraph({
        text: section.section.toUpperCase(),
        heading: HeadingLevel.HEADING_1
      })
    );

    // Process changes
    for (const change of section.changes) {
      if (change.type === 'added') {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: change.toText,
                revision: {
                  id: 1,
                  author: 'Author',
                  date: new Date(),
                  type: 'insert'
                }
              })
            ]
          })
        );
      } else if (change.type === 'removed') {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: change.fromText,
                revision: {
                  id: 2,
                  author: 'Author',
                  date: new Date(),
                  type: 'delete'
                }
              })
            ]
          })
        );
      } else if (change.type === 'modified') {
        // Show as delete + insert
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: change.fromText,
                revision: {
                  id: 3,
                  author: 'Author',
                  date: new Date(),
                  type: 'delete'
                }
              }),
              new TextRun({ text: ' ' }),
              new TextRun({
                text: change.toText,
                revision: {
                  id: 4,
                  author: 'Author',
                  date: new Date(),
                  type: 'insert'
                }
              })
            ]
          })
        );
      }
    }
  }

  return paragraphs;
}
```

### Checklist

- [ ] Install reactflow, docx dependencies
- [ ] Implement ArtifactGraphViewer component
- [ ] Implement CommentPanel component
- [ ] Implement VersionDiffViewer component
- [ ] Implement track-changes DOCX export
- [ ] Add routes for new UI pages
- [ ] Style components (Tailwind CSS)
- [ ] E2E test: view graph → click node → view details
- [ ] E2E test: add comment → resolve → verify in panel
- [ ] E2E test: view diff → export DOCX → verify track changes in Word
- [ ] PR review and merge

---

## Summary

**Total Duration**: 8 weeks
**Total PRs**: 4
**Team Size**: 2-3 engineers

### Milestones

- **Week 2**: PR #1 merged - Artifact graph infrastructure live
- **Week 4**: PR #2 merged - Comments and enhanced versions available
- **Week 6**: PR #3 merged - Real-time collaboration enabled
- **Week 8**: PR #4 merged - Full UI complete, track-changes export working

### Dependencies

```
PR #1 (Foundation)
  ↓
PR #2 (Comments + Versions)
  ↓
PR #3 (Collaboration)
  ↓
PR #4 (UI)
```

### Risk Mitigation

1. **CRDT Complexity**: Start with simple text editing, add rich formatting later
2. **PHI Compliance**: Add PHI scan to every input point, fail closed
3. **Performance**: Load test WebSocket server early, implement rate limiting
4. **Backward Compatibility**: Feature flag all new UI, keep old version control as fallback

### Success Metrics

- [ ] 2+ users can edit simultaneously without conflicts
- [ ] Comment creation <500ms latency
- [ ] Graph rendering <2s for 100 nodes
- [ ] DOCX export contains actual Word track-changes markup
- [ ] 0 PHI leaks in production
- [ ] >85% test coverage on new code
