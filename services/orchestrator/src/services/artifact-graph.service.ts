/**
 * Artifact Graph Service
 *
 * Manages artifact provenance tracking and dependency graph.
 * Implements cycle detection and outdated artifact detection.
 */

import { db } from '../db';
import crypto from 'crypto';

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

export interface CreateArtifactInput {
  type: ArtifactType;
  name: string;
  description?: string;
  ownerUserId: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

export interface LinkArtifactsInput {
  sourceArtifactId: string;
  targetArtifactId: string;
  relationType: RelationType;
  transformationType?: string;
  transformationConfig?: Record<string, unknown>;
  sourceVersionId?: string;
  targetVersionId?: string;
  metadata?: Record<string, unknown>;
}

export interface OutdatedCheckResult {
  isOutdated: boolean;
  reasons: Array<{
    sourceArtifactId: string;
    sourceArtifactName: string;
    reason: 'source_updated' | 'version_mismatch' | 'manual_flag';
    sourceUpdatedAt: Date;
    edgeCreatedAt: Date;
  }>;
  suggestedActions: string[];
}

export class ArtifactGraphService {
  /**
   * Get single artifact by ID
   */
  async getArtifact(id: string): Promise<Artifact | null> {
    const result = await db.query(
      'SELECT * FROM artifacts WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapArtifactRow(result.rows[0]);
  }

  /**
   * Create new artifact
   */
  async createArtifact(data: CreateArtifactInput): Promise<Artifact> {
    const result = await db.query(
      `INSERT INTO artifacts (type, name, description, owner_user_id, organization_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.type,
        data.name,
        data.description,
        data.ownerUserId,
        data.organizationId,
        JSON.stringify(data.metadata || {})
      ]
    );

    const artifact = this.mapArtifactRow(result.rows[0]);

    // Audit log
    await this.auditLog({
      action: 'CREATE_ARTIFACT',
      artifactId: artifact.id,
      userId: data.ownerUserId,
      details: { type: data.type, name: data.name }
    });

    return artifact;
  }

  /**
   * Update artifact metadata
   */
  async updateArtifact(
    id: string,
    updates: Partial<Pick<Artifact, 'name' | 'description' | 'status' | 'metadata'>>,
    userId: string
  ): Promise<Artifact> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    values.push(id);

    const result = await db.query(
      `UPDATE artifacts SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Artifact not found');
    }

    const artifact = this.mapArtifactRow(result.rows[0]);

    await this.auditLog({
      action: 'UPDATE_ARTIFACT',
      artifactId: id,
      userId,
      details: { updates }
    });

    return artifact;
  }

  /**
   * Link two artifacts with a relationship
   */
  async linkArtifacts(data: LinkArtifactsInput, userId: string): Promise<ArtifactEdge> {
    // Check for cycles
    const wouldCycle = await this.wouldCreateCycle(data.sourceArtifactId, data.targetArtifactId);
    if (wouldCycle) {
      throw new Error('Cannot create link: would create cycle in artifact graph');
    }

    // Verify both artifacts exist
    const [source, target] = await Promise.all([
      this.getArtifact(data.sourceArtifactId),
      this.getArtifact(data.targetArtifactId)
    ]);

    if (!source) throw new Error(`Source artifact ${data.sourceArtifactId} not found`);
    if (!target) throw new Error(`Target artifact ${data.targetArtifactId} not found`);

    const result = await db.query(
      `INSERT INTO artifact_edges (
        source_artifact_id, target_artifact_id, relation_type,
        transformation_type, transformation_config,
        source_version_id, target_version_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.sourceArtifactId,
        data.targetArtifactId,
        data.relationType,
        data.transformationType,
        JSON.stringify(data.transformationConfig || {}),
        data.sourceVersionId,
        data.targetVersionId,
        JSON.stringify(data.metadata || {})
      ]
    );

    const edge = this.mapEdgeRow(result.rows[0]);

    await this.auditLog({
      action: 'CREATE_EDGE',
      artifactId: data.targetArtifactId,
      userId,
      details: {
        sourceArtifactId: data.sourceArtifactId,
        relationType: data.relationType
      }
    });

    return edge;
  }

  /**
   * Delete an edge (soft delete)
   */
  async deleteEdge(edgeId: string, userId: string): Promise<void> {
    const result = await db.query(
      'UPDATE artifact_edges SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [edgeId]
    );

    if (result.rows.length > 0) {
      await this.auditLog({
        action: 'DELETE_EDGE',
        artifactId: result.rows[0].target_artifact_id,
        userId,
        details: { edgeId }
      });
    }
  }

  /**
   * Get artifact graph with upstream and/or downstream nodes
   */
  async getArtifactGraph(
    artifactId: string,
    depth: number = 3,
    direction: 'both' | 'upstream' | 'downstream' = 'both'
  ): Promise<ArtifactGraph> {
    const nodes: Artifact[] = [];
    const edges: ArtifactEdge[] = [];

    // Get upstream (ancestors)
    if (direction === 'upstream' || direction === 'both') {
      const upstream = await this.getUpstream(artifactId, depth);
      nodes.push(...upstream.nodes);
      edges.push(...upstream.edges);
    }

    // Get downstream (descendants)
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

  /**
   * Check if artifact is outdated (needs refresh)
   */
  async checkArtifactOutdated(artifactId: string): Promise<OutdatedCheckResult> {
    const graph = await this.getArtifactGraph(artifactId, 1, 'upstream');

    const reasons: OutdatedCheckResult['reasons'] = [];
    const suggestedActions: string[] = [];

    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.sourceArtifactId);
      if (!sourceNode) continue;

      // Check if source was updated after edge creation
      if (new Date(sourceNode.updatedAt) > new Date(edge.createdAt)) {
        reasons.push({
          sourceArtifactId: sourceNode.id,
          sourceArtifactName: sourceNode.name,
          reason: 'source_updated',
          sourceUpdatedAt: sourceNode.updatedAt,
          edgeCreatedAt: edge.createdAt
        });

        suggestedActions.push(
          `Re-run transformation from ${sourceNode.name} to regenerate artifact`
        );
      }

      // Check manual flag
      if (edge.metadata?.needsRefresh) {
        reasons.push({
          sourceArtifactId: sourceNode.id,
          sourceArtifactName: sourceNode.name,
          reason: 'manual_flag',
          sourceUpdatedAt: sourceNode.updatedAt,
          edgeCreatedAt: edge.createdAt
        });

        suggestedActions.push(
          `Manual refresh flag set for ${sourceNode.name} → ${graph.nodes.find(n => n.id === artifactId)?.name}`
        );
      }
    }

    return {
      isOutdated: reasons.length > 0,
      reasons,
      suggestedActions
    };
  }

  /**
   * Soft delete an artifact
   */
  async softDeleteArtifact(id: string, userId: string): Promise<void> {
    const artifact = await this.getArtifact(id);
    if (!artifact) {
      throw new Error(`Artifact ${id} not found`);
    }

    // Soft delete by setting deleted_at timestamp
    await db.query(
      'UPDATE artifacts SET deleted_at = NOW() WHERE id = $1',
      [id]
    );

    // Audit log
    await this.auditLog({
      action: 'DELETE_ARTIFACT',
      artifactId: id,
      userId,
      details: {
        artifactType: artifact.type,
        artifactName: artifact.name
      }
    });
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Get upstream artifacts (ancestors)
   */
  private async getUpstream(artifactId: string, depth: number): Promise<{ nodes: Artifact[], edges: ArtifactEdge[] }> {
    const query = `
      WITH RECURSIVE upstream AS (
        SELECT
          e.id as edge_id,
          e.source_artifact_id,
          e.target_artifact_id,
          e.relation_type,
          e.transformation_type,
          e.transformation_config,
          e.source_version_id,
          e.target_version_id,
          e.created_at as edge_created_at,
          e.metadata as edge_metadata,
          1 as depth
        FROM artifact_edges e
        WHERE e.target_artifact_id = $1 AND e.deleted_at IS NULL

        UNION ALL

        SELECT
          e.id,
          e.source_artifact_id,
          e.target_artifact_id,
          e.relation_type,
          e.transformation_type,
          e.transformation_config,
          e.source_version_id,
          e.target_version_id,
          e.created_at,
          e.metadata,
          u.depth + 1
        FROM artifact_edges e
        INNER JOIN upstream u ON e.target_artifact_id = u.source_artifact_id
        WHERE u.depth < $2 AND e.deleted_at IS NULL
      )
      SELECT
        a.*,
        u.edge_id,
        u.relation_type,
        u.transformation_type,
        u.transformation_config,
        u.source_version_id,
        u.target_version_id,
        u.edge_created_at,
        u.edge_metadata
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
        nodes.push(this.mapArtifactRow(row));
        seenNodes.add(row.id);
      }

      if (!seenEdges.has(row.edge_id)) {
        edges.push({
          id: row.edge_id,
          sourceArtifactId: row.id,
          targetArtifactId: row.target_artifact_id,
          relationType: row.relation_type,
          transformationType: row.transformation_type,
          transformationConfig: row.transformation_config,
          sourceVersionId: row.source_version_id,
          targetVersionId: row.target_version_id,
          createdAt: row.edge_created_at,
          metadata: row.edge_metadata || {}
        });
        seenEdges.add(row.edge_id);
      }
    }

    return { nodes, edges };
  }

  /**
   * Get downstream artifacts (descendants)
   */
  private async getDownstream(artifactId: string, depth: number): Promise<{ nodes: Artifact[], edges: ArtifactEdge[] }> {
    const query = `
      WITH RECURSIVE downstream AS (
        SELECT
          e.id as edge_id,
          e.source_artifact_id,
          e.target_artifact_id,
          e.relation_type,
          e.transformation_type,
          e.transformation_config,
          e.source_version_id,
          e.target_version_id,
          e.created_at as edge_created_at,
          e.metadata as edge_metadata,
          1 as depth
        FROM artifact_edges e
        WHERE e.source_artifact_id = $1 AND e.deleted_at IS NULL

        UNION ALL

        SELECT
          e.id,
          e.source_artifact_id,
          e.target_artifact_id,
          e.relation_type,
          e.transformation_type,
          e.transformation_config,
          e.source_version_id,
          e.target_version_id,
          e.created_at,
          e.metadata,
          d.depth + 1
        FROM artifact_edges e
        INNER JOIN downstream d ON e.source_artifact_id = d.target_artifact_id
        WHERE d.depth < $2 AND e.deleted_at IS NULL
      )
      SELECT
        a.*,
        d.edge_id,
        d.relation_type,
        d.transformation_type,
        d.transformation_config,
        d.source_version_id,
        d.target_version_id,
        d.edge_created_at,
        d.edge_metadata
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
        nodes.push(this.mapArtifactRow(row));
        seenNodes.add(row.id);
      }

      if (!seenEdges.has(row.edge_id)) {
        edges.push({
          id: row.edge_id,
          sourceArtifactId: row.source_artifact_id,
          targetArtifactId: row.id,
          relationType: row.relation_type,
          transformationType: row.transformation_type,
          transformationConfig: row.transformation_config,
          sourceVersionId: row.source_version_id,
          targetVersionId: row.target_version_id,
          createdAt: row.edge_created_at,
          metadata: row.edge_metadata || {}
        });
        seenEdges.add(row.edge_id);
      }
    }

    return { nodes, edges };
  }

  /**
   * Check which nodes are outdated
   */
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

      // Check manual refresh flag
      if (edge.metadata?.needsRefresh) {
        const targetNode = nodes.find(n => n.id === edge.targetArtifactId);
        if (targetNode && !outdated.includes(targetNode.id)) {
          outdated.push(targetNode.id);
        }
      }
    }

    return outdated;
  }

  /**
   * Check if adding an edge would create a cycle
   */
  private async wouldCreateCycle(sourceId: string, targetId: string): Promise<boolean> {
    // Check if there's already a path from target to source
    // If yes, adding source -> target would create a cycle
    const query = `
      WITH RECURSIVE paths AS (
        SELECT source_artifact_id, target_artifact_id, 1 as depth
        FROM artifact_edges
        WHERE source_artifact_id = $1 AND deleted_at IS NULL

        UNION ALL

        SELECT e.source_artifact_id, e.target_artifact_id, p.depth + 1
        FROM artifact_edges e
        INNER JOIN paths p ON e.source_artifact_id = p.target_artifact_id
        WHERE p.depth < 20 AND e.deleted_at IS NULL
      )
      SELECT 1 FROM paths WHERE target_artifact_id = $2 LIMIT 1
    `;

    const result = await db.query(query, [targetId, sourceId]);
    return result.rows.length > 0;
  }

  /**
   * Audit logging with hash chain
   */
  private async auditLog(params: {
    action: string;
    artifactId?: string;
    userId: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    // Get previous hash for chain
    const prevResult = await db.query(
      'SELECT current_hash FROM artifact_audit_log ORDER BY timestamp DESC LIMIT 1'
    );
    const previousHash = prevResult.rows[0]?.current_hash || null;

    // Generate current hash
    const hashInput = JSON.stringify({
      action: params.action,
      artifactId: params.artifactId,
      userId: params.userId,
      details: params.details,
      timestamp: new Date().toISOString()
    });
    const currentHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    await db.query(
      `INSERT INTO artifact_audit_log (
        artifact_id, action, action_category, user_id,
        details, previous_hash, current_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.artifactId,
        params.action,
        this.categorizeAction(params.action),
        params.userId,
        JSON.stringify(params.details),
        previousHash,
        currentHash
      ]
    );
  }

  /**
   * Categorize audit action
   */
  private categorizeAction(action: string): string {
    if (action.includes('ARTIFACT')) return 'METADATA';
    if (action.includes('EDGE')) return 'GRAPH';
    if (action.includes('VERSION')) return 'VERSION';
    if (action.includes('PHI')) return 'PHI';
    return 'OTHER';
  }

  /**
   * Map database row to Artifact
   */
  private mapArtifactRow(row: any): Artifact {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description,
      status: row.status,
      phiScanned: row.phi_scanned,
      phiStatus: row.phi_status,
      phiScanDate: row.phi_scan_date,
      phiFindingsCount: row.phi_findings_count,
      ownerUserId: row.owner_user_id,
      organizationId: row.organization_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      metadata: row.metadata || {}
    };
  }

  /**
   * Map database row to ArtifactEdge
   */
  private mapEdgeRow(row: any): ArtifactEdge {
    return {
      id: row.id,
      sourceArtifactId: row.source_artifact_id,
      targetArtifactId: row.target_artifact_id,
      relationType: row.relation_type,
      transformationType: row.transformation_type,
      transformationConfig: row.transformation_config || {},
      sourceVersionId: row.source_version_id,
      targetVersionId: row.target_version_id,
      createdAt: row.created_at,
      metadata: row.metadata || {}
    };
  }
}

// Export singleton instance
export const artifactGraphService = new ArtifactGraphService();
