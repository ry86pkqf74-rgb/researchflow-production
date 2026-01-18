export type SearchScope = 'columns' | 'values' | 'statistics' | 'citations' | 'all';

export interface SearchResult {
  type: 'column' | 'value' | 'statistic' | 'citation';
  datasetId: string;
  datasetName: string;
  match: string;
  context: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface SearchQuery {
  query: string;
  scope: SearchScope;
  manuscriptId: string;
  limit?: number;
}

export class DataSearchService {
  private mockDatasets = new Map<string, {
    id: string;
    name: string;
    columns: Array<{ name: string; type: string; description?: string }>;
    citations: Array<{ id: string; title: string }>;
  }>();

  search(params: SearchQuery): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = params.query.toLowerCase();

    // Search across all datasets for this manuscript
    for (const dataset of this.mockDatasets.values()) {
      // Search columns
      if (params.scope === 'columns' || params.scope === 'all') {
        for (const column of dataset.columns) {
          const score = this.calculateRelevance(params.query, column.name);
          if (score > 0) {
            results.push({
              type: 'column',
              datasetId: dataset.id,
              datasetName: dataset.name,
              match: column.name,
              context: `Type: ${column.type}${column.description ? `, ${column.description}` : ''}`,
              relevanceScore: score,
              metadata: { columnType: column.type }
            });
          }
        }
      }

      // Search citations
      if (params.scope === 'citations' || params.scope === 'all') {
        for (const citation of dataset.citations) {
          const score = this.calculateRelevance(params.query, citation.title);
          if (score > 0) {
            results.push({
              type: 'citation',
              datasetId: dataset.id,
              datasetName: dataset.name,
              match: citation.title,
              context: 'Referenced in dataset',
              relevanceScore: score,
              metadata: { citationId: citation.id }
            });
          }
        }
      }
    }

    // Sort by relevance and apply limit
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return params.limit ? results.slice(0, params.limit) : results;
  }

  private calculateRelevance(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower === queryLower) return 1.0;

    // Contains full query
    if (textLower.includes(queryLower)) return 0.8;

    // Word overlap
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    const matches = queryWords.filter(word => textWords.some(tw => tw.includes(word)));

    if (matches.length === 0) return 0;

    const wordScore = matches.length / queryWords.length;
    return wordScore * 0.6;
  }

  indexDataset(dataset: {
    id: string;
    name: string;
    columns: Array<{ name: string; type: string; description?: string }>;
    citations: Array<{ id: string; title: string }>;
  }): void {
    this.mockDatasets.set(dataset.id, dataset);
  }

  clearIndex(): void {
    this.mockDatasets.clear();
  }
}

export const dataSearchService = new DataSearchService();
