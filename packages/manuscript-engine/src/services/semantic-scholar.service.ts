import type { LitSearchResult } from '../types/citation.types';

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  authors: { authorId?: string; name: string }[];
  year?: number;
  venue?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: { url: string };
  externalIds?: {
    DOI?: string;
    PubMed?: string;
    ArXiv?: string;
  };
  tldr?: { text: string }; // AI-generated summary
  embedding?: { vector: number[] };
}

export interface SemanticSearchParams {
  query: string;
  limit?: number;
  year?: string; // e.g., "2020-2024" or "2023"
  fieldsOfStudy?: string[];
  openAccessOnly?: boolean;
}

export class SemanticScholarService {
  private readonly baseUrl = 'https://api.semanticscholar.org/graph/v1';
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search papers by keyword
   */
  async search(params: SemanticSearchParams): Promise<LitSearchResult> {
    const fields = [
      'paperId', 'title', 'abstract', 'authors', 'year',
      'venue', 'citationCount', 'isOpenAccess', 'externalIds', 'tldr'
    ].join(',');

    const url = new URL(`${this.baseUrl}/paper/search`);
    url.searchParams.set('query', params.query);
    url.searchParams.set('limit', String(params.limit || 20));
    url.searchParams.set('fields', fields);

    if (params.year) {
      url.searchParams.set('year', params.year);
    }
    if (params.fieldsOfStudy) {
      url.searchParams.set('fieldsOfStudy', params.fieldsOfStudy.join(','));
    }
    if (params.openAccessOnly) {
      url.searchParams.set('openAccessPdf', '');
    }

    const response = await this.fetchWithAuth(url.toString());
    const data = await response.json();

    return {
      query: params.query,
      source: 'semantic_scholar',
      totalResults: data.total || 0,
      results: (data.data || []).map((paper: SemanticScholarPaper) => ({
        externalId: paper.paperId,
        title: paper.title,
        authors: paper.authors.map(a => a.name),
        year: paper.year || 0,
        abstract: paper.abstract,
        relevanceScore: undefined,
        citationCount: paper.citationCount
      })),
      searchedAt: new Date()
    };
  }

  /**
   * Get paper details by ID
   */
  async getPaper(paperId: string): Promise<SemanticScholarPaper | null> {
    const fields = [
      'paperId', 'title', 'abstract', 'authors', 'year', 'venue',
      'citationCount', 'influentialCitationCount', 'isOpenAccess',
      'openAccessPdf', 'externalIds', 'tldr'
    ].join(',');

    const url = `${this.baseUrl}/paper/${paperId}?fields=${fields}`;

    try {
      const response = await this.fetchWithAuth(url);
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get paper by DOI
   */
  async getByDoi(doi: string): Promise<SemanticScholarPaper | null> {
    return this.getPaper(`DOI:${doi}`);
  }

  /**
   * Get paper by PMID
   */
  async getByPmid(pmid: string): Promise<SemanticScholarPaper | null> {
    return this.getPaper(`PMID:${pmid}`);
  }

  /**
   * Get paper citations
   */
  async getCitations(paperId: string, limit: number = 100): Promise<SemanticScholarPaper[]> {
    const fields = 'paperId,title,authors,year,citationCount';
    const url = `${this.baseUrl}/paper/${paperId}/citations?fields=${fields}&limit=${limit}`;

    try {
      const response = await this.fetchWithAuth(url);
      const data = await response.json();
      return (data.data || []).map((item: { citingPaper: SemanticScholarPaper }) => item.citingPaper);
    } catch {
      return [];
    }
  }

  /**
   * Get paper references
   */
  async getReferences(paperId: string, limit: number = 100): Promise<SemanticScholarPaper[]> {
    const fields = 'paperId,title,authors,year,citationCount';
    const url = `${this.baseUrl}/paper/${paperId}/references?fields=${fields}&limit=${limit}`;

    try {
      const response = await this.fetchWithAuth(url);
      const data = await response.json();
      return (data.data || []).map((item: { citedPaper: SemanticScholarPaper }) => item.citedPaper);
    } catch {
      return [];
    }
  }

  /**
   * Get AI-generated summary (TLDR)
   */
  async getTldr(paperId: string): Promise<string | null> {
    const paper = await this.getPaper(paperId);
    return paper?.tldr?.text || null;
  }

  /**
   * Find similar papers using embeddings
   */
  async findSimilar(paperId: string, limit: number = 10): Promise<SemanticScholarPaper[]> {
    const fields = 'paperId,title,authors,year,citationCount,abstract';
    const url = `${this.baseUrl}/recommendations/v1/papers/forpaper/${paperId}?fields=${fields}&limit=${limit}`;

    try {
      const response = await this.fetchWithAuth(url);
      const data = await response.json();
      return data.recommendedPapers || [];
    } catch {
      return [];
    }
  }

  /**
   * Batch fetch papers
   */
  async batchGetPapers(paperIds: string[]): Promise<SemanticScholarPaper[]> {
    if (paperIds.length === 0) return [];

    const fields = 'paperId,title,abstract,authors,year,venue,citationCount,externalIds';
    const url = `${this.baseUrl}/paper/batch?fields=${fields}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {})
        },
        body: JSON.stringify({ ids: paperIds })
      });

      return await response.json();
    } catch {
      return [];
    }
  }

  private async fetchWithAuth(url: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Semantic Scholar API error: ${response.status}`);
    }
    return response;
  }
}

export const semanticScholarService = new SemanticScholarService(
  process.env.SEMANTIC_SCHOLAR_API_KEY
);
