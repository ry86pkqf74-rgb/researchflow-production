/**
 * Final PHI Scan Service
 * Task T97: CRITICAL - Final gate before export
 */

export interface FinalScanResult {
  passed: boolean;
  manuscriptId: string;
  scanTimestamp: Date;
  totalScanned: number;
  phiDetections: PhiDetection[];
  quarantinedItems: string[];
  attestationRequired: boolean;
  auditHash: string;
}

export interface PhiDetection {
  section: string;
  type: string;
  pattern: string;
  // GOVERNANCE: context field REMOVED - never expose PHI values
  // Only return location indices, not actual content
  startIndex: number;
  endIndex: number;
  severity: 'critical' | 'high' | 'medium';
  recommendation: string;
  // Stable identifier for tracking without exposing PHI
  detectionId: string;
}

export class FinalPhiScanService {
  /**
   * Perform comprehensive PHI scan before export
   * CRITICAL: This is the final gate before any data leaves the system
   */
  async performFinalScan(
    manuscriptId: string,
    content: Record<string, string>,
    userId: string
  ): Promise<FinalScanResult> {
    const detections: PhiDetection[] = [];
    let totalScanned = 0;

    // Scan each section
    for (const [section, text] of Object.entries(content)) {
      if (!text || text.trim().length === 0) continue;

      totalScanned++;
      const sectionDetections = await this.scanSection(section, text);
      detections.push(...sectionDetections);
    }

    // Determine if attestation is required
    const attestationRequired = detections.some(d =>
      d.severity === 'critical' || d.severity === 'high'
    );

    // Generate audit hash
    const auditHash = await this.generateAuditHash(manuscriptId, detections, userId);

    // Log audit entry
    await this.logAudit({
      manuscriptId,
      userId,
      action: 'final_phi_scan',
      timestamp: new Date(),
      detectionCount: detections.length,
      passed: detections.length === 0,
      auditHash
    });

    return {
      passed: detections.length === 0,
      manuscriptId,
      scanTimestamp: new Date(),
      totalScanned,
      phiDetections: detections,
      // GOVERNANCE: quarantinedItems now contains stable IDs, not PHI values
      quarantinedItems: detections.filter(d => d.severity === 'critical').map(d => d.detectionId),
      attestationRequired,
      auditHash
    };
  }

  /**
   * Scan individual section for PHI (HIPAA 18 identifiers)
   */
  private async scanSection(section: string, text: string): Promise<PhiDetection[]> {
    const detections: PhiDetection[] = [];

    // PHI patterns following HIPAA 18 identifiers
    const patterns = [
      // Names
      { type: 'name', pattern: /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, severity: 'critical' as const },
      // Dates of birth
      { type: 'dob', pattern: /\b(?:DOB|born|birth)[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi, severity: 'critical' as const },
      // SSN
      { type: 'ssn', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, severity: 'critical' as const },
      // MRN
      { type: 'mrn', pattern: /\b(?:MRN|medical\s+record)[:\s#]*[\d\-]+/gi, severity: 'critical' as const },
      // Phone numbers
      { type: 'phone', pattern: /\b(?:\+1\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, severity: 'high' as const },
      // Email addresses
      { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, severity: 'high' as const },
      // Street addresses
      { type: 'address', pattern: /\b\d+\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd)\b/gi, severity: 'high' as const },
      // ZIP codes
      { type: 'zip', pattern: /\b\d{5}(?:-\d{4})?\b/g, severity: 'medium' as const },
      // Account numbers
      { type: 'account', pattern: /\b(?:account|acct)[:\s#]*[\d\-]+/gi, severity: 'high' as const },
      // License/Certificate numbers
      { type: 'license', pattern: /\b(?:license|certificate)[:\s#]*[A-Z\d\-]+/gi, severity: 'medium' as const },
      // Vehicle identifiers
      { type: 'vehicle', pattern: /\b(?:VIN|plate)[:\s#]*[A-Z\d\-]+/gi, severity: 'medium' as const },
      // Device identifiers
      { type: 'device', pattern: /\b(?:serial|device\s+id)[:\s#]*[A-Z\d\-]+/gi, severity: 'medium' as const },
      // URLs with identifiers
      { type: 'url', pattern: /https?:\/\/[^\s]+(?:patient|record|id=)[^\s]*/gi, severity: 'high' as const },
      // IP addresses
      { type: 'ip', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, severity: 'medium' as const },
      // Biometric identifiers
      { type: 'biometric', pattern: /\b(?:fingerprint|retina|voiceprint)[:\s]*[^\s]+/gi, severity: 'critical' as const },
      // Photos
      { type: 'photo', pattern: /\b(?:photograph|photo)\s+(?:of|showing)\s+(?:patient|subject)/gi, severity: 'critical' as const }
    ];

    for (const { type, pattern, severity } of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // GOVERNANCE: Generate stable detection ID without exposing PHI
        const detectionId = this.generateDetectionId(section, type, match.index, match.index + match[0].length);
        detections.push({
          section,
          type,
          pattern: pattern.source,
          // REMOVED: context field - never expose PHI values
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          severity,
          recommendation: this.getRecommendation(type),
          detectionId
        });
      }
    }

    return detections;
  }

  /**
   * GOVERNANCE: Generate stable detection ID without exposing PHI values
   * Format: {section}:{type}:{startIndex}:{endIndex}
   */
  private generateDetectionId(section: string, type: string, startIndex: number, endIndex: number): string {
    return `${section}:${type}:${startIndex}:${endIndex}`;
  }

  // REMOVED: getContext method - was exposing PHI values
  // private getContext(text: string, index: number, windowSize: number): string { ... }

  private getRecommendation(type: string): string {
    const recommendations: Record<string, string> = {
      name: 'Replace with "Patient A" or use pseudonyms',
      dob: 'Remove specific dates; use age instead',
      ssn: 'Remove completely - never include SSN',
      mrn: 'Remove or use study-specific ID',
      phone: 'Remove phone numbers completely',
      email: 'Remove email addresses completely',
      address: 'Use general geographic region only',
      zip: 'Remove or truncate to first 3 digits',
      account: 'Remove account numbers completely',
      license: 'Remove license/certificate numbers',
      vehicle: 'Remove vehicle identifiers',
      device: 'Remove device identifiers',
      url: 'Remove URLs containing identifiers',
      ip: 'Remove IP addresses',
      biometric: 'Remove biometric identifiers',
      photo: 'Ensure no identifiable photos included'
    };

    return recommendations[type] || 'Review and remove potential identifier';
  }

  private async generateAuditHash(
    manuscriptId: string,
    detections: PhiDetection[],
    userId: string
  ): Promise<string> {
    const data = JSON.stringify({
      manuscriptId,
      detectionCount: detections.length,
      userId,
      timestamp: new Date().toISOString()
    });

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async logAudit(entry: {
    manuscriptId: string;
    userId: string;
    action: string;
    timestamp: Date;
    detectionCount: number;
    passed: boolean;
    auditHash: string;
  }): Promise<void> {
    // In production, log to audit database
    console.log('[AUDIT]', JSON.stringify(entry));
  }
}

export const finalPhiScanService = new FinalPhiScanService();
