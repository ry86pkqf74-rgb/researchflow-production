/**
 * Plagiarism Detection Service
 * Task T29: N-gram similarity checking and originality scoring
 */

import { createHash } from 'crypto';

export interface PlagiarismCheckRequest {
  manuscriptId: string;
  textToCheck: string;
  sectionType: 'abstract' | 'introduction' | 'methods' | 'results' | 'discussion';
  checkAgainst: 'existing_citations' | 'pubmed_corpus' | 'manuscript_database' | 'all';
}

export interface PlagiarismMatch {
  sourceId: string; // PMID, DOI, or internal manuscript ID
  sourceTitle: string;
  matchedText: string; // The overlapping text
  matchedTextLocation: { start: number; end: number };
  similarityScore: number; // 0-1 (1 = identical)
  ngramSize: number; // Size of n-gram that matched (e.g., 5-gram)
  matchType: 'exact' | 'near_exact' | 'paraphrase';
  isCited: boolean; // Whether this source is already in bibliography
}

export interface PlagiarismCheckResult {
  manuscriptId: string;
  overallSimilarity: number; // 0-1
  passesThreshold: boolean; // true if < 0.30 similarity
  matches: PlagiarismMatch[];
  warnings: string[];
  recommendations: string[];
  checkedAt: Date;
}

/**
 * Plagiarism detection using n-gram fingerprinting and Jaccard similarity
 *
 * Thresholds (industry standard):
 * - <0.15: Low similarity (acceptable)
 * - 0.15-0.30: Moderate similarity (review required)
 * - 0.30-0.50: High similarity (likely plagiarism)
 * - >0.50: Very high similarity (definite plagiarism)
 */
export class PlagiarismCheckService {
  private readonly ACCEPTABLE_THRESHOLD = 0.30; // 30% similarity max
  private readonly NGRAM_SIZE = 5; // 5-word shingles
  private readonly MIN_MATCH_LENGTH = 20; // Min 20 chars to flag as match

  /**
   * Check text for plagiarism against known sources
   */
  async checkForPlagiarism(request: PlagiarismCheckRequest): Promise<PlagiarismCheckResult> {
    const norms = this.normalizeText(request.textToCheck);
    const ngrams = this.generateNgrams(norms, this.NGRAM_SIZE);
    const fingerprint = this.createFingerprint(ngrams);

    // In production, this would query actual databases
    const candidateSources = await this.fetchCandidateSources(request.checkAgainst, request.manuscriptId);

    const matches: PlagiarismMatch[] = [];
    for (const source of candidateSources) {
      const sourceNgrams = this.generateNgrams(this.normalizeText(source.text), this.NGRAM_SIZE);
      const sourceFingerprint = this.createFingerprint(sourceNgrams);

      const similarity = this.calculateJaccardSimilarity(fingerprint, sourceFingerprint);

      if (similarity > 0.15) { // Flag if >15% similar
        const matchedSegments = this.findMatchingSegments(request.textToCheck, source.text);

        for (const segment of matchedSegments) {
          if (segment.text.length >= this.MIN_MATCH_LENGTH) {
            matches.push({
              sourceId: source.id,
              sourceTitle: source.title,
              matchedText: segment.text,
              matchedTextLocation: segment.location,
              similarityScore: similarity,
              ngramSize: this.NGRAM_SIZE,
              matchType: similarity > 0.90 ? 'exact' : similarity > 0.70 ? 'near_exact' : 'paraphrase',
              isCited: source.isCited,
            });
          }
        }
      }
    }

    const overallSimilarity = this.calculateOverallSimilarity(matches);
    const passesThreshold = overallSimilarity < this.ACCEPTABLE_THRESHOLD;

    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (!passesThreshold) {
      warnings.push(`Overall similarity (${(overallSimilarity * 100).toFixed(1)}%) exceeds acceptable threshold (${this.ACCEPTABLE_THRESHOLD * 100}%)`);
    }

    // Check for uncited matches
    const uncitedMatches = matches.filter(m => !m.isCited && m.similarityScore > 0.30);
    if (uncitedMatches.length > 0) {
      warnings.push(`Found ${uncitedMatches.length} high-similarity matches that are not cited in your bibliography`);
      recommendations.push('Add citations for sources with high textual overlap');
    }

    // Check for self-plagiarism
    const selfPlagiarismMatches = matches.filter(m => m.sourceId.startsWith('manuscript-'));
    if (selfPlagiarismMatches.length > 0) {
      warnings.push('Text overlaps with other manuscripts in the database (potential self-plagiarism)');
      recommendations.push('Ensure proper self-citation if reusing your own previously published text');
    }

    return {
      manuscriptId: request.manuscriptId,
      overallSimilarity,
      passesThreshold,
      matches: matches.sort((a, b) => b.similarityScore - a.similarityScore), // Sort by severity
      warnings,
      recommendations,
      checkedAt: new Date(),
    };
  }

  /**
   * Generate n-grams (shingles) from text
   */
  private generateNgrams(text: string, n: number): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const ngrams: string[] = [];

    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      ngrams.push(ngram);
    }

    return ngrams;
  }

  /**
   * Create fingerprint (hash set) from n-grams for efficient comparison
   */
  private createFingerprint(ngrams: string[]): Set<string> {
    const fingerprint = new Set<string>();

    for (const ngram of ngrams) {
      const hash = createHash('md5').update(ngram).digest('hex');
      fingerprint.add(hash);
    }

    return fingerprint;
  }

  /**
   * Calculate Jaccard similarity between two fingerprints
   * Jaccard = |A ∩ B| / |A ∪ B|
   */
  private calculateJaccardSimilarity(fp1: Set<string>, fp2: Set<string>): number {
    const intersection = new Set([...fp1].filter(x => fp2.has(x)));
    const union = new Set([...fp1, ...fp2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Normalize text for comparison (lowercase, remove punctuation, etc.)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Find matching segments between two texts (for highlighting)
   */
  private findMatchingSegments(
    text1: string,
    text2: string
  ): Array<{ text: string; location: { start: number; end: number } }> {
    const segments: Array<{ text: string; location: { start: number; end: number } }> = [];

    // Use sliding window to find matching substrings
    const minLength = this.MIN_MATCH_LENGTH;
    const words1 = text1.split(/\s+/);

    for (let i = 0; i < words1.length; i++) {
      for (let len = Math.min(20, words1.length - i); len >= 3; len--) { // Try 3-20 word windows
        const segment = words1.slice(i, i + len).join(' ');

        if (segment.length >= minLength && text2.includes(segment)) {
          const start = text1.indexOf(segment);
          segments.push({
            text: segment,
            location: { start, end: start + segment.length },
          });
          i += len - 1; // Skip ahead
          break;
        }
      }
    }

    return segments;
  }

  /**
   * Calculate overall similarity from multiple matches
   */
  private calculateOverallSimilarity(matches: PlagiarismMatch[]): number {
    if (matches.length === 0) return 0;

    // Weight by match type
    const weights = {
      exact: 1.0,
      near_exact: 0.8,
      paraphrase: 0.5,
    };

    const weightedSum = matches.reduce((sum, match) => {
      return sum + (match.similarityScore * weights[match.matchType]);
    }, 0);

    return Math.min(1.0, weightedSum / matches.length);
  }

  /**
   * Fetch candidate sources to check against
   * (In production, this would query PubMed, internal manuscript DB, etc.)
   */
  private async fetchCandidateSources(
    scope: PlagiarismCheckRequest['checkAgainst'],
    manuscriptId: string
  ): Promise<Array<{ id: string; title: string; text: string; isCited: boolean }>> {
    // Mock implementation - in production, query actual databases
    // For 'existing_citations': fetch full text of all cited papers
    // For 'pubmed_corpus': query PubMed for similar abstracts
    // For 'manuscript_database': check internal manuscripts
    // For 'all': combine all sources

    return [];
  }

  /**
   * Quick check: Does text contain sufficient original content?
   */
  async quickOriginalityCheck(text: string): Promise<{ isOriginal: boolean; score: number }> {
    const wordCount = text.split(/\s+/).length;

    // Very basic heuristic checks
    const hasVariedVocabulary = new Set(text.toLowerCase().split(/\s+/)).size / wordCount > 0.4;
    const hasComplexSentences = text.split(/[.!?]/).some(s => s.split(/\s+/).length > 15);
    const hasTransitionalPhrases = /however|moreover|furthermore|nevertheless|therefore/i.test(text);

    const score = [hasVariedVocabulary, hasComplexSentences, hasTransitionalPhrases]
      .filter(Boolean).length / 3;

    return {
      isOriginal: score > 0.5,
      score,
    };
  }
}

export const plagiarismCheckService = new PlagiarismCheckService();
