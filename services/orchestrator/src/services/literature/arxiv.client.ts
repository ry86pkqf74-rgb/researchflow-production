/**
 * arXiv API Client
 *
 * Provides search capabilities for arXiv preprint repository.
 * Parses Atom feed responses.
 */

import CacheService from '../cache.service.js';
import { logger } from '../../logger/file-logger.js';

export interface ArxivPaper {
  arxivId: string;
  title: string;
  abstract?: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  categories: string[];
  published?: string;
  updated?: string;
  pdfUrl?: string;
  source: 'arxiv';
}

export interface ArxivSearchOptions {
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
  start?: number;
  categories?: string[];
}

export class ArxivClient {
  private baseUrl = 'https://export.arxiv.org/api/query';
  private cache: CacheService;
  private userAgent: string;

  constructor(cache: CacheService) {
    this.cache = cache;
    this.userAgent = process.env.ARXIV_USER_AGENT || 'ResearchFlow/1.0 (mailto:admin@example.com)';
  }

  /**
   * Search arXiv for papers
   */
  async search(query: string, options: ArxivSearchOptions = {}): Promise<ArxivPaper[]> {
    const maxResults = options.maxResults ?? 20;
    const start = options.start ?? 0;
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    // Normalize cache key
    const cacheKey = `arxiv:q:${query.trim().toLowerCase()}|n:${maxResults}|s:${start}`;

    return this.cache.getOrSet(cacheKey, async () => {
      // Build search query
      let searchQuery = `all:${query}`;

      // Add category filter if provided
      if (options.categories?.length) {
        const catFilter = options.categories.map(c => `cat:${c}`).join('+OR+');
        searchQuery = `(${searchQuery})+AND+(${catFilter})`;
      }

      let url = `${this.baseUrl}?search_query=${encodeURIComponent(searchQuery)}&start=${start}&max_results=${maxResults}`;

      // Add sort options
      if (options.sortBy) {
        const sortMap: Record<string, string> = {
          relevance: 'relevance',
          lastUpdatedDate: 'lastUpdatedDate',
          submittedDate: 'submittedDate',
        };
        url += `&sortBy=${sortMap[options.sortBy] || 'relevance'}`;

        if (options.sortOrder) {
          url += `&sortOrder=${options.sortOrder}`;
        }
      }

      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        throw new Error(`arXiv search failed: ${res.status}`);
      }

      const xml = await res.text();
      const papers = await this.parseAtomFeed(xml);

      logger.info(`arXiv search: ${papers.length} results for "${query}"`);

      return papers;
    }, ttl);
  }

  /**
   * Fetch paper by arXiv ID
   */
  async fetchPaper(arxivId: string): Promise<ArxivPaper | null> {
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);
    const cacheKey = `arxiv:paper:${arxivId}`;

    return this.cache.getOrSet(cacheKey, async () => {
      // Clean the ID (remove version if present for initial lookup)
      const cleanId = arxivId.replace(/^arxiv:/i, '');

      const url = `${this.baseUrl}?id_list=${encodeURIComponent(cleanId)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`arXiv fetch failed: ${res.status}`);
      }

      const xml = await res.text();
      const papers = await this.parseAtomFeed(xml);

      return papers.length > 0 ? papers[0] : null;
    }, ttl);
  }

  /**
   * Parse arXiv Atom feed response
   */
  private async parseAtomFeed(xml: string): Promise<ArxivPaper[]> {
    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const doc = parser.parse(xml);
    const entries = doc?.feed?.entry ?? [];
    const arr = Array.isArray(entries) ? entries : entries ? [entries] : [];

    return arr
      .map((e: any) => {
        // Extract arXiv ID from URL
        const idUrl = String(e.id ?? '');
        const arxivId = idUrl.split('/abs/').pop() || '';

        // Extract title (clean newlines)
        const title = String(e.title ?? '')
          .replace(/\s+/g, ' ')
          .trim();

        // Extract abstract/summary
        const abstract = String(e.summary ?? '')
          .replace(/\s+/g, ' ')
          .trim() || undefined;

        // Extract authors
        const authorData = e.author ?? [];
        const authorArr = Array.isArray(authorData) ? authorData : [authorData];
        const authors = authorArr
          .map((a: any) => a?.name)
          .filter(Boolean) as string[];

        // Extract year from published date
        const published = e.published ? String(e.published) : undefined;
        const year = published ? parseInt(published.slice(0, 4), 10) : undefined;

        // Extract DOI if present
        const doi = e['arxiv:doi']?.['#text'] || e['arxiv:doi'] || undefined;

        // Extract categories
        const categoryData = e.category ?? [];
        const categoryArr = Array.isArray(categoryData) ? categoryData : [categoryData];
        const categories = categoryArr
          .map((c: any) => c?.['@_term'])
          .filter(Boolean) as string[];

        // Extract links
        const linkData = e.link ?? [];
        const linkArr = Array.isArray(linkData) ? linkData : [linkData];

        const url = linkArr.find((l: any) => l?.['@_type'] === 'text/html')?.['@_href'] || idUrl;
        const pdfUrl = linkArr.find((l: any) => l?.['@_title'] === 'pdf')?.['@_href'] || undefined;

        return {
          arxivId,
          title,
          abstract,
          authors,
          year,
          doi,
          url,
          categories,
          published,
          updated: e.updated ? String(e.updated) : undefined,
          pdfUrl,
          source: 'arxiv' as const,
        };
      })
      .filter((p: any) => p.arxivId && p.title);
  }
}

export default ArxivClient;
