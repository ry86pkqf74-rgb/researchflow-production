/**
 * PubMed API Client
 *
 * Client for NCBI E-utilities API (PubMed search).
 * Implements rate limiting, retries, and result normalization.
 */

import type {
  LiteratureItem,
  LiteratureAuthor,
  LiteratureSearchResponse,
} from '@researchflow/core';

/**
 * PubMed search options
 */
export interface PubMedSearchOptions {
  limit?: number;
  offset?: number;
  yearStart?: number;
  yearEnd?: number;
  publicationTypes?: string[];
  sortBy?: 'relevance' | 'date';
}

/**
 * NCBI E-utilities configuration
 */
interface EutilsConfig {
  baseUrl: string;
  apiKey?: string;
  tool: string;
  email: string;
  rateLimitMs: number;
}

/**
 * ESearch response
 */
interface ESearchResult {
  esearchresult: {
    count: string;
    retmax: string;
    retstart: string;
    idlist: string[];
    querytranslation?: string;
  };
}

/**
 * ESummary document result
 */
interface ESummaryDocsum {
  uid: string;
  pubdate: string;
  epubdate?: string;
  source: string;
  authors: Array<{ name: string; authtype: string; clusterid?: string }>;
  lastauthor?: string;
  title: string;
  sorttitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  lang?: string[];
  nlmuniqueid?: string;
  issn?: string;
  essn?: string;
  pubtype?: string[];
  recordstatus?: string;
  pubstatus?: string;
  articleids?: Array<{ idtype: string; idtypen: number; value: string }>;
  fulljournalname?: string;
  elocationid?: string;
  pmcrefcount?: number;
  sortpubdate?: string;
}

/**
 * ESummary response
 */
interface ESummaryResult {
  result: {
    uids: string[];
    [pmid: string]: ESummaryDocsum | string[];
  };
}

/**
 * EFetch abstract result (XML parsed)
 */
interface EFetchAbstract {
  pmid: string;
  abstract: string;
  meshTerms?: string[];
}

/**
 * Rate limiter for NCBI API
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
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[PubMed] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * PubMed API Client
 */
export class PubMedClient {
  private config: EutilsConfig;
  private rateLimiter: RateLimiter;

  constructor() {
    // Rate limit: 3 req/sec without API key, 10 req/sec with API key
    const hasApiKey = !!process.env.NCBI_API_KEY;
    const rateLimitMs = hasApiKey ? 100 : 334; // ~3 or ~10 req/sec

    this.config = {
      baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
      apiKey: process.env.NCBI_API_KEY,
      tool: process.env.NCBI_TOOL || 'researchflow',
      email: process.env.NCBI_EMAIL || 'support@researchflow.dev',
      rateLimitMs,
    };
    this.rateLimiter = new RateLimiter(rateLimitMs);
  }

  /**
   * Build URL with common parameters
   */
  private buildUrl(endpoint: string, params: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.config.baseUrl}/${endpoint}`);

    // Add common params
    url.searchParams.set('tool', this.config.tool);
    url.searchParams.set('email', this.config.email);
    if (this.config.apiKey) {
      url.searchParams.set('api_key', this.config.apiKey);
    }

    // Add custom params
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * Search PubMed and return PMIDs
   */
  private async esearch(query: string, options: PubMedSearchOptions = {}): Promise<ESearchResult> {
    await this.rateLimiter.wait();

    // Build query with filters
    let fullQuery = query;
    if (options.yearStart || options.yearEnd) {
      const start = options.yearStart || 1900;
      const end = options.yearEnd || new Date().getFullYear();
      fullQuery += ` AND ${start}:${end}[pdat]`;
    }
    if (options.publicationTypes && options.publicationTypes.length > 0) {
      const ptFilter = options.publicationTypes.map(pt => `"${pt}"[pt]`).join(' OR ');
      fullQuery += ` AND (${ptFilter})`;
    }

    const url = this.buildUrl('esearch.fcgi', {
      db: 'pubmed',
      term: fullQuery,
      retmax: options.limit || 20,
      retstart: options.offset || 0,
      retmode: 'json',
      sort: options.sortBy === 'date' ? 'pub+date' : 'relevance',
      usehistory: 'n',
    });

    return retryWithBackoff(async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`PubMed esearch failed: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<ESearchResult>;
    });
  }

  /**
   * Get document summaries by PMIDs
   */
  private async esummary(pmids: string[]): Promise<ESummaryResult> {
    if (pmids.length === 0) {
      return { result: { uids: [] } };
    }

    await this.rateLimiter.wait();

    const url = this.buildUrl('esummary.fcgi', {
      db: 'pubmed',
      id: pmids.join(','),
      retmode: 'json',
    });

    return retryWithBackoff(async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`PubMed esummary failed: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<ESummaryResult>;
    });
  }

  /**
   * Fetch abstracts for PMIDs (XML, then parse)
   */
  private async efetchAbstracts(pmids: string[]): Promise<Map<string, EFetchAbstract>> {
    if (pmids.length === 0) {
      return new Map();
    }

    await this.rateLimiter.wait();

    const url = this.buildUrl('efetch.fcgi', {
      db: 'pubmed',
      id: pmids.join(','),
      rettype: 'abstract',
      retmode: 'xml',
    });

    const result = new Map<string, EFetchAbstract>();

    try {
      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(60000),
        });

        if (!res.ok) {
          throw new Error(`PubMed efetch failed: ${res.status} ${res.statusText}`);
        }

        return res.text();
      });

      // Parse XML to extract abstracts (simple regex-based parsing)
      const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
      let match;

      while ((match = articleRegex.exec(response)) !== null) {
        const article = match[1];

        // Extract PMID
        const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
        if (!pmidMatch) continue;
        const pmid = pmidMatch[1];

        // Extract abstract
        const abstractMatch = article.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
        let abstract = '';
        if (abstractMatch) {
          abstract = abstractMatch
            .map(a => a.replace(/<[^>]+>/g, '').trim())
            .join(' ')
            .trim();
        }

        // Extract MeSH terms
        const meshTerms: string[] = [];
        const meshRegex = /<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g;
        let meshMatch;
        while ((meshMatch = meshRegex.exec(article)) !== null) {
          meshTerms.push(meshMatch[1]);
        }

        result.set(pmid, { pmid, abstract, meshTerms });
      }
    } catch (error) {
      console.warn('[PubMed] Error fetching abstracts:', error);
    }

    return result;
  }

  /**
   * Parse ESummary document to LiteratureItem
   */
  private parseSummary(
    pmid: string,
    doc: ESummaryDocsum,
    abstract?: EFetchAbstract
  ): LiteratureItem {
    // Parse authors
    const authors: LiteratureAuthor[] = (doc.authors || []).map(a => ({
      name: a.name,
    }));

    // Parse year from pubdate
    let year: number | undefined;
    const yearMatch = doc.pubdate?.match(/\d{4}/);
    if (yearMatch) {
      year = parseInt(yearMatch[0], 10);
    }

    // Extract identifiers
    let doi: string | undefined;
    let pmcid: string | undefined;
    const articleIds = doc.articleids || [];
    for (const aid of articleIds) {
      if (aid.idtype === 'doi') {
        doi = aid.value;
      } else if (aid.idtype === 'pmc') {
        pmcid = aid.value;
      }
    }

    // Build URLs
    const urls: string[] = [`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`];
    if (doi) {
      urls.push(`https://doi.org/${doi}`);
    }
    if (pmcid) {
      urls.push(`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`);
    }

    return {
      id: `pubmed:${pmid}`,
      provider: 'pubmed',
      title: doc.title?.replace(/\.$/, '') || 'Untitled',
      abstract: abstract?.abstract,
      authors,
      year,
      venue: doc.fulljournalname || doc.source,
      doi,
      pmid,
      pmcid,
      urls,
      fetchedAt: new Date().toISOString(),
      meshTerms: abstract?.meshTerms,
      publicationTypes: doc.pubtype,
    };
  }

  /**
   * Search PubMed and return normalized results
   */
  async search(query: string, options: PubMedSearchOptions = {}): Promise<LiteratureSearchResponse> {
    const startTime = Date.now();

    // Step 1: Search for PMIDs
    const searchResult = await this.esearch(query, options);
    const pmids = searchResult.esearchresult.idlist || [];
    const total = parseInt(searchResult.esearchresult.count || '0', 10);

    if (pmids.length === 0) {
      return {
        items: [],
        total: 0,
        query,
        providers: ['pubmed'],
        cached: false,
        searchDurationMs: Date.now() - startTime,
      };
    }

    // Step 2: Get summaries
    const summaryResult = await this.esummary(pmids);

    // Step 3: Get abstracts
    const abstracts = await this.efetchAbstracts(pmids);

    // Step 4: Parse and normalize
    const items: LiteratureItem[] = [];
    for (const pmid of pmids) {
      const doc = summaryResult.result[pmid] as ESummaryDocsum | undefined;
      if (doc && typeof doc === 'object' && 'uid' in doc) {
        const abstract = abstracts.get(pmid);
        items.push(this.parseSummary(pmid, doc, abstract));
      }
    }

    return {
      items,
      total,
      query,
      providers: ['pubmed'],
      cached: false,
      searchDurationMs: Date.now() - startTime,
      providerResults: {
        pubmed: {
          count: items.length,
          total,
          durationMs: Date.now() - startTime,
        },
      },
    };
  }

  /**
   * Get a single paper by PMID
   */
  async getByPmid(pmid: string): Promise<LiteratureItem | null> {
    try {
      const summaryResult = await this.esummary([pmid]);
      const doc = summaryResult.result[pmid] as ESummaryDocsum | undefined;
      if (!doc || typeof doc !== 'object' || !('uid' in doc)) {
        return null;
      }

      const abstracts = await this.efetchAbstracts([pmid]);
      const abstract = abstracts.get(pmid);

      return this.parseSummary(pmid, doc, abstract);
    } catch (error) {
      console.error(`[PubMed] Error fetching PMID ${pmid}:`, error);
      return null;
    }
  }
}

// Singleton instance
let pubmedClientInstance: PubMedClient | null = null;

/**
 * Get or create PubMed client instance
 */
export function getPubMedClient(): PubMedClient {
  if (!pubmedClientInstance) {
    pubmedClientInstance = new PubMedClient();
  }
  return pubmedClientInstance;
}
