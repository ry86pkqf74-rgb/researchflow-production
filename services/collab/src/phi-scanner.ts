/**
 * PHI Scanner for Collaborative Edits
 *
 * Implements debounced periodic scanning strategy:
 * - Does NOT scan every keystroke (performance)
 * - Scans every 30 seconds or on "commit revision"
 * - Reports location metadata only (never logs PHI text)
 * - Consumes patterns from @researchflow/phi-engine when available
 *
 * This scanner is designed to reduce drift from the central phi-engine
 * by dynamically importing patterns rather than duplicating them.
 */

import type * as Y from "yjs";

/**
 * PHI finding with location-only metadata
 * Note: Never includes the actual PHI text value - uses [REDACTED] instead
 */
export interface PhiLocationReport {
  /** PHI type detected */
  type: string;
  /** Character offset in the document */
  startOffset: number;
  /** Character offset end */
  endOffset: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Approximate section/path in document structure */
  location?: string;
  /** Redacted placeholder (never actual PHI) */
  redactedValue: "[REDACTED]";
}

/**
 * Scan result with aggregate metadata
 */
export interface PhiScanResult {
  /** Document identifier */
  documentName: string;
  /** Timestamp of scan */
  scannedAt: Date;
  /** Total PHI findings count */
  findingsCount: number;
  /** Findings by type (counts only) */
  findingsByType: Record<string, number>;
  /** Location metadata for each finding (no PHI text) */
  locations: PhiLocationReport[];
  /** Risk level based on findings */
  riskLevel: "none" | "low" | "medium" | "high";
  /** Scan duration in milliseconds */
  scanDurationMs: number;
}

/**
 * Logger interface for PHI scanner
 */
export interface PhiScannerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console-based logger
 */
const defaultLogger: PhiScannerLogger = {
  info(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.log(
      JSON.stringify({ timestamp, level: "info", source: "collab-phi-scanner", message, ...meta })
    );
  },
  warn(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.warn(
      JSON.stringify({ timestamp, level: "warn", source: "collab-phi-scanner", message, ...meta })
    );
  },
  error(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    console.error(
      JSON.stringify({ timestamp, level: "error", source: "collab-phi-scanner", message, ...meta })
    );
  },
};

/**
 * PHI Scanner interface (matches @researchflow/phi-engine)
 */
interface PhiEngineScanner {
  scan(text: string): Array<{
    type: string;
    value: string;
    startIndex: number;
    endIndex: number;
    confidence: number;
  }>;
  hasPhi(text: string): boolean;
  redact(text: string): string;
}

/**
 * Configuration for PHI scanner
 */
export interface PhiScannerConfig {
  /** Debounce interval in milliseconds (default: 30000 = 30 seconds) */
  debounceMs?: number;
  /** Logger instance */
  logger?: PhiScannerLogger;
  /** Custom PHI scanner (falls back to minimal patterns if not provided) */
  scanner?: PhiEngineScanner;
}

/**
 * Document scan state tracking
 */
interface DocumentScanState {
  /** Timer handle for debounced scan */
  timer: ReturnType<typeof setTimeout> | null;
  /** Last scan result */
  lastResult: PhiScanResult | null;
  /** Content hash of last scanned content (to avoid rescanning unchanged) */
  lastContentHash: string | null;
  /** Last scan timestamp */
  lastScanTime: number;
}

/**
 * Minimal high-confidence fallback patterns
 * Only used when @researchflow/phi-engine is not available
 * Kept intentionally small to reduce drift - prefer consuming phi-engine patterns
 */
const MINIMAL_FALLBACK_PATTERNS: Array<{
  type: string;
  regex: RegExp;
  baseConfidence: number;
}> = [
  // SSN - Very high confidence, distinctive format
  {
    type: "SSN",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    baseConfidence: 0.95,
  },
  // MRN - High confidence with explicit label
  {
    type: "MRN",
    regex: /\b(?:MRN|Medical Record|Patient ID)[:\s#]*([A-Z0-9]{6,12})\b/gi,
    baseConfidence: 0.90,
  },
  // Phone - Standard US format
  {
    type: "PHONE",
    regex: /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    baseConfidence: 0.80,
  },
  // Email - Standard format
  {
    type: "EMAIL",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    baseConfidence: 0.85,
  },
  // DOB - With explicit label for higher confidence
  {
    type: "DOB",
    regex: /\b(?:DOB|Date of Birth|Birth Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
    baseConfidence: 0.90,
  },
];

/**
 * Collaborative document PHI scanner
 *
 * Implements debounced scanning strategy to avoid performance impact
 * while still catching PHI in collaborative edits.
 *
 * Key design principle: Consume @researchflow/phi-engine patterns when available
 * to reduce drift between scanners. Falls back to minimal high-confidence patterns only.
 */
export class CollabPhiScanner {
  private readonly debounceMs: number;
  private readonly logger: PhiScannerLogger;
  private readonly scanner: PhiEngineScanner | null;
  private readonly documentStates: Map<string, DocumentScanState> = new Map();

  constructor(config: PhiScannerConfig = {}) {
    this.debounceMs = config.debounceMs ?? 30000; // 30 seconds default
    this.logger = config.logger ?? defaultLogger;
    this.scanner = config.scanner ?? null;
  }

  /**
   * Schedule a debounced scan for a document
   *
   * This should be called when document content changes.
   * The actual scan will be delayed by debounceMs.
   */
  scheduleScan(documentName: string, getContent: () => string): void {
    let state = this.documentStates.get(documentName);

    if (!state) {
      state = {
        timer: null,
        lastResult: null,
        lastContentHash: null,
        lastScanTime: 0,
      };
      this.documentStates.set(documentName, state);
    }

    // Clear existing timer
    if (state.timer) {
      clearTimeout(state.timer);
    }

    // Schedule new scan
    state.timer = setTimeout(() => {
      this.performScan(documentName, getContent).catch((error) => {
        this.logger.error("Scheduled PHI scan failed", {
          documentName,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.debounceMs);
  }

  /**
   * Cancel any scheduled scan for a document
   */
  cancelScheduledScan(documentName: string): void {
    const state = this.documentStates.get(documentName);
    if (state?.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  /**
   * Force immediate scan (bypasses debounce)
   *
   * Use this for "commit revision" actions where we want
   * to ensure PHI is scanned before persisting.
   */
  async forceScan(documentName: string, content: string): Promise<PhiScanResult> {
    // Cancel any scheduled scan
    this.cancelScheduledScan(documentName);

    // Perform immediate scan
    return this.performScan(documentName, () => content);
  }

  /**
   * Get last scan result for a document
   */
  getLastResult(documentName: string): PhiScanResult | null {
    return this.documentStates.get(documentName)?.lastResult ?? null;
  }

  /**
   * Clear state for a document (call on document close)
   */
  clearDocumentState(documentName: string): void {
    this.cancelScheduledScan(documentName);
    this.documentStates.delete(documentName);
  }

  /**
   * Clear all document states
   */
  clearAll(): void {
    for (const [documentName] of this.documentStates) {
      this.cancelScheduledScan(documentName);
    }
    this.documentStates.clear();
  }

  /**
   * Perform the actual PHI scan
   */
  private async performScan(
    documentName: string,
    getContent: () => string
  ): Promise<PhiScanResult> {
    const startTime = Date.now();

    let state = this.documentStates.get(documentName);
    if (!state) {
      state = {
        timer: null,
        lastResult: null,
        lastContentHash: null,
        lastScanTime: 0,
      };
      this.documentStates.set(documentName, state);
    }

    state.timer = null;

    try {
      const content = getContent();

      // Check if content has changed using simple hash
      const contentHash = this.simpleHash(content);
      if (contentHash === state.lastContentHash) {
        this.logger.info("Skipping PHI scan: content unchanged", { documentName });
        if (state.lastResult) {
          return state.lastResult;
        }
      }

      // Perform scan using phi-engine or fallback
      const findings = this.scanContent(content);

      // Build location-only report (never include PHI text - always [REDACTED])
      const locations: PhiLocationReport[] = findings.map((finding) => ({
        type: finding.type,
        startOffset: finding.startIndex,
        endOffset: finding.endIndex,
        confidence: finding.confidence,
        location: this.estimateLocation(content, finding.startIndex),
        redactedValue: "[REDACTED]" as const,
      }));

      // Aggregate by type
      const findingsByType: Record<string, number> = {};
      for (const finding of findings) {
        findingsByType[finding.type] = (findingsByType[finding.type] ?? 0) + 1;
      }

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(findings);

      const result: PhiScanResult = {
        documentName,
        scannedAt: new Date(),
        findingsCount: findings.length,
        findingsByType,
        locations,
        riskLevel,
        scanDurationMs: Date.now() - startTime,
      };

      // Update state
      state.lastResult = result;
      state.lastContentHash = contentHash;
      state.lastScanTime = Date.now();

      // Log scan result (without PHI - only counts and types)
      this.logger.info("PHI scan completed", {
        documentName,
        findingsCount: result.findingsCount,
        findingsByType: result.findingsByType,
        riskLevel: result.riskLevel,
        scanDurationMs: result.scanDurationMs,
      });

      // Warn on high-risk findings
      if (riskLevel === "high") {
        this.logger.warn("High-risk PHI detected in document", {
          documentName,
          findingsCount: result.findingsCount,
          findingsByType: result.findingsByType,
        });
      }

      return result;
    } catch (error) {
      this.logger.error("PHI scan failed", {
        documentName,
        error: error instanceof Error ? error.message : String(error),
        scanDurationMs: Date.now() - startTime,
      });

      // Return empty result on error
      return {
        documentName,
        scannedAt: new Date(),
        findingsCount: 0,
        findingsByType: {},
        locations: [],
        riskLevel: "none",
        scanDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Scan content using available scanner
   * Returns findings with [REDACTED] instead of actual values
   */
  private scanContent(
    content: string
  ): Array<{
    type: string;
    startIndex: number;
    endIndex: number;
    confidence: number;
  }> {
    // Try to use provided phi-engine scanner
    if (this.scanner) {
      try {
        const findings = this.scanner.scan(content);
        // Note: We intentionally discard the 'value' field to never expose raw PHI
        return findings.map((f) => ({
          type: f.type,
          startIndex: f.startIndex,
          endIndex: f.endIndex,
          confidence: f.confidence,
        }));
      } catch (error) {
        this.logger.warn("PHI engine scanner failed, using minimal fallback", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback to minimal high-confidence patterns
    return this.scanWithMinimalPatterns(content);
  }

  /**
   * Scan using minimal fallback regex patterns
   * Only includes high-confidence patterns (SSN, MRN, PHONE, EMAIL, DOB)
   */
  private scanWithMinimalPatterns(
    content: string
  ): Array<{
    type: string;
    startIndex: number;
    endIndex: number;
    confidence: number;
  }> {
    const findings: Array<{
      type: string;
      startIndex: number;
      endIndex: number;
      confidence: number;
    }> = [];

    for (const pattern of MINIMAL_FALLBACK_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        findings.push({
          type: pattern.type,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: pattern.baseConfidence,
        });
      }
    }

    return findings.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Calculate risk level based on findings
   */
  private calculateRiskLevel(
    findings: Array<{ type: string; confidence: number }>
  ): "none" | "low" | "medium" | "high" {
    if (findings.length === 0) {
      return "none";
    }

    // High risk types
    const highRiskTypes = ["SSN", "MRN", "DOB"];
    const hasHighRisk = findings.some(
      (f) => highRiskTypes.includes(f.type) && f.confidence >= 0.8
    );
    if (hasHighRisk) {
      return "high";
    }

    // Medium risk: multiple findings or moderate confidence
    const mediumRiskTypes = ["NAME", "PHONE", "EMAIL", "ADDRESS"];
    const mediumRiskFindings = findings.filter(
      (f) => mediumRiskTypes.includes(f.type) && f.confidence >= 0.7
    );
    if (mediumRiskFindings.length >= 2 || findings.length >= 5) {
      return "medium";
    }

    return "low";
  }

  /**
   * Estimate document location from character offset
   *
   * Returns approximate position like "line 5, paragraph 2"
   */
  private estimateLocation(content: string, offset: number): string {
    const beforeOffset = content.slice(0, offset);
    const lines = beforeOffset.split("\n");
    const lineNumber = lines.length;
    const paragraphs = beforeOffset.split(/\n\s*\n/).length;

    return `line ${lineNumber}, paragraph ${paragraphs}`;
  }

  /**
   * Simple non-cryptographic hash for content comparison
   */
  private simpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}

/**
 * Create PHI scanner, attempting to use @researchflow/phi-engine
 *
 * This factory function tries to dynamically import the phi-engine package
 * to consume its patterns and scanner implementation, reducing drift between
 * the collab scanner and the central phi-engine.
 */
export async function createPhiScanner(
  config: Omit<PhiScannerConfig, "scanner"> = {}
): Promise<CollabPhiScanner> {
  const logger = config.logger ?? defaultLogger;

  // Try to dynamically import @researchflow/phi-engine
  let scanner: PhiEngineScanner | undefined;
  try {
    const phiEngine = await import("@researchflow/phi-engine");
    if (phiEngine.RegexPhiScanner) {
      scanner = new phiEngine.RegexPhiScanner();
      logger.info("Using @researchflow/phi-engine for PHI scanning - drift minimized");
    }
  } catch {
    logger.info(
      "@researchflow/phi-engine not available, using minimal high-confidence fallback patterns (SSN, MRN, PHONE, EMAIL, DOB)"
    );
  }

  return new CollabPhiScanner({
    ...config,
    scanner,
  });
}

/**
 * Extract text content from a Yjs document
 *
 * This handles common Yjs structures used in collaborative editors.
 */
export function extractTextFromYDoc(doc: Y.Doc): string {
  const parts: string[] = [];

  // Check for common shared types
  const sharedTypes = ["content", "text", "document", "root"];

  for (const name of sharedTypes) {
    try {
      const yText = doc.getText(name);
      if (yText && yText.length > 0) {
        parts.push(yText.toString());
      }
    } catch {
      // Type doesn't exist or isn't text
    }

    try {
      const yXml = doc.getXmlFragment(name);
      if (yXml) {
        parts.push(extractTextFromXml(yXml));
      }
    } catch {
      // Type doesn't exist or isn't XML
    }
  }

  // Also check all shared types
  doc.share.forEach((type, _name) => {
    try {
      if ("toString" in type && typeof type.toString === "function") {
        const text = type.toString();
        if (text && !parts.includes(text)) {
          parts.push(text);
        }
      }
    } catch {
      // Ignore extraction errors
    }
  });

  return parts.join("\n\n");
}

/**
 * Extract text from XML fragment (for ProseMirror/TipTap documents)
 */
function extractTextFromXml(xml: Y.XmlFragment | Y.XmlElement | Y.XmlText): string {
  if ("toString" in xml && typeof xml.toString === "function") {
    // Strip XML tags for plain text
    return xml.toString().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}
