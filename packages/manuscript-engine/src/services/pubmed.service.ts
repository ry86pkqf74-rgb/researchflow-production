import { z } from 'zod';
import type { Citation, CitationSourceType, LitSearchResult } from '../types/citation.types';

export interface PubMedSearchParams {
  query: string;
  maxResults?: number;
  minDate?: string; // YYYY/MM/DD
  maxDate?: string;
  sortBy?: 'relevance' | 'date';
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract?: string;
  authors: { lastName: string; firstName?: string; initials?: string }[];
  journal: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pmcid?: string;
  meshTerms?: string[];
  keywords?: string[];
  publicationType?: string[];
}

export class PubMedService {
  private readonly baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search PubMed for articles
   */
  async search(params: PubMedSearchParams): Promise<LitSearchResult> {
    const searchUrl = this.buildSearchUrl(params);

    // In production, this would make actual API calls
    const response = await this.fetchWithRetry(searchUrl);
    const idList = this.parseSearchResponse(response);

    // Fetch details for each ID
    const articles = await this.fetchArticleDetails(idList);

    return {
      query: params.query,
      source: 'pubmed',
      totalResults: idList.length,
      results: articles.map(a => ({
        externalId: a.pmid,
        title: a.title,
        authors: a.authors.map(auth =>
          `${auth.lastName}${auth.initials ? ' ' + auth.initials : ''}`
        ),
        year: a.year,
        abstract: a.abstract,
        citationCount: undefined
      })),
      searchedAt: new Date()
    };
  }

  /**
   * Fetch single article by PMID
   */
  async fetchByPmid(pmid: string): Promise<PubMedArticle | null> {
    const url = `${this.baseUrl}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml${this.apiKeyParam}`;

    try {
      const response = await this.fetchWithRetry(url);
      return this.parseArticleXml(response);
    } catch (error) {
      console.error(`Failed to fetch PMID ${pmid}:`, error);
      return null;
    }
  }

  /**
   * Fetch multiple articles by PMIDs
   */
  async fetchByPmids(pmids: string[]): Promise<PubMedArticle[]> {
    if (pmids.length === 0) return [];

    const url = `${this.baseUrl}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml${this.apiKeyParam}`;

    const response = await this.fetchWithRetry(url);
    return this.parseArticlesXml(response);
  }

  /**
   * Convert PubMed article to Citation format
   */
  toCitation(article: PubMedArticle, manuscriptId: string): Omit<Citation, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      manuscriptId,
      sourceType: 'pubmed' as CitationSourceType,
      externalId: article.pmid,
      title: article.title,
      authors: article.authors,
      journal: article.journal,
      year: article.year,
      volume: article.volume,
      issue: article.issue,
      pages: article.pages,
      doi: article.doi,
      pmid: article.pmid,
      pmcid: article.pmcid,
      abstract: article.abstract,
      keywords: article.keywords,
      meshTerms: article.meshTerms,
      sections: [],
      orderInDocument: undefined
    };
  }

  /**
   * Search for related articles
   */
  async findRelated(pmid: string, maxResults: number = 10): Promise<string[]> {
    const url = `${this.baseUrl}/elink.fcgi?dbfrom=pubmed&db=pubmed&id=${pmid}&cmd=neighbor_score${this.apiKeyParam}`;

    const response = await this.fetchWithRetry(url);
    return this.parseRelatedIds(response, maxResults);
  }

  /**
   * Get citation count from PubMed Central
   */
  async getCitationCount(pmid: string): Promise<number | null> {
    const url = `${this.baseUrl}/elink.fcgi?dbfrom=pubmed&linkname=pubmed_pubmed_citedin&id=${pmid}${this.apiKeyParam}`;

    try {
      const response = await this.fetchWithRetry(url);
      return this.parseCitationCount(response);
    } catch {
      return null;
    }
  }

  private get apiKeyParam(): string {
    return this.apiKey ? `&api_key=${this.apiKey}` : '';
  }

  private buildSearchUrl(params: PubMedSearchParams): string {
    const queryParts = [params.query];

    if (params.minDate) {
      queryParts.push(`${params.minDate}[PDAT]`);
    }
    if (params.maxDate) {
      queryParts.push(`${params.maxDate}[PDAT]`);
    }

    const query = encodeURIComponent(queryParts.join(' AND '));
    const sort = params.sortBy === 'date' ? '&sort=date' : '';
    const retmax = params.maxResults || 20;

    return `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${query}&retmax=${retmax}${sort}&retmode=json${this.apiKeyParam}`;
  }

  private async fetchWithRetry(url: string, retries: number = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Fetch failed after retries');
  }

  private parseSearchResponse(xml: string): string[] {
    // Parse esearch response to extract PMIDs
    const idMatch = xml.match(/<IdList>([\s\S]*?)<\/IdList>/);
    if (!idMatch) return [];

    const ids = idMatch[1].match(/<Id>(\d+)<\/Id>/g) || [];
    return ids.map(id => id.replace(/<\/?Id>/g, ''));
  }

  private async fetchArticleDetails(pmids: string[]): Promise<PubMedArticle[]> {
    if (pmids.length === 0) return [];
    return this.fetchByPmids(pmids);
  }

  private parseArticleXml(xml: string): PubMedArticle | null {
    const articles = this.parseArticlesXml(xml);
    return articles[0] || null;
  }

  private parseArticlesXml(xml: string): PubMedArticle[] {
    // Simplified XML parsing - in production use proper XML parser
    const articles: PubMedArticle[] = [];
    const articleMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];

    for (const articleXml of articleMatches) {
      const pmid = this.extractXmlValue(articleXml, 'PMID');
      const title = this.extractXmlValue(articleXml, 'ArticleTitle');
      const abstractText = this.extractXmlValue(articleXml, 'AbstractText');
      const journal = this.extractXmlValue(articleXml, 'Title'); // Journal title
      const year = parseInt(this.extractXmlValue(articleXml, 'Year') || '0', 10);

      if (pmid && title) {
        articles.push({
          pmid,
          title,
          abstract: abstractText,
          authors: this.parseAuthors(articleXml),
          journal: journal || '',
          year,
          volume: this.extractXmlValue(articleXml, 'Volume'),
          issue: this.extractXmlValue(articleXml, 'Issue'),
          pages: this.extractXmlValue(articleXml, 'MedlinePgn'),
          doi: this.extractDoi(articleXml),
          pmcid: this.extractPmcid(articleXml),
          meshTerms: this.parseMeshTerms(articleXml)
        });
      }
    }

    return articles;
  }

  private extractXmlValue(xml: string, tag: string): string | undefined {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return match ? match[1].trim() : undefined;
  }

  private parseAuthors(xml: string): PubMedArticle['authors'] {
    const authors: PubMedArticle['authors'] = [];
    const authorMatches = xml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) || [];

    for (const authorXml of authorMatches) {
      const lastName = this.extractXmlValue(authorXml, 'LastName');
      const firstName = this.extractXmlValue(authorXml, 'ForeName');
      const initials = this.extractXmlValue(authorXml, 'Initials');

      if (lastName) {
        authors.push({ lastName, firstName, initials });
      }
    }

    return authors;
  }

  private parseMeshTerms(xml: string): string[] {
    const terms: string[] = [];
    const meshMatches = xml.match(/<DescriptorName[^>]*>([^<]*)<\/DescriptorName>/g) || [];

    for (const match of meshMatches) {
      const term = match.replace(/<[^>]*>/g, '').trim();
      if (term) terms.push(term);
    }

    return terms;
  }

  private extractDoi(xml: string): string | undefined {
    const match = xml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
    return match ? match[1] : undefined;
  }

  private extractPmcid(xml: string): string | undefined {
    const match = xml.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/);
    return match ? match[1] : undefined;
  }

  private parseRelatedIds(xml: string, maxResults: number): string[] {
    const ids: string[] = [];
    const linkMatches = xml.match(/<Id>(\d+)<\/Id>/g) || [];

    for (const match of linkMatches.slice(0, maxResults)) {
      ids.push(match.replace(/<\/?Id>/g, ''));
    }

    return ids;
  }

  private parseCitationCount(xml: string): number {
    const idMatches = xml.match(/<Id>(\d+)<\/Id>/g) || [];
    return idMatches.length;
  }
}

export const pubmedService = new PubMedService(process.env.NCBI_API_KEY);
