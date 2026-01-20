/**
 * PHI Snippet Scanner
 *
 * Specialized scanner for text snippets from various sources:
 * - Literature abstracts
 * - OCR-extracted text
 * - Transcribed audio
 * - Parsed document content
 *
 * Provides batch scanning, risk assessment, and contextual analysis.
 */

import type { PhiFinding, PhiScanner, RiskLevel, ScanContext } from './types';
import { RegexPhiScanner } from './regex-scanner';

/**
 * Result of scanning a single snippet
 */
export interface SnippetScanResult {
  /** Unique identifier for the snippet */
  snippetId: string;
  /** Source of the snippet */
  source: string;
  /** Whether PHI was found */
  hasPhi: boolean;
  /** Number of PHI findings */
  findingCount: number;
  /** Risk level assessment */
  riskLevel: RiskLevel;
  /** Individual findings */
  findings: PhiFinding[];
  /** Redacted version of the text */
  redactedText: string;
  /** Original text length */
  originalLength: number;
  /** Context where scan was performed */
  context?: ScanContext;
}

/**
 * Batch scan result for multiple snippets
 */
export interface BatchScanResult {
  /** Total snippets scanned */
  totalSnippets: number;
  /** Snippets containing PHI */
  snippetsWithPhi: number;
  /** Total PHI findings across all snippets */
  totalFindings: number;
  /** Overall risk level (highest among snippets) */
  overallRisk: RiskLevel;
  /** Risk distribution */
  riskDistribution: Record<RiskLevel, number>;
  /** Finding type distribution */
  typeDistribution: Record<string, number>;
  /** Individual results */
  results: SnippetScanResult[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Options for snippet scanning
 */
export interface SnippetScanOptions {
  /** Include redacted text in results (default: true) */
  includeRedacted?: boolean;
  /** Include full findings in results (default: true) */
  includeFindings?: boolean;
  /** Maximum snippet length to scan (longer will be truncated) */
  maxSnippetLength?: number;
  /** Context for the scan */
  context?: ScanContext;
  /** Minimum confidence threshold for findings (0-1) */
  minConfidence?: number;
}

/**
 * Snippet metadata for batch processing
 */
export interface SnippetInput {
  /** Unique identifier */
  id: string;
  /** Text content to scan */
  text: string;
  /** Source identifier (e.g., paper ID, file path) */
  source: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * PHI Snippet Scanner class
 *
 * Specialized scanner for processing text snippets from various sources
 * with batch scanning, risk assessment, and detailed reporting.
 */
export class PhiSnippetScanner {
  private scanner: PhiScanner;
  private defaultOptions: SnippetScanOptions = {
    includeRedacted: true,
    includeFindings: true,
    maxSnippetLength: 100000,
    minConfidence: 0,
  };

  constructor(scanner?: PhiScanner) {
    this.scanner = scanner ?? new RegexPhiScanner();
  }

  /**
   * Scan a single text snippet
   */
  scanSnippet(
    text: string,
    snippetId: string,
    source: string,
    options?: SnippetScanOptions
  ): SnippetScanResult {
    const opts = { ...this.defaultOptions, ...options };

    // Truncate if needed
    let textToScan = text;
    if (opts.maxSnippetLength && text.length > opts.maxSnippetLength) {
      textToScan = text.substring(0, opts.maxSnippetLength);
    }

    // Scan for PHI
    let findings = this.scanner.scan(textToScan);

    // Filter by confidence threshold
    if (opts.minConfidence && opts.minConfidence > 0) {
      findings = findings.filter(f => f.confidence >= (opts.minConfidence ?? 0));
    }

    // Get redacted text if requested
    const redactedText = opts.includeRedacted
      ? this.scanner.redact(textToScan)
      : '';

    // Assess risk level
    const riskLevel = this.assessRiskLevel(findings);

    return {
      snippetId,
      source,
      hasPhi: findings.length > 0,
      findingCount: findings.length,
      riskLevel,
      findings: opts.includeFindings ? findings : [],
      redactedText,
      originalLength: text.length,
      context: opts.context,
    };
  }

  /**
   * Batch scan multiple snippets
   */
  scanBatch(
    snippets: SnippetInput[],
    options?: SnippetScanOptions
  ): BatchScanResult {
    const startTime = Date.now();
    const results: SnippetScanResult[] = [];

    // Initialize distributions
    const riskDistribution: Record<RiskLevel, number> = {
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
    };
    const typeDistribution: Record<string, number> = {};
    let totalFindings = 0;
    let snippetsWithPhi = 0;

    // Process each snippet
    for (const snippet of snippets) {
      const result = this.scanSnippet(
        snippet.text,
        snippet.id,
        snippet.source,
        options
      );
      results.push(result);

      // Update statistics
      riskDistribution[result.riskLevel]++;
      totalFindings += result.findingCount;
      if (result.hasPhi) {
        snippetsWithPhi++;
      }

      // Update type distribution
      for (const finding of result.findings) {
        typeDistribution[finding.type] = (typeDistribution[finding.type] || 0) + 1;
      }
    }

    // Determine overall risk
    const overallRisk = this.determineOverallRisk(riskDistribution);

    return {
      totalSnippets: snippets.length,
      snippetsWithPhi,
      totalFindings,
      overallRisk,
      riskDistribution,
      typeDistribution,
      results,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Scan literature items (papers with abstracts)
   */
  scanLiteratureItems(
    items: Array<{
      id: string;
      title?: string;
      abstract?: string;
      [key: string]: unknown;
    }>,
    options?: SnippetScanOptions
  ): BatchScanResult {
    const snippets: SnippetInput[] = items
      .filter(item => item.abstract || item.title)
      .map(item => ({
        id: item.id,
        text: [item.title, item.abstract].filter(Boolean).join('\n\n'),
        source: `paper:${item.id}`,
        metadata: { title: item.title },
      }));

    return this.scanBatch(snippets, {
      ...options,
      context: options?.context ?? 'export',
    });
  }

  /**
   * Scan OCR-extracted text snippets
   */
  scanOcrResults(
    ocrResults: Array<{
      pageNumber: number;
      text: string;
      source: string;
    }>,
    options?: SnippetScanOptions
  ): BatchScanResult {
    const snippets: SnippetInput[] = ocrResults.map((result, index) => ({
      id: `ocr-page-${result.pageNumber || index}`,
      text: result.text,
      source: result.source,
      metadata: { pageNumber: result.pageNumber },
    }));

    return this.scanBatch(snippets, {
      ...options,
      context: options?.context ?? 'upload',
    });
  }

  /**
   * Scan transcribed audio segments
   */
  scanTranscriptions(
    transcriptions: Array<{
      segmentId: string;
      text: string;
      startTime?: number;
      endTime?: number;
      source: string;
    }>,
    options?: SnippetScanOptions
  ): BatchScanResult {
    const snippets: SnippetInput[] = transcriptions.map(t => ({
      id: t.segmentId,
      text: t.text,
      source: t.source,
      metadata: { startTime: t.startTime, endTime: t.endTime },
    }));

    return this.scanBatch(snippets, {
      ...options,
      context: options?.context ?? 'upload',
    });
  }

  /**
   * Assess risk level based on findings
   */
  private assessRiskLevel(findings: PhiFinding[]): RiskLevel {
    if (findings.length === 0) {
      return 'none';
    }

    // High-risk PHI types
    const highRiskTypes = new Set(['SSN', 'MRN', 'HEALTH_PLAN', 'ACCOUNT']);
    const mediumRiskTypes = new Set(['DOB', 'NAME', 'ADDRESS', 'PHONE']);

    let maxRisk: RiskLevel = 'low';

    for (const finding of findings) {
      if (highRiskTypes.has(finding.type)) {
        return 'high'; // Immediate high risk
      }
      if (mediumRiskTypes.has(finding.type) && finding.confidence > 0.7) {
        maxRisk = 'medium';
      }
    }

    // Multiple findings increase risk
    if (findings.length >= 5) {
      return maxRisk === 'low' ? 'medium' : maxRisk;
    }

    return maxRisk;
  }

  /**
   * Determine overall risk from distribution
   */
  private determineOverallRisk(
    distribution: Record<RiskLevel, number>
  ): RiskLevel {
    if (distribution.high > 0) return 'high';
    if (distribution.medium > 0) return 'medium';
    if (distribution.low > 0) return 'low';
    return 'none';
  }

  /**
   * Generate a summary report
   */
  generateReport(batchResult: BatchScanResult): string {
    const lines: string[] = [
      '# PHI Scan Report',
      '',
      '## Summary',
      '',
      `- **Total Snippets Scanned:** ${batchResult.totalSnippets}`,
      `- **Snippets with PHI:** ${batchResult.snippetsWithPhi}`,
      `- **Total Findings:** ${batchResult.totalFindings}`,
      `- **Overall Risk Level:** ${batchResult.overallRisk.toUpperCase()}`,
      `- **Processing Time:** ${batchResult.processingTimeMs}ms`,
      '',
      '## Risk Distribution',
      '',
      `| Risk Level | Count |`,
      `|------------|-------|`,
      `| None | ${batchResult.riskDistribution.none} |`,
      `| Low | ${batchResult.riskDistribution.low} |`,
      `| Medium | ${batchResult.riskDistribution.medium} |`,
      `| High | ${batchResult.riskDistribution.high} |`,
      '',
    ];

    if (Object.keys(batchResult.typeDistribution).length > 0) {
      lines.push('## PHI Type Distribution', '');
      lines.push('| Type | Count |');
      lines.push('|------|-------|');
      for (const [type, count] of Object.entries(batchResult.typeDistribution)) {
        lines.push(`| ${type} | ${count} |`);
      }
      lines.push('');
    }

    if (batchResult.snippetsWithPhi > 0) {
      lines.push('## Snippets Requiring Review', '');
      const riskyResults = batchResult.results
        .filter(r => r.hasPhi)
        .sort((a, b) => {
          const riskOrder = { high: 0, medium: 1, low: 2, none: 3 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        });

      for (const result of riskyResults.slice(0, 20)) {
        lines.push(`### ${result.snippetId} (${result.riskLevel.toUpperCase()})`);
        lines.push(`- Source: ${result.source}`);
        lines.push(`- Findings: ${result.findingCount}`);
        if (result.findings.length > 0) {
          lines.push(`- Types: ${[...new Set(result.findings.map(f => f.type))].join(', ')}`);
        }
        lines.push('');
      }

      if (riskyResults.length > 20) {
        lines.push(`*... and ${riskyResults.length - 20} more snippets*`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Factory function to create a snippet scanner
 */
export function createSnippetScanner(scanner?: PhiScanner): PhiSnippetScanner {
  return new PhiSnippetScanner(scanner);
}
