/**
 * PHI Audit Service
 * Phase 1.3: Aggregates PHI findings across all three layers
 * 
 * Collects results from:
 * - Layer 1: Input Scan Middleware
 * - Layer 2: AI Router Processing Guard
 * - Layer 3: Pre-Export Gate
 * 
 * Generates comprehensive audit reports for governance dashboard.
 */

import { db } from '../../db';
import { logAction } from '../services/audit-service';
import { scrubLog } from '@researchflow/phi-engine';

export interface PhiFinding {
  type: string;
  location: 'input' | 'processing' | 'output' | 'export';
  layer: 1 | 2 | 3;
  sectionOrEndpoint: string;
  count: number;
  detectedAt: string;
  mode: string;
  resolution?: 'blocked' | 'redacted' | 'allowed' | 'pending';
}

export interface PhiAuditReport {
  id: string;
  manuscriptId: string;
  generatedAt: string;
  generatedBy: string;
  totalFindings: number;
  findingsByLayer: Record<number, number>;
  findingsByType: Record<string, number>;
  findingsByLocation: Record<string, number>;
  findings: PhiFinding[];
  recommendations: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  complianceStatus: 'compliant' | 'review_required' | 'non_compliant';
}

export interface PhiScanRecord {
  manuscriptId: string;
  scanType: 'input' | 'processing' | 'export';
  layer: number;
  findings: Record<string, number>;
  totalFindings: number;
  passed: boolean;
  mode: string;
  scannedAt: string;
  userId?: string;
  endpoint?: string;
  section?: string;
}

/**
 * PHI Audit Service
 */
export class PhiAuditService {
  private scanRecords: Map<string, PhiScanRecord[]> = new Map();
  
  /**
   * Record a PHI scan result from any layer
   */
  async recordScan(record: PhiScanRecord): Promise<void> {
    const key = record.manuscriptId;
    
    if (!this.scanRecords.has(key)) {
      this.scanRecords.set(key, []);
    }
    
    this.scanRecords.get(key)!.push(record);
    
    // Persist to database if PHI found
    if (record.totalFindings > 0) {
      try {
        // Log to audit trail (actual DB persist would use drizzle ORM)
        await logAction({
          eventType: 'PHI_SCAN_RECORDED',
          action: `LAYER_${record.layer}_SCAN`,
          resourceType: 'MANUSCRIPT',
          resourceId: record.manuscriptId,
          userId: record.userId || 'system',
          details: {
            layer: record.layer,
            scanType: record.scanType,
            totalFindings: record.totalFindings,
            findingTypes: Object.keys(record.findings),
            mode: record.mode,
            passed: record.passed
          },
          severity: record.totalFindings > 10 ? 'HIGH' : 'MEDIUM'
        });
      } catch (error) {
        console.error('[PhiAuditService] Failed to persist scan record:', scrubLog(String(error)));
      }
    }
  }
  
  /**
   * Generate comprehensive PHI audit report for a manuscript
   */
  async generateReport(manuscriptId: string, userId: string): Promise<PhiAuditReport> {
    const records = this.scanRecords.get(manuscriptId) || [];
    
    const findings: PhiFinding[] = [];
    const findingsByLayer: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const findingsByType: Record<string, number> = {};
    const findingsByLocation: Record<string, number> = {};
    
    // Process all scan records
    for (const record of records) {
      findingsByLayer[record.layer] = (findingsByLayer[record.layer] || 0) + record.totalFindings;
      
      for (const [type, count] of Object.entries(record.findings)) {
        findingsByType[type] = (findingsByType[type] || 0) + count;
        findingsByLocation[record.scanType] = (findingsByLocation[record.scanType] || 0) + count;
        
        findings.push({
          type,
          location: record.scanType,
          layer: record.layer as 1 | 2 | 3,
          sectionOrEndpoint: record.endpoint || record.section || 'unknown',
          count,
          detectedAt: record.scannedAt,
          mode: record.mode,
          resolution: record.passed ? 'allowed' : (record.mode === 'LIVE' ? 'blocked' : 'redacted')
        });
      }
    }
    
    const totalFindings = Object.values(findingsByLayer).reduce((a, b) => a + b, 0);
    
    // Determine risk level
    let riskLevel: PhiAuditReport['riskLevel'] = 'none';
    if (totalFindings > 0) {
      if (totalFindings > 50) riskLevel = 'critical';
      else if (totalFindings > 20) riskLevel = 'high';
      else if (totalFindings > 5) riskLevel = 'medium';
      else riskLevel = 'low';
    }
    
    // Determine compliance status
    let complianceStatus: PhiAuditReport['complianceStatus'] = 'compliant';
    const hasUnresolvedFindings = findings.some(f => f.resolution === 'allowed' && f.location === 'export');
    if (hasUnresolvedFindings) {
      complianceStatus = 'non_compliant';
    } else if (totalFindings > 0) {
      complianceStatus = 'review_required';
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(findings, findingsByType);
    
    const report: PhiAuditReport = {
      id: `phi-audit-${manuscriptId}-${Date.now()}`,
      manuscriptId,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      totalFindings,
      findingsByLayer,
      findingsByType,
      findingsByLocation,
      findings,
      recommendations,
      riskLevel,
      complianceStatus
    };
    
    // Log report generation
    await logAction({
      eventType: 'PHI_AUDIT_REPORT_GENERATED',
      action: 'GENERATE_REPORT',
      resourceType: 'MANUSCRIPT',
      resourceId: manuscriptId,
      userId,
      details: {
        reportId: report.id,
        totalFindings,
        riskLevel,
        complianceStatus
      },
      severity: riskLevel === 'critical' || riskLevel === 'high' ? 'HIGH' : 'INFO'
    });
    
    return report;
  }
  
  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(
    findings: PhiFinding[],
    findingsByType: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];
    
    if (Object.keys(findingsByType).length === 0) {
      recommendations.push('No PHI detected. Manuscript is compliant for export.');
      return recommendations;
    }
    
    // Type-specific recommendations
    if (findingsByType['NAME'] || findingsByType['PERSON']) {
      recommendations.push('Replace patient names with pseudonyms or initials (e.g., "Patient A").');
    }
    
    if (findingsByType['MRN'] || findingsByType['MEDICAL_RECORD']) {
      recommendations.push('Remove or replace Medical Record Numbers with study IDs.');
    }
    
    if (findingsByType['DATE'] || findingsByType['DOB']) {
      recommendations.push('Convert specific dates to relative timeframes (e.g., "Day 1", "Week 2").');
    }
    
    if (findingsByType['PHONE'] || findingsByType['EMAIL']) {
      recommendations.push('Remove all contact information from manuscript text.');
    }
    
    if (findingsByType['ADDRESS'] || findingsByType['LOCATION']) {
      recommendations.push('Remove or generalize geographic identifiers.');
    }
    
    if (findingsByType['SSN'] || findingsByType['INSURANCE']) {
      recommendations.push('CRITICAL: Remove all Social Security Numbers and insurance identifiers immediately.');
    }
    
    // Layer-specific recommendations
    const inputFindings = findings.filter(f => f.location === 'input').length;
    const exportFindings = findings.filter(f => f.location === 'export').length;
    
    if (inputFindings > 0) {
      recommendations.push('PHI detected during data input. Consider using de-identification tools before upload.');
    }
    
    if (exportFindings > 0) {
      recommendations.push('PHI must be removed before export in LIVE mode.');
    }
    
    return recommendations;
  }
  
  /**
   * Get audit summary for governance dashboard
   */
  async getAuditSummary(manuscriptId: string): Promise<{
    totalScans: number;
    totalFindings: number;
    lastScanAt: string | null;
    riskLevel: string;
  }> {
    const records = this.scanRecords.get(manuscriptId) || [];
    
    const totalFindings = records.reduce((sum, r) => sum + r.totalFindings, 0);
    const lastScan = records.length > 0 
      ? records.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())[0]
      : null;
    
    let riskLevel = 'none';
    if (totalFindings > 50) riskLevel = 'critical';
    else if (totalFindings > 20) riskLevel = 'high';
    else if (totalFindings > 5) riskLevel = 'medium';
    else if (totalFindings > 0) riskLevel = 'low';
    
    return {
      totalScans: records.length,
      totalFindings,
      lastScanAt: lastScan?.scannedAt || null,
      riskLevel
    };
  }
  
  /**
   * Clear scan records for a manuscript (after export or deletion)
   */
  async clearRecords(manuscriptId: string): Promise<void> {
    this.scanRecords.delete(manuscriptId);
  }
}

// Singleton instance
export const phiAuditService = new PhiAuditService();

export default phiAuditService;
