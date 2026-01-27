/**
 * Cumulative Data Service
 *
 * Manages the flow of data between workflow stages.
 * Ensures that each stage has access to all prior stage outputs.
 *
 * This is the critical component that fixes the "information not transferring
 * between workflow stages in LIVE mode" issue.
 *
 * @module services/cumulative-data.service
 */

import { db } from '../../db';
import { sql } from 'drizzle-orm';

// =====================
// TYPES
// =====================

export interface StageOutput {
  stageNumber: number;
  stageName: string;
  data: Record<string, unknown>;
  artifacts: string[];
  completedAt: string;
}

export interface CumulativeData {
  [key: string]: {
    name: string;
    data: Record<string, unknown>;
    artifacts: string[];
    completedAt?: string;
  };
}

export interface ProjectManifest {
  id: string;
  projectId?: string;
  researchId?: string;
  userId?: string;
  currentStage: number;
  governanceMode: 'DEMO' | 'LIVE';
  cumulativeData: CumulativeData;
  phiSchemas: Record<string, unknown>;
  workflowConfig: Record<string, unknown>;
  status: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StageOutputRecord {
  id: string;
  manifestId: string;
  projectId?: string;
  researchId?: string;
  stageNumber: number;
  stageName: string;
  status: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  artifacts: string[];
  aiCalls: Array<{
    model: string;
    prompt: string;
    response: string;
    tokens: number;
    cost: number;
    timestamp: string;
  }>;
  errorMessage?: string;
  executionTimeMs?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface StageJobPayload {
  projectId?: string;
  researchId?: string;
  userId: string;
  stageNumber: number;
  stageName: string;
  governanceMode: 'DEMO' | 'LIVE';
  inputData: Record<string, unknown>;
  cumulativeData: CumulativeData;
  phiSchemas: Record<string, unknown>;
  artifactsPath: string;
  manifestId: string;
}

// =====================
// STAGE DEFINITIONS
// =====================

export const WORKFLOW_STAGES = [
  { number: 1, name: 'topic_declaration', displayName: 'Topic Declaration' },
  { number: 2, name: 'literature_search', displayName: 'Literature Search' },
  { number: 3, name: 'irb_proposal', displayName: 'IRB Proposal' },
  { number: 4, name: 'planned_extraction', displayName: 'Planned Extraction' },
  { number: 5, name: 'phi_scanning', displayName: 'PHI Scanning' },
  { number: 6, name: 'schema_extraction', displayName: 'Schema Extraction' },
  { number: 7, name: 'data_scrubbing', displayName: 'Data Scrubbing' },
  { number: 8, name: 'data_validation', displayName: 'Data Validation' },
  { number: 9, name: 'summary_characteristics', displayName: 'Summary Characteristics' },
  { number: 10, name: 'gap_analysis', displayName: 'Gap Analysis' },
  { number: 11, name: 'manuscript_ideation', displayName: 'Manuscript Ideation' },
  { number: 12, name: 'statistical_analysis', displayName: 'Statistical Analysis' },
  { number: 13, name: 'results_interpretation', displayName: 'Results Interpretation' },
  { number: 14, name: 'manuscript_draft', displayName: 'Manuscript Draft' },
  { number: 15, name: 'polish_manuscript', displayName: 'Polish Manuscript' },
  { number: 16, name: 'journal_selection', displayName: 'Journal Selection' },
  { number: 17, name: 'poster', displayName: 'Poster' },
  { number: 18, name: 'symposium', displayName: 'Symposium' },
  { number: 19, name: 'presentation', displayName: 'Presentation' },
  { number: 20, name: 'archive', displayName: 'Archive' },
];

// =====================
// SERVICE CLASS
// =====================

export class CumulativeDataService {

  /**
   * Get or create a project manifest for tracking cumulative data
   */
  async getOrCreateManifest(
    identifier: { projectId?: string; researchId?: string },
    userId: string,
    governanceMode: 'DEMO' | 'LIVE' = 'DEMO'
  ): Promise<ProjectManifest> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const { projectId, researchId } = identifier;

    if (!projectId && !researchId) {
      throw new Error('Either projectId or researchId must be provided');
    }

    // Check if manifest exists
    let whereClause: string;
    let params: unknown[];

    if (projectId) {
      whereClause = 'project_id = $1';
      params = [projectId];
    } else {
      whereClause = 'research_id = $1';
      params = [researchId];
    }

    const existingResult = await db.execute(sql.raw(`
      SELECT * FROM project_manifests WHERE ${whereClause} LIMIT 1
    `));

    if (existingResult.rows && existingResult.rows.length > 0) {
      const row = existingResult.rows[0] as Record<string, unknown>;
      return this.mapRowToManifest(row);
    }

    // Create new manifest
    const insertResult = await db.execute(sql.raw(`
      INSERT INTO project_manifests (
        project_id, research_id, user_id, governance_mode,
        cumulative_data, phi_schemas, workflow_config, status
      ) VALUES (
        ${projectId ? `'${projectId}'` : 'NULL'},
        ${researchId ? `'${researchId}'` : 'NULL'},
        '${userId}',
        '${governanceMode}',
        '{}',
        '{}',
        '{}',
        'active'
      ) RETURNING *
    `));

    if (insertResult.rows && insertResult.rows.length > 0) {
      const row = insertResult.rows[0] as Record<string, unknown>;
      console.log(`[CumulativeDataService] Created new manifest for ${projectId || researchId}`);
      return this.mapRowToManifest(row);
    }

    throw new Error('Failed to create manifest');
  }

  /**
   * Get cumulative data from all prior stages
   */
  async getCumulativeData(
    manifestId: string,
    upToStage: number
  ): Promise<CumulativeData> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.execute(sql.raw(`
      SELECT get_cumulative_stage_data('${manifestId}'::uuid, ${upToStage}) as data
    `));

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      return (row.data as CumulativeData) || {};
    }

    return {};
  }

  /**
   * Get specific stage output
   */
  async getStageOutput(
    manifestId: string,
    stageNumber: number
  ): Promise<StageOutputRecord | null> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.execute(sql.raw(`
      SELECT * FROM stage_outputs
      WHERE manifest_id = '${manifestId}'::uuid
        AND stage_number = ${stageNumber}
      LIMIT 1
    `));

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      return this.mapRowToStageOutput(row);
    }

    return null;
  }

  /**
   * Get all stage outputs for a manifest
   */
  async getAllStageOutputs(manifestId: string): Promise<StageOutputRecord[]> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.execute(sql.raw(`
      SELECT * FROM stage_outputs
      WHERE manifest_id = '${manifestId}'::uuid
      ORDER BY stage_number
    `));

    if (result.rows) {
      return (result.rows as Record<string, unknown>[]).map(row =>
        this.mapRowToStageOutput(row)
      );
    }

    return [];
  }

  /**
   * Start a stage (create pending record)
   */
  async startStage(
    manifestId: string,
    stageNumber: number,
    stageName: string,
    inputData: Record<string, unknown>,
    identifier?: { projectId?: string; researchId?: string }
  ): Promise<StageOutputRecord> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const { projectId, researchId } = identifier || {};

    // Upsert stage output record
    const result = await db.execute(sql.raw(`
      INSERT INTO stage_outputs (
        manifest_id, project_id, research_id, stage_number, stage_name,
        status, input_data, started_at
      ) VALUES (
        '${manifestId}'::uuid,
        ${projectId ? `'${projectId}'` : 'NULL'},
        ${researchId ? `'${researchId}'` : 'NULL'},
        ${stageNumber},
        '${stageName}',
        'running',
        '${JSON.stringify(inputData).replace(/'/g, "''")}',
        NOW()
      )
      ON CONFLICT (manifest_id, stage_number)
      DO UPDATE SET
        status = 'running',
        input_data = '${JSON.stringify(inputData).replace(/'/g, "''")}',
        started_at = NOW(),
        error_message = NULL
      RETURNING *
    `));

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      console.log(`[CumulativeDataService] Stage ${stageNumber} (${stageName}) started for manifest ${manifestId}`);
      return this.mapRowToStageOutput(row);
    }

    throw new Error('Failed to start stage');
  }

  /**
   * Complete a stage with output data
   * This triggers the database function to update the manifest's cumulative_data
   */
  async completeStage(
    manifestId: string,
    stageNumber: number,
    outputData: Record<string, unknown>,
    artifacts: string[] = [],
    executionTimeMs?: number
  ): Promise<StageOutputRecord> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.execute(sql.raw(`
      UPDATE stage_outputs
      SET
        status = 'completed',
        output_data = '${JSON.stringify(outputData).replace(/'/g, "''")}',
        artifacts = '${JSON.stringify(artifacts)}',
        execution_time_ms = ${executionTimeMs || 'NULL'},
        completed_at = NOW()
      WHERE manifest_id = '${manifestId}'::uuid
        AND stage_number = ${stageNumber}
      RETURNING *
    `));

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      console.log(`[CumulativeDataService] Stage ${stageNumber} completed for manifest ${manifestId}`);
      return this.mapRowToStageOutput(row);
    }

    throw new Error('Failed to complete stage');
  }

  /**
   * Fail a stage with error message
   */
  async failStage(
    manifestId: string,
    stageNumber: number,
    errorMessage: string
  ): Promise<StageOutputRecord> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.execute(sql.raw(`
      UPDATE stage_outputs
      SET
        status = 'failed',
        error_message = '${errorMessage.replace(/'/g, "''")}',
        completed_at = NOW()
      WHERE manifest_id = '${manifestId}'::uuid
        AND stage_number = ${stageNumber}
      RETURNING *
    `));

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      console.log(`[CumulativeDataService] Stage ${stageNumber} failed for manifest ${manifestId}: ${errorMessage}`);
      return this.mapRowToStageOutput(row);
    }

    throw new Error('Failed to update stage status');
  }

  /**
   * Save PHI schema for project
   */
  async savePhiSchema(
    manifestId: string,
    schemaName: string,
    schema: Record<string, unknown>
  ): Promise<void> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    await db.execute(sql.raw(`
      UPDATE project_manifests
      SET phi_schemas = phi_schemas || '{"${schemaName}": ${JSON.stringify(schema).replace(/'/g, "''")}}'::jsonb
      WHERE id = '${manifestId}'::uuid
    `));

    console.log(`[CumulativeDataService] PHI schema '${schemaName}' saved for manifest ${manifestId}`);
  }

  /**
   * Get PHI schemas for project
   */
  async getPhiSchemas(manifestId: string): Promise<Record<string, unknown>> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.execute(sql.raw(`
      SELECT phi_schemas FROM project_manifests WHERE id = '${manifestId}'::uuid
    `));

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      return (row.phi_schemas as Record<string, unknown>) || {};
    }

    return {};
  }

  /**
   * Build a complete job payload for stage execution
   * This is the key method that ensures all cumulative data is passed to the worker
   */
  async buildStageJobPayload(
    identifier: { projectId?: string; researchId?: string },
    userId: string,
    stageNumber: number,
    inputData: Record<string, unknown>,
    governanceMode: 'DEMO' | 'LIVE' = 'DEMO'
  ): Promise<StageJobPayload> {
    const { projectId, researchId } = identifier;

    // Get or create manifest
    const manifest = await this.getOrCreateManifest(identifier, userId, governanceMode);

    // Get stage info
    const stage = WORKFLOW_STAGES.find(s => s.number === stageNumber);
    if (!stage) {
      throw new Error(`Invalid stage number: ${stageNumber}`);
    }

    // Get cumulative data from all prior stages
    const cumulativeData = await this.getCumulativeData(manifest.id, stageNumber);

    // Get PHI schemas
    const phiSchemas = await this.getPhiSchemas(manifest.id);

    // Start the stage (creates pending record)
    await this.startStage(manifest.id, stageNumber, stage.name, inputData, identifier);

    // Build complete payload
    const payload: StageJobPayload = {
      projectId,
      researchId,
      userId,
      stageNumber,
      stageName: stage.name,
      governanceMode,
      inputData,
      cumulativeData,  // <-- CRITICAL: All prior stage outputs
      phiSchemas,      // <-- CRITICAL: PHI protection schemas
      artifactsPath: `/data/artifacts/${projectId || researchId}/stage_${String(stageNumber).padStart(2, '0')}/`,
      manifestId: manifest.id,
    };

    console.log(`[CumulativeDataService] Built job payload for stage ${stageNumber} (${stage.name})`);
    console.log(`[CumulativeDataService] Cumulative data keys: ${Object.keys(cumulativeData).join(', ') || 'none'}`);
    console.log(`[CumulativeDataService] PHI schemas: ${Object.keys(phiSchemas).join(', ') || 'none'}`);
    console.log(`[CumulativeDataService] Governance mode: ${governanceMode}`);

    return payload;
  }

  /**
   * Get full project state for debugging/display
   */
  async getProjectState(
    identifier: { projectId?: string; researchId?: string }
  ): Promise<{
    manifest: ProjectManifest | null;
    stages: StageOutputRecord[];
    cumulativeData: CumulativeData;
  }> {
    const { projectId, researchId } = identifier;

    if (!projectId && !researchId) {
      return { manifest: null, stages: [], cumulativeData: {} };
    }

    try {
      // Try to get existing manifest
      if (!db) {
        return { manifest: null, stages: [], cumulativeData: {} };
      }

      let whereClause: string;
      if (projectId) {
        whereClause = `project_id = '${projectId}'`;
      } else {
        whereClause = `research_id = '${researchId}'`;
      }

      const manifestResult = await db.execute(sql.raw(`
        SELECT * FROM project_manifests WHERE ${whereClause} LIMIT 1
      `));

      if (!manifestResult.rows || manifestResult.rows.length === 0) {
        return { manifest: null, stages: [], cumulativeData: {} };
      }

      const manifest = this.mapRowToManifest(manifestResult.rows[0] as Record<string, unknown>);
      const stages = await this.getAllStageOutputs(manifest.id);
      const cumulativeData = manifest.cumulativeData;

      return { manifest, stages, cumulativeData };
    } catch (error) {
      console.error('[CumulativeDataService] Error getting project state:', error);
      return { manifest: null, stages: [], cumulativeData: {} };
    }
  }

  /**
   * Record a state transition for audit trail
   */
  async recordTransition(
    manifestId: string,
    fromStage: number | null,
    toStage: number,
    fromStatus: string | null,
    toStatus: string,
    triggeredBy: string,
    governanceMode: string,
    transitionData: Record<string, unknown> = {}
  ): Promise<void> {
    if (!db) {
      throw new Error('Database connection not available');
    }

    await db.execute(sql.raw(`
      INSERT INTO workflow_state_transitions (
        manifest_id, from_stage, to_stage, from_status, to_status,
        triggered_by, governance_mode, transition_data
      ) VALUES (
        '${manifestId}'::uuid,
        ${fromStage || 'NULL'},
        ${toStage},
        ${fromStatus ? `'${fromStatus}'` : 'NULL'},
        '${toStatus}',
        '${triggeredBy}',
        '${governanceMode}',
        '${JSON.stringify(transitionData).replace(/'/g, "''")}'
      )
    `));
  }

  // =====================
  // HELPER METHODS
  // =====================

  private mapRowToManifest(row: Record<string, unknown>): ProjectManifest {
    return {
      id: row.id as string,
      projectId: row.project_id as string | undefined,
      researchId: row.research_id as string | undefined,
      userId: row.user_id as string | undefined,
      currentStage: row.current_stage as number,
      governanceMode: row.governance_mode as 'DEMO' | 'LIVE',
      cumulativeData: (row.cumulative_data as CumulativeData) || {},
      phiSchemas: (row.phi_schemas as Record<string, unknown>) || {},
      workflowConfig: (row.workflow_config as Record<string, unknown>) || {},
      status: row.status as string,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapRowToStageOutput(row: Record<string, unknown>): StageOutputRecord {
    return {
      id: row.id as string,
      manifestId: row.manifest_id as string,
      projectId: row.project_id as string | undefined,
      researchId: row.research_id as string | undefined,
      stageNumber: row.stage_number as number,
      stageName: row.stage_name as string,
      status: row.status as string,
      inputData: (row.input_data as Record<string, unknown>) || {},
      outputData: (row.output_data as Record<string, unknown>) || {},
      artifacts: (row.artifacts as string[]) || [],
      aiCalls: (row.ai_calls as StageOutputRecord['aiCalls']) || [],
      errorMessage: row.error_message as string | undefined,
      executionTimeMs: row.execution_time_ms as number | undefined,
      startedAt: row.started_at as string | undefined,
      completedAt: row.completed_at as string | undefined,
      createdAt: row.created_at as string,
    };
  }
}

// =====================
// SINGLETON INSTANCE
// =====================

let cumulativeDataService: CumulativeDataService | null = null;

export function getCumulativeDataService(): CumulativeDataService {
  if (!cumulativeDataService) {
    cumulativeDataService = new CumulativeDataService();
  }
  return cumulativeDataService;
}

export default CumulativeDataService;
