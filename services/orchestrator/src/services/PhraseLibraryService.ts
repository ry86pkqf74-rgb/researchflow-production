/**
 * Phrase Library Service
 * Phase 4.2: Searchable phrase library for academic writing
 * 
 * Features:
 * - Category-based organization
 * - Tag-based search
 * - Full-text search
 * - Usage tracking
 * - Favorites management
 */

import { db } from '../../db';
import { logAction } from './audit-service';

export interface Phrase {
  id: string;
  phrase: string;
  category: string;
  tags: string[];
  rationale?: string;
  usageCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PhraseSearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'usage_count' | 'created_at' | 'phrase';
  sortOrder?: 'asc' | 'desc';
}

export interface PhraseSearchResult {
  phrases: Phrase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePhraseInput {
  phrase: string;
  category: string;
  tags?: string[];
  rationale?: string;
}

/**
 * Phrase categories for academic writing
 */
export const PHRASE_CATEGORIES = {
  INTRODUCTION: 'introduction',
  METHODS: 'methods',
  RESULTS: 'results',
  DISCUSSION: 'discussion',
  CONCLUSION: 'conclusion',
  TRANSITION: 'transition',
  HEDGING: 'hedging',
  EMPHASIS: 'emphasis',
  COMPARISON: 'comparison',
  LIMITATION: 'limitation',
  FUTURE_WORK: 'future_work',
  CITATION: 'citation'
} as const;

/**
 * Phrase Library Service
 */
export class PhraseLibraryService {
  private static instance: PhraseLibraryService;
  
  private constructor() {}
  
  static getInstance(): PhraseLibraryService {
    if (!this.instance) {
      this.instance = new PhraseLibraryService();
    }
    return this.instance;
  }
  
  /**
   * Search phrases
   */
  async search(params: PhraseSearchParams): Promise<PhraseSearchResult> {
    const {
      query,
      category,
      tags,
      limit = 20,
      offset = 0,
      sortBy = 'usage_count',
      sortOrder = 'desc'
    } = params;
    
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    // Full-text search
    if (query) {
      conditions.push(`(
        phrase ILIKE $${paramIndex} OR 
        rationale ILIKE $${paramIndex} OR
        $${paramIndex + 1} = ANY(tags)
      )`);
      values.push(`%${query}%`, query.toLowerCase());
      paramIndex += 2;
    }
    
    // Category filter
    if (category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }
    
    // Tags filter (match any)
    if (tags && tags.length > 0) {
      conditions.push(`tags && $${paramIndex}::text[]`);
      values.push(tags);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM phrase_library ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Get phrases
    const orderColumn = sortBy === 'phrase' ? 'phrase' : 
                        sortBy === 'created_at' ? 'created_at' : 'usage_count';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    const result = await db.query(`
      SELECT * FROM phrase_library
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...values, limit, offset]);
    
    return {
      phrases: result.rows.map(this.mapPhrase),
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit
    };
  }
  
  /**
   * Get phrase by ID
   */
  async getById(id: string): Promise<Phrase | null> {
    const result = await db.query(
      'SELECT * FROM phrase_library WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapPhrase(result.rows[0]);
  }
  
  /**
   * Get phrases by category
   */
  async getByCategory(category: string, limit = 50): Promise<Phrase[]> {
    const result = await db.query(`
      SELECT * FROM phrase_library
      WHERE category = $1
      ORDER BY usage_count DESC
      LIMIT $2
    `, [category, limit]);
    
    return result.rows.map(this.mapPhrase);
  }
  
  /**
   * Get phrases by tags
   */
  async getByTags(tags: string[], limit = 50): Promise<Phrase[]> {
    const result = await db.query(`
      SELECT * FROM phrase_library
      WHERE tags && $1::text[]
      ORDER BY usage_count DESC
      LIMIT $2
    `, [tags, limit]);
    
    return result.rows.map(this.mapPhrase);
  }
  
  /**
   * Create a new phrase
   */
  async create(input: CreatePhraseInput, userId?: string): Promise<Phrase> {
    const { phrase, category, tags = [], rationale } = input;
    
    const result = await db.query(`
      INSERT INTO phrase_library (phrase, category, tags, rationale)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [phrase, category, tags, rationale]);
    
    const created = this.mapPhrase(result.rows[0]);
    
    await logAction({
      eventType: 'PHRASE_CREATED',
      action: 'CREATE',
      resourceType: 'PHRASE',
      resourceId: created.id,
      userId,
      details: { category, tags }
    });
    
    return created;
  }
  
  /**
   * Update a phrase
   */
  async update(id: string, input: Partial<CreatePhraseInput>, userId?: string): Promise<Phrase | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (input.phrase !== undefined) {
      updates.push(`phrase = $${paramIndex++}`);
      values.push(input.phrase);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(input.tags);
    }
    if (input.rationale !== undefined) {
      updates.push(`rationale = $${paramIndex++}`);
      values.push(input.rationale);
    }
    
    if (updates.length === 0) return this.getById(id);
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await db.query(`
      UPDATE phrase_library
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) return null;
    
    const updated = this.mapPhrase(result.rows[0]);
    
    await logAction({
      eventType: 'PHRASE_UPDATED',
      action: 'UPDATE',
      resourceType: 'PHRASE',
      resourceId: id,
      userId
    });
    
    return updated;
  }
  
  /**
   * Delete a phrase
   */
  async delete(id: string, userId?: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM phrase_library WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length > 0) {
      await logAction({
        eventType: 'PHRASE_DELETED',
        action: 'DELETE',
        resourceType: 'PHRASE',
        resourceId: id,
        userId
      });
      return true;
    }
    
    return false;
  }
  
  /**
   * Increment usage count
   */
  async recordUsage(id: string, userId?: string): Promise<void> {
    await db.query(
      'UPDATE phrase_library SET usage_count = usage_count + 1 WHERE id = $1',
      [id]
    );
    
    await logAction({
      eventType: 'PHRASE_USED',
      action: 'USE',
      resourceType: 'PHRASE',
      resourceId: id,
      userId
    });
  }
  
  /**
   * Get popular phrases
   */
  async getPopular(limit = 20): Promise<Phrase[]> {
    const result = await db.query(`
      SELECT * FROM phrase_library
      ORDER BY usage_count DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(this.mapPhrase);
  }
  
  /**
   * Get category stats
   */
  async getCategoryStats(): Promise<Record<string, { count: number; totalUsage: number }>> {
    const result = await db.query(`
      SELECT category, COUNT(*) as count, SUM(usage_count) as total_usage
      FROM phrase_library
      GROUP BY category
      ORDER BY total_usage DESC
    `);
    
    const stats: Record<string, { count: number; totalUsage: number }> = {};
    for (const row of result.rows) {
      stats[row.category] = {
        count: parseInt(row.count),
        totalUsage: parseInt(row.total_usage) || 0
      };
    }
    return stats;
  }
  
  /**
   * Bulk import phrases
   */
  async bulkImport(phrases: CreatePhraseInput[], userId?: string): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    
    for (const phrase of phrases) {
      try {
        await this.create(phrase, userId);
        imported++;
      } catch (e: any) {
        errors.push(`Failed to import "${phrase.phrase.substring(0, 50)}...": ${e.message}`);
      }
    }
    
    return { imported, errors };
  }
  
  // Helper method
  private mapPhrase(row: any): Phrase {
    return {
      id: row.id,
      phrase: row.phrase,
      category: row.category,
      tags: row.tags || [],
      rationale: row.rationale,
      usageCount: row.usage_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const phraseLibraryService = PhraseLibraryService.getInstance();
export default phraseLibraryService;
