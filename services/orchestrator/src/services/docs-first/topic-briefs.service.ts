/**
 * Topic Briefs Service
 *
 * Manages structured research planning documents with PICO framework.
 * Supports version tracking and scope freezing.
 */

import { db } from '../../lib/db.js';
import { topicBriefs, type TopicBrief, type InsertTopicBrief } from '@researchflow/core/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createAuditEntry } from '../auditService.js';

export class TopicBriefsService {
  /**
   * Create a new topic brief
   */
  async createBrief(data: InsertTopicBrief, userId: string): Promise<TopicBrief> {
    const [brief] = await db.insert(topicBriefs).values({
      ...data,
      createdBy: userId,
      versionNumber: 1,
    }).returning();

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'CREATE_TOPIC_BRIEF',
      userId,
      resourceType: 'topic_brief',
      resourceId: brief.id,
      details: { title: brief.title }
    });

    return brief;
  }

  /**
   * Get single topic brief by ID
   */
  async getBrief(id: string): Promise<TopicBrief | null> {
    const result = await db.select()
      .from(topicBriefs)
      .where(and(eq(topicBriefs.id, id), eq(topicBriefs.deletedAt, null)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update topic brief
   */
  async updateBrief(
    id: string,
    updates: Partial<TopicBrief>,
    userId: string
  ): Promise<TopicBrief> {
    // Check if frozen
    const existing = await db.select()
      .from(topicBriefs)
      .where(eq(topicBriefs.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Topic Brief not found');
    }

    if (existing[0].status === 'FROZEN') {
      throw new Error('Cannot update frozen Topic Brief');
    }

    // Update (version trigger will increment if major fields changed)
    const [updated] = await db.update(topicBriefs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(topicBriefs.id, id))
      .returning();

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'UPDATE_TOPIC_BRIEF',
      userId,
      resourceType: 'topic_brief',
      resourceId: id,
      details: {
        versionNumber: updated.versionNumber,
        changedFields: Object.keys(updates)
      }
    });

    return updated;
  }

  /**
   * List topic briefs with filtering
   */
  async listBriefs(filters: {
    researchId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ briefs: TopicBrief[]; total: number }> {
    const conditions = [eq(topicBriefs.deletedAt, null)];

    if (filters.researchId) {
      conditions.push(eq(topicBriefs.researchId, filters.researchId));
    }
    if (filters.status) {
      conditions.push(eq(topicBriefs.status, filters.status));
    }

    const results = await db.select()
      .from(topicBriefs)
      .where(and(...conditions))
      .orderBy(desc(topicBriefs.updatedAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    const [{ count }] = await db.select({ count: sql`count(*)::int` })
      .from(topicBriefs)
      .where(and(...conditions));

    return { briefs: results, total: Number(count) };
  }

  /**
   * Soft delete topic brief
   */
  async deleteBrief(id: string, userId: string): Promise<void> {
    await db.update(topicBriefs)
      .set({ deletedAt: new Date() })
      .where(eq(topicBriefs.id, id));

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'DELETE_TOPIC_BRIEF',
      userId,
      resourceType: 'topic_brief',
      resourceId: id,
      details: {}
    });
  }
}

export const topicBriefsService = new TopicBriefsService();
