/**
 * Abbreviation Service
 *
 * Manages abbreviation definitions and consistency.
 */

import type {
  AbbreviationAnalysis,
  AbbreviationEntry,
  AbbreviationDefinition,
  AbbreviationIssue,
} from '../types';

export class AbbreviationService {
  /**
   * Analyze abbreviations in text
   */
  analyzeAbbreviations(text: string): AbbreviationAnalysis {
    const abbreviations = this.extractAbbreviations(text);
    const definitions = this.findDefinitions(text, abbreviations);
    const issues = this.identifyIssues(abbreviations, definitions);

    return {
      abbreviations,
      suggestedDefinitions: definitions,
      consistencyIssues: issues,
    };
  }

  /**
   * Extract all abbreviations from text
   */
  private extractAbbreviations(text: string): AbbreviationEntry[] {
    // Pattern to match abbreviations (2-8 uppercase letters, possibly with numbers)
    const abbrevPattern = /\b[A-Z]{2,8}\d*\b/g;
    const matches = text.matchAll(abbrevPattern);

    const abbrevMap = new Map<string, number[]>();

    let index = 0;
    for (const match of matches) {
      const abbrev = match[0];
      const position = match.index!;

      // Skip common words that look like abbreviations
      if (this.isCommonWord(abbrev)) continue;

      if (!abbrevMap.has(abbrev)) {
        abbrevMap.set(abbrev, []);
      }
      abbrevMap.get(abbrev)!.push(position);
    }

    return Array.from(abbrevMap.entries()).map(([abbreviation, occurrences]) => {
      const firstOccurrence = occurrences[0];
      const definition = this.findDefinitionAt(text, abbreviation, firstOccurrence);

      return {
        abbreviation,
        firstOccurrence,
        occurrences,
        definedAt: definition ? firstOccurrence : undefined,
        expandedForm: definition,
      };
    });
  }

  /**
   * Check if a string is a common word (not an abbreviation)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set(['I', 'A', 'USA', 'UK', 'US', 'FDA', 'WHO', 'CDC']);
    return commonWords.has(word);
  }

  /**
   * Find definition for abbreviation near its position
   */
  private findDefinitionAt(
    text: string,
    abbrev: string,
    position: number
  ): string | undefined {
    // Look for pattern: "expanded form (ABBREV)" or "ABBREV (expanded form)"
    const contextStart = Math.max(0, position - 100);
    const contextEnd = Math.min(text.length, position + 100);
    const context = text.substring(contextStart, contextEnd);

    // Pattern 1: expanded form (ABBREV)
    const pattern1 = new RegExp(`([\\w\\s]{3,})\\s*\\(${abbrev}\\)`, 'i');
    const match1 = context.match(pattern1);
    if (match1) {
      return match1[1].trim();
    }

    // Pattern 2: ABBREV (expanded form)
    const pattern2 = new RegExp(`${abbrev}\\s*\\(([\\w\\s]{3,})\\)`, 'i');
    const match2 = context.match(pattern2);
    if (match2) {
      return match2[1].trim();
    }

    return undefined;
  }

  /**
   * Find or suggest definitions for abbreviations
   */
  private findDefinitions(
    text: string,
    abbreviations: AbbreviationEntry[]
  ): AbbreviationDefinition[] {
    const definitions: AbbreviationDefinition[] = [];

    for (const abbrev of abbreviations) {
      if (abbrev.expandedForm) {
        definitions.push({
          abbreviation: abbrev.abbreviation,
          expandedForm: abbrev.expandedForm,
          position: abbrev.firstOccurrence,
          confidence: 1.0,
        });
      } else {
        // Try to infer definition from context
        const inferred = this.inferDefinition(text, abbrev);
        if (inferred) {
          definitions.push(inferred);
        }
      }
    }

    return definitions;
  }

  /**
   * Infer definition from context (simplified)
   */
  private inferDefinition(
    text: string,
    abbrev: AbbreviationEntry
  ): AbbreviationDefinition | null {
    // Common medical abbreviations
    const commonAbbrevs: Record<string, string> = {
      BMI: 'Body Mass Index',
      CI: 'Confidence Interval',
      OR: 'Odds Ratio',
      HR: 'Hazard Ratio',
      RR: 'Relative Risk',
      SD: 'Standard Deviation',
      IQR: 'Interquartile Range',
      RCT: 'Randomized Controlled Trial',
      IRB: 'Institutional Review Board',
      CT: 'Computed Tomography',
      MRI: 'Magnetic Resonance Imaging',
      DNA: 'Deoxyribonucleic Acid',
      RNA: 'Ribonucleic Acid',
      PCR: 'Polymerase Chain Reaction',
    };

    if (commonAbbrevs[abbrev.abbreviation]) {
      return {
        abbreviation: abbrev.abbreviation,
        expandedForm: commonAbbrevs[abbrev.abbreviation],
        position: abbrev.firstOccurrence,
        confidence: 0.8,
      };
    }

    return null;
  }

  /**
   * Identify consistency issues
   */
  private identifyIssues(
    abbreviations: AbbreviationEntry[],
    definitions: AbbreviationDefinition[]
  ): AbbreviationIssue[] {
    const issues: AbbreviationIssue[] = [];

    // Check for undefined abbreviations
    for (const abbrev of abbreviations) {
      if (!abbrev.expandedForm && abbrev.occurrences.length > 1) {
        const hasDefinition = definitions.some(
          (d) => d.abbreviation === abbrev.abbreviation && d.confidence >= 0.8
        );

        if (!hasDefinition) {
          issues.push({
            abbreviation: abbrev.abbreviation,
            issueType: 'undefined',
            positions: abbrev.occurrences,
            recommendation: `Define "${abbrev.abbreviation}" at first use.`,
          });
        }
      }
    }

    // Check for multiple definitions
    const defCounts = new Map<string, AbbreviationDefinition[]>();
    for (const def of definitions) {
      if (!defCounts.has(def.abbreviation)) {
        defCounts.set(def.abbreviation, []);
      }
      defCounts.get(def.abbreviation)!.push(def);
    }

    for (const [abbrev, defs] of defCounts.entries()) {
      const uniqueForms = new Set(defs.map((d) => d.expandedForm));
      if (uniqueForms.size > 1) {
        issues.push({
          abbreviation: abbrev,
          issueType: 'multiple_definitions',
          positions: defs.map((d) => d.position),
          recommendation: `"${abbrev}" has multiple definitions: ${Array.from(
            uniqueForms
          ).join(', ')}. Use consistent definition.`,
        });
      }
    }

    return issues;
  }

  /**
   * Format abbreviation with definition
   */
  formatAbbreviationDefinition(abbreviation: string, expandedForm: string): string {
    return `${expandedForm} (${abbreviation})`;
  }

  /**
   * Insert abbreviation definition at first occurrence
   */
  insertDefinition(
    text: string,
    abbreviation: string,
    expandedForm: string,
    position: number
  ): string {
    const before = text.substring(0, position);
    const after = text.substring(position + abbreviation.length);

    return before + this.formatAbbreviationDefinition(abbreviation, expandedForm) + after;
  }

  /**
   * Generate abbreviation list for manuscript
   */
  generateAbbreviationList(analysis: AbbreviationAnalysis): string {
    let list = `Abbreviations\n\n`;

    const sortedAbbrevs = [...analysis.abbreviations].sort((a, b) =>
      a.abbreviation.localeCompare(b.abbreviation)
    );

    for (const abbrev of sortedAbbrevs) {
      const definition = analysis.suggestedDefinitions.find(
        (d) => d.abbreviation === abbrev.abbreviation
      );

      if (definition) {
        list += `${abbrev.abbreviation}: ${definition.expandedForm}\n`;
      } else {
        list += `${abbrev.abbreviation}: [Definition needed]\n`;
      }
    }

    return list;
  }

  /**
   * Check abbreviation style compliance
   */
  checkStyleCompliance(
    analysis: AbbreviationAnalysis
  ): {
    compliant: boolean;
    violations: Array<{
      rule: string;
      abbreviations: string[];
      recommendation: string;
    }>;
  } {
    const violations: Array<{
      rule: string;
      abbreviations: string[];
      recommendation: string;
    }> = [];

    // Rule 1: Abbreviations should be defined at first use
    const undefined = analysis.abbreviations.filter(
      (a) => !a.expandedForm && a.occurrences.length > 1
    );
    if (undefined.length > 0) {
      violations.push({
        rule: 'Define at first use',
        abbreviations: undefined.map((a) => a.abbreviation),
        recommendation: 'Define each abbreviation when first introduced.',
      });
    }

    // Rule 2: Don't abbreviate terms used fewer than 3 times
    const overused = analysis.abbreviations.filter((a) => a.occurrences.length < 3);
    if (overused.length > 0) {
      violations.push({
        rule: 'Minimum usage threshold',
        abbreviations: overused.map((a) => a.abbreviation),
        recommendation:
          'Consider spelling out terms used fewer than 3 times instead of abbreviating.',
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Generate abbreviation report
   */
  generateReport(analysis: AbbreviationAnalysis): string {
    let report = `Abbreviation Analysis Report\n\n`;

    report += `Total Abbreviations Found: ${analysis.abbreviations.length}\n`;

    const defined = analysis.abbreviations.filter((a) => a.expandedForm).length;
    const undefined = analysis.abbreviations.length - defined;

    report += `- Defined: ${defined}\n`;
    report += `- Undefined: ${undefined}\n`;
    report += `- Issues: ${analysis.consistencyIssues.length}\n\n`;

    if (analysis.consistencyIssues.length > 0) {
      report += `Consistency Issues:\n\n`;
      analysis.consistencyIssues.forEach((issue, i) => {
        report += `${i + 1}. ${issue.abbreviation} (${issue.issueType})\n`;
        report += `   ${issue.recommendation}\n`;
        report += `   Occurrences: ${issue.positions.length}\n\n`;
      });
    }

    const compliance = this.checkStyleCompliance(analysis);
    report += `Style Compliance: ${compliance.compliant ? 'PASS' : 'NEEDS ATTENTION'}\n`;

    if (compliance.violations.length > 0) {
      report += `\nStyle Violations:\n`;
      compliance.violations.forEach((v) => {
        report += `- ${v.rule}: ${v.abbreviations.join(', ')}\n`;
        report += `  ${v.recommendation}\n`;
      });
    }

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: AbbreviationService | null = null;

export function getAbbreviation(): AbbreviationService {
  if (!instance) {
    instance = new AbbreviationService();
  }
  return instance;
}
