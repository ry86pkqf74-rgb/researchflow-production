/**
 * PubMed API Client
 *
 * Provides search and fetch capabilities for PubMed/MEDLINE database.
 * Uses NCBI E-utilities with caching via CacheService.
 */

import CacheService from '../cache.service.js';
import { logger } from '../../logger/file-logger.js';

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract?: string;
  authors: string[];
  journal?: string;
  year?: number;
  doi?: string;
  url?: string;
  source: 'pubmed';
}

export interface PubMedSearchOptions {
  maxResults?: number;
  sortBy?: 'relevance' | 'date';
  dateFrom?: string;
  dateTo?: string;
}

export class PubMedClient {
  private base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private cache: CacheService;
  private apiKey?: string;

  constructor(cache: CacheService, apiKey?: string) {
    this.cache = cache;
    this.apiKey = apiKey ?? process.env.NCBI_API_KEY;
  }

  /**
   * Search PubMed for articles matching query
   */
  async search(query: string, options: PubMedSearchOptions = {}): Promise<PubMedArticle[]> {
    const maxResults = options.maxResults ?? 20;
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    // Normalize cache key
    const cacheKey = `pubmed:q:${query.trim().toLowerCase()}|n:${maxResults}`;

    // Check cache first
    const cached = await this.cache.getCachedPubMedSearch(cacheKey);
    if (cached) {
      logger.debug(`PubMed cache hit for query: ${query}`);
      return cached as PubMedArticle[];
    }

    // Fetch from API
    const ids = await this.esearch(query, maxResults, options);
    if (!ids.length) {
      await this.cache.cachePubMedSearch(cacheKey, [], ttl);
      return [];
    }

    const articles = await this.efetch(ids);

    // Cache results
    await this.cache.cachePubMedSearch(cacheKey, articles, ttl);
    logger.info(`PubMed search completed: ${articles.length} results for "${query}"`);

    return articles;
  }

  /**
   * Fetch a single article by PMID
   */
  async fetchArticle(pmid: string): Promise<PubMedArticle | null> {
    const cached = await this.cache.getCachedPubMedArticle(pmid);
    if (cached) {
      return cached as PubMedArticle;
    }

    const articles = await this.efetch([pmid]);
    if (articles.length > 0) {
      await this.cache.cachePubMedArticle(pmid, articles[0]);
      return articles[0];
    }

    return null;
  }

  private apiKeyParam(): string {
    return this.apiKey ? `&api_key=${encodeURIComponent(this.apiKey)}` : '';
  }

  /**
   * ESearch - returns list of PMIDs matching query
   */
  private async esearch(
    query: string,
    maxResults: number,
    options: PubMedSearchOptions
  ): Promise<string[]> {
    let url =
      `${this.base}/esearch.fcgi?db=pubmed&retmode=json` +
      `&sort=${options.sortBy === 'date' ? 'pub+date' : 'relevance'}` +
      `&retmax=${maxResults}&term=${encodeURIComponent(query)}` +
      this.apiKeyParam();

    // Add date filters if provided
    if (options.dateFrom) {
      url += `&mindate=${options.dateFrom}`;
    }
    if (options.dateTo) {
      url += `&maxdate=${options.dateTo}`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      throw new Error(`PubMed esearch failed: ${res.status}`);
    }

    const json = await res.json();
    return (json?.esearchresult?.idlist ?? []) as string[];
  }

  /**
   * EFetch - retrieves article details for given PMIDs
   */
  private async efetch(pmids: string[]): Promise<PubMedArticle[]> {
    const url =
      `${this.base}/efetch.fcgi?db=pubmed&retmode=xml&id=${pmids.join(',')}` +
      this.apiKeyParam();

    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      throw new Error(`PubMed efetch failed: ${res.status}`);
    }

    const xml = await res.text();
    return this.parseXmlResponse(xml);
  }

  /**
   * Parse PubMed XML response into structured articles
   */
  private async parseXmlResponse(xml: string): Promise<PubMedArticle[]> {
    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(xml);

    const articles = doc?.PubmedArticleSet?.PubmedArticle ?? [];
    const arr = Array.isArray(articles) ? articles : [articles];

    return arr.map((a: any) => {
      const med = a?.MedlineCitation ?? {};
      const art = med?.Article ?? {};

      // Extract PMID
      const pmid = String(med?.PMID?.['#text'] ?? med?.PMID ?? '').trim();

      // Extract title
      const title = String(art?.ArticleTitle ?? '').trim();

      // Extract abstract (may be structured with multiple parts)
      const abs = art?.Abstract?.AbstractText;
      let abstract: string | undefined;
      if (Array.isArray(abs)) {
        abstract = abs
          .map((part: any) => {
            if (typeof part === 'string') return part;
            const label = part?.['@_Label'] || '';
            const text = part?.['#text'] || String(part);
            return label ? `${label}: ${text}` : text;
          })
          .join(' ');
      } else if (abs) {
        abstract = typeof abs === 'string' ? abs : String(abs?.['#text'] ?? abs);
      }

      // Extract journal
      const journal = String(art?.Journal?.Title ?? '').trim() || undefined;

      // Extract year
      const yearStr =
        art?.Journal?.JournalIssue?.PubDate?.Year ??
        art?.ArticleDate?.Year ??
        undefined;
      const year = yearStr ? parseInt(String(yearStr), 10) : undefined;

      // Extract authors
      const authorList = art?.AuthorList?.Author ?? [];
      const authorsArr = Array.isArray(authorList) ? authorList : [authorList];
      const authors = authorsArr
        .map((x: any) => {
          const last = x?.LastName;
          const fore = x?.ForeName;
          if (fore && last) return `${fore} ${last}`;
          return last || fore || null;
        })
        .filter(Boolean) as string[];

      // Extract DOI
      const ids = a?.PubmedData?.ArticleIdList?.ArticleId ?? [];
      const idsArr = Array.isArray(ids) ? ids : [ids];
      const doi = idsArr.find((id: any) => id?.['@_IdType'] === 'doi')?.['#text'];

      // Build URL
      const url = doi
        ? `https://doi.org/${doi}`
        : pmid
          ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
          : undefined;

      return {
        pmid,
        title,
        abstract,
        authors,
        journal,
        year,
        doi,
        url,
        source: 'pubmed' as const,
      };
    }).filter((x: any) => x.pmid && x.title);
  }
}

export default PubMedClient;
