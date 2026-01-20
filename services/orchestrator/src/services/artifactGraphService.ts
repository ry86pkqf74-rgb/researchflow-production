/**
 * Artifact Graph Service
 * 
 * Manages the provenance graph for artifacts including:
 * - Creating edges with cycle prevention
 * - Querying graph with bounded depth
 * - Detecting outdated nodes
 */
import { pool } from "../../db";
import { db } from "../../db";
import { artifactEdges, artifacts, artifactVersions } from "@researchflow/core/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export type RelationType = 
  | 'derived_from' 
  | 'references' 
  | 'supersedes' 
  | 'uses' 
  | 'generated_from' 
  | 'exported_to' 
  | 'annotates';

export interface CreateEdgeParams {
  researchId: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  relationType: RelationType;
  transformationType?: string;
  transformationConfig?: Record<string, unknown>;
  sourceVersionId?: string;
  targetVersionId?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  artifactType: string;
  filename: string;
  stageId: string;
  currentVersionId: string | null;
  latestVersionNumber: number | null;
  isOutdated: boolean;
  outdatedReason?: string;
}

export interface GraphEdge {
  id: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  relationType: RelationType;
  transformationType?: string;
  createdAt: Date;
}

export interface ArtifactGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootArtifactId: string;
  direction: 'upstream' | 'downstream' | 'both';
  depth: number;
}

/**
 * Check if creating an edge would create a cycle in the graph.
 * Uses recursive CTE to traverse existing paths.
 */
export async function wouldCreateCycle(
  sourceId: string, 
  targetId: string
): Promise<boolean> {
  if (!pool) throw new Error("DB not configured");
  
  // Self-loop is always a cycle
  if (sourceId === targetId) return true;
  
  // Check if there's a path from target back to source
  const query = \`
    WITH RECURSIVE paths AS (
      SELECT source_artifact_id, target_artifact_id, 1 AS depth
      FROM artifact_edges
      WHERE source_artifact_id = \$1 AND deleted_at IS NULL
      UNION ALL
      SELECT e.source_artifact_id, e.target_artifact_id, p.depth + 1
      FROM artifact_edges e
      JOIN paths p ON e.source_artifact_id = p.target_artifact_id
      WHERE e.deleted_at IS NULL AND p.depth < 20
    )
    SELECT EXISTS(
      SELECT 1 FROM paths WHERE target_artifact_id = \$2
    ) AS has_cycle;
  \`;
  
  const res = await pool.query(query, [targetId, sourceId]);
  return Boolean(res.rows?.[0]?.has_cycle);
}

/**
 * Create an artifact edge with cycle prevention.
 */
export async function createEdge(params: CreateEdgeParams): Promise<{
  id: string;
  success: boolean;
  error?: string;
}> {
  // Check for cycle before creating
  const wouldCycle = await wouldCreateCycle(params.sourceArtifactId, params.targetArtifactId);
  if (wouldCycle) {
    return {
      id: "",
      success: false,
      error: "Creating this edge would create a cycle in the artifact graph",
    };
  }

  const edgeId = nanoid();
  
  try {
    await db.insert(artifactEdges).values({
      id: edgeId,
      researchId: params.researchId,
      sourceArtifactId: params.sourceArtifactId,
      targetArtifactId: params.targetArtifactId,
      relationType: params.relationType,
      transformationType: params.transformationType || null,
      transformationConfig: params.transformationConfig || {},
      sourceVersionId: params.sourceVersionId || null,
      targetVersionId: params.targetVersionId || null,
      metadata: params.metadata || {},
    });

    return { id: edgeId, success: true };
  } catch (error: any) {
    // Handle unique constraint violation (duplicate edge)
    if (error?.code === "23505") {
      return {
        id: "",
        success: false,
        error: "An edge with this relationship already exists",
      };
    }
    throw error;
  }
}

/**
 * Soft-delete an edge by setting deleted_at.
 */
export async function deleteEdge(edgeId: string): Promise<boolean> {
  const result = await db
    .update(artifactEdges)
    .set({ deletedAt: new Date() })
    .where(and(eq(artifactEdges.id, edgeId), isNull(artifactEdges.deletedAt)));
  
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get the artifact graph for a given artifact.
 */
export async function getGraph(
  artifactId: string,
  options: {
    depth?: number;
    direction?: 'upstream' | 'downstream' | 'both';
  } = {}
): Promise<ArtifactGraph> {
  const depth = Math.min(options.depth || 3, 10); // Cap at 10 for performance
  const direction = options.direction || 'both';
  
  if (!pool) throw new Error("DB not configured");

  const nodeIds = new Set<string>([artifactId]);
  const edgesList: GraphEdge[] = [];

  // Build queries based on direction
  const queries: string[] = [];
  
  if (direction === 'downstream' || direction === 'both') {
    // Get downstream artifacts (those that depend on this one)
    queries.push(\`
      WITH RECURSIVE downstream AS (
        SELECT id, source_artifact_id, target_artifact_id, relation_type, 
               transformation_type, created_at, 1 AS depth
        FROM artifact_edges
        WHERE source_artifact_id = \$1 AND deleted_at IS NULL
        UNION ALL
        SELECT e.id, e.source_artifact_id, e.target_artifact_id, e.relation_type,
               e.transformation_type, e.created_at, d.depth + 1
        FROM artifact_edges e
        JOIN downstream d ON e.source_artifact_id = d.target_artifact_id
        WHERE e.deleted_at IS NULL AND d.depth < \$2
      )
      SELECT * FROM downstream
    \`);
  }
  
  if (direction === 'upstream' || direction === 'both') {
    // Get upstream artifacts (those this one depends on)
    queries.push(\`
      WITH RECURSIVE upstream AS (
        SELECT id, source_artifact_id, target_artifact_id, relation_type,
               transformation_type, created_at, 1 AS depth
        FROM artifact_edges
        WHERE target_artifact_id = \$1 AND deleted_at IS NULL
        UNION ALL
        SELECT e.id, e.source_artifact_id, e.target_artifact_id, e.relation_type,
               e.transformation_type, e.created_at, u.depth + 1
        FROM artifact_edges e
        JOIN upstream u ON e.target_artifact_id = u.source_artifact_id
        WHERE e.deleted_at IS NULL AND u.depth < \$2
      )
      SELECT * FROM upstream
    \`);
  }

  // Execute queries and collect results
  for (const query of queries) {
    const res = await pool.query(query, [artifactId, depth]);
    for (const row of res.rows) {
      nodeIds.add(row.source_artifact_id);
      nodeIds.add(row.target_artifact_id);
      edgesList.push({
        id: row.id,
        sourceArtifactId: row.source_artifact_id,
        targetArtifactId: row.target_artifact_id,
        relationType: row.relation_type as RelationType,
        transformationType: row.transformation_type,
        createdAt: row.created_at,
      });
    }
  }

  // Fetch artifact details for all nodes
  const nodeIdArray = Array.from(nodeIds);
  const nodes: GraphNode[] = [];
  
  if (nodeIdArray.length > 0) {
    const artifactRows = await db
      .select({
        id: artifacts.id,
        artifactType: artifacts.artifactType,
        filename: artifacts.filename,
        stageId: artifacts.stageId,
        currentVersionId: artifacts.currentVersionId,
      })
      .from(artifacts)
      .where(sql\`\${artifacts.id} IN (\${sql.join(nodeIdArray.map(id => sql\`\${id}\`), sql\`, \`)})\`);

    // Get latest version numbers
    for (const artifact of artifactRows) {
      const versionRows = await db
        .select({ versionNumber: artifactVersions.versionNumber })
        .from(artifactVersions)
        .where(eq(artifactVersions.artifactId, artifact.id))
        .orderBy(desc(artifactVersions.versionNumber))
        .limit(1);

      nodes.push({
        id: artifact.id,
        artifactType: artifact.artifactType,
        filename: artifact.filename,
        stageId: artifact.stageId,
        currentVersionId: artifact.currentVersionId,
        latestVersionNumber: versionRows[0]?.versionNumber ?? null,
        isOutdated: false, // Will be computed below
      });
    }
  }

  // Compute outdated status
  await computeOutdatedStatus(nodes, edgesList);

  return {
    nodes,
    edges: edgesList,
    rootArtifactId: artifactId,
    direction,
    depth,
  };
}

/**
 * Compute outdated status for nodes based on edge version tracking.
 */
async function computeOutdatedStatus(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Promise<void> {
  if (!pool) return;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // For each edge, check if source has been updated since edge was created
  for (const edge of edges) {
    const targetNode = nodeMap.get(edge.targetArtifactId);
    if (!targetNode) continue;

    // Get the edge's recorded source version and current source version
    const edgeQuery = \`
      SELECT 
        ae.source_version_id,
        a.current_version_id as source_current_version,
        ae.created_at as edge_created_at,
        (SELECT MAX(created_at) FROM artifact_versions WHERE artifact_id = ae.source_artifact_id) as latest_source_version_at
      FROM artifact_edges ae
      JOIN artifacts a ON a.id = ae.source_artifact_id
      WHERE ae.id = \$1
    \`;
    
    const res = await pool.query(edgeQuery, [edge.id]);
    const row = res.rows[0];
    
    if (!row) continue;

    // Check for outdated conditions
    if (row.source_version_id && row.source_current_version) {
      // Version-tracked edge: outdated if source version changed
      if (row.source_version_id !== row.source_current_version) {
        targetNode.isOutdated = true;
        targetNode.outdatedReason = \`Source artifact version changed since edge was created\`;
      }
    } else if (row.latest_source_version_at && row.edge_created_at) {
      // Non-version-tracked: outdated if source updated after edge created
      if (new Date(row.latest_source_version_at) > new Date(row.edge_created_at)) {
        targetNode.isOutdated = true;
        targetNode.outdatedReason = \`Source artifact updated after dependency was created\`;
      }
    }
  }
}

/**
 * List all edges for a research project.
 */
export async function listEdges(
  researchId: string,
  options?: { relationType?: RelationType }
): Promise<GraphEdge[]> {
  let query = db
    .select()
    .from(artifactEdges)
    .where(and(
      eq(artifactEdges.researchId, researchId),
      isNull(artifactEdges.deletedAt)
    ));

  const rows = await query;
  
  return rows
    .filter(row => !options?.relationType || row.relationType === options.relationType)
    .map(row => ({
      id: row.id,
      sourceArtifactId: row.sourceArtifactId,
      targetArtifactId: row.targetArtifactId,
      relationType: row.relationType as RelationType,
      transformationType: row.transformationType ?? undefined,
      createdAt: row.createdAt,
    }));
}

/**
 * Get a single edge by ID.
 */
export async function getEdge(edgeId: string): Promise<GraphEdge | null> {
  const rows = await db
    .select()
    .from(artifactEdges)
    .where(and(eq(artifactEdges.id, edgeId), isNull(artifactEdges.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    sourceArtifactId: row.sourceArtifactId,
    targetArtifactId: row.targetArtifactId,
    relationType: row.relationType as RelationType,
    transformationType: row.transformationType ?? undefined,
    createdAt: row.createdAt,
  };
}
