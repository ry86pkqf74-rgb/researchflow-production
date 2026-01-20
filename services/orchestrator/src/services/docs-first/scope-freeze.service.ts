/**
 * Scope Freeze Service
 *
 * Creates immutable snapshots of Topic Briefs using hash chain for audit integrity.
 * Implements blockchain-style verification of frozen documents.
 */

import { db } from '../../lib/db.js';
import { topicBriefs, docAnchors, type DocAnchor } from '@researchflow/core/schema';
import { eq, desc } from 'drizzle-orm';
import { createAuditEntry } from '../auditService.js';
import crypto from 'crypto';

export class ScopeFreezeService {
  /**
   * Freeze a Topic Brief and create immutable snapshot
   */
  async freezeBrief(briefId: string, userId: string): Promise<DocAnchor> {
    // Get brief
    const briefResult = await db.select()
      .from(topicBriefs)
      .where(eq(topicBriefs.id, briefId))
      .limit(1);

    if (briefResult.length === 0) {
      throw new Error('Topic Brief not found');
    }

    const currentBrief = briefResult[0];

    if (currentBrief.status === 'FROZEN') {
      throw new Error('Topic Brief already frozen');
    }

    // Get previous anchor hash (for chain)
    const previousAnchors = await db.select()
      .from(docAnchors)
      .where(eq(docAnchors.topicBriefId, briefId))
      .orderBy(desc(docAnchors.versionNumber))
      .limit(1);

    const previousHash = previousAnchors.length > 0
      ? previousAnchors[0].currentHash
      : 'GENESIS';

    // Create snapshot
    const snapshotData = {
      briefId: currentBrief.id,
      versionNumber: currentBrief.versionNumber,
      title: currentBrief.title,
      researchQuestion: currentBrief.researchQuestion,
      hypothesis: currentBrief.hypothesis,
      population: currentBrief.population,
      intervention: currentBrief.intervention,
      comparison: currentBrief.comparison,
      outcomes: currentBrief.outcomes,
      background: currentBrief.background,
      methodsOverview: currentBrief.methodsOverview,
      expectedFindings: currentBrief.expectedFindings,
      frozenAt: new Date().toISOString(),
      frozenBy: userId,
    };

    // Calculate hash
    const dataString = JSON.stringify(snapshotData) + previousHash;
    const currentHash = crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');

    // Create anchor
    const [anchor] = await db.insert(docAnchors).values({
      topicBriefId: briefId,
      versionNumber: currentBrief.versionNumber,
      snapshotData,
      previousHash,
      currentHash,
      createdBy: userId,
    }).returning();

    // Update brief status
    await db.update(topicBriefs)
      .set({
        status: 'FROZEN',
        frozenAt: new Date(),
        frozenBy: userId,
      })
      .where(eq(topicBriefs.id, briefId));

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'FREEZE_TOPIC_BRIEF',
      userId,
      resourceType: 'topic_brief',
      resourceId: briefId,
      details: {
        versionNumber: currentBrief.versionNumber,
        anchorId: anchor.id,
        hash: currentHash
      }
    });

    return anchor;
  }

  /**
   * Verify integrity of anchor chain
   */
  async verifyAnchor(anchorId: string): Promise<{
    valid: boolean;
    details: string;
  }> {
    const anchorResult = await db.select()
      .from(docAnchors)
      .where(eq(docAnchors.id, anchorId))
      .limit(1);

    if (anchorResult.length === 0) {
      return { valid: false, details: 'Anchor not found' };
    }

    const current = anchorResult[0];

    // Recalculate hash
    const dataString = JSON.stringify(current.snapshotData) + current.previousHash;
    const expectedHash = crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');

    if (expectedHash !== current.currentHash) {
      return {
        valid: false,
        details: `Hash mismatch. Expected: ${expectedHash}, Got: ${current.currentHash}`
      };
    }

    // Verify previous anchor exists (if not GENESIS)
    if (current.previousHash !== 'GENESIS') {
      const previousAnchors = await db.select()
        .from(docAnchors)
        .where(eq(docAnchors.currentHash, current.previousHash))
        .limit(1);

      if (previousAnchors.length === 0) {
        return {
          valid: false,
          details: 'Previous anchor not found (broken chain)'
        };
      }
    }

    return { valid: true, details: 'Anchor verified successfully' };
  }

  /**
   * Get latest snapshot for a brief
   */
  async getLatestSnapshot(briefId: string): Promise<DocAnchor | null> {
    const result = await db.select()
      .from(docAnchors)
      .where(eq(docAnchors.topicBriefId, briefId))
      .orderBy(desc(docAnchors.versionNumber))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }
}

export const scopeFreezeService = new ScopeFreezeService();
