/**
 * Presidio Adapter (Task 66)
 *
 * Integrates Microsoft Presidio for ML-based NER PHI detection.
 * Extends the regex scanner with more sophisticated entity recognition.
 *
 * IMPORTANT: Never returns matched text values, only types and offsets.
 */

import type { PhiFinding, PhiScanner, RiskLevel } from '../types';
import { RegexPhiScanner } from '../regex-scanner';

/**
 * Presidio analyzer request format
 */
interface PresidioAnalyzeRequest {
  text: string;
  language: string;
  entities?: string[];
  correlation_id?: string;
  score_threshold?: number;
  return_decision_process?: boolean;
  ad_hoc_recognizers?: unknown[];
}

/**
 * Presidio analyzer response format
 */
interface PresidioAnalyzeResponse {
  entity_type: string;
  start: number;
  end: number;
  score: number;
  analysis_explanation?: {
    recognizer: string;
    pattern_name?: string;
    pattern?: string;
    original_score: number;
    score: number;
    textual_explanation?: string;
    score_context_improvement: number;
    supportive_context_word: string;
    validation_result: unknown;
  };
}

/**
 * Presidio configuration
 */
export interface PresidioConfig {
  analyzerUrl: string;
  anonymizerUrl?: string;
  language?: string;
  scoreThreshold?: number;
  entities?: string[];
  timeout?: number;
}

/**
 * Map Presidio entity types to our PHI types
 */
const PRESIDIO_TYPE_MAP: Record<string, PhiFinding['type']> = {
  'PERSON': 'NAME',
  'PHONE_NUMBER': 'PHONE',
  'EMAIL_ADDRESS': 'EMAIL',
  'CREDIT_CARD': 'ACCOUNT',
  'US_SSN': 'SSN',
  'US_PASSPORT': 'LICENSE',
  'US_DRIVER_LICENSE': 'LICENSE',
  'DATE_TIME': 'DOB',
  'LOCATION': 'ADDRESS',
  'IP_ADDRESS': 'IP_ADDRESS',
  'MEDICAL_LICENSE': 'MRN',
  'US_BANK_NUMBER': 'ACCOUNT',
  'NRP': 'NAME', // Nationality, religion, political affiliation
  'URL': 'URL',
  'IBAN_CODE': 'ACCOUNT',
  'US_ITIN': 'SSN',
};

/**
 * Presidio-based PHI Scanner
 */
export class PresidioPhiScanner implements PhiScanner {
  private config: PresidioConfig;
  private enabled: boolean;
  private fallbackScanner: RegexPhiScanner;

  constructor(config?: Partial<PresidioConfig>) {
    this.config = {
      analyzerUrl: config?.analyzerUrl || process.env.PRESIDIO_SERVICE_URL || 'http://presidio-analyzer:8080',
      anonymizerUrl: config?.anonymizerUrl || process.env.PRESIDIO_ANONYMIZER_URL,
      language: config?.language || 'en',
      scoreThreshold: config?.scoreThreshold ?? parseFloat(process.env.PRESIDIO_CONFIDENCE_THRESHOLD || '0.7'),
      entities: config?.entities,
      timeout: config?.timeout || 10000,
    };

    this.enabled = process.env.PRESIDIO_ENABLED === 'true';
    this.fallbackScanner = new RegexPhiScanner();
  }

  /**
   * Scan text for PHI using Presidio
   */
  async scan(text: string): Promise<PhiFinding[]> {
    // Get regex findings first (always available)
    const regexFindings = this.fallbackScanner.scan(text);

    // If Presidio not enabled, return regex findings only
    if (!this.enabled) {
      return regexFindings;
    }

    try {
      // Call Presidio analyzer
      const presidioFindings = await this.callPresidio(text);

      // Combine and deduplicate findings
      return this.combineFindings(regexFindings, presidioFindings);
    } catch (error) {
      // Log error but don't fail - fall back to regex only
      console.error('Presidio scan failed, falling back to regex:', error);
      return regexFindings;
    }
  }

  /**
   * Synchronous scan - uses only regex scanner
   * Required by PhiScanner interface
   */
  scanSync(text: string): PhiFinding[] {
    return this.fallbackScanner.scan(text);
  }

  /**
   * Call Presidio analyzer service
   */
  private async callPresidio(text: string): Promise<PhiFinding[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const request: PresidioAnalyzeRequest = {
        text,
        language: this.config.language!,
        score_threshold: this.config.scoreThreshold,
        entities: this.config.entities,
      };

      const response = await fetch(`${this.config.analyzerUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Presidio returned ${response.status}: ${await response.text()}`);
      }

      const results: PresidioAnalyzeResponse[] = await response.json();

      return results.map(result => this.convertFinding(result, text));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert Presidio response to PhiFinding
   * IMPORTANT: Never include the matched text value
   */
  private convertFinding(result: PresidioAnalyzeResponse, text: string): PhiFinding {
    const mappedType = PRESIDIO_TYPE_MAP[result.entity_type] || 'UNKNOWN';

    // Calculate length without storing actual value
    const matchLength = result.end - result.start;

    return {
      type: mappedType,
      // CRITICAL: Use placeholder, never actual matched text
      value: `[PRESIDIO:${result.entity_type}:${matchLength}chars]`,
      startIndex: result.start,
      endIndex: result.end,
      confidence: result.score,
    };
  }

  /**
   * Combine regex and Presidio findings, deduplicating overlaps
   */
  private combineFindings(regexFindings: PhiFinding[], presidioFindings: PhiFinding[]): PhiFinding[] {
    const combined: PhiFinding[] = [];
    const covered = new Set<string>();

    // Helper to create a position key
    const posKey = (f: PhiFinding) => `${f.startIndex}-${f.endIndex}`;

    // Add Presidio findings first (generally more accurate)
    for (const pf of presidioFindings) {
      const key = posKey(pf);
      combined.push(pf);
      covered.add(key);
    }

    // Add non-overlapping regex findings
    for (const rf of regexFindings) {
      const key = posKey(rf);

      // Check for overlap with existing findings
      const overlaps = combined.some(cf =>
        (rf.startIndex >= cf.startIndex && rf.startIndex < cf.endIndex) ||
        (rf.endIndex > cf.startIndex && rf.endIndex <= cf.endIndex) ||
        (rf.startIndex <= cf.startIndex && rf.endIndex >= cf.endIndex)
      );

      if (!overlaps) {
        combined.push(rf);
      }
    }

    // Sort by position
    return combined.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Redact PHI from text
   */
  async redact(text: string): Promise<string> {
    const findings = await this.scan(text);

    // Sort by position descending to replace from end
    const sorted = [...findings].sort((a, b) => b.startIndex - a.startIndex);

    let redacted = text;
    for (const finding of sorted) {
      redacted =
        redacted.slice(0, finding.startIndex) +
        `[REDACTED:${finding.type}]` +
        redacted.slice(finding.endIndex);
    }

    return redacted;
  }

  /**
   * Synchronous redact - uses regex scanner
   */
  redactSync(text: string): string {
    return this.fallbackScanner.redact(text);
  }

  /**
   * Check if text contains PHI
   */
  async hasPhi(text: string): Promise<boolean> {
    const findings = await this.scan(text);
    return findings.length > 0;
  }

  /**
   * Synchronous hasPhi - uses regex scanner
   */
  hasPhiSync(text: string): boolean {
    return this.fallbackScanner.hasPhi(text);
  }

  /**
   * Check if Presidio integration is enabled
   */
  isPresidioEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Health check for Presidio service
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    if (!this.enabled) {
      return { healthy: true, latencyMs: 0 };
    }

    const start = Date.now();

    try {
      const response = await fetch(`${this.config.analyzerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Check if Presidio is available
 */
export function isPresidioAvailable(): boolean {
  return process.env.PRESIDIO_ENABLED === 'true';
}

/**
 * Create a Presidio scanner with optional config
 */
export function createPresidioScanner(config?: Partial<PresidioConfig>): PresidioPhiScanner {
  return new PresidioPhiScanner(config);
}

/**
 * Singleton instance
 */
let defaultPresidioScanner: PresidioPhiScanner | null = null;

export function getPresidioScanner(config?: Partial<PresidioConfig>): PresidioPhiScanner {
  if (!defaultPresidioScanner || config) {
    defaultPresidioScanner = new PresidioPhiScanner(config);
  }
  return defaultPresidioScanner;
}
