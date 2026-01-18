/**
 * Medical NLP Service
 *
 * Medical entity recognition and terminology standardization.
 * Simulates BioBERT/PubMedBERT functionality through AI Router.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { MedicalNLPResult, MedicalEntity, TerminologyIssue } from '../types';

export class MedicalNLPService {
  private router = getModelRouter();

  /**
   * Extract medical entities from text
   */
  async extractEntities(text: string): Promise<MedicalEntity[]> {
    const prompt = `Extract all medical entities from the following text. Identify diseases, drugs, procedures, symptoms, anatomical terms, and biomarkers.

Text:
${text}

For each entity, provide:
- The exact text span
- Start and end positions
- Entity type
- Standardized medical term (if applicable)
- UMLS CUI (if known)
- Confidence score

Respond in JSON format:
{
  "entities": [
    {
      "text": "entity text",
      "start": 0,
      "end": 10,
      "type": "disease|drug|procedure|symptom|anatomy|biomarker",
      "standardized_term": "standard medical term",
      "cui": "C0000000",
      "confidence": 0.0-1.0
    }
  ]
}`;

    const request: AIRouterRequest = {
      taskType: 'extract_metadata',
      prompt,
      systemPrompt:
        'You are a medical NLP system trained on biomedical literature. Extract and classify medical entities with high precision.',
      responseFormat: 'json',
      maxTokens: 2000,
      temperature: 0.1,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse entity extraction response');
    }

    const result = response.parsed as {
      entities: Array<{
        text: string;
        start: number;
        end: number;
        type: string;
        standardized_term?: string;
        cui?: string;
        confidence: number;
      }>;
    };

    return result.entities.map((e) => ({
      text: e.text,
      start: e.start,
      end: e.end,
      type: e.type as MedicalEntity['type'],
      standardizedTerm: e.standardized_term,
      cui: e.cui,
      confidence: e.confidence,
    }));
  }

  /**
   * Standardize medical terminology in text
   */
  async standardizeTerminology(text: string): Promise<MedicalNLPResult> {
    const entities = await this.extractEntities(text);

    const prompt = `Given this medical text and the identified entities, standardize any non-standard terminology to preferred medical terms.

Original Text:
${text}

Identified Entities:
${JSON.stringify(entities, null, 2)}

Provide:
1. Standardized version of the text
2. List of terminology issues found

Respond in JSON format:
{
  "standardized_text": "text with standardized terms",
  "terminology_issues": [
    {
      "original": "original term",
      "suggested": "standardized term",
      "reason": "why this change is recommended",
      "position": 0
    }
  ]
}`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt:
        'You are a medical terminology expert. Standardize medical terms according to established nomenclature (ICD, SNOMED CT, MeSH).',
      responseFormat: 'json',
      maxTokens: 2000,
      temperature: 0.2,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse standardization response');
    }

    const result = response.parsed as {
      standardized_text: string;
      terminology_issues: Array<{
        original: string;
        suggested: string;
        reason: string;
        position: number;
      }>;
    };

    return {
      entities,
      standardizedText: result.standardized_text,
      terminologyIssues: result.terminology_issues,
    };
  }

  /**
   * Identify medical entities by type
   */
  async findEntitiesByType(
    text: string,
    entityType: MedicalEntity['type']
  ): Promise<MedicalEntity[]> {
    const entities = await this.extractEntities(text);
    return entities.filter((e) => e.type === entityType);
  }

  /**
   * Validate medical terminology consistency
   */
  async validateConsistency(text: string): Promise<{
    consistent: boolean;
    issues: Array<{
      term: string;
      variants: string[];
      positions: number[];
      recommendedStandard: string;
    }>;
  }> {
    const entities = await this.extractEntities(text);

    // Group similar entities
    const termGroups = new Map<string, Set<string>>();

    entities.forEach((entity) => {
      const standard = entity.standardizedTerm || entity.text.toLowerCase();
      if (!termGroups.has(standard)) {
        termGroups.set(standard, new Set());
      }
      termGroups.get(standard)!.add(entity.text);
    });

    // Find inconsistencies (same concept, different terms)
    const issues = Array.from(termGroups.entries())
      .filter(([_, variants]) => variants.size > 1)
      .map(([standard, variants]) => {
        const variantArray = Array.from(variants);
        const positions = entities
          .filter((e) =>
            variantArray.includes(e.text) ||
            (e.standardizedTerm && e.standardizedTerm === standard)
          )
          .map((e) => e.start);

        return {
          term: standard,
          variants: variantArray,
          positions,
          recommendedStandard: standard,
        };
      });

    return {
      consistent: issues.length === 0,
      issues,
    };
  }

  /**
   * Map entities to UMLS concepts
   */
  async mapToUMLS(entities: MedicalEntity[]): Promise<
    Array<{
      entity: MedicalEntity;
      umlsConcepts: Array<{
        cui: string;
        preferredTerm: string;
        semanticType: string;
        score: number;
      }>;
    }>
  > {
    // This is a simplified version - in production, integrate with UMLS API
    const results = await Promise.all(
      entities.map(async (entity) => {
        const prompt = `Map this medical entity to UMLS concepts:

Entity: "${entity.text}"
Context Type: ${entity.type}

Provide the most relevant UMLS concepts with CUI, preferred term, semantic type, and confidence score.

Respond in JSON:
{
  "concepts": [
    {
      "cui": "C0000000",
      "preferred_term": "Standard Term",
      "semantic_type": "Disease or Syndrome",
      "score": 0.0-1.0
    }
  ]
}`;

        const request: AIRouterRequest = {
          taskType: 'extract_metadata',
          prompt,
          responseFormat: 'json',
          maxTokens: 500,
          temperature: 0.1,
          forceTier: 'NANO',
        };

        const response = await this.router.route(request);

        const concepts = response.parsed
          ? (response.parsed as { concepts: any[] }).concepts
          : [];

        return {
          entity,
          umlsConcepts: concepts.map((c: any) => ({
            cui: c.cui,
            preferredTerm: c.preferred_term,
            semanticType: c.semantic_type,
            score: c.score,
          })),
        };
      })
    );

    return results;
  }

  /**
   * Generate NLP analysis report
   */
  generateReport(result: MedicalNLPResult): string {
    let report = `Medical NLP Analysis Report\n\n`;

    report += `Entities Identified: ${result.entities.length}\n`;

    // Count by type
    const byType = result.entities.reduce((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `\nEntity Distribution:\n`;
    Object.entries(byType).forEach(([type, count]) => {
      report += `- ${type}: ${count}\n`;
    });

    if (result.terminologyIssues.length > 0) {
      report += `\nTerminology Issues: ${result.terminologyIssues.length}\n\n`;
      result.terminologyIssues.forEach((issue, i) => {
        report += `${i + 1}. "${issue.original}" → "${issue.suggested}"\n`;
        report += `   Reason: ${issue.reason}\n`;
        report += `   Position: ${issue.position}\n\n`;
      });
    } else {
      report += `\nNo terminology issues found. Terms are properly standardized.\n`;
    }

    // High confidence entities
    const highConfidence = result.entities.filter((e) => e.confidence > 0.9);
    report += `\nHigh Confidence Entities: ${highConfidence.length}/${result.entities.length}\n`;

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: MedicalNLPService | null = null;

export function getMedicalNLP(): MedicalNLPService {
  if (!instance) {
    instance = new MedicalNLPService();
  }
  return instance;
}
