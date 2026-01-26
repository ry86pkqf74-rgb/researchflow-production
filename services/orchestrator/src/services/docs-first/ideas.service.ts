/**
 * Ideas Service
 *
 * Manages research idea backlog and scorecards.
 * Supports CRUD operations and conversion to Topic Briefs.
 */

import { db } from '../../lib/db.js';
import { ideas, ideaScorecards, topicBriefs, type Idea, type IdeaScorecard, type InsertIdea } from '@researchflow/core/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createAuditEntry } from '../auditService.js';

export class IdeasService {
  /**
   * Create a new idea
   */
  async createIdea(data: InsertIdea, userId: string): Promise<Idea> {
    const [idea] = await db.insert(ideas).values({
      ...data,
      createdBy: userId,
    }).returning();

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'CREATE_IDEA',
      userId,
      resourceType: 'idea',
      resourceId: idea.id,
      details: { title: idea.title, status: idea.status }
    });

    return idea;
  }

  /**
   * List ideas with filtering
   */
  async listIdeas(filters: {
    researchId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ ideas: Idea[]; total: number }> {
    const conditions = [eq(ideas.deletedAt, null)];

    if (filters.researchId) {
      conditions.push(eq(ideas.researchId, filters.researchId));
    }
    if (filters.status) {
      conditions.push(eq(ideas.status, filters.status));
    }

    const results = await db.select()
      .from(ideas)
      .where(and(...conditions))
      .orderBy(desc(ideas.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    const [{ count }] = await db.select({ count: sql`count(*)::int` })
      .from(ideas)
      .where(and(...conditions));

    return { ideas: results, total: Number(count) };
  }

  /**
   * Get single idea by ID
   */
  async getIdea(id: string): Promise<Idea | null> {
    const result = await db.select()
      .from(ideas)
      .where(and(eq(ideas.id, id), eq(ideas.deletedAt, null)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update idea
   */
  async updateIdea(id: string, updates: Partial<Idea>, userId: string): Promise<Idea> {
    const [updated] = await db.update(ideas)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(ideas.id, id))
      .returning();

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'UPDATE_IDEA',
      userId,
      resourceType: 'idea',
      resourceId: id,
      details: { changedFields: Object.keys(updates) }
    });

    return updated;
  }

  /**
   * Soft delete idea
   */
  async deleteIdea(id: string, userId: string): Promise<void> {
    await db.update(ideas)
      .set({ deletedAt: new Date() })
      .where(eq(ideas.id, id));

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'DELETE_IDEA',
      userId,
      resourceType: 'idea',
      resourceId: id,
      details: {}
    });
  }

  /**
   * Create or update scorecard for an idea
   */
  async createOrUpdateScorecard(
    ideaId: string,
    scores: Partial<IdeaScorecard>,
    userId: string
  ): Promise<IdeaScorecard> {
    // Check if scorecard exists
    const existing = await db.select()
      .from(ideaScorecards)
      .where(eq(ideaScorecards.ideaId, ideaId))
      .limit(1);

    if (existing.length > 0) {
      // Update
      const [updated] = await db.update(ideaScorecards)
        .set({
          ...scores,
          updatedAt: new Date(),
        })
        .where(eq(ideaScorecards.ideaId, ideaId))
        .returning();

      await createAuditEntry({
        eventType: 'DOCS_FIRST',
        action: 'UPDATE_SCORECARD',
        userId,
        resourceType: 'scorecard',
        resourceId: updated.id,
        details: { ideaId, totalScore: updated.totalScore }
      });

      return updated;
    } else {
      // Create
      const [scorecard] = await db.insert(ideaScorecards)
        .values({
          ideaId,
          ...scores,
          createdBy: userId,
        })
        .returning();

      await createAuditEntry({
        eventType: 'DOCS_FIRST',
        action: 'CREATE_SCORECARD',
        userId,
        resourceType: 'scorecard',
        resourceId: scorecard.id,
        details: { ideaId, totalScore: scorecard.totalScore }
      });

      return scorecard;
    }
  }

  /**
   * Get scorecard for an idea
   */
  async getScorecard(ideaId: string): Promise<IdeaScorecard | null> {
    const result = await db.select()
      .from(ideaScorecards)
      .where(eq(ideaScorecards.ideaId, ideaId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Convert idea to topic brief
   */
  async convertToTopicBrief(ideaId: string, userId: string): Promise<string> {
    // Get idea
    const ideaResult = await db.select()
      .from(ideas)
      .where(eq(ideas.id, ideaId))
      .limit(1);

    if (ideaResult.length === 0) {
      throw new Error('Idea not found');
    }

    const idea = ideaResult[0];

    // Create topic brief from idea
    const [brief] = await db.insert(topicBriefs).values({
      researchId: idea.researchId,
      ideaId: ideaId,
      title: idea.title,
      background: idea.description || '',
      researchQuestion: '', // To be filled by user
      createdBy: userId,
    }).returning();

    // Update idea status
    await db.update(ideas)
      .set({ status: 'CONVERTED', updatedAt: new Date() })
      .where(eq(ideas.id, ideaId));

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'CONVERT_IDEA_TO_BRIEF',
      userId,
      resourceType: 'topic_brief',
      resourceId: brief.id,
      details: { ideaId, briefId: brief.id }
    });

    return brief.id;
  }
}

export const ideasService = new IdeasService();
