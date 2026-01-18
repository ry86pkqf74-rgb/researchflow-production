# Phase 2: Literature Search Integration (Tasks 21-40)

## Prerequisites

- Phase 1A/1B completed (Data Integration)
- `packages/manuscript-engine/` with core services
- Citation types defined in `types/citation.types.ts`

## Integration Points

- `packages/ai-router/` - For AI-powered summarization and analysis
- `services/orchestrator/` - API routes for literature endpoints
- External APIs: PubMed, Semantic Scholar, arXiv

---

## Task 21: PubMed Service

**File**: `packages/manuscript-engine/src/services/pubmed.service.ts`

```typescript
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
    // For now, return structure for implementation
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
```

---

## Task 22: Semantic Scholar Service

**File**: `packages/manuscript-engine/src/services/semantic-scholar.service.ts`

```typescript
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
```

---

## Task 23: Literature Review Generator Service

**File**: `packages/manuscript-engine/src/services/lit-review.service.ts`

```typescript
import type { Citation } from '../types/citation.types';
import type { SemanticScholarPaper } from './semantic-scholar.service';

export interface LitReviewConfig {
  manuscriptId: string;
  topic: string;
  citations: Citation[];
  style: 'narrative' | 'thematic' | 'chronological' | 'methodological';
  maxLength: number; // words
  includeGapAnalysis?: boolean;
}

export interface LitReviewSection {
  heading?: string;
  content: string;
  citationIds: string[];
  wordCount: number;
}

export interface GeneratedLitReview {
  sections: LitReviewSection[];
  gapAnalysis?: string;
  totalWordCount: number;
  citationsUsed: string[];
  suggestedAdditionalCitations?: string[];
}

export interface ThemeCluster {
  theme: string;
  citations: Citation[];
  summary: string;
  consensus?: string;
  controversies?: string[];
}

export class LitReviewService {
  /**
   * Generate literature review structure
   */
  async generateReview(config: LitReviewConfig): Promise<GeneratedLitReview> {
    // Cluster citations by theme
    const clusters = this.clusterByTheme(config.citations);

    // Generate sections based on style
    const sections = await this.generateSections(clusters, config);

    // Calculate word distribution
    const targetPerSection = Math.floor(config.maxLength / sections.length);
    
    // Generate gap analysis if requested
    let gapAnalysis: string | undefined;
    if (config.includeGapAnalysis) {
      gapAnalysis = await this.generateGapAnalysis(config.topic, config.citations);
    }

    return {
      sections: sections.map(s => ({
        ...s,
        wordCount: this.countWords(s.content)
      })),
      gapAnalysis,
      totalWordCount: sections.reduce((sum, s) => sum + this.countWords(s.content), 0),
      citationsUsed: config.citations.map(c => c.id),
      suggestedAdditionalCitations: []
    };
  }

  /**
   * Cluster citations by theme using keywords/MeSH terms
   */
  clusterByTheme(citations: Citation[]): ThemeCluster[] {
    // Group by shared keywords/MeSH terms
    const termFrequency = new Map<string, Citation[]>();

    for (const citation of citations) {
      const terms = [
        ...(citation.keywords || []),
        ...(citation.meshTerms || [])
      ];

      for (const term of terms) {
        const normalized = term.toLowerCase();
        const existing = termFrequency.get(normalized) || [];
        existing.push(citation);
        termFrequency.set(normalized, existing);
      }
    }

    // Find top themes (terms appearing in multiple citations)
    const themes: ThemeCluster[] = [];
    const usedCitations = new Set<string>();

    const sortedTerms = Array.from(termFrequency.entries())
      .filter(([_, cites]) => cites.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [theme, themeCitations] of sortedTerms) {
      // Only include citations not already used
      const newCitations = themeCitations.filter(c => !usedCitations.has(c.id));
      
      if (newCitations.length >= 2) {
        newCitations.forEach(c => usedCitations.add(c.id));
        
        themes.push({
          theme: this.formatThemeName(theme),
          citations: newCitations,
          summary: this.summarizeTheme(newCitations)
        });
      }

      if (themes.length >= 5) break; // Limit to 5 themes
    }

    // Add remaining unclustered citations as "Other Studies"
    const remaining = citations.filter(c => !usedCitations.has(c.id));
    if (remaining.length > 0) {
      themes.push({
        theme: 'Other Relevant Studies',
        citations: remaining,
        summary: this.summarizeTheme(remaining)
      });
    }

    return themes;
  }

  /**
   * Generate sections based on review style
   */
  private async generateSections(
    clusters: ThemeCluster[],
    config: LitReviewConfig
  ): Promise<LitReviewSection[]> {
    switch (config.style) {
      case 'thematic':
        return this.generateThematicSections(clusters);
      case 'chronological':
        return this.generateChronologicalSections(config.citations);
      case 'methodological':
        return this.generateMethodologicalSections(config.citations);
      case 'narrative':
      default:
        return this.generateNarrativeSections(clusters, config.topic);
    }
  }

  private generateThematicSections(clusters: ThemeCluster[]): LitReviewSection[] {
    return clusters.map(cluster => ({
      heading: cluster.theme,
      content: this.writeThematicParagraph(cluster),
      citationIds: cluster.citations.map(c => c.id),
      wordCount: 0
    }));
  }

  private generateChronologicalSections(citations: Citation[]): LitReviewSection[] {
    // Sort by year
    const sorted = [...citations].sort((a, b) => a.year - b.year);
    
    // Group by decade or 5-year periods
    const periods = new Map<string, Citation[]>();
    
    for (const citation of sorted) {
      const period = Math.floor(citation.year / 5) * 5;
      const key = `${period}-${period + 4}`;
      const existing = periods.get(key) || [];
      existing.push(citation);
      periods.set(key, existing);
    }

    return Array.from(periods.entries()).map(([period, cites]) => ({
      heading: `Studies from ${period}`,
      content: this.writeChronologicalParagraph(cites),
      citationIds: cites.map(c => c.id),
      wordCount: 0
    }));
  }

  private generateMethodologicalSections(citations: Citation[]): LitReviewSection[] {
    // Group by study design (inferred from keywords/abstract)
    const designs = new Map<string, Citation[]>();
    
    for (const citation of citations) {
      const design = this.inferStudyDesign(citation);
      const existing = designs.get(design) || [];
      existing.push(citation);
      designs.set(design, existing);
    }

    return Array.from(designs.entries()).map(([design, cites]) => ({
      heading: `${design} Studies`,
      content: this.writeMethodologicalParagraph(design, cites),
      citationIds: cites.map(c => c.id),
      wordCount: 0
    }));
  }

  private generateNarrativeSections(
    clusters: ThemeCluster[],
    topic: string
  ): LitReviewSection[] {
    const sections: LitReviewSection[] = [];

    // Opening section
    sections.push({
      heading: undefined,
      content: `The literature on ${topic} has evolved considerably over recent years. ` +
               `This review synthesizes findings from ${clusters.reduce((sum, c) => sum + c.citations.length, 0)} studies.`,
      citationIds: [],
      wordCount: 0
    });

    // Theme sections
    for (const cluster of clusters) {
      sections.push({
        heading: cluster.theme,
        content: this.writeThematicParagraph(cluster),
        citationIds: cluster.citations.map(c => c.id),
        wordCount: 0
      });
    }

    return sections;
  }

  private async generateGapAnalysis(topic: string, citations: Citation[]): Promise<string> {
    // Analyze what's covered and what's missing
    const coveredAreas = new Set<string>();
    
    for (const citation of citations) {
      (citation.keywords || []).forEach(k => coveredAreas.add(k.toLowerCase()));
      (citation.meshTerms || []).forEach(m => coveredAreas.add(m.toLowerCase()));
    }

    // This would be enhanced with AI analysis
    return `Based on the reviewed literature, several gaps remain in our understanding of ${topic}. ` +
           `Future research should address these limitations to provide more comprehensive evidence.`;
  }

  private writeThematicParagraph(cluster: ThemeCluster): string {
    const citations = cluster.citations;
    const firstAuthor = citations[0]?.authors[0]?.lastName || 'Authors';
    
    let paragraph = `Research on ${cluster.theme.toLowerCase()} has been examined by several investigators. `;
    
    if (citations.length === 1) {
      paragraph += `${firstAuthor} et al. (${citations[0].year}) reported findings in this area.`;
    } else {
      paragraph += `${firstAuthor} et al. (${citations[0].year}) and others have contributed to this body of knowledge.`;
    }

    return paragraph;
  }

  private writeChronologicalParagraph(citations: Citation[]): string {
    const sorted = [...citations].sort((a, b) => a.year - b.year);
    const parts = sorted.map(c => {
      const author = c.authors[0]?.lastName || 'Unknown';
      return `${author} et al. (${c.year})`;
    });

    return `During this period, notable contributions were made by ${parts.join(', ')}.`;
  }

  private writeMethodologicalParagraph(design: string, citations: Citation[]): string {
    return `${citations.length} ${design.toLowerCase()} studies have examined this topic. ` +
           `These studies provide ${design === 'RCT' ? 'high-quality experimental' : 'observational'} evidence.`;
  }

  private inferStudyDesign(citation: Citation): string {
    const text = [
      citation.title,
      citation.abstract,
      ...(citation.keywords || [])
    ].join(' ').toLowerCase();

    if (text.includes('randomized') || text.includes('rct')) return 'RCT';
    if (text.includes('meta-analysis')) return 'Meta-Analysis';
    if (text.includes('systematic review')) return 'Systematic Review';
    if (text.includes('cohort')) return 'Cohort';
    if (text.includes('case-control')) return 'Case-Control';
    if (text.includes('cross-sectional')) return 'Cross-Sectional';
    
    return 'Observational';
  }

  private formatThemeName(term: string): string {
    return term
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private summarizeTheme(citations: Citation[]): string {
    return `${citations.length} studies examined this topic between ${Math.min(...citations.map(c => c.year))} and ${Math.max(...citations.map(c => c.year))}.`;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

export const litReviewService = new LitReviewService();
```

---

## Task 24: Citation Manager Service

**File**: `packages/manuscript-engine/src/services/citation-manager.service.ts`

```typescript
import { v4 as uuid } from 'uuid';
import type { Citation, CitationStyle, FormattedCitation } from '../types/citation.types';
import { pubmedService } from './pubmed.service';

export interface CitationManagerConfig {
  manuscriptId: string;
  defaultStyle: CitationStyle;
}

export interface ResolvedCitation {
  citation: Citation;
  resolvedFrom: 'doi' | 'pmid' | 'pmcid' | 'manual';
  validationErrors?: string[];
}

export class CitationManagerService {
  private citations: Map<string, Citation[]> = new Map(); // manuscriptId -> citations
  private citationOrder: Map<string, string[]> = new Map(); // manuscriptId -> citationId order

  /**
   * Resolve DOI to full citation
   */
  async resolveFromDoi(doi: string, manuscriptId: string): Promise<ResolvedCitation | null> {
    try {
      // Use CrossRef API
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (!response.ok) return null;

      const data = await response.json();
      const work = data.message;

      const citation: Citation = {
        id: uuid(),
        manuscriptId,
        sourceType: 'doi',
        externalId: doi,
        title: work.title?.[0] || '',
        authors: (work.author || []).map((a: { family?: string; given?: string }) => ({
          lastName: a.family || '',
          firstName: a.given
        })),
        journal: work['container-title']?.[0],
        year: work.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
        volume: work.volume,
        issue: work.issue,
        pages: work.page,
        doi,
        url: work.URL,
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return { citation, resolvedFrom: 'doi' };
    } catch {
      return null;
    }
  }

  /**
   * Resolve PMID to full citation
   */
  async resolveFromPmid(pmid: string, manuscriptId: string): Promise<ResolvedCitation | null> {
    const article = await pubmedService.fetchByPmid(pmid);
    if (!article) return null;

    const citation = pubmedService.toCitation(article, manuscriptId);
    
    return {
      citation: {
        ...citation,
        id: uuid(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      resolvedFrom: 'pmid'
    };
  }

  /**
   * Add citation to manuscript
   */
  addCitation(citation: Citation): Citation {
    const existing = this.citations.get(citation.manuscriptId) || [];
    
    // Check for duplicates
    const duplicate = this.findDuplicate(citation, existing);
    if (duplicate) {
      return duplicate;
    }

    existing.push(citation);
    this.citations.set(citation.manuscriptId, existing);

    // Update order
    const order = this.citationOrder.get(citation.manuscriptId) || [];
    order.push(citation.id);
    this.citationOrder.set(citation.manuscriptId, order);

    return citation;
  }

  /**
   * Remove citation from manuscript
   */
  removeCitation(manuscriptId: string, citationId: string): boolean {
    const existing = this.citations.get(manuscriptId) || [];
    const index = existing.findIndex(c => c.id === citationId);
    
    if (index === -1) return false;

    existing.splice(index, 1);
    this.citations.set(manuscriptId, existing);

    // Update order
    const order = this.citationOrder.get(manuscriptId) || [];
    const orderIndex = order.indexOf(citationId);
    if (orderIndex !== -1) {
      order.splice(orderIndex, 1);
      this.citationOrder.set(manuscriptId, order);
    }

    return true;
  }

  /**
   * Get all citations for manuscript
   */
  getCitations(manuscriptId: string): Citation[] {
    return this.citations.get(manuscriptId) || [];
  }

  /**
   * Get citations in order
   */
  getCitationsInOrder(manuscriptId: string): Citation[] {
    const citations = this.citations.get(manuscriptId) || [];
    const order = this.citationOrder.get(manuscriptId) || [];

    const citationMap = new Map(citations.map(c => [c.id, c]));
    const ordered = order
      .map(id => citationMap.get(id))
      .filter((c): c is Citation => c !== undefined);

    // Add any citations not in order at the end
    const orderedIds = new Set(order);
    const unordered = citations.filter(c => !orderedIds.has(c.id));

    return [...ordered, ...unordered];
  }

  /**
   * Reorder citations (e.g., by appearance order)
   */
  reorderByAppearance(manuscriptId: string, sectionOrder: string[]): void {
    const citations = this.citations.get(manuscriptId) || [];
    const newOrder: string[] = [];
    const seen = new Set<string>();

    // Order by first appearance in sections
    for (const section of sectionOrder) {
      const sectionCitations = citations.filter(c => c.sections.includes(section));
      for (const citation of sectionCitations) {
        if (!seen.has(citation.id)) {
          newOrder.push(citation.id);
          seen.add(citation.id);
        }
      }
    }

    // Add any remaining
    for (const citation of citations) {
      if (!seen.has(citation.id)) {
        newOrder.push(citation.id);
      }
    }

    this.citationOrder.set(manuscriptId, newOrder);
  }

  /**
   * Validate citation data
   */
  validateCitation(citation: Citation): string[] {
    const errors: string[] = [];

    if (!citation.title || citation.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!citation.authors || citation.authors.length === 0) {
      errors.push('At least one author is required');
    }

    if (!citation.year || citation.year < 1800 || citation.year > new Date().getFullYear() + 1) {
      errors.push('Valid year is required');
    }

    // Validate DOI format if provided
    if (citation.doi && !this.isValidDoi(citation.doi)) {
      errors.push('Invalid DOI format');
    }

    // Validate PMID format if provided
    if (citation.pmid && !/^\d+$/.test(citation.pmid)) {
      errors.push('Invalid PMID format');
    }

    return errors;
  }

  /**
   * Find duplicate citations
   */
  findDuplicate(citation: Citation, existing: Citation[]): Citation | null {
    // Check by DOI
    if (citation.doi) {
      const byDoi = existing.find(c => c.doi === citation.doi);
      if (byDoi) return byDoi;
    }

    // Check by PMID
    if (citation.pmid) {
      const byPmid = existing.find(c => c.pmid === citation.pmid);
      if (byPmid) return byPmid;
    }

    // Check by title similarity
    const normalizedTitle = this.normalizeTitle(citation.title);
    const byTitle = existing.find(c => 
      this.normalizeTitle(c.title) === normalizedTitle &&
      c.year === citation.year
    );
    if (byTitle) return byTitle;

    return null;
  }

  /**
   * Merge duplicate citations
   */
  mergeCitations(manuscriptId: string): { merged: number; remaining: Citation[] } {
    const citations = this.citations.get(manuscriptId) || [];
    const unique: Citation[] = [];
    let merged = 0;

    for (const citation of citations) {
      const existing = this.findDuplicate(citation, unique);
      if (existing) {
        // Merge sections
        existing.sections = [...new Set([...existing.sections, ...citation.sections])];
        merged++;
      } else {
        unique.push(citation);
      }
    }

    this.citations.set(manuscriptId, unique);
    return { merged, remaining: unique };
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isValidDoi(doi: string): boolean {
    // Basic DOI format validation
    return /^10\.\d{4,}\/[^\s]+$/.test(doi);
  }
}

export const citationManagerService = new CitationManagerService();
```

---

## Task 25: Gap Analysis Prompt

**File**: `packages/manuscript-engine/src/prompts/gap-analysis.prompt.ts`

```typescript
export interface GapAnalysisInput {
  topic: string;
  researchQuestion: string;
  existingLiterature: {
    title: string;
    year: number;
    keyFindings: string;
  }[];
  studyDesigns: string[];
  populations: string[];
  outcomes: string[];
}

export const GAP_ANALYSIS_SYSTEM_PROMPT = `You are an expert research methodologist analyzing gaps in the existing literature.

Your role is to:
1. Identify what has been studied and what remains unexplored
2. Highlight methodological limitations in existing research
3. Suggest how new research could address these gaps
4. Be specific and actionable in recommendations

Guidelines:
- Base analysis ONLY on the provided literature summaries
- Do not fabricate studies or findings
- Be balanced - acknowledge strengths as well as gaps
- Consider population, intervention, comparison, outcome (PICO) framework
- Flag potential publication bias concerns`;

export const GAP_ANALYSIS_PROMPT = `Analyze the research landscape for the following topic and identify gaps:

## Research Topic
{topic}

## Research Question
{researchQuestion}

## Existing Literature Summary
{literatureSummary}

## Study Designs Used
{studyDesigns}

## Populations Studied
{populations}

## Outcomes Measured
{outcomes}

---

Please provide a structured gap analysis with the following sections:

### 1. Coverage Assessment
- What aspects of the research question are well-addressed?
- What evidence quality exists (RCTs, observational, etc.)?

### 2. Identified Gaps

#### Population Gaps
- What populations are underrepresented?
- Are there subgroups that need separate analysis?

#### Methodological Gaps
- What study designs are missing?
- Are there limitations in existing methodologies?

#### Outcome Gaps
- What outcomes haven't been measured?
- Are there important long-term outcomes missing?

#### Contextual Gaps
- What settings or contexts are understudied?
- Are there geographic or cultural gaps?

### 3. Research Opportunities
- List 3-5 specific research questions that could address key gaps
- Prioritize by feasibility and potential impact

### 4. Limitations of This Analysis
- Note any caveats about the literature reviewed

Output as JSON with keys: coverageAssessment, populationGaps, methodologicalGaps, outcomeGaps, contextualGaps, researchOpportunities, limitations`;

export function buildGapAnalysisPrompt(input: GapAnalysisInput): string {
  const literatureSummary = input.existingLiterature
    .map(lit => `- ${lit.title} (${lit.year}): ${lit.keyFindings}`)
    .join('\n');

  return GAP_ANALYSIS_PROMPT
    .replace('{topic}', input.topic)
    .replace('{researchQuestion}', input.researchQuestion)
    .replace('{literatureSummary}', literatureSummary)
    .replace('{studyDesigns}', input.studyDesigns.join(', '))
    .replace('{populations}', input.populations.join(', '))
    .replace('{outcomes}', input.outcomes.join(', '));
}

export interface GapAnalysisResult {
  coverageAssessment: string;
  populationGaps: string[];
  methodologicalGaps: string[];
  outcomeGaps: string[];
  contextualGaps: string[];
  researchOpportunities: {
    question: string;
    priority: 'high' | 'medium' | 'low';
    rationale: string;
  }[];
  limitations: string[];
}
```

---

## Task 26: Citation Inserter Types

**File**: `packages/manuscript-engine/src/types/citation-inserter.types.ts`

```typescript
import { z } from 'zod';
import type { Citation, CitationStyle, FormattedCitation } from './citation.types';

export const InsertPosition = z.object({
  section: z.string(),
  paragraphIndex: z.number().int().nonnegative(),
  characterOffset: z.number().int().nonnegative()
});
export type InsertPosition = z.infer<typeof InsertPosition>;

export const CitationInsertRequest = z.object({
  manuscriptId: z.string().uuid(),
  citationId: z.string().uuid(),
  position: InsertPosition,
  citationStyle: z.string().optional()
});
export type CitationInsertRequest = z.infer<typeof CitationInsertRequest>;

export interface CitationPreview {
  citation: Citation;
  formatted: FormattedCitation;
  insertText: string;
  existingOccurrences: InsertPosition[];
}

export interface CitationInserterProps {
  manuscriptId: string;
  position: InsertPosition;
  citationStyle: CitationStyle;
  onInsert: (request: CitationInsertRequest) => Promise<void>;
  onSearch: (query: string) => Promise<Citation[]>;
  onClose: () => void;
  recentCitations?: Citation[];
}

export interface CitationSearchState {
  query: string;
  results: Citation[];
  isSearching: boolean;
  selectedIndex: number;
  showPubMedResults: boolean;
  pubMedResults?: Citation[];
}
```

---

## Task 27: arXiv Service

**File**: `packages/manuscript-engine/src/services/arxiv.service.ts`

```typescript
import type { LitSearchResult, Citation, CitationSourceType } from '../types/citation.types';

export interface ArxivPaper {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  publishedDate: Date;
  updatedDate?: Date;
  doi?: string;
  pdfUrl: string;
  comment?: string;
}

export interface ArxivSearchParams {
  query: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
  categories?: string[]; // e.g., ['cs.AI', 'stat.ML']
}

export class ArxivService {
  private readonly baseUrl = 'http://export.arxiv.org/api/query';

  /**
   * Search arXiv papers
   */
  async search(params: ArxivSearchParams): Promise<LitSearchResult> {
    const searchQuery = this.buildQuery(params);
    const url = `${this.baseUrl}?${searchQuery}`;

    const response = await fetch(url);
    const xml = await response.text();
    const papers = this.parseAtomFeed(xml);

    return {
      query: params.query,
      source: 'arxiv',
      totalResults: papers.length,
      results: papers.map(p => ({
        externalId: p.arxivId,
        title: p.title,
        authors: p.authors,
        year: p.publishedDate.getFullYear(),
        abstract: p.abstract
      })),
      searchedAt: new Date()
    };
  }

  /**
   * Get paper by arXiv ID
   */
  async getById(arxivId: string): Promise<ArxivPaper | null> {
    // Normalize ID (remove version if present)
    const normalizedId = arxivId.replace(/v\d+$/, '');
    const url = `${this.baseUrl}?id_list=${normalizedId}`;

    try {
      const response = await fetch(url);
      const xml = await response.text();
      const papers = this.parseAtomFeed(xml);
      return papers[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Convert arXiv paper to Citation
   */
  toCitation(paper: ArxivPaper, manuscriptId: string): Omit<Citation, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      manuscriptId,
      sourceType: 'arxiv' as CitationSourceType,
      externalId: paper.arxivId,
      title: paper.title,
      authors: paper.authors.map(name => {
        const parts = name.split(' ');
        return {
          lastName: parts[parts.length - 1],
          firstName: parts.slice(0, -1).join(' ')
        };
      }),
      year: paper.publishedDate.getFullYear(),
      doi: paper.doi,
      url: paper.pdfUrl,
      abstract: paper.abstract,
      sections: []
    };
  }

  /**
   * Get recent papers in categories
   */
  async getRecentInCategories(
    categories: string[],
    maxResults: number = 50
  ): Promise<ArxivPaper[]> {
    const categoryQuery = categories.map(c => `cat:${c}`).join(' OR ');
    
    return this.search({
      query: categoryQuery,
      maxResults,
      sortBy: 'submittedDate',
      sortOrder: 'descending'
    }).then(result => 
      result.results.map(r => ({
        arxivId: r.externalId,
        title: r.title,
        abstract: r.abstract || '',
        authors: r.authors,
        categories: [],
        publishedDate: new Date(r.year, 0, 1),
        pdfUrl: `https://arxiv.org/pdf/${r.externalId}.pdf`
      }))
    );
  }

  private buildQuery(params: ArxivSearchParams): string {
    const parts: string[] = [];

    // Search query
    let searchTerms = params.query;
    if (params.categories && params.categories.length > 0) {
      const catQuery = params.categories.map(c => `cat:${c}`).join(' OR ');
      searchTerms = `(${searchTerms}) AND (${catQuery})`;
    }
    parts.push(`search_query=${encodeURIComponent(searchTerms)}`);

    // Max results
    parts.push(`max_results=${params.maxResults || 20}`);

    // Sorting
    if (params.sortBy) {
      parts.push(`sortBy=${params.sortBy}`);
    }
    if (params.sortOrder) {
      parts.push(`sortOrder=${params.sortOrder}`);
    }

    return parts.join('&');
  }

  private parseAtomFeed(xml: string): ArxivPaper[] {
    const papers: ArxivPaper[] = [];
    const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    for (const entry of entryMatches) {
      const paper = this.parseEntry(entry);
      if (paper) {
        papers.push(paper);
      }
    }

    return papers;
  }

  private parseEntry(entryXml: string): ArxivPaper | null {
    const getId = (xml: string): string | null => {
      const match = xml.match(/<id>http:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
      return match ? match[1] : null;
    };

    const getTitle = (xml: string): string => {
      const match = xml.match(/<title>([^<]*)<\/title>/);
      return match ? match[1].replace(/\s+/g, ' ').trim() : '';
    };

    const getAbstract = (xml: string): string => {
      const match = xml.match(/<summary>([^]*?)<\/summary>/);
      return match ? match[1].replace(/\s+/g, ' ').trim() : '';
    };

    const getAuthors = (xml: string): string[] => {
      const authors: string[] = [];
      const authorMatches = xml.match(/<author>[\s\S]*?<\/author>/g) || [];
      for (const authorXml of authorMatches) {
        const nameMatch = authorXml.match(/<name>([^<]+)<\/name>/);
        if (nameMatch) {
          authors.push(nameMatch[1]);
        }
      }
      return authors;
    };

    const getPublishedDate = (xml: string): Date => {
      const match = xml.match(/<published>([^<]+)<\/published>/);
      return match ? new Date(match[1]) : new Date();
    };

    const getCategories = (xml: string): string[] => {
      const categories: string[] = [];
      const catMatches = xml.match(/term="([^"]+)"/g) || [];
      for (const match of catMatches) {
        const term = match.match(/term="([^"]+)"/);
        if (term) {
          categories.push(term[1]);
        }
      }
      return categories;
    };

    const getDoi = (xml: string): string | undefined => {
      const match = xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
      return match ? match[1] : undefined;
    };

    const arxivId = getId(entryXml);
    if (!arxivId) return null;

    return {
      arxivId,
      title: getTitle(entryXml),
      abstract: getAbstract(entryXml),
      authors: getAuthors(entryXml),
      categories: getCategories(entryXml),
      publishedDate: getPublishedDate(entryXml),
      doi: getDoi(entryXml),
      pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`
    };
  }
}

export const arxivService = new ArxivService();
```

---

## Task 28: Literature Matrix Builder

**File**: `packages/manuscript-engine/src/services/lit-matrix.service.ts`

```typescript
import type { Citation } from '../types/citation.types';

export interface MatrixColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'category';
  description?: string;
}

export interface MatrixRow {
  citationId: string;
  citation: Citation;
  values: Record<string, string | number | boolean | null>;
  notes?: string;
}

export interface LiteratureMatrix {
  id: string;
  manuscriptId: string;
  title: string;
  columns: MatrixColumn[];
  rows: MatrixRow[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SystematicReviewColumns {
  // PICO elements
  population: MatrixColumn;
  intervention: MatrixColumn;
  comparator: MatrixColumn;
  outcome: MatrixColumn;
  // Study characteristics
  studyDesign: MatrixColumn;
  sampleSize: MatrixColumn;
  followUpDuration: MatrixColumn;
  // Quality assessment
  riskOfBias: MatrixColumn;
  // Results
  effectSize: MatrixColumn;
  confidenceInterval: MatrixColumn;
  pValue: MatrixColumn;
}

export const SYSTEMATIC_REVIEW_COLUMNS: SystematicReviewColumns = {
  population: {
    id: 'population',
    label: 'Population',
    type: 'text',
    description: 'Study population characteristics'
  },
  intervention: {
    id: 'intervention',
    label: 'Intervention',
    type: 'text',
    description: 'Intervention or exposure'
  },
  comparator: {
    id: 'comparator',
    label: 'Comparator',
    type: 'text',
    description: 'Control or comparison group'
  },
  outcome: {
    id: 'outcome',
    label: 'Outcome',
    type: 'text',
    description: 'Primary outcome measured'
  },
  studyDesign: {
    id: 'studyDesign',
    label: 'Study Design',
    type: 'category',
    description: 'RCT, Cohort, Case-Control, etc.'
  },
  sampleSize: {
    id: 'sampleSize',
    label: 'Sample Size',
    type: 'number',
    description: 'Total number of participants'
  },
  followUpDuration: {
    id: 'followUpDuration',
    label: 'Follow-up',
    type: 'text',
    description: 'Duration of follow-up'
  },
  riskOfBias: {
    id: 'riskOfBias',
    label: 'Risk of Bias',
    type: 'category',
    description: 'Low, Moderate, High, or Critical'
  },
  effectSize: {
    id: 'effectSize',
    label: 'Effect Size',
    type: 'text',
    description: 'OR, RR, HR, MD, etc.'
  },
  confidenceInterval: {
    id: 'confidenceInterval',
    label: '95% CI',
    type: 'text',
    description: '95% Confidence Interval'
  },
  pValue: {
    id: 'pValue',
    label: 'P-value',
    type: 'text',
    description: 'Statistical significance'
  }
};

export class LitMatrixService {
  private matrices: Map<string, LiteratureMatrix> = new Map();

  /**
   * Create new literature matrix
   */
  createMatrix(params: {
    manuscriptId: string;
    title: string;
    template?: 'systematic_review' | 'custom';
    customColumns?: MatrixColumn[];
  }): LiteratureMatrix {
    const columns = params.template === 'systematic_review'
      ? Object.values(SYSTEMATIC_REVIEW_COLUMNS)
      : params.customColumns || [];

    const matrix: LiteratureMatrix = {
      id: crypto.randomUUID(),
      manuscriptId: params.manuscriptId,
      title: params.title,
      columns,
      rows: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.matrices.set(matrix.id, matrix);
    return matrix;
  }

  /**
   * Add citation to matrix
   */
  addCitation(
    matrixId: string,
    citation: Citation,
    values?: Record<string, string | number | boolean | null>
  ): MatrixRow {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) {
      throw new Error('Matrix not found');
    }

    // Initialize values for all columns
    const rowValues: Record<string, string | number | boolean | null> = {};
    for (const column of matrix.columns) {
      rowValues[column.id] = values?.[column.id] ?? null;
    }

    const row: MatrixRow = {
      citationId: citation.id,
      citation,
      values: rowValues
    };

    matrix.rows.push(row);
    matrix.updatedAt = new Date();

    return row;
  }

  /**
   * Update cell value
   */
  updateCell(
    matrixId: string,
    citationId: string,
    columnId: string,
    value: string | number | boolean | null
  ): void {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) {
      throw new Error('Matrix not found');
    }

    const row = matrix.rows.find(r => r.citationId === citationId);
    if (!row) {
      throw new Error('Row not found');
    }

    row.values[columnId] = value;
    matrix.updatedAt = new Date();
  }

  /**
   * Add column to matrix
   */
  addColumn(matrixId: string, column: MatrixColumn): void {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) {
      throw new Error('Matrix not found');
    }

    matrix.columns.push(column);
    
    // Initialize new column in all rows
    for (const row of matrix.rows) {
      row.values[column.id] = null;
    }

    matrix.updatedAt = new Date();
  }

  /**
   * Remove column from matrix
   */
  removeColumn(matrixId: string, columnId: string): void {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) {
      throw new Error('Matrix not found');
    }

    matrix.columns = matrix.columns.filter(c => c.id !== columnId);
    
    for (const row of matrix.rows) {
      delete row.values[columnId];
    }

    matrix.updatedAt = new Date();
  }

  /**
   * Get matrix
   */
  getMatrix(matrixId: string): LiteratureMatrix | null {
    return this.matrices.get(matrixId) || null;
  }

  /**
   * Export to table format
   */
  exportToTable(matrixId: string): {
    headers: string[];
    rows: (string | number | null)[][];
  } {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) {
      throw new Error('Matrix not found');
    }

    const headers = [
      'Author (Year)',
      ...matrix.columns.map(c => c.label)
    ];

    const rows = matrix.rows.map(row => {
      const author = row.citation.authors[0]?.lastName || 'Unknown';
      const year = row.citation.year;
      
      return [
        `${author} et al. (${year})`,
        ...matrix.columns.map(c => row.values[c.id] ?? null)
      ];
    });

    return { headers, rows };
  }

  /**
   * Generate summary statistics
   */
  generateSummary(matrixId: string): Record<string, unknown> {
    const matrix = this.matrices.get(matrixId);
    if (!matrix) {
      throw new Error('Matrix not found');
    }

    const summary: Record<string, unknown> = {
      totalStudies: matrix.rows.length,
      dateRange: this.getDateRange(matrix.rows),
      columns: {}
    };

    for (const column of matrix.columns) {
      const values = matrix.rows
        .map(r => r.values[column.id])
        .filter(v => v !== null && v !== undefined);

      if (column.type === 'number') {
        const numbers = values.filter((v): v is number => typeof v === 'number');
        (summary.columns as Record<string, unknown>)[column.id] = {
          count: numbers.length,
          sum: numbers.reduce((a, b) => a + b, 0),
          mean: numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null,
          min: numbers.length > 0 ? Math.min(...numbers) : null,
          max: numbers.length > 0 ? Math.max(...numbers) : null
        };
      } else if (column.type === 'category') {
        const counts: Record<string, number> = {};
        for (const v of values) {
          const key = String(v);
          counts[key] = (counts[key] || 0) + 1;
        }
        (summary.columns as Record<string, unknown>)[column.id] = counts;
      }
    }

    return summary;
  }

  private getDateRange(rows: MatrixRow[]): { earliest: number; latest: number } | null {
    if (rows.length === 0) return null;

    const years = rows.map(r => r.citation.year);
    return {
      earliest: Math.min(...years),
      latest: Math.max(...years)
    };
  }
}

export const litMatrixService = new LitMatrixService();
```

---

## Tasks 29-40: Continued

**File**: `packages/manuscript-engine/src/services/plagiarism-check.service.ts` (Task 29)

```typescript
import { createHash } from 'crypto';

export interface PlagiarismCheckResult {
  similarity: number; // 0-100 percentage
  matches: PlagiarismMatch[];
  checkedAgainst: string[];
  checkTimestamp: Date;
}

export interface PlagiarismMatch {
  sourceId: string;
  sourceTitle: string;
  matchedText: string;
  originalText: string;
  similarity: number;
  startPosition: number;
  endPosition: number;
}

export class PlagiarismCheckService {
  /**
   * Check text against cited sources
   */
  async checkAgainstCitations(
    text: string,
    citations: { id: string; title: string; abstract?: string }[]
  ): Promise<PlagiarismCheckResult> {
    const matches: PlagiarismMatch[] = [];
    const checkedAgainst: string[] = [];

    // Tokenize input text into sentences
    const sentences = this.tokenizeSentences(text);

    for (const citation of citations) {
      if (!citation.abstract) continue;
      checkedAgainst.push(citation.id);

      const citationSentences = this.tokenizeSentences(citation.abstract);
      
      for (const sentence of sentences) {
        for (const citeSentence of citationSentences) {
          const similarity = this.calculateSimilarity(sentence, citeSentence);
          
          if (similarity > 0.7) { // 70% similarity threshold
            matches.push({
              sourceId: citation.id,
              sourceTitle: citation.title,
              matchedText: sentence,
              originalText: citeSentence,
              similarity: similarity * 100,
              startPosition: text.indexOf(sentence),
              endPosition: text.indexOf(sentence) + sentence.length
            });
          }
        }
      }
    }

    // Calculate overall similarity
    const overallSimilarity = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length
      : 0;

    return {
      similarity: overallSimilarity,
      matches,
      checkedAgainst,
      checkTimestamp: new Date()
    };
  }

  /**
   * Calculate n-gram based similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const ngrams1 = this.getNgrams(text1.toLowerCase(), 3);
    const ngrams2 = this.getNgrams(text2.toLowerCase(), 3);

    const set1 = new Set(ngrams1);
    const set2 = new Set(ngrams2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  private getNgrams(text: string, n: number): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const ngrams: string[] = [];

    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }

    return ngrams;
  }

  private tokenizeSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Filter out very short sentences
  }
}

export const plagiarismCheckService = new PlagiarismCheckService();
```

**File**: `packages/manuscript-engine/src/utils/citation-export.ts` (Task 30)

```typescript
import type { Citation, CitationStyle } from '../types/citation.types';

export type ExportFormat = 'bibtex' | 'ris' | 'endnote' | 'csv';

export function exportCitations(
  citations: Citation[],
  format: ExportFormat
): string {
  switch (format) {
    case 'bibtex':
      return exportToBibtex(citations);
    case 'ris':
      return exportToRis(citations);
    case 'endnote':
      return exportToEndNote(citations);
    case 'csv':
      return exportToCsv(citations);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function exportToBibtex(citations: Citation[]): string {
  return citations.map(c => {
    const key = generateBibtexKey(c);
    const authors = c.authors
      .map(a => `${a.lastName}, ${a.firstName || ''}`.trim())
      .join(' and ');

    const fields = [
      `  author = {${authors}}`,
      `  title = {${c.title}}`,
      `  year = {${c.year}}`
    ];

    if (c.journal) fields.push(`  journal = {${c.journal}}`);
    if (c.volume) fields.push(`  volume = {${c.volume}}`);
    if (c.issue) fields.push(`  number = {${c.issue}}`);
    if (c.pages) fields.push(`  pages = {${c.pages}}`);
    if (c.doi) fields.push(`  doi = {${c.doi}}`);
    if (c.pmid) fields.push(`  pmid = {${c.pmid}}`);

    return `@article{${key},\n${fields.join(',\n')}\n}`;
  }).join('\n\n');
}

function exportToRis(citations: Citation[]): string {
  return citations.map(c => {
    const lines = [
      'TY  - JOUR',
      ...c.authors.map(a => `AU  - ${a.lastName}, ${a.firstName || ''}`),
      `TI  - ${c.title}`,
      `PY  - ${c.year}`
    ];

    if (c.journal) lines.push(`JO  - ${c.journal}`);
    if (c.volume) lines.push(`VL  - ${c.volume}`);
    if (c.issue) lines.push(`IS  - ${c.issue}`);
    if (c.pages) {
      const [sp, ep] = c.pages.split('-');
      if (sp) lines.push(`SP  - ${sp}`);
      if (ep) lines.push(`EP  - ${ep}`);
    }
    if (c.doi) lines.push(`DO  - ${c.doi}`);
    if (c.abstract) lines.push(`AB  - ${c.abstract}`);
    
    lines.push('ER  -');

    return lines.join('\n');
  }).join('\n\n');
}

function exportToEndNote(citations: Citation[]): string {
  // EndNote XML format
  return `<?xml version="1.0" encoding="UTF-8"?>
<xml><records>
${citations.map(c => `<record>
  <ref-type name="Journal Article">17</ref-type>
  <contributors><authors>
    ${c.authors.map(a => `<author>${a.lastName}, ${a.firstName || ''}</author>`).join('\n    ')}
  </authors></contributors>
  <titles><title>${escapeXml(c.title)}</title></titles>
  <dates><year>${c.year}</year></dates>
  ${c.journal ? `<periodical><full-title>${escapeXml(c.journal)}</full-title></periodical>` : ''}
  ${c.volume ? `<volume>${c.volume}</volume>` : ''}
  ${c.pages ? `<pages>${c.pages}</pages>` : ''}
  ${c.doi ? `<electronic-resource-num>${c.doi}</electronic-resource-num>` : ''}
</record>`).join('\n')}
</records></xml>`;
}

function exportToCsv(citations: Citation[]): string {
  const headers = ['Authors', 'Year', 'Title', 'Journal', 'Volume', 'Issue', 'Pages', 'DOI', 'PMID'];
  const rows = citations.map(c => [
    c.authors.map(a => `${a.lastName} ${a.firstName || ''}`).join('; '),
    c.year,
    `"${c.title.replace(/"/g, '""')}"`,
    c.journal || '',
    c.volume || '',
    c.issue || '',
    c.pages || '',
    c.doi || '',
    c.pmid || ''
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function generateBibtexKey(citation: Citation): string {
  const author = citation.authors[0]?.lastName || 'unknown';
  const year = citation.year;
  const titleWord = citation.title.split(' ')[0]?.toLowerCase() || 'untitled';
  
  return `${author.toLowerCase()}${year}${titleWord}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

---

## Remaining Tasks Summary (31-40)

| Task | File | Description |
|------|------|-------------|
| 31 | `services/lit-watcher.service.ts` | Background job for new relevant papers |
| 32 | `services/keyword-extractor.service.ts` | Extract keywords, generate MeSH terms |
| 33 | `services/lit-summary-embed.service.ts` | Embed condensed paper summaries |
| 34 | `services/conflict-detector.service.ts` | Detect conflicts with literature |
| 35 | `services/zotero.service.ts` | Zotero library integration |
| 36 | `services/paraphrase.service.ts` | AI-assisted paraphrasing |
| 37 | `types/lit-search-history.types.ts` | Search history types |
| 38 | `services/citation-formatter.service.ts` | Format to AMA, APA, Vancouver, etc. |
| 39 | `services/relevance-scorer.service.ts` | Score papers by relevance |
| 40 | `__tests__/integration/literature.test.ts` | Integration tests |

---

## Verification Checklist - Phase 2

- [ ] PubMed service fetches and parses articles
- [ ] Semantic Scholar integration returns papers with TLDR
- [ ] Literature review generator produces structured output
- [ ] Citation manager handles DOI/PMID resolution
- [ ] Gap analysis prompt generates actionable insights
- [ ] arXiv service parses Atom feed correctly
- [ ] Literature matrix supports systematic review columns
- [ ] Plagiarism check identifies similar text
- [ ] Export formats (BibTeX, RIS, EndNote) valid
- [ ] All services integrate with citation types

## Next Phase

Proceed to **PHASE_3_STRUCTURE_BUILDING.md** for Tasks 41-60.
