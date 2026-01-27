/**
 * Embedding Service (Task 107: Semantic Search)
 *
 * Generates and manages artifact embeddings for semantic search.
 * PHI-SAFE: Only embeds metadata (filename, type, description, tags) - NEVER content.
 */

import { db } from '../../db';
import { artifacts, artifactEmbeddings } from '@researchflow/core/schema';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';

interface EmbeddingMetadata {
  artifactType: string;
  filename: string;
  description?: string;
  tags?: string[];
}

export class EmbeddingService {
  private readonly workerUrl: string;
  private readonly modelName = 'text-embedding-3-small';

  constructor(workerUrl: string = process.env.WORKER_SERVICE_URL || 'http://worker:8001') {
    this.workerUrl = workerUrl;
  }

  /**
   * Generate embedding for a single artifact (PHI-safe)
   */
  async generateEmbedding(artifactId: string, orgId: string): Promise<void> {
    // Fetch artifact metadata
    const artifact = await db.query.artifacts.findFirst({
      where: eq(artifacts.id, artifactId),
      columns: {
        id: true,
        artifactType: true,
        filename: true,
        description: true,
      },
    });

    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    // Build PHI-safe metadata text
    const metadata: EmbeddingMetadata = {
      artifactType: artifact.artifactType,
      filename: artifact.filename,
      description: artifact.description || undefined,
    };

    const metadataText = this.buildEmbeddingText(metadata);
    const metadataHash = this.hashMetadata(metadataText);

    // Check if embedding already exists and is current
    const existing = await db.query.artifactEmbeddings.findFirst({
      where: and(
        eq(artifactEmbeddings.artifactId, artifactId),
        eq(artifactEmbeddings.metadataHash, metadataHash)
      ),
    });

    if (existing) {
      console.log(`[EmbeddingService] Embedding for ${artifactId} is current`);
      return;
    }

    // Call worker service to generate embedding
    const response = await fetch(`${this.workerUrl}/api/embeddings/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [metadataText],
        model: this.modelName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker service error: ${response.statusText}`);
    }

    const result = await response.json();
    const embedding = result.embeddings[0];

    // Store or update embedding
    await db.insert(artifactEmbeddings).values({
      artifactId,
      orgId,
      embeddingVector: embedding,
      modelName: this.modelName,
      metadataHash,
    }).onConflictDoUpdate({
      target: artifactEmbeddings.artifactId,
      set: {
        embeddingVector: embedding,
        metadataHash,
        updatedAt: new Date(),
      },
    });

    console.log(`[EmbeddingService] Generated embedding for ${artifactId}`);
  }

  /**
   * Batch generate embeddings for multiple artifacts
   */
  async batchGenerateEmbeddings(orgId: string, limit: number = 100): Promise<number> {
    // Find artifacts without embeddings
    const artifactsNeedingEmbeddings = await db
      .select({ id: artifacts.id })
      .from(artifacts)
      .leftJoin(artifactEmbeddings, eq(artifacts.id, artifactEmbeddings.artifactId))
      .where(and(
        eq(artifacts.orgId, orgId),
        isNull(artifactEmbeddings.id)
      ))
      .limit(limit);

    let count = 0;
    for (const artifact of artifactsNeedingEmbeddings) {
      try {
        await this.generateEmbedding(artifact.id, orgId);
        count++;
      } catch (error) {
        console.error(`[EmbeddingService] Failed to generate embedding for ${artifact.id}:`, error);
      }
    }

    return count;
  }

  /**
   * Build PHI-safe embedding text from metadata
   * CRITICAL: NEVER include file content, paths with PHI, or user data
   */
  private buildEmbeddingText(metadata: EmbeddingMetadata): string {
    const parts: string[] = [];

    parts.push(`Type: ${metadata.artifactType}`);
    parts.push(`Filename: ${metadata.filename}`);

    if (metadata.description) {
      parts.push(`Description: ${metadata.description}`);
    }

    if (metadata.tags && metadata.tags.length > 0) {
      parts.push(`Tags: ${metadata.tags.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Hash metadata for change detection
   */
  private hashMetadata(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}

export const embeddingService = new EmbeddingService();
