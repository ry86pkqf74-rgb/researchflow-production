/**
 * Clarity Analyzer Service
 *
 * AI-powered clarity feedback for medical writing.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { ClarityAnalysis, ClarityIssue } from '../types';

export class ClarityAnalyzerService {
  private router = getModelRouter();

  /**
   * Analyze text clarity
   */
  async analyzeClarity(text: string): Promise<ClarityAnalysis> {
    const prompt = `Analyze the clarity of this medical research text. Identify issues with:
1. Passive voice overuse
2. Overly complex sentences
3. Unnecessary jargon
4. Ambiguous statements
5. Wordiness

Text:
${text}

Provide detailed feedback in JSON format:
{
  "overall_score": 0.0-1.0,
  "issues": [
    {
      "sentence": "problematic sentence",
      "position": 0,
      "issue_type": "passive_voice|complex_sentence|jargon|ambiguity|wordiness",
      "severity": "low|medium|high",
      "suggestion": "how to improve"
    }
  ],
  "suggestions": ["overall suggestions for improvement"],
  "strengths": ["what the text does well"]
}`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt:
        'You are an expert medical editor specializing in clarity and readability. Provide actionable feedback to improve text clarity while maintaining scientific rigor.',
      responseFormat: 'json',
      maxTokens: 2000,
      temperature: 0.3,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse clarity analysis response');
    }

    const result = response.parsed as {
      overall_score: number;
      issues: Array<{
        sentence: string;
        position: number;
        issue_type: string;
        severity: string;
        suggestion: string;
      }>;
      suggestions: string[];
      strengths: string[];
    };

    return {
      overallScore: result.overall_score,
      issues: result.issues.map((i) => ({
        sentence: i.sentence,
        position: i.position,
        issueType: i.issue_type as ClarityIssue['issueType'],
        severity: i.severity as ClarityIssue['severity'],
        suggestion: i.suggestion,
      })),
      suggestions: result.suggestions,
      strengths: result.strengths,
    };
  }

  /**
   * Check for passive voice
   */
  async checkPassiveVoice(text: string): Promise<ClarityIssue[]> {
    const sentences = this.splitIntoSentences(text);
    const issues: ClarityIssue[] = [];

    for (const [index, sentence] of sentences.entries()) {
      if (this.hasPassiveVoice(sentence)) {
        const activeSuggestion = await this.convertToActive(sentence);
        issues.push({
          sentence,
          position: this.getSentencePosition(text, index),
          issueType: 'passive_voice',
          severity: 'medium',
          suggestion: activeSuggestion,
        });
      }
    }

    return issues;
  }

  /**
   * Detect passive voice (simplified heuristic)
   */
  private hasPassiveVoice(sentence: string): boolean {
    const passiveIndicators = [
      /\b(was|were|is|are|been|being)\s+\w+ed\b/i,
      /\b(was|were|is|are|been|being)\s+\w+en\b/i,
    ];

    return passiveIndicators.some((pattern) => pattern.test(sentence));
  }

  /**
   * Convert passive to active voice
   */
  private async convertToActive(sentence: string): Promise<string> {
    const prompt = `Convert this passive voice sentence to active voice while preserving meaning:

"${sentence}"

Respond with only the converted sentence.`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      maxTokens: 200,
      temperature: 0.3,
      forceTier: 'NANO',
    };

    const response = await this.router.route(request);
    return response.content.trim();
  }

  /**
   * Identify complex sentences
   */
  async identifyComplexSentences(text: string): Promise<ClarityIssue[]> {
    const sentences = this.splitIntoSentences(text);
    const issues: ClarityIssue[] = [];

    for (const [index, sentence] of sentences.entries()) {
      const wordCount = sentence.split(/\s+/).length;
      const clauseCount = (sentence.match(/[,;:]/g) || []).length + 1;

      // Consider complex if > 30 words or > 3 clauses
      if (wordCount > 30 || clauseCount > 3) {
        issues.push({
          sentence,
          position: this.getSentencePosition(text, index),
          issueType: 'complex_sentence',
          severity: wordCount > 40 ? 'high' : 'medium',
          suggestion: `Consider breaking this ${wordCount}-word sentence into ${Math.ceil(
            wordCount / 20
          )} shorter sentences for better clarity.`,
        });
      }
    }

    return issues;
  }

  /**
   * Check for unnecessary jargon
   */
  async checkJargon(text: string): Promise<ClarityIssue[]> {
    const prompt = `Identify unnecessarily complex or jargon-heavy passages in this medical text that could be simplified without losing precision.

Text:
${text}

Return JSON array of issues:
[
  {
    "sentence": "sentence with jargon",
    "position": 0,
    "suggestion": "simpler alternative"
  }
]`;

    const request: AIRouterRequest = {
      taskType: 'classify',
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

    const results = response.parsed as Array<{
      sentence: string;
      position: number;
      suggestion: string;
    }>;

    return results.map((r) => ({
      sentence: r.sentence,
      position: r.position,
      issueType: 'jargon' as const,
      severity: 'medium' as const,
      suggestion: r.suggestion,
    }));
  }

  /**
   * Detect ambiguous statements
   */
  async detectAmbiguity(text: string): Promise<ClarityIssue[]> {
    const prompt = `Identify ambiguous or unclear statements in this medical research text that could lead to misinterpretation.

Text:
${text}

Return JSON array:
[
  {
    "sentence": "ambiguous sentence",
    "position": 0,
    "suggestion": "how to clarify"
  }
]`;

    const request: AIRouterRequest = {
      taskType: 'classify',
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

    const results = response.parsed as Array<{
      sentence: string;
      position: number;
      suggestion: string;
    }>;

    return results.map((r) => ({
      sentence: r.sentence,
      position: r.position,
      issueType: 'ambiguity' as const,
      severity: 'high' as const,
      suggestion: r.suggestion,
    }));
  }

  /**
   * Check for wordiness
   */
  async checkWordiness(text: string): Promise<ClarityIssue[]> {
    const prompt = `Identify wordy passages that could be more concise without losing meaning.

Text:
${text}

Return JSON array:
[
  {
    "sentence": "wordy sentence",
    "position": 0,
    "suggestion": "concise version"
  }
]`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
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

    const results = response.parsed as Array<{
      sentence: string;
      position: number;
      suggestion: string;
    }>;

    return results.map((r) => ({
      sentence: r.sentence,
      position: r.position,
      issueType: 'wordiness' as const,
      severity: 'low' as const,
      suggestion: r.suggestion,
    }));
  }

  /**
   * Get comprehensive clarity report
   */
  async getComprehensiveReport(text: string): Promise<ClarityAnalysis> {
    const [
      overallAnalysis,
      passiveVoiceIssues,
      complexSentences,
      jargonIssues,
      ambiguityIssues,
      wordinessIssues,
    ] = await Promise.all([
      this.analyzeClarity(text),
      this.checkPassiveVoice(text),
      this.identifyComplexSentences(text),
      this.checkJargon(text),
      this.detectAmbiguity(text),
      this.checkWordiness(text),
    ]);

    // Merge all issues
    const allIssues = [
      ...overallAnalysis.issues,
      ...passiveVoiceIssues,
      ...complexSentences,
      ...jargonIssues,
      ...ambiguityIssues,
      ...wordinessIssues,
    ];

    // Remove duplicates based on position
    const uniqueIssues = Array.from(
      new Map(allIssues.map((issue) => [issue.position, issue])).values()
    );

    return {
      overallScore: overallAnalysis.overallScore,
      issues: uniqueIssues,
      suggestions: overallAnalysis.suggestions,
      strengths: overallAnalysis.strengths,
    };
  }

  /**
   * Generate clarity report
   */
  generateReport(analysis: ClarityAnalysis): string {
    let report = `Clarity Analysis Report\n`;
    report += `Overall Score: ${(analysis.overallScore * 100).toFixed(1)}%\n\n`;

    // Group issues by type
    const byType = analysis.issues.reduce((acc, issue) => {
      acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `Issues by Type:\n`;
    Object.entries(byType).forEach(([type, count]) => {
      report += `- ${type}: ${count}\n`;
    });
    report += `\n`;

    if (analysis.strengths.length > 0) {
      report += `Strengths:\n`;
      analysis.strengths.forEach((s) => {
        report += `- ${s}\n`;
      });
      report += `\n`;
    }

    if (analysis.suggestions.length > 0) {
      report += `Overall Suggestions:\n`;
      analysis.suggestions.forEach((s) => {
        report += `- ${s}\n`;
      });
      report += `\n`;
    }

    if (analysis.issues.length > 0) {
      report += `Detailed Issues:\n\n`;
      analysis.issues.forEach((issue, i) => {
        report += `${i + 1}. ${issue.issueType.toUpperCase()} [${issue.severity}]\n`;
        report += `   "${issue.sentence}"\n`;
        report += `   Suggestion: ${issue.suggestion}\n\n`;
      });
    }

    return report;
  }

  /**
   * Helper: Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  }

  /**
   * Helper: Get sentence position in text
   */
  private getSentencePosition(text: string, sentenceIndex: number): number {
    const sentences = this.splitIntoSentences(text);
    let position = 0;
    for (let i = 0; i < sentenceIndex && i < sentences.length; i++) {
      position += sentences[i].length + 1; // +1 for delimiter
    }
    return position;
  }
}

/**
 * Singleton instance
 */
let instance: ClarityAnalyzerService | null = null;

export function getClarityAnalyzer(): ClarityAnalyzerService {
  if (!instance) {
    instance = new ClarityAnalyzerService();
  }
  return instance;
}
