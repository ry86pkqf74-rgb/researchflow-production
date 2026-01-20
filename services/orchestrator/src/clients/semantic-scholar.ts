/**
 * Semantic Scholar API Client
 *
 * Client for Semantic Scholar Graph API.
 * Implements rate limiting, retries, and result normalization.
 */

import type {
  LiteratureItem,
  LiteratureAuthor,
  LiteratureSearchResponse,
} from '@researchflow/core';

/**
 * Semantic Scholar search options
 */
export interface SemanticScholarSearchOptions {
  limit?: number;
  offset?: number;
  yearStart?: number;
  yearEnd?: number;
  fieldsOfStudy?: string[];
  openAccessOnly?: boolean;
}

/**
 * S2 API Paper response
 */
interface S2Paper {
  paperId: string;
  corpusId?: number;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
    PubMedCentral?: string;
    DBLP?: string;
  };
  url?: string;
  title: string;
  abstract?: string;
  venue?: string;
  publicationVenue?: {
    id?: string;
    name?: string;
    type?: string;
  };
  year?: number;
  referenceCount?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: {
    url?: string;
    status?: string;
  };
  fieldsOfStudy?: string[];
  s2FieldsOfStudy?: Array<{
    category: string;
    source: string;
  }>;
  publicationTypes?: string[];
  publicationDate?: string;
  journal?: {
    name?: string;
    pages?: string;
    volume?: string;
  };
  authors?: Array<{
    authorId: string;
    name: string;
    affiliations?: string[];
  }>;
  tldr?: {
    model: string;
    text: string;
  };
}

/**
 * S2 Search response
 */
interface S2SearchResponse {
  total: number;
  offset: number;
  next?: number;
  data: S2Paper[];
}

/**
 * Rate limiter
 */
class RateLimiter {
  private lastRequestTime = 0;
  private delayMs: number;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.delayMs) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isRateLimit = error instanceof Error && error.message.includes('429');
      if (attempt < maxRetries - 1) {
        const delay = isRateLimit
          ? baseDelayMs * Math.pow(2, attempt + 2) // Longer delay for rate limits
          : baseDelayMs * Math.pow(2, attempt);
        console.warn(`[SemanticScholar] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Semantic Scholar API Client
 */
export class SemanticScholarClient {
  private baseUrl = 'https://api.semanticscholar.org/graph/v1';
  private apiKey?: string;
  private rateLimiter: RateLimiter;

  constructor() {
    this.apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    // Rate limit: ~100 req/5 min without key, higher with key
    const rateLimitMs = this.apiKey ? 100 : 3000;
    this.rateLimiter = new RateLimiter(rateLimitMs);
  }

  /**
   * Build headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Parse S2 paper to LiteratureItem
   */
  private parsePaper(paper: S2Paper): LiteratureItem {
    // Parse authors
    const authors: LiteratureAuthor[] = (paper.authors || []).map(a => ({
      name: a.name,
      affiliation: a.affiliations?.[0],
    }));

    // Build URLs
    const urls: string[] = [];
    if (paper.url) {
      urls.push(paper.url);
    }
    if (paper.externalIds?.DOI) {
      urls.push(`https://doi.org/${paper.externalIds.DOI}`);
    }
    if (paper.openAccessPdf?.url) {
      urls.push(paper.openAccessPdf.url);
    }

    return {
      id: `s2:${paper.paperId}`,
      provider: 'semantic_scholar',
      title: paper.title,
      abstract: paper.abstract || paper.tldr?.text,
      authors,
      year: paper.year,
      venue: paper.venue || paper.publicationVenue?.name || paper.journal?.name,
      doi: paper.externalIds?.DOI,
      pmid: paper.externalIds?.PubMed,
      pmcid: paper.externalIds?.PubMedCentral,
      arxivId: paper.externalIds?.ArXiv,
      s2PaperId: paper.paperId,
      urls,
      pdfUrl: paper.openAccessPdf?.url,
      fetchedAt: new Date().toISOString(),
      keywords: paper.fieldsOfStudy,
      citationCount: paper.citationCount,
      influentialCitationCount: paper.influentialCitationCount,
    };
  }

  /**
   * Search papers
   */
  async search(query: string, options: SemanticScholarSearchOptions = {}): Promise<LiteratureSearchResponse> {
    const startTime = Date.now();
    await this.rateLimiter.wait();

    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    // Build query params
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      offset: String(offset),
      fields: 'paperId,corpusId,externalIds,url,title,abstract,venue,publicationVenue,year,referenceCount,citationCount,influentialCitationCount,isOpenAccess,openAccessPdf,fieldsOfStudy,s2FieldsOfStudy,publicationTypes,publicationDate,journal,authors,tldr',
    });

    // Add year filter
    if (options.yearStart || options.yearEnd) {
      const start = options.yearStart || 1900;
      const end = options.yearEnd || new Date().getFullYear();
      params.set('year', `${start}-${end}`);
    }

    // Add field of study filter
    if (options.fieldsOfStudy && options.fieldsOfStudy.length > 0) {
      params.set('fieldsOfStudy', options.fieldsOfStudy.join(','));
    }

    // Add open access filter
    if (options.openAccessOnly) {
      params.set('openAccessPdf', '');
    }

    const url = `${this.baseUrl}/paper/search?${params.toString()}`;

    try {
      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(`Semantic Scholar search failed: ${res.status} ${res.statusText}`);
        }

        return res.json() as Promise<S2SearchResponse>;
      });

      const items = response.data.map(paper => this.parsePaper(paper));

      return {
        items,
        total: response.total,
        query,
        providers: ['semantic_scholar'],
        cached: false,
        searchDurationMs: Date.now() - startTime,
        providerResults: {
          semantic_scholar: {
            count: items.length,
            total: response.total,
            durationMs: Date.now() - startTime,
          },
        },
      };
    } catch (error) {
      console.error('[SemanticScholar] Search error:', error);
      return {
        items: [],
        total: 0,
        query,
        providers: ['semantic_scholar'],
        cached: false,
        searchDurationMs: Date.now() - startTime,
        providerResults: {
          semantic_scholar: {
            count: 0,
            total: 0,
            durationMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      };
    }
  }

  /**
   * Get paper by S2 ID
   */
  async getById(paperId: string): Promise<LiteratureItem | null> {
    await this.rateLimiter.wait();

    const params = new URLSearchParams({
      fields: 'paperId,corpusId,externalIds,url,title,abstract,venue,publicationVenue,year,referenceCount,citationCount,influentialCitationCount,isOpenAccess,openAccessPdf,fieldsOfStudy,s2FieldsOfStudy,publicationTypes,publicationDate,journal,authors,tldr',
    });

    const url = `${this.baseUrl}/paper/${paperId}?${params.toString()}`;

    try {
      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(30000),
        });

        if (res.status === 404) {
          return null;
        }

        if (!res.ok) {
          throw new Error(`Semantic Scholar fetch failed: ${res.status} ${res.statusText}`);
        }

        return res.json() as Promise<S2Paper>;
      });

      if (!response) {
        return null;
      }

      return this.parsePaper(response);
    } catch (error) {
      console.error(`[SemanticScholar] Error fetching paper ${paperId}:`, error);
      return null;
    }
  }

  /**
   * Get paper by DOI
   */
  async getByDoi(doi: string): Promise<LiteratureItem | null> {
    return this.getById(`DOI:${doi}`);
  }

  /**
   * Get paper by arXiv ID
   */
  async getByArxiv(arxivId: string): Promise<LiteratureItem | null> {
    return this.getById(`ARXIV:${arxivId}`);
  }
}

// Singleton instance
let semanticScholarClientInstance: SemanticScholarClient | null = null;

/**
 * Get or create Semantic Scholar client instance
 */
export function getSemanticScholarClient(): SemanticScholarClient {
  if (!semanticScholarClientInstance) {
    semanticScholarClientInstance = new SemanticScholarClient();
  }
  return semanticScholarClientInstance;
}
