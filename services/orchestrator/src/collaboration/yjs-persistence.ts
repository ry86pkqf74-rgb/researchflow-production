/**
 * Yjs Persistence Layer
 *
 * Stores Yjs CRDT updates in PostgreSQL for durability and recovery.
 * Implements efficient update retrieval and snapshot management.
 *
 * Features:
 * - Store incremental Yjs updates
 * - Retrieve updates for room initialization
 * - Snapshot management for faster loading
 * - Update compaction to reduce storage
 */

import { db } from '../lib/db';
import * as Y from 'yjs';

export class YjsPersistence {
  /**
   * Store a Yjs update in the database
   */
  async storeUpdate(roomName: string, update: Uint8Array): Promise<void> {
    // Parse artifact ID from room name (format: "artifact-{uuid}")
    const artifactId = this.parseArtifactId(roomName);
    if (!artifactId) {
      console.warn(`[YjsPersistence] Invalid room name format: ${roomName}`);
      return;
    }

    try {
      // Generate clock value (timestamp-based)
      const clock = Date.now();

      await db.query(
        `INSERT INTO manuscript_yjs_updates (
          manuscript_id, clock, update_data, applied_at
        )
        VALUES ($1, $2, $3, NOW())`,
        [artifactId, clock, update]
      );
    } catch (error) {
      console.error('[YjsPersistence] Error storing update:', error);
      throw error;
    }
  }

  /**
   * Get all updates for a room since a given clock
   */
  async getUpdates(
    roomName: string,
    sinceClock: number = 0
  ): Promise<Uint8Array[]> {
    const artifactId = this.parseArtifactId(roomName);
    if (!artifactId) {
      return [];
    }

    try {
      const result = await db.query(
        `SELECT update_data
         FROM manuscript_yjs_updates
         WHERE manuscript_id = $1 AND clock > $2
         ORDER BY clock ASC`,
        [artifactId, sinceClock]
      );

      return result.rows.map((row) => row.update_data);
    } catch (error) {
      console.error('[YjsPersistence] Error getting updates:', error);
      return [];
    }
  }

  /**
   * Store a snapshot of the current document state
   */
  async storeSnapshot(roomName: string, snapshot: Uint8Array): Promise<void> {
    const artifactId = this.parseArtifactId(roomName);
    if (!artifactId) {
      return;
    }

    try {
      // Get the latest version number
      const versionResult = await db.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
         FROM manuscript_versions
         WHERE manuscript_id = $1`,
        [artifactId]
      );

      const nextVersion = versionResult.rows[0].next_version;

      // Decode snapshot to get content
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);

      // Extract content from Yjs document
      const xmlFragment = doc.getXmlFragment('prosemirror');
      const content = this.extractContent(xmlFragment);

      // Store as new version
      await db.query(
        `INSERT INTO manuscript_versions (
          manuscript_id, version_number, content_json,
          yjs_snapshot, created_by, change_description
        )
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          artifactId,
          nextVersion,
          JSON.stringify(content),
          snapshot,
          'system',
          'Automatic snapshot from collaboration',
        ]
      );

      console.log(
        `[YjsPersistence] Stored snapshot for ${roomName} as version ${nextVersion}`
      );
    } catch (error) {
      console.error('[YjsPersistence] Error storing snapshot:', error);
    }
  }

  /**
   * Get the latest snapshot for a room
   */
  async getLatestSnapshot(roomName: string): Promise<Uint8Array | null> {
    const artifactId = this.parseArtifactId(roomName);
    if (!artifactId) {
      return null;
    }

    try {
      const result = await db.query(
        `SELECT yjs_snapshot
         FROM manuscript_versions
         WHERE manuscript_id = $1 AND yjs_snapshot IS NOT NULL
         ORDER BY version_number DESC
         LIMIT 1`,
        [artifactId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].yjs_snapshot;
    } catch (error) {
      console.error('[YjsPersistence] Error getting snapshot:', error);
      return null;
    }
  }

  /**
   * Compact old updates by removing those superseded by snapshots
   */
  async compactUpdates(roomName: string, olderThanDays: number = 30): Promise<number> {
    const artifactId = this.parseArtifactId(roomName);
    if (!artifactId) {
      return 0;
    }

    try {
      // Get the latest snapshot clock
      const snapshotResult = await db.query(
        `SELECT EXTRACT(EPOCH FROM created_at) * 1000 as snapshot_clock
         FROM manuscript_versions
         WHERE manuscript_id = $1 AND yjs_snapshot IS NOT NULL
         ORDER BY version_number DESC
         LIMIT 1`,
        [artifactId]
      );

      if (snapshotResult.rows.length === 0) {
        console.log('[YjsPersistence] No snapshot found, skipping compaction');
        return 0;
      }

      const snapshotClock = snapshotResult.rows[0].snapshot_clock;

      // Delete updates older than snapshot and retention period
      const deleteResult = await db.query(
        `DELETE FROM manuscript_yjs_updates
         WHERE manuscript_id = $1
           AND clock < $2
           AND applied_at < NOW() - INTERVAL '${olderThanDays} days'`,
        [artifactId, snapshotClock]
      );

      const deletedCount = deleteResult.rowCount || 0;

      console.log(
        `[YjsPersistence] Compacted ${deletedCount} updates for ${roomName}`
      );

      return deletedCount;
    } catch (error) {
      console.error('[YjsPersistence] Error compacting updates:', error);
      return 0;
    }
  }

  /**
   * Parse artifact ID from room name
   */
  private parseArtifactId(roomName: string): string | null {
    // Expected format: "artifact-{uuid}"
    const match = roomName.match(/^artifact-([a-f0-9-]+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Extract content from Yjs XmlFragment
   */
  private extractContent(xmlFragment: Y.XmlFragment): any {
    // This is a simplified extraction
    // In production, you'd want to properly parse the ProseMirror document structure
    try {
      const content: any = {
        type: 'doc',
        content: [],
      };

      // Iterate through XML elements
      xmlFragment.forEach((item) => {
        if (item instanceof Y.XmlElement) {
          content.content.push(this.extractElement(item));
        } else if (item instanceof Y.XmlText) {
          content.content.push({
            type: 'text',
            text: item.toString(),
          });
        }
      });

      return content;
    } catch (error) {
      console.error('[YjsPersistence] Error extracting content:', error);
      return { type: 'doc', content: [] };
    }
  }

  /**
   * Extract XML element recursively
   */
  private extractElement(element: Y.XmlElement): any {
    const node: any = {
      type: element.nodeName,
      attrs: {},
      content: [],
    };

    // Get attributes
    element.getAttributes().forEach((value, key) => {
      node.attrs[key] = value;
    });

    // Get child content
    element.forEach((child) => {
      if (child instanceof Y.XmlElement) {
        node.content.push(this.extractElement(child));
      } else if (child instanceof Y.XmlText) {
        node.content.push({
          type: 'text',
          text: child.toString(),
        });
      }
    });

    return node;
  }

  /**
   * Initialize room from database
   */
  async initializeRoom(roomName: string): Promise<Y.Doc> {
    const doc = new Y.Doc();

    // First try to load from latest snapshot
    const snapshot = await this.getLatestSnapshot(roomName);

    if (snapshot) {
      // Apply snapshot
      Y.applyUpdate(doc, snapshot);

      // Get updates since snapshot
      const snapshotTime = await this.getSnapshotTime(roomName);
      const updates = await this.getUpdates(roomName, snapshotTime);

      // Apply incremental updates
      if (updates.length > 0) {
        const mergedUpdate = Y.mergeUpdates(updates);
        Y.applyUpdate(doc, mergedUpdate);
      }

      console.log(
        `[YjsPersistence] Initialized room ${roomName} from snapshot + ${updates.length} updates`
      );
    } else {
      // No snapshot, load all updates
      const updates = await this.getUpdates(roomName);

      if (updates.length > 0) {
        const mergedUpdate = Y.mergeUpdates(updates);
        Y.applyUpdate(doc, mergedUpdate);
      }

      console.log(
        `[YjsPersistence] Initialized room ${roomName} from ${updates.length} updates`
      );
    }

    return doc;
  }

  /**
   * Get snapshot timestamp
   */
  private async getSnapshotTime(roomName: string): Promise<number> {
    const artifactId = this.parseArtifactId(roomName);
    if (!artifactId) {
      return 0;
    }

    try {
      const result = await db.query(
        `SELECT EXTRACT(EPOCH FROM created_at) * 1000 as timestamp
         FROM manuscript_versions
         WHERE manuscript_id = $1 AND yjs_snapshot IS NOT NULL
         ORDER BY version_number DESC
         LIMIT 1`,
        [artifactId]
      );

      return result.rows.length > 0 ? result.rows[0].timestamp : 0;
    } catch (error) {
      return 0;
    }
  }
}
