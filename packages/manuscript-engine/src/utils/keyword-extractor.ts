/**
 * Keyword Extraction Utility
 * Task T32: Extract keywords from text using TF-IDF and Named Entity Recognition
 */

/**
 * Extracted keyword with relevance score
 */
export interface ExtractedKeyword {
  term: string;
  score: number; // 0-1 relevance score
  frequency: number; // Number of occurrences
  type: 'single' | 'bigram' | 'trigram' | 'entity';
  category?: 'medical' | 'statistical' | 'methodological' | 'general';
}

/**
 * Keyword extraction configuration
 */
export interface KeywordExtractionConfig {
  maxKeywords?: number; // Max number of keywords to return (default: 10)
  minScore?: number; // Min relevance score (default: 0.1)
  includeNgrams?: boolean; // Include 2-3 word phrases (default: true)
  includeMedicalTerms?: boolean; // Prioritize medical terminology (default: true)
  stopWords?: string[]; // Additional stop words to exclude
}

/**
 * Medical/research-specific stop words
 */
const MEDICAL_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
  'that', 'these', 'those', 'which', 'who', 'what', 'where', 'when',
  'study', 'studies', 'research', 'paper', 'article', 'results', 'methods',
]);

/**
 * Medical terminology indicators (prefixes/suffixes)
 */
const MEDICAL_INDICATORS = {
  prefixes: ['anti', 'pre', 'post', 'hyper', 'hypo', 'intra', 'inter', 'sub', 'trans', 'neo'],
  suffixes: ['itis', 'oma', 'osis', 'emia', 'pathy', 'plasty', 'ectomy', 'otomy', 'scopy'],
};

/**
 * Statistical/methodological terms (prioritize in research context)
 */
const STATISTICAL_TERMS = new Set([
  'regression', 'correlation', 'analysis', 'significance', 'confidence',
  'interval', 'odds ratio', 'hazard ratio', 'p-value', 'mean', 'median',
  'variance', 'standard deviation', 'meta-analysis', 'randomized',
  'controlled', 'trial', 'rct', 'cohort', 'case-control', 'prospective',
  'retrospective', 'blinding', 'placebo', 'intervention', 'outcome',
]);

/**
 * Extract keywords from text using TF-IDF-like scoring
 */
export function extractKeywords(
  text: string,
  config: KeywordExtractionConfig = {}
): ExtractedKeyword[] {
  const {
    maxKeywords = 10,
    minScore = 0.1,
    includeNgrams = true,
    includeMedicalTerms = true,
    stopWords = [],
  } = config;

  const allStopWords = new Set([...MEDICAL_STOP_WORDS, ...stopWords.map(w => w.toLowerCase())]);

  // Tokenize and normalize
  const words = tokenize(text);

  // Extract single words
  const singleKeywords = extractSingleWords(words, allStopWords, includeMedicalTerms);

  // Extract n-grams if enabled
  const ngrams: ExtractedKeyword[] = includeNgrams
    ? [...extractBigrams(words, allStopWords), ...extractTrigrams(words, allStopWords)]
    : [];

  // Combine and score
  const allKeywords = [...singleKeywords, ...ngrams];

  // Calculate TF-IDF-like scores
  const totalWords = words.length;
  for (const kw of allKeywords) {
    const tf = kw.frequency / totalWords;
    const categoryBoost = getCategoryBoost(kw.term, kw.category);
    kw.score = tf * categoryBoost;
  }

  // Sort by score and filter
  return allKeywords
    .filter(kw => kw.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKeywords);
}

/**
 * Extract keywords from multiple texts and find common themes
 */
export function extractCommonKeywords(
  texts: string[],
  config: KeywordExtractionConfig = {}
): ExtractedKeyword[] {
  const allKeywordSets = texts.map(text => extractKeywords(text, config));

  // Count occurrences across texts
  const termCounts = new Map<string, { count: number; totalScore: number; type: ExtractedKeyword['type'] }>();

  for (const keywordSet of allKeywordSets) {
    for (const kw of keywordSet) {
      const existing = termCounts.get(kw.term);
      if (existing) {
        existing.count++;
        existing.totalScore += kw.score;
      } else {
        termCounts.set(kw.term, { count: 1, totalScore: kw.score, type: kw.type });
      }
    }
  }

  // Convert to ExtractedKeyword array
  const commonKeywords: ExtractedKeyword[] = [];
  for (const [term, data] of termCounts) {
    if (data.count >= Math.ceil(texts.length * 0.3)) { // Appears in 30%+ of texts
      commonKeywords.push({
        term,
        score: data.totalScore / data.count,
        frequency: data.count,
        type: data.type,
        category: categorizeKeyword(term),
      });
    }
  }

  return commonKeywords.sort((a, b) => b.score - a.score).slice(0, config.maxKeywords || 10);
}

/**
 * Suggest MeSH (Medical Subject Headings) terms from text
 */
export function suggestMeSHTerms(text: string): string[] {
  // In production, this would use NLM's MeSH API
  // For now, extract medical-looking terms
  const keywords = extractKeywords(text, { includeMedicalTerms: true, maxKeywords: 20 });

  return keywords
    .filter(kw => kw.category === 'medical' || isMedicalTerm(kw.term))
    .map(kw => kw.term)
    .slice(0, 10);
}

// ========== Helper Functions ==========

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Keep hyphens for compound terms
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function extractSingleWords(
  words: string[],
  stopWords: Set<string>,
  prioritizeMedical: boolean
): ExtractedKeyword[] {
  const counts = new Map<string, number>();

  for (const word of words) {
    if (!stopWords.has(word)) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  const keywords: ExtractedKeyword[] = [];
  for (const [term, freq] of counts) {
    const category = categorizeKeyword(term);
    keywords.push({
      term,
      score: 0, // Will be calculated later
      frequency: freq,
      type: 'single',
      category,
    });
  }

  return keywords;
}

function extractBigrams(words: string[], stopWords: Set<string>): ExtractedKeyword[] {
  const bigrams = new Map<string, number>();

  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];

    // Skip if either word is a stop word
    if (stopWords.has(w1) || stopWords.has(w2)) continue;

    const bigram = `${w1} ${w2}`;
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }

  const keywords: ExtractedKeyword[] = [];
  for (const [term, freq] of bigrams) {
    if (freq >= 2) { // Must appear at least twice
      keywords.push({
        term,
        score: 0,
        frequency: freq,
        type: 'bigram',
        category: categorizeKeyword(term),
      });
    }
  }

  return keywords;
}

function extractTrigrams(words: string[], stopWords: Set<string>): ExtractedKeyword[] {
  const trigrams = new Map<string, number>();

  for (let i = 0; i < words.length - 2; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];
    const w3 = words[i + 2];

    // Allow middle word to be stop word (e.g., "quality of life")
    if (stopWords.has(w1) || stopWords.has(w3)) continue;

    const trigram = `${w1} ${w2} ${w3}`;
    trigrams.set(trigram, (trigrams.get(trigram) || 0) + 1);
  }

  const keywords: ExtractedKeyword[] = [];
  for (const [term, freq] of trigrams) {
    if (freq >= 2) {
      keywords.push({
        term,
        score: 0,
        frequency: freq,
        type: 'trigram',
        category: categorizeKeyword(term),
      });
    }
  }

  return keywords;
}

function categorizeKeyword(term: string): ExtractedKeyword['category'] {
  if (isMedicalTerm(term)) return 'medical';
  if (isStatisticalTerm(term)) return 'statistical';
  if (isMethodologicalTerm(term)) return 'methodological';
  return 'general';
}

function isMedicalTerm(term: string): boolean {
  // Check for medical prefixes/suffixes
  for (const prefix of MEDICAL_INDICATORS.prefixes) {
    if (term.startsWith(prefix)) return true;
  }
  for (const suffix of MEDICAL_INDICATORS.suffixes) {
    if (term.endsWith(suffix)) return true;
  }

  // Check for common medical patterns
  return /cancer|therapy|treatment|disease|syndrome|disorder|diagnosis|patient/.test(term);
}

function isStatisticalTerm(term: string): boolean {
  return STATISTICAL_TERMS.has(term) || /statistic|analysis|regression|correlation/.test(term);
}

function isMethodologicalTerm(term: string): boolean {
  return /method|approach|technique|protocol|procedure|design/.test(term);
}

function getCategoryBoost(term: string, category?: ExtractedKeyword['category']): number {
  switch (category) {
    case 'medical':
      return 2.0; // Prioritize medical terms
    case 'statistical':
      return 1.5;
    case 'methodological':
      return 1.3;
    default:
      return 1.0;
  }
}
