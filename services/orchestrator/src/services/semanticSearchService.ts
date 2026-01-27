/**
 * Semantic Search Service (Task 107: Semantic Search)
 *
 * Vector similarity search using cosine similarity on artifact embeddings.
 * Enables conceptual search beyond keyword matching.
 */

import { db } from '../../db';
import { artifacts, artifactEmbeddings } from '@researchflow/core/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

interface SemanticSearchOptions {
  orgId: string;
  limit?: number;
  threshold?: number;
  artifactTypes?: string[];
}

interface SemanticSearchResult {
  artifactId: string;
  filename: string;
  artifactType: string;
  similarity: number;
  createdAt: Date;
}

export class SemanticSearchService {
  private readonly workerUrl: string;
  private readonly defaultThreshold = 0.5;
  private readonly defaultLimit = 20;

  constructor(workerUrl: string = process.env.WORKER_SERVICE_URL || 'http://worker:8001') {
    this.workerUrl = workerUrl;
  }

  /**
   * Semantic search by query text
   */
  async search(
    query: string,
    options: SemanticSearchOptions
  ): Promise<SemanticSearchResult[]> {
    const { orgId, limit = this.defaultLimit, threshold = this.defaultThreshold, artifactTypes } = options;

    // Generate embedding for query
    const queryEmbedding = await this.generateQueryEmbedding(query);

    // Build similarity query using the cosine_similarity function
    const similarityExpr = sql<number>`cosine_similarity(
      ${artifactEmbeddings.embeddingVector},
      ${JSON.stringify(queryEmbedding)}::jsonb
    )`;

    // Build WHERE clause conditions
    const conditions = [
      eq(artifactEmbeddings.orgId, orgId),
      sql`${similarityExpr} >= ${threshold}`,
    ];

    // Add artifact type filter if specified
    if (artifactTypes && artifactTypes.length > 0) {
      conditions.push(sql`${artifacts.artifactType} = ANY(${artifactTypes})`);
    }

    const results = await db
      .select({
        artifactId: artifactEmbeddings.artifactId,
        filename: artifacts.filename,
        artifactType: artifacts.artifactType,
        similarity: similarityExpr,
        createdAt: artifacts.createdAt,
      })
      .from(artifactEmbeddings)
      .innerJoin(artifacts, eq(artifactEmbeddings.artifactId, artifacts.id))
      .where(and(...conditions))
      .orderBy(desc(similarityExpr))
      .limit(limit);

    return results;
  }

  /**
   * Find similar artifacts to a given artifact
   */
  async findSimilar(
    artifactId: string,
    orgId: string,
    limit: number = 10
  ): Promise<SemanticSearchResult[]> {
    // Get embedding for source artifact
    const sourceEmbedding = await db.query.artifactEmbeddings.findFirst({
      where: and(
        eq(artifactEmbeddings.artifactId, artifactId),
        eq(artifactEmbeddings.orgId, orgId)
      ),
    });

    if (!sourceEmbedding) {
      throw new Error(`No embedding found for artifact ${artifactId}`);
    }

    const similarityExpr = sql<number>`cosine_similarity(
      ${artifactEmbeddings.embeddingVector},
      ${sourceEmbedding.embeddingVector}::jsonb
    )`;

    const results = await db
      .select({
        artifactId: artifactEmbeddings.artifactId,
        filename: artifacts.filename,
        artifactType: artifacts.artifactType,
        similarity: similarityExpr,
        createdAt: artifacts.createdAt,
      })
      .from(artifactEmbeddings)
      .innerJoin(artifacts, eq(artifactEmbeddings.artifactId, artifacts.id))
      .where(
        and(
          eq(artifactEmbeddings.orgId, orgId),
          sql`${artifactEmbeddings.artifactId} != ${artifactId}` // Exclude self
        )
      )
      .orderBy(desc(similarityExpr))
      .limit(limit);

    return results;
  }

  /**
   * Generate query embedding via worker service
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const response = await fetch(`${this.workerUrl}/api/embeddings/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [query],
        model: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate query embedding: ${response.statusText}`);
    }

    const result = await response.json();
    return result.embeddings[0];
  }
}

export const semanticSearchService = new SemanticSearchService();
