/**
 * Citation Suggester Service
 *
 * Suggests relevant citations based on context and claims.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { CitationSuggestion, SuggestedCitation } from '../types';

export class CitationSuggesterService {
  private router = getModelRouter();

  /**
   * Suggest citations for a claim
   */
  async suggestCitations(
    claim: string,
    context: string,
    availableCitations?: Array<{
      id: string;
      title: string;
      authors: string[];
      year: number;
      journal?: string;
      abstract?: string;
      doi?: string;
    }>
  ): Promise<CitationSuggestion> {
    const prompt = this.buildSuggestionPrompt(claim, context, availableCitations);

    const request: AIRouterRequest = {
      taskType: 'protocol_reasoning',
      prompt,
      systemPrompt:
        'You are an expert medical librarian and research specialist. Suggest relevant citations that support scientific claims.',
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.3,
      forceTier: 'FRONTIER',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse citation suggestion response');
    }

    const result = response.parsed as {
      claim: string;
      position: number;
      suggested_citations: Array<{
        title: string;
        authors: string[];
        year: number;
        journal?: string;
        doi?: string;
        relevance_score: number;
        excerpt?: string;
      }>;
      confidence: number;
      reasoning: string;
    };

    return {
      claim: result.claim,
      position: result.position,
      suggestedCitations: result.suggested_citations.map((c) => ({
        title: c.title,
        authors: c.authors,
        year: c.year,
        journal: c.journal,
        doi: c.doi,
        relevanceScore: c.relevance_score,
        excerpt: c.excerpt,
      })),
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }

  /**
   * Build citation suggestion prompt
   */
  private buildSuggestionPrompt(
    claim: string,
    context: string,
    availableCitations?: Array<{
      id: string;
      title: string;
      authors: string[];
      year: number;
      journal?: string;
      abstract?: string;
      doi?: string;
    }>
  ): string {
    let prompt = `Suggest relevant citations for the following claim in a medical research manuscript:\n\n`;
    prompt += `Claim: "${claim}"\n\n`;
    prompt += `Context: ${context}\n\n`;

    if (availableCitations && availableCitations.length > 0) {
      prompt += `Available Citations:\n`;
      availableCitations.forEach((citation, i) => {
        prompt += `\n${i + 1}. ${citation.authors.join(', ')} (${citation.year}). ${
          citation.title
        }`;
        if (citation.journal) {
          prompt += `. ${citation.journal}`;
        }
        if (citation.abstract) {
          prompt += `\n   Abstract: ${citation.abstract.substring(0, 200)}...`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    prompt += `Please suggest ${
      availableCitations && availableCitations.length > 0 ? 'which of these citations' : 'citations that'
    } would be most relevant to support this claim.\n\n`;

    prompt += `Respond in JSON format:
{
  "claim": "${claim}",
  "position": 0,
  "suggested_citations": [
    {
      "title": "Citation title",
      "authors": ["Author 1", "Author 2"],
      "year": 2023,
      "journal": "Journal Name",
      "doi": "10.xxxx/xxxxx",
      "relevance_score": 0.0-1.0,
      "excerpt": "Relevant excerpt from the paper"
    }
  ],
  "confidence": 0.0-1.0,
  "reasoning": "Why these citations are relevant"
}`;

    return prompt;
  }

  /**
   * Identify claims needing citations
   */
  async identifyClaimsNeedingCitations(text: string): Promise<
    Array<{
      claim: string;
      position: number;
      priority: 'high' | 'medium' | 'low';
      reason: string;
    }>
  > {
    const prompt = `Identify claims in this medical research text that need citations but don't have them.

Text:
${text}

For each claim needing citation, indicate:
- The claim text
- Position in text
- Priority level (high/medium/low)
- Reason it needs citation

Respond in JSON format:
[
  {
    "claim": "claim text",
    "position": 0,
    "priority": "high|medium|low",
    "reason": "why citation is needed"
  }
]`;

    const request: AIRouterRequest = {
      taskType: 'extract_metadata',
      prompt,
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.2,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed || !Array.isArray(response.parsed)) {
      return [];
    }

    return response.parsed as Array<{
      claim: string;
      position: number;
      priority: 'high' | 'medium' | 'low';
      reason: string;
    }>;
  }

  /**
   * Suggest citations for entire section
   */
  async suggestForSection(
    text: string,
    sectionName: string,
    availableCitations?: Array<{
      id: string;
      title: string;
      authors: string[];
      year: number;
      journal?: string;
      abstract?: string;
      doi?: string;
    }>
  ): Promise<CitationSuggestion[]> {
    // First, identify claims needing citations
    const claims = await this.identifyClaimsNeedingCitations(text);

    // Then, suggest citations for each claim
    const suggestions = await Promise.all(
      claims
        .filter((c) => c.priority === 'high' || c.priority === 'medium')
        .map((claim) =>
          this.suggestCitations(
            claim.claim,
            `${sectionName} section of medical research manuscript`,
            availableCitations
          )
        )
    );

    return suggestions;
  }

  /**
   * Match citation to claim
   */
  async matchCitationToClaim(
    claim: string,
    citation: {
      title: string;
      abstract?: string;
      findings?: string[];
    }
  ): Promise<{
    relevant: boolean;
    relevanceScore: number;
    supportType: 'direct' | 'indirect' | 'contextual' | 'not_relevant';
    explanation: string;
  }> {
    const prompt = `Determine if this citation is relevant to support the given claim.

Claim: "${claim}"

Citation:
Title: ${citation.title}
${citation.abstract ? `Abstract: ${citation.abstract}` : ''}
${
  citation.findings
    ? `Key Findings:\n${citation.findings.map((f) => `- ${f}`).join('\n')}`
    : ''
}

Evaluate:
1. Is this citation relevant?
2. Relevance score (0.0-1.0)
3. Type of support: direct, indirect, contextual, or not_relevant
4. Brief explanation

Respond in JSON:
{
  "relevant": true/false,
  "relevance_score": 0.0-1.0,
  "support_type": "direct|indirect|contextual|not_relevant",
  "explanation": "brief explanation"
}`;

    const request: AIRouterRequest = {
      taskType: 'classify',
      prompt,
      responseFormat: 'json',
      maxTokens: 500,
      temperature: 0.2,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      return {
        relevant: false,
        relevanceScore: 0,
        supportType: 'not_relevant',
        explanation: 'Unable to evaluate relevance',
      };
    }

    const result = response.parsed as {
      relevant: boolean;
      relevance_score: number;
      support_type: string;
      explanation: string;
    };

    return {
      relevant: result.relevant,
      relevanceScore: result.relevance_score,
      supportType: result.support_type as any,
      explanation: result.explanation,
    };
  }

  /**
   * Format citation in specified style
   */
  formatCitation(
    citation: SuggestedCitation,
    style: 'AMA' | 'APA' | 'Vancouver' | 'Harvard' = 'Vancouver'
  ): string {
    switch (style) {
      case 'Vancouver':
        return this.formatVancouver(citation);
      case 'AMA':
        return this.formatAMA(citation);
      case 'APA':
        return this.formatAPA(citation);
      case 'Harvard':
        return this.formatHarvard(citation);
      default:
        return this.formatVancouver(citation);
    }
  }

  /**
   * Format citation in Vancouver style
   */
  private formatVancouver(citation: SuggestedCitation): string {
    const authors = citation.authors.slice(0, 6).join(', ');
    const et_al = citation.authors.length > 6 ? ', et al' : '';

    let formatted = `${authors}${et_al}. ${citation.title}.`;

    if (citation.journal) {
      formatted += ` ${citation.journal}. ${citation.year}`;
    } else {
      formatted += ` ${citation.year}`;
    }

    if (citation.doi) {
      formatted += `. doi:${citation.doi}`;
    }

    return formatted;
  }

  /**
   * Format citation in AMA style
   */
  private formatAMA(citation: SuggestedCitation): string {
    const authors = citation.authors.slice(0, 6).join(', ');
    const et_al = citation.authors.length > 6 ? ', et al' : '';

    return `${authors}${et_al}. ${citation.title}. ${citation.journal || 'Journal'}. ${
      citation.year
    }.`;
  }

  /**
   * Format citation in APA style
   */
  private formatAPA(citation: SuggestedCitation): string {
    const authors = citation.authors.join(', ');

    return `${authors} (${citation.year}). ${citation.title}. ${
      citation.journal || 'Journal'
    }.`;
  }

  /**
   * Format citation in Harvard style
   */
  private formatHarvard(citation: SuggestedCitation): string {
    const firstAuthor = citation.authors[0] || 'Unknown';
    const et_al = citation.authors.length > 1 ? ' et al.' : '';

    return `${firstAuthor}${et_al} (${citation.year}) '${citation.title}', ${
      citation.journal || 'Journal'
    }.`;
  }

  /**
   * Generate citation report
   */
  generateReport(suggestions: CitationSuggestion[]): string {
    let report = `Citation Suggestion Report\n\n`;

    report += `Total Claims Analyzed: ${suggestions.length}\n`;

    const withSuggestions = suggestions.filter((s) => s.suggestedCitations.length > 0);
    report += `Claims with Suggested Citations: ${withSuggestions.length}\n`;

    const avgConfidence =
      suggestions.reduce((sum, s) => sum + s.confidence, 0) / (suggestions.length || 1);
    report += `Average Confidence: ${(avgConfidence * 100).toFixed(1)}%\n\n`;

    if (suggestions.length > 0) {
      report += `Detailed Suggestions:\n\n`;

      suggestions.forEach((suggestion, i) => {
        report += `${i + 1}. "${suggestion.claim}"\n`;
        report += `   Confidence: ${(suggestion.confidence * 100).toFixed(1)}%\n`;
        report += `   Reasoning: ${suggestion.reasoning}\n`;

        if (suggestion.suggestedCitations.length > 0) {
          report += `   Suggested Citations:\n`;
          suggestion.suggestedCitations.forEach((citation, j) => {
            report += `   ${j + 1}. ${citation.authors.join(', ')} (${citation.year})\n`;
            report += `      "${citation.title}"\n`;
            report += `      Relevance: ${(citation.relevanceScore * 100).toFixed(1)}%\n`;
            if (citation.doi) {
              report += `      DOI: ${citation.doi}\n`;
            }
          });
        } else {
          report += `   No specific citations suggested\n`;
        }
        report += `\n`;
      });
    }

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: CitationSuggesterService | null = null;

export function getCitationSuggester(): CitationSuggesterService {
  if (!instance) {
    instance = new CitationSuggesterService();
  }
  return instance;
}
