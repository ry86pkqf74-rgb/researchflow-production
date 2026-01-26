/**
 * Hybrid Search Service (Task 107: Semantic Search)
 *
 * Combines keyword-based and semantic vector search for best results.
 * Uses weighted scoring to merge and rank results from both approaches.
 */

import { searchArtifacts, type SearchResult } from './searchService';
import { semanticSearchService } from './semanticSearchService';

interface HybridSearchOptions {
  orgId: string;
  keywordWeight?: number;
  semanticWeight?: number;
  limit?: number;
}

interface HybridSearchResult {
  artifactId: string;
  filename: string;
  artifactType: string;
  combinedScore: number;
  keywordScore: number;
  semanticScore: number;
  matchType: 'keyword' | 'semantic' | 'both';
  snippet?: string;
  createdAt: Date;
}

export class HybridSearchService {
  /**
   * Hybrid search combining keyword and semantic results
   */
  async search(
    query: string,
    options: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    const {
      orgId,
      keywordWeight = 0.5,
      semanticWeight = 0.5,
      limit = 20,
    } = options;

    // Run searches in parallel
    const [keywordResults, semanticResults] = await Promise.all([
      searchArtifacts({ query, orgId, type: 'all', limit: limit * 2 }),
      semanticSearchService.search(query, { orgId, limit: limit * 2 }),
    ]);

    // Score keyword results (position-based decay)
    const keywordMap = new Map<string, { score: number; result: SearchResult }>();
    keywordResults.forEach((result, index) => {
      const score = Math.max(1.0 - (index * 0.05), 0.1); // Decay: 1.0, 0.95, 0.90, ... min 0.1
      keywordMap.set(result.id, { score, result });
    });

    // Score semantic results (similarity-based)
    const semanticMap = new Map<string, { score: number; result: any }>();
    semanticResults.forEach((result) => {
      semanticMap.set(result.artifactId, { score: result.similarity, result });
    });

    // Merge results
    const allIds = new Set([...keywordMap.keys(), ...semanticMap.keys()]);
    const combined: HybridSearchResult[] = [];

    for (const artifactId of allIds) {
      const keyword = keywordMap.get(artifactId);
      const semantic = semanticMap.get(artifactId);

      const keywordScore = keyword ? keyword.score : 0;
      const semanticScore = semantic ? semantic.score : 0;
      const combinedScore = (keywordScore * keywordWeight) + (semanticScore * semanticWeight);

      let matchType: 'keyword' | 'semantic' | 'both';
      if (keyword && semantic) matchType = 'both';
      else if (keyword) matchType = 'keyword';
      else matchType = 'semantic';

      combined.push({
        artifactId,
        filename: (keyword?.result.filename || semantic?.result.filename) as string,
        artifactType: (keyword?.result.artifactType || semantic?.result.artifactType) as string,
        combinedScore,
        keywordScore,
        semanticScore,
        matchType,
        snippet: keyword?.result.snippet,
        createdAt: (keyword?.result.createdAt || semantic?.result.createdAt) as Date,
      });
    }

    // Sort by combined score and limit
    return combined
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);
  }
}

export const hybridSearchService = new HybridSearchService();
