import type { LitSearchResult } from '../types/citation.types';

export interface ArxivArticle {
  id: string;
  title: string;
  summary: string;
  authors: { name: string }[];
  published: Date;
  updated: Date;
  category: string;
  pdfUrl: string;
  doi?: string;
  journalRef?: string;
}

export interface ArxivSearchParams {
  query: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
  category?: string;
}

export class ArxivService {
  private readonly baseUrl = 'http://export.arxiv.org/api/query';

  async search(params: ArxivSearchParams): Promise<LitSearchResult> {
    const url = this.buildSearchUrl(params);

    try {
      const response = await fetch(url);
      const xml = await response.text();
      const articles = this.parseAtomFeed(xml);

      return {
        query: params.query,
        source: 'arxiv',
        totalResults: articles.length,
        results: articles.map(a => ({
          externalId: a.id,
          title: a.title,
          authors: a.authors.map(auth => auth.name),
          year: a.published.getFullYear(),
          abstract: a.summary,
          citationCount: undefined
        })),
        searchedAt: new Date()
      };
    } catch (error) {
      console.error('ArXiv search failed:', error);
      return {
        query: params.query,
        source: 'arxiv',
        totalResults: 0,
        results: [],
        searchedAt: new Date()
      };
    }
  }

  async getArticle(arxivId: string): Promise<ArxivArticle | null> {
    const url = `${this.baseUrl}?id_list=${arxivId}`;

    try {
      const response = await fetch(url);
      const xml = await response.text();
      const articles = this.parseAtomFeed(xml);
      return articles[0] || null;
    } catch {
      return null;
    }
  }

  private buildSearchUrl(params: ArxivSearchParams): string {
    const searchQuery = params.category
      ? `${params.query} AND cat:${params.category}`
      : params.query;

    const url = new URL(this.baseUrl);
    url.searchParams.set('search_query', searchQuery);
    url.searchParams.set('max_results', String(params.maxResults || 20));

    if (params.sortBy) {
      url.searchParams.set('sortBy', params.sortBy);
    }
    if (params.sortOrder) {
      url.searchParams.set('sortOrder', params.sortOrder);
    }

    return url.toString();
  }

  private parseAtomFeed(xml: string): ArxivArticle[] {
    const articles: ArxivArticle[] = [];
    const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    for (const entryXml of entryMatches) {
      const id = this.extractValue(entryXml, 'id')?.replace('http://arxiv.org/abs/', '') || '';
      const title = this.extractValue(entryXml, 'title')?.replace(/\s+/g, ' ').trim() || '';
      const summary = this.extractValue(entryXml, 'summary')?.replace(/\s+/g, ' ').trim() || '';
      const published = new Date(this.extractValue(entryXml, 'published') || '');
      const updated = new Date(this.extractValue(entryXml, 'updated') || '');

      const pdfLink = entryXml.match(/<link.*?title="pdf".*?href="([^"]+)"/);
      const pdfUrl = pdfLink ? pdfLink[1] : `http://arxiv.org/pdf/${id}`;

      const category = this.extractValue(entryXml, 'arxiv:primary_category', 'term') || '';
      const doi = this.extractValue(entryXml, 'arxiv:doi');
      const journalRef = this.extractValue(entryXml, 'arxiv:journal_ref');

      const authors: ArxivArticle['authors'] = [];
      const authorMatches = entryXml.match(/<author>[\s\S]*?<\/author>/g) || [];
      for (const authorXml of authorMatches) {
        const name = this.extractValue(authorXml, 'name');
        if (name) authors.push({ name });
      }

      if (id && title) {
        articles.push({
          id,
          title,
          summary,
          authors,
          published,
          updated,
          category,
          pdfUrl,
          doi,
          journalRef
        });
      }
    }

    return articles;
  }

  private extractValue(xml: string, tag: string, attribute?: string): string | undefined {
    if (attribute) {
      const match = xml.match(new RegExp(`<${tag}[^>]*${attribute}="([^"]+)"`));
      return match ? match[1] : undefined;
    }

    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return match ? match[1].trim() : undefined;
  }
}

export const arxivService = new ArxivService();
