/**
 * Gap Analysis Service (Orchestrator)
 * Phase 2.1: Identifies missing literature and research gaps
 * 
 * Integrates with:
 * - Literature services (PubMed, Semantic Scholar, ArXiv)
 * - Worker gap_analysis.py for temporal analysis
 * - Manuscript sections for context extraction
 */

import { getLiteratureCache } from '../infra/cache';
import { rateLimitedFetch, fetchWithFallback } from '../infra/rateLimiter';
import { logAction } from '../services/audit-service';

export interface LiteratureGap {
  topic: string;
  gapType: 'missing_citation' | 'outdated_citation' | 'methodology_gap' | 'data_gap';
  severity: 'low' | 'medium' | 'high';
  suggestedQueries: string[];
  relatedCitations: string[];
  confidence: number;
}

export interface GapAnalysisResult {
  manuscriptId: string;
  analysisId: string;
  analyzedAt: string;
  totalGaps: number;
  gaps: LiteratureGap[];
  coverage: {
    introduction: number;
    methods: number;
    results: number;
    discussion: number;
  };
  recommendations: string[];
  suggestedCitations: CitationSuggestion[];
}

export interface CitationSuggestion {
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  pmid?: string;
  relevanceScore: number;
  suggestedSection: string;
  reason: string;
}

export interface ManuscriptContext {
  title?: string;
  abstract?: string;
  keywords?: string[];
  existingCitations?: Array<{ title: string; doi?: string; pmid?: string }>;
  sections?: Record<string, string>;
}

/**
 * Gap Analysis Service
 */
export class GapAnalysisService {
  private static instance: GapAnalysisService;
  private cache = getLiteratureCache();
  
  private constructor() {}
  
  static getInstance(): GapAnalysisService {
    if (!this.instance) {
      this.instance = new GapAnalysisService();
    }
    return this.instance;
  }
  
  /**
   * Perform comprehensive gap analysis
   */
  async analyzeGaps(
    manuscriptId: string,
    context: ManuscriptContext,
    options: {
      maxSuggestions?: number;
      yearsBack?: number;
      includePreprints?: boolean;
    } = {}
  ): Promise<GapAnalysisResult> {
    const analysisId = `gap-${manuscriptId}-${Date.now()}`;
    const maxSuggestions = options.maxSuggestions || 20;
    const yearsBack = options.yearsBack || 5;
    
    console.log(`[GapAnalysis] Starting analysis ${analysisId}`);
    
    // Extract key themes from context
    const themes = await this.extractThemes(context);
    
    // Search for existing literature on each theme
    const themeResults = await Promise.all(
      themes.map(theme => this.searchTheme(theme, yearsBack))
    );
    
    // Identify gaps
    const gaps = this.identifyGaps(themes, themeResults, context.existingCitations || []);
    
    // Generate citation suggestions
    const suggestions = await this.generateSuggestions(
      gaps, 
      themeResults.flat(), 
      maxSuggestions
    );
    
    // Calculate section coverage
    const coverage = this.calculateCoverage(context, themeResults.flat());
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, coverage);
    
    const result: GapAnalysisResult = {
      manuscriptId,
      analysisId,
      analyzedAt: new Date().toISOString(),
      totalGaps: gaps.length,
      gaps,
      coverage,
      recommendations,
      suggestedCitations: suggestions
    };
    
    // Log analysis completion
    await logAction({
      eventType: 'GAP_ANALYSIS_COMPLETE',
      action: 'ANALYZE',
      resourceType: 'MANUSCRIPT',
      resourceId: manuscriptId,
      details: {
        analysisId,
        totalGaps: gaps.length,
        suggestionsCount: suggestions.length
      },
      severity: 'INFO'
    });
    
    return result;
  }
  
  /**
   * Extract key themes from manuscript context
   */
  private async extractThemes(context: ManuscriptContext): Promise<string[]> {
    const themes: Set<string> = new Set();
    
    // Add keywords directly
    if (context.keywords) {
      context.keywords.forEach(k => themes.add(k.toLowerCase()));
    }
    
    // Extract from title
    if (context.title) {
      const titleWords = this.extractKeyPhrases(context.title);
      titleWords.forEach(w => themes.add(w));
    }
    
    // Extract from abstract (PICO elements)
    if (context.abstract) {
      const picoElements = this.extractPICO(context.abstract);
      Object.values(picoElements).flat().forEach(p => themes.add(p));
    }
    
    return Array.from(themes).slice(0, 10); // Limit to 10 themes
  }
  
  /**
   * Extract key phrases from text
   */
  private extractKeyPhrases(text: string): string[] {
    // Remove common words and extract noun phrases
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
      'those', 'it', 'its', 'our', 'we', 'their', 'them', 'study', 'analysis'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    
    // Return unique phrases (bigrams and single words)
    const phrases: string[] = [];
    for (let i = 0; i < words.length; i++) {
      phrases.push(words[i]);
      if (i < words.length - 1) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
    }
    
    return [...new Set(phrases)].slice(0, 15);
  }
  
  /**
   * Extract PICO elements from abstract
   */
  private extractPICO(abstract: string): {
    population: string[];
    intervention: string[];
    comparison: string[];
    outcome: string[];
  } {
    // Simple pattern-based extraction
    const lower = abstract.toLowerCase();
    
    const population: string[] = [];
    const intervention: string[] = [];
    const outcome: string[] = [];
    
    // Population patterns
    const popPatterns = [
      /patients with ([^.]+)/gi,
      /(\d+)\s*(patients|subjects|participants)/gi,
      /(adults|children|elderly|women|men) with/gi
    ];
    
    for (const pattern of popPatterns) {
      const matches = lower.match(pattern);
      if (matches) population.push(...matches.slice(0, 2));
    }
    
    // Intervention patterns
    const intPatterns = [
      /treated with ([^.]+)/gi,
      /received ([^.]+) (therapy|treatment)/gi,
      /underwent ([^.]+)/gi
    ];
    
    for (const pattern of intPatterns) {
      const matches = lower.match(pattern);
      if (matches) intervention.push(...matches.slice(0, 2));
    }
    
    // Outcome patterns
    const outPatterns = [
      /(mortality|survival|complication|outcome|readmission)/gi,
      /length of stay/gi,
      /(improvement|reduction|increase) in/gi
    ];
    
    for (const pattern of outPatterns) {
      const matches = lower.match(pattern);
      if (matches) outcome.push(...matches.slice(0, 3));
    }
    
    return {
      population,
      intervention,
      comparison: [], // Often implicit
      outcome
    };
  }
  
  /**
   * Search for literature on a theme
   */
  private async searchTheme(
    theme: string,
    yearsBack: number
  ): Promise<CitationSuggestion[]> {
    const cacheKey = this.cache.generateKey('gapanalysis', theme, { yearsBack });
    
    // Check cache
    const cached = await this.cache.get<CitationSuggestion[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Search with fallback chain
    const results = await fetchWithFallback([
      {
        provider: 'pubmed',
        fetchFn: () => this.searchPubMed(theme, yearsBack)
      },
      {
        provider: 'semanticscholar',
        fetchFn: () => this.searchSemanticScholar(theme, yearsBack)
      }
    ], { timeout: 15000 });
    
    const citations = results?.result || [];
    
    // Cache results
    await this.cache.set(cacheKey, citations, 3600000); // 1 hour
    
    return citations;
  }
  
  /**
   * Search PubMed for citations
   */
  private async searchPubMed(theme: string, yearsBack: number): Promise<CitationSuggestion[]> {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - yearsBack;
    
    // This would integrate with the actual PubMed service
    // For now, return structure for integration
    const baseUrl = process.env.WORKER_URL || 'http://worker:8000';
    
    try {
      const response = await fetch(`${baseUrl}/api/literature/pubmed/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: theme,
          minYear,
          maxResults: 10
        })
      });
      
      if (!response.ok) {
        throw new Error(`PubMed search failed: ${response.status}`);
      }
      
      const data = await response.json();
      return this.mapToCitationSuggestions(data.results || [], 'pubmed');
    } catch (error) {
      console.warn(`[GapAnalysis] PubMed search failed for "${theme}":`, error);
      return [];
    }
  }
  
  /**
   * Search Semantic Scholar for citations
   */
  private async searchSemanticScholar(theme: string, yearsBack: number): Promise<CitationSuggestion[]> {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - yearsBack;
    
    const baseUrl = process.env.WORKER_URL || 'http://worker:8000';
    
    try {
      const response = await fetch(`${baseUrl}/api/literature/semantic-scholar/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: theme,
          year: `${minYear}-`,
          limit: 10
        })
      });
      
      if (!response.ok) {
        throw new Error(`Semantic Scholar search failed: ${response.status}`);
      }
      
      const data = await response.json();
      return this.mapToCitationSuggestions(data.results || [], 'semanticscholar');
    } catch (error) {
      console.warn(`[GapAnalysis] Semantic Scholar search failed for "${theme}":`, error);
      return [];
    }
  }
  
  /**
   * Map external results to CitationSuggestion format
   */
  private mapToCitationSuggestions(
    results: any[],
    source: string
  ): CitationSuggestion[] {
    return results.map(r => ({
      title: r.title || 'Unknown Title',
      authors: r.authors || [],
      year: r.year || r.publicationDate?.split('-')[0] || 0,
      doi: r.doi,
      pmid: r.pmid,
      relevanceScore: r.score || 0.5,
      suggestedSection: 'discussion', // Default, refined later
      reason: `Found via ${source} search`
    }));
  }
  
  /**
   * Identify literature gaps
   */
  private identifyGaps(
    themes: string[],
    themeResults: CitationSuggestion[][],
    existingCitations: Array<{ title: string; doi?: string; pmid?: string }>
  ): LiteratureGap[] {
    const gaps: LiteratureGap[] = [];
    const existingTitles = new Set(
      existingCitations.map(c => c.title.toLowerCase())
    );
    const existingDois = new Set(
      existingCitations.filter(c => c.doi).map(c => c.doi!.toLowerCase())
    );
    
    themes.forEach((theme, idx) => {
      const results = themeResults[idx] || [];
      
      // Check for missing key papers
      const keyPapers = results.filter(r => r.relevanceScore > 0.7);
      const missingKeyPapers = keyPapers.filter(p => 
        !existingTitles.has(p.title.toLowerCase()) &&
        !(p.doi && existingDois.has(p.doi.toLowerCase()))
      );
      
      if (missingKeyPapers.length > 0) {
        gaps.push({
          topic: theme,
          gapType: 'missing_citation',
          severity: missingKeyPapers.length > 3 ? 'high' : 'medium',
          suggestedQueries: [`${theme} review`, `${theme} meta-analysis`],
          relatedCitations: missingKeyPapers.slice(0, 5).map(p => p.title),
          confidence: 0.8
        });
      }
      
      // Check for outdated citations (>5 years old only)
      const recentPapers = results.filter(r => {
        const year = new Date().getFullYear();
        return r.year >= year - 3; // Last 3 years
      });
      
      if (recentPapers.length > 0 && results.length > 0) {
        const recentCoverage = recentPapers.length / results.length;
        if (recentCoverage > 0.5) {
          // Topic is actively researched but we might have old citations
          const hasRecent = existingCitations.some(c => {
            // Would need year from citations - simplified check
            return true; // Placeholder
          });
          
          if (!hasRecent) {
            gaps.push({
              topic: theme,
              gapType: 'outdated_citation',
              severity: 'low',
              suggestedQueries: [`${theme} 2024`, `${theme} recent advances`],
              relatedCitations: recentPapers.slice(0, 3).map(p => p.title),
              confidence: 0.6
            });
          }
        }
      }
    });
    
    return gaps;
  }
  
  /**
   * Generate citation suggestions
   */
  private async generateSuggestions(
    gaps: LiteratureGap[],
    allResults: CitationSuggestion[],
    maxSuggestions: number
  ): Promise<CitationSuggestion[]> {
    // Deduplicate and rank
    const seen = new Set<string>();
    const suggestions: CitationSuggestion[] = [];
    
    for (const result of allResults) {
      const key = result.doi || result.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Boost score for citations related to gaps
      const relatedGap = gaps.find(g => 
        g.relatedCitations.includes(result.title)
      );
      
      if (relatedGap) {
        result.relevanceScore *= 1.5;
        result.reason = `Addresses gap: ${relatedGap.topic}`;
        result.suggestedSection = relatedGap.gapType === 'methodology_gap' ? 'methods' : 'discussion';
      }
      
      suggestions.push(result);
    }
    
    // Sort by relevance and return top N
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxSuggestions);
  }
  
  /**
   * Calculate section coverage scores
   */
  private calculateCoverage(
    context: ManuscriptContext,
    allResults: CitationSuggestion[]
  ): { introduction: number; methods: number; results: number; discussion: number } {
    // Simplified coverage calculation
    const existing = context.existingCitations?.length || 0;
    const suggested = allResults.length;
    
    const baseCoverage = Math.min(existing / 20, 1); // Assume 20 citations is good
    
    return {
      introduction: baseCoverage * 0.8,
      methods: baseCoverage * 0.7,
      results: baseCoverage * 0.9,
      discussion: baseCoverage * 0.6
    };
  }
  
  /**
   * Generate recommendations based on gaps
   */
  private generateRecommendations(
    gaps: LiteratureGap[],
    coverage: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];
    
    // Gap-based recommendations
    const highGaps = gaps.filter(g => g.severity === 'high');
    if (highGaps.length > 0) {
      recommendations.push(
        `Address ${highGaps.length} high-priority literature gap(s): ${highGaps.map(g => g.topic).join(', ')}`
      );
    }
    
    // Coverage-based recommendations
    for (const [section, score] of Object.entries(coverage)) {
      if (score < 0.5) {
        recommendations.push(
          `Strengthen ${section} section citations (current coverage: ${Math.round(score * 100)}%)`
        );
      }
    }
    
    // General recommendations
    if (gaps.some(g => g.gapType === 'outdated_citation')) {
      recommendations.push('Consider updating older citations with recent literature (2022-2024)');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Literature coverage appears adequate. Consider reviewing for any recent publications.');
    }
    
    return recommendations;
  }
}

export const gapAnalysisService = GapAnalysisService.getInstance();
export default gapAnalysisService;
