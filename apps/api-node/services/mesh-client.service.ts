/**
 * MeSH Client Service - NLM E-utilities integration for MeSH lookups.
 * 
 * This service handles all communication with NCBI/NLM E-utilities for
 * MeSH (Medical Subject Headings) term lookups. It implements:
 * - Rate limiting (respects NCBI API key limits)
 * - Caching for frequently looked-up terms
 * - Batch lookups for efficiency
 * 
 * NLM E-utilities Reference:
 * https://www.ncbi.nlm.nih.gov/books/NBK25499/
 */

import { XMLParser } from 'fast-xml-parser';

// Configuration
const NCBI_API_KEY = process.env.NCBI_API_KEY;
const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const RATE_LIMIT_MS = NCBI_API_KEY ? 100 : 334; // 10/sec with key, 3/sec without

// Simple in-memory cache (consider Redis for production)
const meshCache = new Map<string, MeSHResult>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface MeSHResult {
  mesh_id: string;
  label: string;
  tree_numbers: string[];
  synonyms: string[];
  confidence: number;
  cached_at: number;
}

interface MeSHLookupResult {
  term: string;
  matches: MeSHResult[];
}

interface MeSHLookupResponse {
  results: MeSHLookupResult[];
  request_id: string;
}

/**
 * Simple rate limiter
 */
let lastRequestTime = 0;
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Build E-utilities URL with API key
 */
function buildUrl(endpoint: string, params: Record<string, string>): string {
  const url = new URL(`${EUTILS_BASE}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  if (NCBI_API_KEY) {
    url.searchParams.append('api_key', NCBI_API_KEY);
  }
  return url.toString();
}

/**
 * Search MeSH database for a term
 */
async function searchMeSH(term: string): Promise<string[]> {
  await rateLimit();
  
  const url = buildUrl('esearch.fcgi', {
    db: 'mesh',
    term: term,
    retmax: '5',
    retmode: 'json',
  });
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`MeSH search failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data.esearchresult?.idlist || [];
  } catch (error) {
    console.error('MeSH search error:', error);
    return [];
  }
}

/**
 * Fetch MeSH descriptor details by UID
 */
async function fetchMeSHDetails(uids: string[]): Promise<MeSHResult[]> {
  if (uids.length === 0) return [];
  
  await rateLimit();
  
  const url = buildUrl('efetch.fcgi', {
    db: 'mesh',
    id: uids.join(','),
    retmode: 'xml',
  });
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`MeSH fetch failed: ${response.status}`);
      return [];
    }
    
    const xmlText = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const data = parser.parse(xmlText);
    
    const results: MeSHResult[] = [];
    
    // Parse the XML structure
    const records = data.DescriptorRecordSet?.DescriptorRecord;
    if (!records) return [];
    
    const recordList = Array.isArray(records) ? records : [records];
    
    for (const record of recordList) {
      const meshId = record.DescriptorUI || '';
      const label = record.DescriptorName?.String || '';
      
      // Extract tree numbers
      const treeNumbers: string[] = [];
      const treeList = record.TreeNumberList?.TreeNumber;
      if (treeList) {
        const trees = Array.isArray(treeList) ? treeList : [treeList];
        treeNumbers.push(...trees);
      }
      
      // Extract synonyms from concepts
      const synonyms: string[] = [];
      const concepts = record.ConceptList?.Concept;
      if (concepts) {
        const conceptList = Array.isArray(concepts) ? concepts : [concepts];
        for (const concept of conceptList) {
          const terms = concept.TermList?.Term;
          if (terms) {
            const termList = Array.isArray(terms) ? terms : [terms];
            for (const term of termList) {
              const termString = term.String;
              if (termString && termString !== label) {
                synonyms.push(termString);
              }
            }
          }
        }
      }
      
      results.push({
        mesh_id: meshId,
        label,
        tree_numbers: treeNumbers,
        synonyms: synonyms.slice(0, 10), // Limit synonyms
        confidence: 0.8, // Default confidence for exact MeSH match
        cached_at: Date.now(),
      });
    }
    
    return results;
  } catch (error) {
    console.error('MeSH fetch error:', error);
    return [];
  }
}

/**
 * Get cached result or null if expired/missing
 */
function getCached(term: string): MeSHResult | null {
  const cached = meshCache.get(term.toLowerCase());
  if (!cached) return null;
  
  if (Date.now() - cached.cached_at > CACHE_TTL_MS) {
    meshCache.delete(term.toLowerCase());
    return null;
  }
  
  return cached;
}

/**
 * Cache a result
 */
function setCache(term: string, result: MeSHResult): void {
  meshCache.set(term.toLowerCase(), result);
}

/**
 * Look up a single term in MeSH
 */
export async function lookupTerm(term: string): Promise<MeSHResult[]> {
  // Check cache first
  const cached = getCached(term);
  if (cached) {
    return [cached];
  }
  
  // Search MeSH
  const uids = await searchMeSH(term);
  if (uids.length === 0) {
    return [];
  }
  
  // Fetch details
  const results = await fetchMeSHDetails(uids);
  
  // Cache the best result
  if (results.length > 0) {
    setCache(term, results[0]);
  }
  
  return results;
}

/**
 * Look up multiple terms in MeSH (batch)
 */
export async function lookupTermsBatch(
  terms: string[],
  includeSynonyms: boolean = false,
  maxResultsPerTerm: number = 3
): Promise<MeSHLookupResponse> {
  const results: MeSHLookupResult[] = [];
  
  for (const term of terms) {
    const matches = await lookupTerm(term);
    
    // Filter out synonyms if not requested
    const processedMatches = matches.slice(0, maxResultsPerTerm).map(m => ({
      ...m,
      synonyms: includeSynonyms ? m.synonyms : [],
    }));
    
    results.push({
      term,
      matches: processedMatches,
    });
  }
  
  return {
    results,
    request_id: `mesh_${Date.now()}`,
  };
}

/**
 * Clear the MeSH cache
 */
export function clearCache(): void {
  meshCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;
  for (const entry of meshCache.values()) {
    if (oldest === null || entry.cached_at < oldest) {
      oldest = entry.cached_at;
    }
  }
  
  return {
    size: meshCache.size,
    oldestEntry: oldest,
  };
}

export default {
  lookupTerm,
  lookupTermsBatch,
  clearCache,
  getCacheStats,
};
