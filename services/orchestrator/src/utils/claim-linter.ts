/**
 * Automated Claim Linting System
 *
 * Scans research drafts for:
 * - Numbers without citations
 * - Strong claims without evidence
 * - Forbidden clinical language
 * - Statistical claims without sources
 *
 * Priority: P0 - CRITICAL (Phase 2)
 */

export type LintSeverity = 'ERROR' | 'WARNING' | 'INFO';

export type LintIssueType =
  | 'NUMBER_WITHOUT_SOURCE'
  | 'STRONG_CLAIM_NO_CITATION'
  | 'FORBIDDEN_CLINICAL_LANGUAGE'
  | 'STATISTICAL_CLAIM_UNSUPPORTED'
  | 'CAUSAL_LANGUAGE_NO_EVIDENCE'
  | 'MISSING_LIMITATION'
  | 'OVERGENERALIZATION';

export interface ClaimLintResult {
  /** Line number where issue was found (1-indexed) */
  lineNumber: number;

  /** Column number (0-indexed) */
  columnNumber?: number;

  /** The problematic text */
  text: string;

  /** Type of issue */
  issue: LintIssueType;

  /** Severity level */
  severity: LintSeverity;

  /** Human-readable suggestion for fixing */
  suggestion: string;

  /** Optional: replacement text suggestion */
  replacement?: string;

  /** Context lines (before and after) */
  context?: {
    before: string[];
    after: string[];
  };
}

export interface LintReport {
  /** Total issues found */
  totalIssues: number;

  /** Issues by severity */
  errors: number;
  warnings: number;
  info: number;

  /** All lint results */
  results: ClaimLintResult[];

  /** Whether draft passes minimum quality checks */
  passesMinimumQuality: boolean;

  /** Timestamp of linting */
  lintedAt: Date;

  /** Draft metadata */
  draftId?: string;
  draftLength: number;
}

/**
 * Forbidden patterns that indicate clinical language
 */
const FORBIDDEN_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  severity: LintSeverity;
  suggestion: string;
}> = [
  {
    pattern: /should be treated with/gi,
    message: 'Clinical recommendation language detected',
    severity: 'ERROR',
    suggestion: 'Use research language: "may be associated with" or "warrants further investigation"'
  },
  {
    pattern: /\b(diagnosis|diagnose|diagnosed)\s+of\b/gi,
    message: 'Diagnostic language detected',
    severity: 'ERROR',
    suggestion: 'Use: "findings consistent with" or "indicators of" instead'
  },
  {
    pattern: /\b(we|you)\s+(recommend|should|must)\b/gi,
    message: 'Treatment recommendation detected',
    severity: 'ERROR',
    suggestion: 'Use: "data suggest" or "findings indicate" instead of prescriptive language'
  },
  {
    pattern: /\bcures?\b/gi,
    message: 'Cure claim detected',
    severity: 'ERROR',
    suggestion: 'Avoid claiming cures. Use: "may improve outcomes" or "shows promise"'
  },
  {
    pattern: /\bguaranteed?\b/gi,
    message: 'Guarantee claim detected',
    severity: 'ERROR',
    suggestion: 'No guarantees in research. Use: "evidence suggests" or "may indicate"'
  },
  {
    pattern: /\bprovides?\s+(definitive|conclusive)\s+evidence\b/gi,
    message: 'Overly strong evidence claim',
    severity: 'WARNING',
    suggestion: 'Use: "provides evidence" or "supports the hypothesis"'
  }
];

/**
 * Causal language patterns that require strong evidence
 */
const CAUSAL_PATTERNS: Array<{
  pattern: RegExp;
  suggestion: string;
}> = [
  {
    pattern: /\bcause[ds]?\b/gi,
    suggestion: 'Causal claims require RCT or strong experimental evidence. Consider: "associated with" or "correlates with"'
  },
  {
    pattern: /\bresults? in\b/gi,
    suggestion: 'Implies causation. Consider: "is associated with" unless causal evidence exists'
  },
  {
    pattern: /\bleads? to\b/gi,
    suggestion: 'Implies causation. Consider: "is linked to" or "may contribute to"'
  }
];

/**
 * Lint a research draft for quality issues
 */
export function lintClaims(
  draft: string,
  citations: Array<{ id: string; text: string }> = []
): LintReport {
  const results: ClaimLintResult[] = [];
  const lines = draft.split('\n');

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;

    // Check for numbers without citations
    const numbers = line.match(/\d+(\.\d+)?%|\d{2,}/g);
    const hasCitation = line.match(/\[\d+\]|\(\w+,?\s*\d{4}\)|\(\w+\s+et\s+al\.,?\s*\d{4}\)/);

    if (numbers && !hasCitation && !line.match(/^#/)) { // Skip headings
      results.push({
        lineNumber,
        text: line,
        issue: 'NUMBER_WITHOUT_SOURCE',
        severity: 'WARNING',
        suggestion: 'Add citation for statistical claim. Every numerical finding needs a source.',
        context: getContext(lines, idx)
      });
    }

    // Check for forbidden clinical language
    FORBIDDEN_PATTERNS.forEach(({ pattern, message, severity, suggestion }) => {
      const match = pattern.exec(line);
      if (match) {
        results.push({
          lineNumber,
          columnNumber: match.index,
          text: line,
          issue: 'FORBIDDEN_CLINICAL_LANGUAGE',
          severity,
          suggestion: `${message}. ${suggestion}`,
          context: getContext(lines, idx)
        });
      }
    });

    // Check for causal language
    CAUSAL_PATTERNS.forEach(({ pattern, suggestion }) => {
      const match = pattern.exec(line);
      if (match && !hasCitation) {
        results.push({
          lineNumber,
          columnNumber: match.index,
          text: line,
          issue: 'CAUSAL_LANGUAGE_NO_EVIDENCE',
          severity: 'WARNING',
          suggestion,
          context: getContext(lines, idx)
        });
      }
    });

    // Check for strong claims without evidence
    const strongClaimPatterns = [
      /\b(clearly|obviously|undoubtedly|certainly|definitely)\s+\w+/gi,
      /\ball\s+\w+\s+(are|is|show|demonstrate)/gi,
      /\bnone\s+of\s+the\s+\w+/gi
    ];

    strongClaimPatterns.forEach(pattern => {
      const match = pattern.exec(line);
      if (match && !hasCitation) {
        results.push({
          lineNumber,
          columnNumber: match.index,
          text: line,
          issue: 'STRONG_CLAIM_NO_CITATION',
          severity: 'WARNING',
          suggestion: 'Strong claims require citations. Add evidence or soften language with "may", "suggests", or "indicates".',
          context: getContext(lines, idx)
        });
      }
    });
  });

  // Count by severity
  const errors = results.filter(r => r.severity === 'ERROR').length;
  const warnings = results.filter(r => r.severity === 'WARNING').length;
  const info = results.filter(r => r.severity === 'INFO').length;

  // Pass minimum quality if no errors (warnings are acceptable)
  const passesMinimumQuality = errors === 0;

  return {
    totalIssues: results.length,
    errors,
    warnings,
    info,
    results,
    passesMinimumQuality,
    lintedAt: new Date(),
    draftLength: draft.length
  };
}

/**
 * Get context lines around a match
 */
function getContext(lines: string[], lineIdx: number, contextSize: number = 2): {
  before: string[];
  after: string[];
} {
  return {
    before: lines.slice(Math.max(0, lineIdx - contextSize), lineIdx),
    after: lines.slice(lineIdx + 1, lineIdx + 1 + contextSize)
  };
}

/**
 * Format lint report as human-readable text
 */
export function formatLintReport(report: LintReport): string {
  const lines: string[] = [];

  lines.push('=== CLAIM LINTING REPORT ===');
  lines.push(`Linted at: ${report.lintedAt.toISOString()}`);
  lines.push(`Draft length: ${report.draftLength} characters`);
  lines.push('');
  lines.push(`Total issues: ${report.totalIssues}`);
  lines.push(`  Errors:   ${report.errors}`);
  lines.push(`  Warnings: ${report.warnings}`);
  lines.push(`  Info:     ${report.info}`);
  lines.push('');
  lines.push(`Quality check: ${report.passesMinimumQuality ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push('');

  if (report.results.length === 0) {
    lines.push('No issues found!');
    return lines.join('\n');
  }

  lines.push('=== ISSUES ===');
  lines.push('');

  // Group by severity
  ['ERROR', 'WARNING', 'INFO'].forEach(severity => {
    const issues = report.results.filter(r => r.severity === severity);
    if (issues.length === 0) return;

    lines.push(`--- ${severity}S (${issues.length}) ---`);
    lines.push('');

    issues.forEach((issue, idx) => {
      lines.push(`${idx + 1}. Line ${issue.lineNumber} [${issue.issue}]`);
      lines.push(`   Text: "${issue.text.trim()}"`);
      lines.push(`   ${issue.suggestion}`);
      if (issue.replacement) {
        lines.push(`   Suggested fix: "${issue.replacement}"`);
      }
      lines.push('');
    });
  });

  return lines.join('\n');
}

/**
 * Check if a draft meets export quality standards
 */
export function meetsExportQuality(report: LintReport): {
  allowed: boolean;
  reason?: string;
  blockers: ClaimLintResult[];
} {
  const blockerIssues = report.results.filter(r => r.severity === 'ERROR');

  if (blockerIssues.length > 0) {
    return {
      allowed: false,
      reason: `${blockerIssues.length} critical issue(s) must be resolved before export`,
      blockers: blockerIssues
    };
  }

  return {
    allowed: true,
    blockers: []
  };
}

/**
 * Auto-fix certain linting issues (use with caution)
 */
export function autoFixLint(draft: string, report: LintReport): {
  fixedDraft: string;
  fixedCount: number;
  unfixedCount: number;
} {
  let fixedDraft = draft;
  let fixedCount = 0;
  const unfixedCount = report.results.filter(r => !r.replacement).length;

  // Apply replacements (if provided)
  report.results.forEach(result => {
    if (result.replacement) {
      fixedDraft = fixedDraft.replace(result.text, result.replacement);
      fixedCount++;
    }
  });

  return {
    fixedDraft,
    fixedCount,
    unfixedCount
  };
}
