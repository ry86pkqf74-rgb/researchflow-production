/**
 * PDF Retrieval Service
 * Task: Retrieve full-text PDFs from various sources
 */

import axios, { AxiosInstance } from 'axios';

export interface PDFSource {
  name: string;
  url: string;
  accessType: 'open' | 'institutional' | 'paywalled';
  priority: number;
}

export interface PDFRetrievalResult {
  success: boolean;
  source?: string;
  url?: string;
  pdfData?: Buffer;
  contentType?: string;
  error?: string;
  accessType?: 'open' | 'institutional' | 'paywalled';
  metadata?: {
    fileSize?: number;
    pages?: number;
    title?: string;
  };
}

export interface PDFSearchOptions {
  doi?: string;
  pmid?: string;
  pmcid?: string;
  title?: string;
  preferOpenAccess?: boolean;
  timeout?: number;
}

/**
 * PDF Retrieval Service
 * Attempts to retrieve full-text PDFs from multiple sources
 */
export class PDFRetrievalService {
  private static instance: PDFRetrievalService;
  private httpClient: AxiosInstance;
  private unpayWallEmail?: string;
  private semanticScholarApiKey?: string;

  private constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'ResearchFlow/1.0 (mailto:support@researchflow.io)'
      }
    });
    this.unpayWallEmail = process.env.UNPAYWALL_EMAIL;
    this.semanticScholarApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  static getInstance(): PDFRetrievalService {
    if (!this.instance) {
      this.instance = new PDFRetrievalService();
    }
    return this.instance;
  }

  /**
   * Retrieve PDF from best available source
   */
  async retrieve(options: PDFSearchOptions): Promise<PDFRetrievalResult> {
    const sources: Array<() => Promise<PDFRetrievalResult>> = [];

    // Build retrieval strategy based on available identifiers
    if (options.pmcid) {
      sources.push(() => this.retrieveFromPMC(options.pmcid!));
    }

    if (options.doi) {
      sources.push(() => this.retrieveFromUnpaywall(options.doi!));
      sources.push(() => this.retrieveFromSemanticScholar(options.doi!));
      sources.push(() => this.retrieveFromCrossRef(options.doi!));
    }

    if (options.pmid) {
      sources.push(() => this.retrieveFromPubMed(options.pmid!));
    }

    // Try sources in priority order
    for (const source of sources) {
      try {
        const result = await source();
        if (result.success) {
          return result;
        }
      } catch (error) {
        // Continue to next source
        console.warn('PDF retrieval source failed:', error);
      }
    }

    return {
      success: false,
      error: 'No PDF available from any source'
    };
  }

  /**
   * Retrieve from PubMed Central (open access)
   */
  private async retrieveFromPMC(pmcid: string): Promise<PDFRetrievalResult> {
    const cleanPmcid = pmcid.replace(/^PMC/i, '');
    const pdfUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${cleanPmcid}/pdf/`;

    try {
      const response = await this.httpClient.get(pdfUrl, {
        responseType: 'arraybuffer',
        maxRedirects: 5
      });

      if (response.headers['content-type']?.includes('application/pdf')) {
        return {
          success: true,
          source: 'PubMed Central',
          url: pdfUrl,
          pdfData: Buffer.from(response.data),
          contentType: 'application/pdf',
          accessType: 'open',
          metadata: {
            fileSize: response.data.byteLength
          }
        };
      }

      return { success: false, error: 'Response was not a PDF' };
    } catch (error) {
      return { success: false, error: `PMC retrieval failed: ${error}` };
    }
  }

  /**
   * Retrieve from Unpaywall (open access aggregator)
   */
  private async retrieveFromUnpaywall(doi: string): Promise<PDFRetrievalResult> {
    if (!this.unpayWallEmail) {
      return { success: false, error: 'Unpaywall email not configured' };
    }

    const apiUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${this.unpayWallEmail}`;

    try {
      const response = await this.httpClient.get(apiUrl);
      const data = response.data;

      // Find best open access location
      const oaLocation = data.best_oa_location;
      if (!oaLocation?.url_for_pdf) {
        return { success: false, error: 'No open access PDF available' };
      }

      // Download the PDF
      const pdfResponse = await this.httpClient.get(oaLocation.url_for_pdf, {
        responseType: 'arraybuffer',
        maxRedirects: 5
      });

      if (pdfResponse.headers['content-type']?.includes('application/pdf')) {
        return {
          success: true,
          source: `Unpaywall (${oaLocation.host_type})`,
          url: oaLocation.url_for_pdf,
          pdfData: Buffer.from(pdfResponse.data),
          contentType: 'application/pdf',
          accessType: 'open',
          metadata: {
            fileSize: pdfResponse.data.byteLength,
            title: data.title
          }
        };
      }

      return { success: false, error: 'Downloaded content was not a PDF' };
    } catch (error) {
      return { success: false, error: `Unpaywall retrieval failed: ${error}` };
    }
  }

  /**
   * Retrieve from Semantic Scholar
   */
  private async retrieveFromSemanticScholar(doi: string): Promise<PDFRetrievalResult> {
    const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf,title`;

    const headers: Record<string, string> = {};
    if (this.semanticScholarApiKey) {
      headers['x-api-key'] = this.semanticScholarApiKey;
    }

    try {
      const response = await this.httpClient.get(apiUrl, { headers });
      const data = response.data;

      if (!data.openAccessPdf?.url) {
        return { success: false, error: 'No open access PDF available' };
      }

      // Download the PDF
      const pdfResponse = await this.httpClient.get(data.openAccessPdf.url, {
        responseType: 'arraybuffer',
        maxRedirects: 5
      });

      if (pdfResponse.headers['content-type']?.includes('application/pdf')) {
        return {
          success: true,
          source: 'Semantic Scholar',
          url: data.openAccessPdf.url,
          pdfData: Buffer.from(pdfResponse.data),
          contentType: 'application/pdf',
          accessType: 'open',
          metadata: {
            fileSize: pdfResponse.data.byteLength,
            title: data.title
          }
        };
      }

      return { success: false, error: 'Downloaded content was not a PDF' };
    } catch (error) {
      return { success: false, error: `Semantic Scholar retrieval failed: ${error}` };
    }
  }

  /**
   * Get PDF link from CrossRef
   */
  private async retrieveFromCrossRef(doi: string): Promise<PDFRetrievalResult> {
    const apiUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

    try {
      const response = await this.httpClient.get(apiUrl);
      const data = response.data.message;

      // Check for PDF link
      const pdfLink = data.link?.find((l: any) =>
        l['content-type'] === 'application/pdf' ||
        l.URL?.endsWith('.pdf')
      );

      if (!pdfLink?.URL) {
        return { success: false, error: 'No PDF link in CrossRef metadata' };
      }

      // Try to download (may be paywalled)
      try {
        const pdfResponse = await this.httpClient.get(pdfLink.URL, {
          responseType: 'arraybuffer',
          maxRedirects: 5,
          timeout: 10000
        });

        if (pdfResponse.headers['content-type']?.includes('application/pdf')) {
          return {
            success: true,
            source: 'CrossRef',
            url: pdfLink.URL,
            pdfData: Buffer.from(pdfResponse.data),
            contentType: 'application/pdf',
            accessType: 'open',
            metadata: {
              fileSize: pdfResponse.data.byteLength,
              title: data.title?.[0]
            }
          };
        }
      } catch {
        // PDF is likely paywalled
      }

      // Return URL only (paywalled)
      return {
        success: true,
        source: 'CrossRef (paywalled)',
        url: pdfLink.URL,
        accessType: 'paywalled',
        metadata: {
          title: data.title?.[0]
        }
      };
    } catch (error) {
      return { success: false, error: `CrossRef retrieval failed: ${error}` };
    }
  }

  /**
   * Get PDF info from PubMed
   */
  private async retrieveFromPubMed(pmid: string): Promise<PDFRetrievalResult> {
    // Check if there's a PMC ID linked
    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;

    try {
      const response = await this.httpClient.get(efetchUrl);
      const xml = response.data;

      // Extract PMC ID if present
      const pmcMatch = xml.match(/PMC\d+/);
      if (pmcMatch) {
        return this.retrieveFromPMC(pmcMatch[0]);
      }

      // Extract DOI if present
      const doiMatch = xml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
      if (doiMatch) {
        return this.retrieveFromUnpaywall(doiMatch[1]);
      }

      return { success: false, error: 'No PDF link found in PubMed record' };
    } catch (error) {
      return { success: false, error: `PubMed retrieval failed: ${error}` };
    }
  }

  /**
   * Check if a PDF URL is accessible
   */
  async checkAccess(url: string): Promise<{ accessible: boolean; contentType?: string; size?: number }> {
    try {
      const response = await this.httpClient.head(url, { timeout: 5000 });
      return {
        accessible: true,
        contentType: response.headers['content-type'],
        size: parseInt(response.headers['content-length'] || '0', 10)
      };
    } catch {
      return { accessible: false };
    }
  }

  /**
   * Get all available PDF sources for a paper (without downloading)
   */
  async findSources(options: PDFSearchOptions): Promise<PDFSource[]> {
    const sources: PDFSource[] = [];

    if (options.pmcid) {
      const cleanPmcid = options.pmcid.replace(/^PMC/i, '');
      sources.push({
        name: 'PubMed Central',
        url: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${cleanPmcid}/pdf/`,
        accessType: 'open',
        priority: 1
      });
    }

    if (options.doi && this.unpayWallEmail) {
      try {
        const response = await this.httpClient.get(
          `https://api.unpaywall.org/v2/${encodeURIComponent(options.doi)}?email=${this.unpayWallEmail}`
        );
        const data = response.data;

        if (data.best_oa_location?.url_for_pdf) {
          sources.push({
            name: `Unpaywall (${data.best_oa_location.host_type})`,
            url: data.best_oa_location.url_for_pdf,
            accessType: 'open',
            priority: 2
          });
        }

        // Add all OA locations
        for (const loc of data.oa_locations || []) {
          if (loc.url_for_pdf && loc.url_for_pdf !== data.best_oa_location?.url_for_pdf) {
            sources.push({
              name: `${loc.host_type} via Unpaywall`,
              url: loc.url_for_pdf,
              accessType: 'open',
              priority: 3
            });
          }
        }
      } catch {
        // Unpaywall lookup failed
      }
    }

    // Sort by priority
    return sources.sort((a, b) => a.priority - b.priority);
  }
}

export const pdfRetrievalService = PDFRetrievalService.getInstance();
