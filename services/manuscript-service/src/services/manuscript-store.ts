/**
 * Manuscript Store Service
 * Handles persistence using existing DB tables (artifacts, artifact_versions, artifact_comparisons)
 *
 * NO new tables required - uses existing schema from @researchflow/core
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import type { ManuscriptContent, VersionResponse } from '../types/api.types';

// Import schema - these tables already exist
// artifacts, artifact_versions, artifact_comparisons from @researchflow/core/schema

/**
 * Manuscript persistence model:
 * - Manuscript "current draft" is stored as an artifact with artifactType = "manuscript"
 * - Each edit/job writes a new artifact_version
 * - Diff comparisons stored in artifact_comparisons
 */

export class ManuscriptStoreService {
  /**
   * Create a new manuscript artifact
   */
  async createManuscript(params: {
    researchId: string;
    userId: string;
    title: string;
    templateType: string;
    journalTarget?: string;
    wordLimits?: Record<string, number>;
  }): Promise<{ artifactId: string; versionId: string }> {
    const artifactId = uuidv4();
    const versionId = uuidv4();

    // Initial manuscript content structure
    const initialContent: ManuscriptContent = {
      title: params.title,
      metadata: {
        authors: [],
        keywords: [],
        journalTarget: params.journalTarget,
        templateType: params.templateType,
      },
      sections: {
        abstract: '',
        introduction: '',
        methods: '',
        results: '',
        discussion: '',
        conclusion: '',
      },
      citations: [],
      figures: [],
      tables: [],
    };

    // Insert artifact
    await db.execute({
      sql: `
        INSERT INTO artifacts (id, research_id, artifact_type, stage_id, content, current_version_id, created_by, created_at, updated_at)
        VALUES ($1, $2, 'manuscript', 'manuscript_draft', $3, $4, $5, NOW(), NOW())
      `,
      args: [artifactId, params.researchId, JSON.stringify(initialContent), versionId, params.userId],
    });

    // Insert initial version
    await db.execute({
      sql: `
        INSERT INTO artifact_versions (id, artifact_id, version_number, content, change_description, changed_by, created_at)
        VALUES ($1, $2, 1, $3, 'Initial manuscript creation', $4, NOW())
      `,
      args: [versionId, artifactId, JSON.stringify(initialContent), params.userId],
    });

    return { artifactId, versionId };
  }

  /**
   * Get manuscript by artifact ID
   */
  async getManuscript(artifactId: string): Promise<{
    artifactId: string;
    researchId: string;
    currentVersionId: string | null;
    content: ManuscriptContent;
    versionNumber: number;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const result = await db.execute({
      sql: `
        SELECT a.id, a.research_id, a.current_version_id, a.content, a.created_at, a.updated_at,
               COALESCE(v.version_number, 1) as version_number
        FROM artifacts a
        LEFT JOIN artifact_versions v ON v.id = a.current_version_id
        WHERE a.id = $1 AND a.artifact_type = 'manuscript'
      `,
      args: [artifactId],
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      artifactId: row.id,
      researchId: row.research_id,
      currentVersionId: row.current_version_id,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      versionNumber: row.version_number || 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Update manuscript content and create new version
   */
  async updateManuscript(params: {
    artifactId: string;
    userId: string;
    content: ManuscriptContent;
    changeDescription: string;
  }): Promise<{ versionId: string; versionNumber: number }> {
    const versionId = uuidv4();

    // Get current version number
    const currentResult = await db.execute({
      sql: `
        SELECT COALESCE(MAX(version_number), 0) as max_version
        FROM artifact_versions
        WHERE artifact_id = $1
      `,
      args: [params.artifactId],
    });

    const currentVersion = ((currentResult.rows?.[0] as any)?.max_version || 0) as number;
    const newVersionNumber = currentVersion + 1;

    // Insert new version
    await db.execute({
      sql: `
        INSERT INTO artifact_versions (id, artifact_id, version_number, content, change_description, changed_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      args: [versionId, params.artifactId, newVersionNumber, JSON.stringify(params.content), params.changeDescription, params.userId],
    });

    // Update artifact with new current version
    await db.execute({
      sql: `
        UPDATE artifacts
        SET content = $1, current_version_id = $2, updated_at = NOW()
        WHERE id = $3
      `,
      args: [JSON.stringify(params.content), versionId, params.artifactId],
    });

    return { versionId, versionNumber: newVersionNumber };
  }

  /**
   * Get version history for a manuscript
   */
  async getVersionHistory(artifactId: string): Promise<VersionResponse[]> {
    const result = await db.execute({
      sql: `
        SELECT id, artifact_id, version_number, change_description, changed_by, created_at
        FROM artifact_versions
        WHERE artifact_id = $1
        ORDER BY version_number DESC
      `,
      args: [artifactId],
    });

    return (result.rows || []).map((row: any) => ({
      id: row.id,
      artifactId: row.artifact_id,
      versionNumber: row.version_number,
      changeDescription: row.change_description,
      changedBy: row.changed_by,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get specific version content
   */
  async getVersion(versionId: string): Promise<{
    content: ManuscriptContent;
    versionNumber: number;
  } | null> {
    const result = await db.execute({
      sql: `
        SELECT content, version_number
        FROM artifact_versions
        WHERE id = $1
      `,
      args: [versionId],
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      versionNumber: row.version_number,
    };
  }

  /**
   * Store comparison result
   */
  async storeComparison(params: {
    artifactId: string;
    fromVersionId: string;
    toVersionId: string;
    comparisonData: Record<string, unknown>;
    userId: string;
  }): Promise<string> {
    const comparisonId = uuidv4();

    await db.execute({
      sql: `
        INSERT INTO artifact_comparisons (id, artifact_id, from_version_id, to_version_id, comparison_data, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      args: [comparisonId, params.artifactId, params.fromVersionId, params.toVersionId, JSON.stringify(params.comparisonData), params.userId],
    });

    return comparisonId;
  }

  /**
   * Get manuscripts by research ID
   */
  async getManuscriptsByResearch(researchId: string): Promise<Array<{
    artifactId: string;
    title: string;
    versionNumber: number;
    updatedAt: Date;
  }>> {
    const result = await db.execute({
      sql: `
        SELECT a.id, a.content, a.updated_at,
               COALESCE(v.version_number, 1) as version_number
        FROM artifacts a
        LEFT JOIN artifact_versions v ON v.id = a.current_version_id
        WHERE a.research_id = $1 AND a.artifact_type = 'manuscript'
        ORDER BY a.updated_at DESC
      `,
      args: [researchId],
    });

    return (result.rows || []).map((row: any) => {
      const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
      return {
        artifactId: row.id,
        title: content?.title || 'Untitled',
        versionNumber: row.version_number || 1,
        updatedAt: new Date(row.updated_at),
      };
    });
  }

  /**
   * Store export artifact (PDF, DOCX, etc.)
   */
  async storeExportArtifact(params: {
    manuscriptId: string;
    researchId: string;
    userId: string;
    format: string;
    content: string; // base64 for binary, string for text
    metadata: Record<string, unknown>;
  }): Promise<string> {
    const artifactId = uuidv4();

    await db.execute({
      sql: `
        INSERT INTO artifacts (id, research_id, artifact_type, stage_id, content, metadata, created_by, created_at, updated_at)
        VALUES ($1, $2, 'manuscript', 'manuscript_export', $3, $4, $5, NOW(), NOW())
      `,
      args: [artifactId, params.researchId, params.content, JSON.stringify({
        ...params.metadata,
        format: params.format,
        sourceManuscriptId: params.manuscriptId,
      }), params.userId],
    });

    return artifactId;
  }
}

export const manuscriptStore = new ManuscriptStoreService();
