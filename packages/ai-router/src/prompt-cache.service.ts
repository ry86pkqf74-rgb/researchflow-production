/**
 * Prompt Cache Service
 *
 * Implements prompt caching with static prefix / dynamic suffix structure.
 * Optimizes cost by caching the static portions of prompts.
 */

import type { PromptCacheKey, PromptCacheEntry, ModelTier } from './types';
import { MODEL_CONFIGS } from './types';

/**
 * In-memory cache store (for development/testing)
 * In production, this would use Redis or similar
 */
const cacheStore = new Map<string, PromptCacheEntry>();

/**
 * Structured prompt with cacheable prefix and dynamic suffix
 */
export interface StructuredPrompt {
  staticPrefix: string;
  dynamicSuffix: string;
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  name: string;
  version: number;
  workflowStage?: number;
  systemPrompt: string;
  userTemplate: string;
  /** Markers for where dynamic content is inserted */
  dynamicMarkers: string[];
}

/**
 * Prompt Cache Service
 *
 * Manages prompt caching to reduce token costs by caching static prefixes.
 */
export class PromptCacheService {
  private templates = new Map<string, PromptTemplate>();
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled && process.env.PROMPT_CACHE_ENABLED !== 'false';
  }

  /**
   * Generate cache key from components
   */
  generateCacheKey(components: PromptCacheKey): string {
    const parts = [
      components.tenantId || 'default',
      components.stageId !== undefined ? `stage_${components.stageId}` : 'no_stage',
      components.policyVersion ? `policy_${components.policyVersion}` : 'no_policy',
      components.promptName,
    ];
    return parts.join(':');
  }

  /**
   * Split a prompt into static prefix and dynamic suffix
   *
   * The static prefix contains system instructions and templates.
   * The dynamic suffix contains user-specific content.
   */
  splitPrompt(
    systemPrompt: string,
    userPrompt: string,
    dynamicContent: Record<string, string>
  ): StructuredPrompt {
    // The system prompt is always static
    let staticPrefix = systemPrompt;

    // Find the static portion of the user prompt (before first dynamic marker)
    let dynamicSuffix = userPrompt;

    for (const [key, value] of Object.entries(dynamicContent)) {
      const marker = `{{${key}}}`;
      const index = dynamicSuffix.indexOf(marker);

      if (index > 0) {
        // Content before the first marker is static
        staticPrefix += '\n\n' + dynamicSuffix.substring(0, index);
        dynamicSuffix = dynamicSuffix.substring(index);
      }

      // Replace markers with actual values
      dynamicSuffix = dynamicSuffix.replace(marker, value);
    }

    return {
      staticPrefix: staticPrefix.trim(),
      dynamicSuffix: dynamicSuffix.trim(),
    };
  }

  /**
   * Record a cache hit
   */
  recordHit(cacheKey: string, tier: ModelTier, cachedTokens: number): void {
    if (!this.enabled) return;

    const entry = cacheStore.get(cacheKey);
    if (entry) {
      entry.hitCount++;
      entry.lastAccessedAt = new Date();

      // Calculate estimated savings (cached tokens at reduced rate)
      const config = MODEL_CONFIGS[tier];
      const savingsPerHit = (cachedTokens / 1_000_000) * config.costPerMToken.input * 0.9;
      entry.estimatedSavingsUsd += savingsPerHit;

      cacheStore.set(cacheKey, entry);
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(cacheKey: string, staticPrefix: string): void {
    if (!this.enabled) return;

    const existing = cacheStore.get(cacheKey);
    if (existing) {
      existing.missCount++;
      existing.lastAccessedAt = new Date();
      cacheStore.set(cacheKey, existing);
    } else {
      cacheStore.set(cacheKey, {
        key: cacheKey,
        staticPrefix,
        hitCount: 0,
        missCount: 1,
        estimatedSavingsUsd: 0,
        lastAccessedAt: new Date(),
      });
    }
  }

  /**
   * Get cache statistics for a key
   */
  getStats(cacheKey: string): PromptCacheEntry | undefined {
    return cacheStore.get(cacheKey);
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): PromptCacheEntry[] {
    return Array.from(cacheStore.values());
  }

  /**
   * Calculate hit rate
   */
  getHitRate(): number {
    const entries = this.getAllStats();
    if (entries.length === 0) return 0;

    const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0);
    const totalMisses = entries.reduce((sum, e) => sum + e.missCount, 0);
    const total = totalHits + totalMisses;

    return total > 0 ? totalHits / total : 0;
  }

  /**
   * Get total estimated savings
   */
  getTotalSavings(): number {
    const entries = this.getAllStats();
    return entries.reduce((sum, e) => sum + e.estimatedSavingsUsd, 0);
  }

  /**
   * Register a prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get a prompt template
   */
  getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Build a prompt from template with dynamic content
   */
  buildFromTemplate(
    templateName: string,
    dynamicContent: Record<string, string>
  ): { systemPrompt: string; userPrompt: string } | undefined {
    const template = this.templates.get(templateName);
    if (!template) return undefined;

    let userPrompt = template.userTemplate;
    for (const [key, value] of Object.entries(dynamicContent)) {
      userPrompt = userPrompt.replace(`{{${key}}}`, value);
    }

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
    };
  }

  /**
   * Clear cache (for testing)
   */
  clear(): void {
    cacheStore.clear();
  }

  /**
   * Estimate token count for a string (rough estimate)
   */
  estimateTokenCount(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Get cache key for research brief generation
   */
  getResearchBriefCacheKey(
    tenantId: string,
    stageId: number,
    policyVersion: string
  ): string {
    return this.generateCacheKey({
      tenantId,
      stageId,
      policyVersion,
      promptName: 'research_brief_generator',
    });
  }

  /**
   * Get cache key for SAP generation
   */
  getSapCacheKey(
    tenantId: string,
    stageId: number,
    policyVersion: string
  ): string {
    return this.generateCacheKey({
      tenantId,
      stageId,
      policyVersion,
      promptName: 'sap_generator',
    });
  }
}

/**
 * Create a singleton instance
 */
let defaultInstance: PromptCacheService | null = null;

export function getPromptCache(enabled?: boolean): PromptCacheService {
  if (!defaultInstance) {
    defaultInstance = new PromptCacheService(enabled);
  }
  return defaultInstance;
}

/**
 * Default prompt templates for common tasks
 */
export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    name: 'research_brief_generator',
    version: 1,
    workflowStage: 2,
    systemPrompt: `You are a clinical research methodology expert. Your task is to generate comprehensive research briefs from topic declarations.

IMPORTANT GUIDELINES:
- Focus on HIPAA compliance and data protection
- Ensure methodological rigor
- Consider statistical validity
- Identify potential confounders and biases

OUTPUT FORMAT:
Return valid JSON with the following structure:
{
  "summary": "string",
  "studyObjectives": ["string"],
  "population": "string",
  "exposure": "string",
  "comparator": "string",
  "outcomes": ["string"],
  "timeframe": "string",
  "candidateEndpoints": [{"name": "string", "definition": "string"}],
  "keyConfounders": ["string"],
  "minimumDatasetFields": [{"field": "string", "reason": "string"}],
  "clarifyingPrompts": ["string"],
  "refinementSuggestions": {
    "confounders": [{"variable": "string", "rationale": "string", "priority": "string"}],
    "biases": [{"type": "string", "description": "string", "mitigation": "string"}],
    "missingnessRisks": [{"variable": "string", "expectedRate": "string", "strategy": "string"}],
    "alternativeDesigns": [{"design": "string", "pros": ["string"], "cons": ["string"]}]
  }
}`,
    userTemplate: `Generate a research brief from this topic declaration:

TOPIC: {{title}}
DESCRIPTION: {{description}}

PICO ELEMENTS:
- Population: {{population}}
- Intervention/Exposure: {{intervention}}
- Comparator: {{comparator}}
- Outcomes: {{outcomes}}
- Timeframe: {{timeframe}}

ADDITIONAL CONTEXT:
- Cohort Inclusion: {{cohortInclusion}}
- Cohort Exclusion: {{cohortExclusion}}
- Keywords: {{keywords}}

Return valid JSON only.`,
    dynamicMarkers: ['title', 'description', 'population', 'intervention', 'comparator', 'outcomes', 'timeframe', 'cohortInclusion', 'cohortExclusion', 'keywords'],
  },
  {
    name: 'phi_scanner',
    version: 1,
    workflowStage: 0,
    systemPrompt: `You are a PHI (Protected Health Information) detection specialist. Scan the provided text for any potential PHI according to HIPAA Safe Harbor guidelines.

HIPAA IDENTIFIERS TO DETECT:
1. Names
2. Geographic data smaller than state
3. Dates (except year) related to an individual
4. Phone numbers
5. Fax numbers
6. Email addresses
7. Social Security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers and serial numbers
13. Device identifiers and serial numbers
14. Web URLs
15. IP addresses
16. Biometric identifiers
17. Full-face photos and comparable images
18. Any other unique identifying number or code

OUTPUT FORMAT:
Return valid JSON:
{
  "hasPhi": boolean,
  "riskLevel": "none" | "low" | "medium" | "high",
  "findingsCount": number,
  "categories": ["string"]
}

IMPORTANT: Never include the actual PHI values in your response.`,
    userTemplate: `Scan this text for PHI:

{{content}}`,
    dynamicMarkers: ['content'],
  },
  {
    name: 'abstract_generator',
    version: 1,
    workflowStage: 18,
    systemPrompt: `You are a scientific writing expert specializing in research abstracts. Generate a structured abstract following IMRAD format.

ABSTRACT STRUCTURE:
- Background (2-3 sentences)
- Methods (3-4 sentences)
- Results (3-4 sentences)
- Conclusions (2-3 sentences)

REQUIREMENTS:
- Word limit: 250-300 words
- Use active voice
- Include key statistical findings
- State clinical significance`,
    userTemplate: `Generate an abstract for this research:

TITLE: {{title}}
STUDY DESIGN: {{studyDesign}}
POPULATION: {{population}}
INTERVENTION: {{intervention}}
OUTCOMES: {{outcomes}}
KEY FINDINGS: {{keyFindings}}`,
    dynamicMarkers: ['title', 'studyDesign', 'population', 'intervention', 'outcomes', 'keyFindings'],
  },
];

/**
 * Initialize default templates in the cache service
 */
export function initializeDefaultTemplates(cacheService: PromptCacheService): void {
  for (const template of DEFAULT_TEMPLATES) {
    cacheService.registerTemplate(template);
  }
}
