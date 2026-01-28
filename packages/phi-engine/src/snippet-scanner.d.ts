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
export declare class PhiSnippetScanner {
    private scanner;
    private defaultOptions;
    constructor(scanner?: PhiScanner);
    /**
     * Scan a single text snippet
     */
    scanSnippet(text: string, snippetId: string, source: string, options?: SnippetScanOptions): SnippetScanResult;
    /**
     * Batch scan multiple snippets
     */
    scanBatch(snippets: SnippetInput[], options?: SnippetScanOptions): BatchScanResult;
    /**
     * Scan literature items (papers with abstracts)
     */
    scanLiteratureItems(items: Array<{
        id: string;
        title?: string;
        abstract?: string;
        [key: string]: unknown;
    }>, options?: SnippetScanOptions): BatchScanResult;
    /**
     * Scan OCR-extracted text snippets
     */
    scanOcrResults(ocrResults: Array<{
        pageNumber: number;
        text: string;
        source: string;
    }>, options?: SnippetScanOptions): BatchScanResult;
    /**
     * Scan transcribed audio segments
     */
    scanTranscriptions(transcriptions: Array<{
        segmentId: string;
        text: string;
        startTime?: number;
        endTime?: number;
        source: string;
    }>, options?: SnippetScanOptions): BatchScanResult;
    /**
     * Assess risk level based on findings
     */
    private assessRiskLevel;
    /**
     * Determine overall risk from distribution
     */
    private determineOverallRisk;
    /**
     * Generate a summary report
     */
    generateReport(batchResult: BatchScanResult): string;
}
/**
 * Factory function to create a snippet scanner
 */
export declare function createSnippetScanner(scanner?: PhiScanner): PhiSnippetScanner;
