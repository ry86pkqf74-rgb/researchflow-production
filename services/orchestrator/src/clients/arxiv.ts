/**
 * arXiv API Client
 *
 * Client for arXiv API (Atom feed).
 * Implements rate limiting, retries, and result normalization.
 */

import type {
  LiteratureItem,
  LiteratureAuthor,
  LiteratureSearchResponse,
} from '@researchflow/core';

/**
 * arXiv search options
 */
export interface ArxivSearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
  categories?: string[]; // e.g., ['cs.AI', 'stat.ML']
}

/**
 * Parsed arXiv entry
 */
interface ArxivEntry {
  id: string;
  updated: string;
  published: string;
  title: string;
  summary: string;
  authors: Array<{ name: string; affiliation?: string }>;
  doi?: string;
  comment?: string;
  journalRef?: string;
  primaryCategory: string;
  categories: string[];
  links: Array<{ href: string; rel: string; type?: string; title?: string }>;
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
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[arXiv] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Extract text content from XML element
 */
function getTextContent(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
}

/**
 * Extract attribute from XML element
 */
function getAttribute(element: string, attr: string): string {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = element.match(regex);
  return match ? match[1] : '';
}

/**
 * Parse arXiv Atom feed XML
 */
function parseAtomFeed(xml: string): { entries: ArxivEntry[]; totalResults: number } {
  // Get total results
  const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  const totalResults = totalMatch ? parseInt(totalMatch[1], 10) : 0;

  // Parse entries
  const entries: ArxivEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    // Extract arXiv ID from URL
    const idUrl = getTextContent(entry, 'id');
    const idMatch = idUrl.match(/arxiv\.org\/abs\/([^\s]+)/);
    const arxivId = idMatch ? idMatch[1] : idUrl.split('/').pop() || '';

    // Extract authors
    const authors: Array<{ name: string; affiliation?: string }> = [];
    const authorRegex = /<author>([\s\S]*?)<\/author>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      const authorXml = authorMatch[1];
      const name = getTextContent(authorXml, 'name');
      const affiliation = getTextContent(authorXml, 'arxiv:affiliation') ||
        getTextContent(authorXml, 'affiliation');
      if (name) {
        authors.push({ name, affiliation: affiliation || undefined });
      }
    }

    // Extract links
    const links: Array<{ href: string; rel: string; type?: string; title?: string }> = [];
    const linkRegex = /<link([^>]*)\/>/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(entry)) !== null) {
      const linkAttrs = linkMatch[1];
      const href = getAttribute(linkAttrs, 'href');
      const rel = getAttribute(linkAttrs, 'rel') || 'alternate';
      const type = getAttribute(linkAttrs, 'type');
      const title = getAttribute(linkAttrs, 'title');
      if (href) {
        links.push({ href, rel, type: type || undefined, title: title || undefined });
      }
    }

    // Extract categories
    const categories: string[] = [];
    const categoryRegex = /<category[^>]*term="([^"]+)"[^>]*\/>/g;
    let catMatch;
    while ((catMatch = categoryRegex.exec(entry)) !== null) {
      categories.push(catMatch[1]);
    }

    // Extract primary category
    const primaryCatMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/);
    const primaryCategory = primaryCatMatch ? primaryCatMatch[1] : categories[0] || '';

    // Extract DOI if available
    const doiMatch = entry.match(/<arxiv:doi>([^<]+)<\/arxiv:doi>/);
    const doi = doiMatch ? doiMatch[1] : undefined;

    // Extract journal reference
    const journalRef = getTextContent(entry, 'arxiv:journal_ref');

    // Extract comment
    const comment = getTextContent(entry, 'arxiv:comment');

    entries.push({
      id: arxivId,
      updated: getTextContent(entry, 'updated'),
      published: getTextContent(entry, 'published'),
      title: getTextContent(entry, 'title'),
      summary: getTextContent(entry, 'summary'),
      authors,
      doi,
      comment: comment || undefined,
      journalRef: journalRef || undefined,
      primaryCategory,
      categories,
      links,
    });
  }

  return { entries, totalResults };
}

/**
 * arXiv API Client
 */
export class ArxivClient {
  private baseUrl = 'https://export.arxiv.org/api/query';
  private rateLimiter: RateLimiter;

  constructor() {
    // arXiv recommends ~3 second delay between requests
    this.rateLimiter = new RateLimiter(3000);
  }

  /**
   * Parse arXiv entry to LiteratureItem
   */
  private parseEntry(entry: ArxivEntry): LiteratureItem {
    // Parse authors
    const authors: LiteratureAuthor[] = entry.authors.map(a => ({
      name: a.name,
      affiliation: a.affiliation,
    }));

    // Parse year from published date
    let year: number | undefined;
    if (entry.published) {
      const yearMatch = entry.published.match(/\d{4}/);
      if (yearMatch) {
        year = parseInt(yearMatch[0], 10);
      }
    }

    // Build URLs
    const urls: string[] = [];
    const absLink = entry.links.find(l => l.rel === 'alternate');
    if (absLink) {
      urls.push(absLink.href);
    } else {
      urls.push(`https://arxiv.org/abs/${entry.id}`);
    }

    // Find PDF link
    const pdfLink = entry.links.find(l => l.title === 'pdf' || l.type === 'application/pdf');
    const pdfUrl = pdfLink?.href || `https://arxiv.org/pdf/${entry.id}.pdf`;
    urls.push(pdfUrl);

    if (entry.doi) {
      urls.push(`https://doi.org/${entry.doi}`);
    }

    return {
      id: `arxiv:${entry.id}`,
      provider: 'arxiv',
      title: entry.title,
      abstract: entry.summary,
      authors,
      year,
      venue: entry.journalRef || `arXiv:${entry.primaryCategory}`,
      doi: entry.doi,
      arxivId: entry.id,
      urls,
      pdfUrl,
      fetchedAt: new Date().toISOString(),
      keywords: entry.categories,
    };
  }

  /**
   * Search arXiv
   */
  async search(query: string, options: ArxivSearchOptions = {}): Promise<LiteratureSearchResponse> {
    const startTime = Date.now();
    await this.rateLimiter.wait();

    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    // Build search query
    let searchQuery = `all:${query}`;

    // Add category filter
    if (options.categories && options.categories.length > 0) {
      const catFilter = options.categories.map(c => `cat:${c}`).join(' OR ');
      searchQuery = `(${searchQuery}) AND (${catFilter})`;
    }

    // Build sort
    let sortBy = 'relevance';
    let sortOrder = 'descending';
    if (options.sortBy) {
      sortBy = options.sortBy;
    }
    if (options.sortOrder) {
      sortOrder = options.sortOrder;
    }

    const params = new URLSearchParams({
      search_query: searchQuery,
      start: String(offset),
      max_results: String(limit),
      sortBy,
      sortOrder,
    });

    const url = `${this.baseUrl}?${params.toString()}`;

    try {
      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/atom+xml' },
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(`arXiv search failed: ${res.status} ${res.statusText}`);
        }

        return res.text();
      });

      const { entries, totalResults } = parseAtomFeed(response);
      const items = entries.map(entry => this.parseEntry(entry));

      return {
        items,
        total: totalResults,
        query,
        providers: ['arxiv'],
        cached: false,
        searchDurationMs: Date.now() - startTime,
        providerResults: {
          arxiv: {
            count: items.length,
            total: totalResults,
            durationMs: Date.now() - startTime,
          },
        },
      };
    } catch (error) {
      console.error('[arXiv] Search error:', error);
      return {
        items: [],
        total: 0,
        query,
        providers: ['arxiv'],
        cached: false,
        searchDurationMs: Date.now() - startTime,
        providerResults: {
          arxiv: {
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
   * Get paper by arXiv ID
   */
  async getById(arxivId: string): Promise<LiteratureItem | null> {
    await this.rateLimiter.wait();

    // Clean up the ID
    const cleanId = arxivId.replace('arXiv:', '').replace('arxiv:', '');

    const params = new URLSearchParams({
      id_list: cleanId,
    });

    const url = `${this.baseUrl}?${params.toString()}`;

    try {
      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/atom+xml' },
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(`arXiv fetch failed: ${res.status} ${res.statusText}`);
        }

        return res.text();
      });

      const { entries } = parseAtomFeed(response);
      if (entries.length === 0) {
        return null;
      }

      return this.parseEntry(entries[0]);
    } catch (error) {
      console.error(`[arXiv] Error fetching paper ${arxivId}:`, error);
      return null;
    }
  }
}

// Singleton instance
let arxivClientInstance: ArxivClient | null = null;

/**
 * Get or create arXiv client instance
 */
export function getArxivClient(): ArxivClient {
  if (!arxivClientInstance) {
    arxivClientInstance = new ArxivClient();
  }
  return arxivClientInstance;
}
