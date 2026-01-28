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
import { RegexPhiScanner } from './regex-scanner';
/**
 * PHI Snippet Scanner class
 *
 * Specialized scanner for processing text snippets from various sources
 * with batch scanning, risk assessment, and detailed reporting.
 */
export class PhiSnippetScanner {
    scanner;
    defaultOptions = {
        includeRedacted: true,
        includeFindings: true,
        maxSnippetLength: 100000,
        minConfidence: 0,
    };
    constructor(scanner) {
        this.scanner = scanner ?? new RegexPhiScanner();
    }
    /**
     * Scan a single text snippet
     */
    scanSnippet(text, snippetId, source, options) {
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
    scanBatch(snippets, options) {
        const startTime = Date.now();
        const results = [];
        // Initialize distributions
        const riskDistribution = {
            none: 0,
            low: 0,
            medium: 0,
            high: 0,
        };
        const typeDistribution = {};
        let totalFindings = 0;
        let snippetsWithPhi = 0;
        // Process each snippet
        for (const snippet of snippets) {
            const result = this.scanSnippet(snippet.text, snippet.id, snippet.source, options);
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
    scanLiteratureItems(items, options) {
        const snippets = items
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
    scanOcrResults(ocrResults, options) {
        const snippets = ocrResults.map((result, index) => ({
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
    scanTranscriptions(transcriptions, options) {
        const snippets = transcriptions.map(t => ({
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
    assessRiskLevel(findings) {
        if (findings.length === 0) {
            return 'none';
        }
        // High-risk PHI types
        const highRiskTypes = new Set(['SSN', 'MRN', 'HEALTH_PLAN', 'ACCOUNT']);
        const mediumRiskTypes = new Set(['DOB', 'NAME', 'ADDRESS', 'PHONE']);
        let maxRisk = 'low';
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
    determineOverallRisk(distribution) {
        if (distribution.high > 0)
            return 'high';
        if (distribution.medium > 0)
            return 'medium';
        if (distribution.low > 0)
            return 'low';
        return 'none';
    }
    /**
     * Generate a summary report
     */
    generateReport(batchResult) {
        const lines = [
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
export function createSnippetScanner(scanner) {
    return new PhiSnippetScanner(scanner);
}
//# sourceMappingURL=snippet-scanner.js.map