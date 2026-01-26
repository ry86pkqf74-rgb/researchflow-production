/**
 * Postgres Persistence Adapter
 *
 * Uses Postgres for durable document storage.
 * Integrates with the existing manuscript_versions table for revision history.
 */

import { Pool } from "pg";
import type { PersistenceAdapter } from "./index.js";

/**
 * Postgres persistence adapter using pg Pool
 *
 * Stores collaborative document states in the collab_documents table.
 * Optionally integrates with manuscript_versions for revision snapshots.
 */
export class PostgresPersistenceAdapter implements PersistenceAdapter {
  readonly name = "postgres";

  private readonly pool: Pool;
  private closed = false;
  private initialized = false;

  /**
   * Create Postgres persistence adapter
   * @param connectionString - Postgres connection URL
   */
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on("error", (error) => {
      console.error("[collab-postgres] Pool error:", error.message);
    });
  }

  /**
   * Ensure the required table exists
   */
  private async ensureTable(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const client = await this.pool.connect();
    try {
      // Create collab_documents table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS collab_documents (
          document_name VARCHAR(500) PRIMARY KEY,
          state BYTEA NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_collab_documents_updated
          ON collab_documents(updated_at);
      `);

      this.initialized = true;
    } finally {
      client.release();
    }
  }

  /**
   * Store document state in Postgres
   */
  async storeDocument(documentName: string, state: Uint8Array): Promise<void> {
    this.ensureNotClosed();
    await this.ensureTable();

    const buffer = Buffer.from(state);

    await this.pool.query(
      `
      INSERT INTO collab_documents (document_name, state, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (document_name)
      DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = NOW()
      `,
      [documentName, buffer]
    );
  }

  /**
   * Fetch document state from Postgres
   */
  async fetchDocument(documentName: string): Promise<Uint8Array | null> {
    this.ensureNotClosed();
    await this.ensureTable();

    const result = await this.pool.query<{ state: Buffer }>(
      `
      SELECT state FROM collab_documents
      WHERE document_name = $1
      `,
      [documentName]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return new Uint8Array(result.rows[0].state);
  }

  /**
   * Delete document from Postgres
   */
  async deleteDocument(documentName: string): Promise<void> {
    this.ensureNotClosed();
    await this.ensureTable();

    await this.pool.query(
      `
      DELETE FROM collab_documents
      WHERE document_name = $1
      `,
      [documentName]
    );
  }

  /**
   * Check Postgres connection health
   */
  async isHealthy(): Promise<boolean> {
    if (this.closed) {
      return false;
    }

    try {
      const result = await this.pool.query("SELECT 1 as ok");
      return result.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  /**
   * Close Postgres connection pool
   */
  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await this.pool.end();
    }
  }

  /**
   * Save a revision snapshot to manuscript_versions
   *
   * Called during explicit "commit revision" actions.
   * Integrates the collaborative document with the versioned manuscript system.
   *
   * @param documentName - Document identifier (format: "manuscript:{manuscriptId}")
   * @param content - Manuscript content as JSON
   * @param userId - User ID who created the revision
   * @param changeDescription - Description of changes
   */
  async saveRevisionSnapshot(
    documentName: string,
    content: Record<string, unknown>,
    userId: string,
    changeDescription: string
  ): Promise<string | null> {
    this.ensureNotClosed();

    // Extract manuscript ID from document name
    const manuscriptIdMatch = documentName.match(/^manuscript:([a-f0-9-]+)$/i);
    if (!manuscriptIdMatch) {
      console.warn(
        "[collab-postgres] Cannot save revision: invalid document name format",
        { documentName }
      );
      return null;
    }

    const manuscriptId = manuscriptIdMatch[1];

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Get current version number
      const versionResult = await client.query<{ max_version: number | null }>(
        `
        SELECT MAX(version_number) as max_version
        FROM manuscript_versions
        WHERE manuscript_id = $1
        `,
        [manuscriptId]
      );

      const currentVersion = versionResult.rows[0]?.max_version ?? 0;
      const nextVersion = currentVersion + 1;

      // Get previous hash for chain
      const prevHashResult = await client.query<{ current_hash: string }>(
        `
        SELECT current_hash
        FROM manuscript_versions
        WHERE manuscript_id = $1
        ORDER BY version_number DESC
        LIMIT 1
        `,
        [manuscriptId]
      );

      const previousHash = prevHashResult.rows[0]?.current_hash ?? null;

      // Calculate content hash (simple hash for now)
      const contentJson = JSON.stringify(content);
      const contentBuffer = Buffer.from(contentJson, "utf8");
      const { createHash } = await import("crypto");
      const currentHash = createHash("sha256").update(contentBuffer).digest("hex");
      const dataSnapshotHash = currentHash; // Same for now, could be different

      // Calculate word count
      const wordCount = this.estimateWordCount(content);

      // Insert new version
      const insertResult = await client.query<{ id: string }>(
        `
        INSERT INTO manuscript_versions (
          manuscript_id,
          version_number,
          content,
          data_snapshot_hash,
          word_count,
          change_description,
          previous_hash,
          current_hash,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        `,
        [
          manuscriptId,
          nextVersion,
          content,
          dataSnapshotHash,
          wordCount,
          changeDescription,
          previousHash,
          currentHash,
          userId,
        ]
      );

      // Update manuscript's current version
      await client.query(
        `
        UPDATE manuscripts
        SET current_version_id = $1, updated_at = NOW()
        WHERE id = $2
        `,
        [insertResult.rows[0].id, manuscriptId]
      );

      await client.query("COMMIT");

      return insertResult.rows[0].id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Estimate word count from manuscript content
   */
  private estimateWordCount(content: Record<string, unknown>): number {
    const text = this.extractText(content);
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Recursively extract text from content object
   */
  private extractText(obj: unknown): string {
    if (typeof obj === "string") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.extractText(item)).join(" ");
    }
    if (obj && typeof obj === "object") {
      return Object.values(obj)
        .map((value) => this.extractText(value))
        .join(" ");
    }
    return "";
  }

  /**
   * Ensure adapter hasn't been closed
   */
  private ensureNotClosed(): void {
    if (this.closed) {
      throw new Error("PostgresPersistenceAdapter has been closed");
    }
  }
}
