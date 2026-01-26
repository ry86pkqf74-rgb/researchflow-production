/**
 * Grammar Checker Service
 *
 * Grammar and style checking using AI-powered analysis.
 * In production, integrate with LanguageTool API or similar service.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { GrammarCheckResult, GrammarIssue } from '../types';

export class GrammarCheckerService {
  private router = getModelRouter();

  /**
   * Check grammar and style in text
   */
  async checkGrammar(text: string): Promise<GrammarCheckResult> {
    const prompt = `Analyze the following medical research text for grammar, style, and clarity issues. Provide detailed feedback in JSON format.

Text to analyze:
${text}

Return a JSON object with this structure:
{
  "issues": [
    {
      "message": "Description of the issue",
      "shortMessage": "Brief issue description",
      "offset": 0,
      "length": 10,
      "severity": "error|warning|info",
      "category": "grammar|style|clarity",
      "rule": "rule_identifier",
      "suggestions": ["suggestion1", "suggestion2"],
      "context": {
        "text": "surrounding context",
        "offset": 0,
        "length": 50
      }
    }
  ],
  "correctedText": "Fully corrected version of the text",
  "score": 95
}`;

    const request: AIRouterRequest = {
      taskType: 'format_validate',
      prompt,
      systemPrompt:
        'You are an expert medical editor and grammarian. Identify grammar, style, and clarity issues in medical research writing. Provide actionable suggestions.',
      responseFormat: 'json',
      maxTokens: 2048,
      temperature: 0.1,
      forceTier: 'NANO',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse grammar check response');
    }

    const result = response.parsed as {
      issues: Array<{
        message: string;
        shortMessage?: string;
        offset: number;
        length: number;
        severity: 'error' | 'warning' | 'info';
        category: string;
        rule: string;
        suggestions: string[];
        context: {
          text: string;
          offset: number;
          length: number;
        };
      }>;
      correctedText: string;
      score: number;
    };

    return {
      passed: result.issues.filter((i) => i.severity === 'error').length === 0,
      issues: result.issues,
      correctedText: result.correctedText,
      score: result.score,
    };
  }

  /**
   * Check specific aspects of grammar
   */
  async checkAspect(
    text: string,
    aspect: 'passive_voice' | 'word_choice' | 'sentence_structure' | 'punctuation'
  ): Promise<GrammarIssue[]> {
    const aspectPrompts = {
      passive_voice:
        'Identify all instances of passive voice and suggest active voice alternatives.',
      word_choice:
        'Identify problematic word choices, redundancies, and suggest more precise medical terminology.',
      sentence_structure:
        'Identify overly complex or poorly structured sentences and suggest improvements.',
      punctuation: 'Identify punctuation errors and style inconsistencies.',
    };

    const prompt = `${aspectPrompts[aspect]}

Text:
${text}

Return JSON array of issues with this structure:
[
  {
    "message": "Issue description",
    "offset": 0,
    "length": 10,
    "severity": "error|warning|info",
    "category": "${aspect}",
    "rule": "rule_name",
    "suggestions": ["suggestion"],
    "context": {"text": "context", "offset": 0, "length": 20}
  }
]`;

    const request: AIRouterRequest = {
      taskType: 'classify',
      prompt,
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.1,
      forceTier: 'NANO',
    };

    const response = await this.router.route(request);

    if (!response.parsed || !Array.isArray(response.parsed)) {
      return [];
    }

    return response.parsed as GrammarIssue[];
  }

  /**
   * Apply grammar corrections automatically
   */
  async applyCorrections(text: string, issues: GrammarIssue[]): Promise<string> {
    // Sort issues by offset in reverse order to apply corrections without shifting positions
    const sortedIssues = [...issues].sort((a, b) => b.offset - a.offset);

    let correctedText = text;

    for (const issue of sortedIssues) {
      if (issue.suggestions.length > 0) {
        const before = correctedText.substring(0, issue.offset);
        const after = correctedText.substring(issue.offset + issue.length);
        correctedText = before + issue.suggestions[0] + after;
      }
    }

    return correctedText;
  }

  /**
   * Get grammar statistics for text
   */
  getGrammarStats(result: GrammarCheckResult): {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    byCategory: Record<string, number>;
  } {
    const stats = {
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      byCategory: {} as Record<string, number>,
    };

    for (const issue of result.issues) {
      // Count by severity
      if (issue.severity === 'error') stats.errorCount++;
      else if (issue.severity === 'warning') stats.warningCount++;
      else stats.infoCount++;

      // Count by category
      stats.byCategory[issue.category] = (stats.byCategory[issue.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Generate grammar report
   */
  generateReport(result: GrammarCheckResult): string {
    const stats = this.getGrammarStats(result);

    let report = `Grammar Check Report\n`;
    report += `Score: ${result.score}/100\n`;
    report += `Status: ${result.passed ? 'PASSED' : 'NEEDS ATTENTION'}\n\n`;

    report += `Summary:\n`;
    report += `- Errors: ${stats.errorCount}\n`;
    report += `- Warnings: ${stats.warningCount}\n`;
    report += `- Suggestions: ${stats.infoCount}\n\n`;

    if (Object.keys(stats.byCategory).length > 0) {
      report += `Issues by Category:\n`;
      Object.entries(stats.byCategory).forEach(([category, count]) => {
        report += `- ${category}: ${count}\n`;
      });
      report += `\n`;
    }

    if (result.issues.length > 0) {
      report += `Detailed Issues:\n`;
      result.issues.forEach((issue, i) => {
        report += `\n${i + 1}. ${issue.message}\n`;
        report += `   Position: ${issue.offset}-${issue.offset + issue.length}\n`;
        report += `   Severity: ${issue.severity}\n`;
        if (issue.suggestions.length > 0) {
          report += `   Suggestions: ${issue.suggestions.join(', ')}\n`;
        }
      });
    }

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: GrammarCheckerService | null = null;

export function getGrammarChecker(): GrammarCheckerService {
  if (!instance) {
    instance = new GrammarCheckerService();
  }
  return instance;
}
