/**
 * PHI Pre-Export Gate
 * Phase 1.3: Layer 3 of Three-Layer PHI Audit
 * 
 * Final PHI scan before manuscript export.
 * Scans complete manuscript including figures, captions, and acknowledgements.
 */

import { FinalPhiScanService } from '@researchflow/manuscript-engine';
import { containsPhi, getPhiStats, scrubLog } from '@researchflow/phi-engine';
import { logAction } from '../services/audit-service';
import { getMode } from '../services/governance-config.service';

export interface ExportGateResult {
  passed: boolean;
  hasPhi: boolean;
  totalFindings: number;
  findingsBySection: Record<string, number>;
  scannedSections: string[];
  blockedReason?: string;
  mode: string;
  scanDurationMs: number;
}

export interface ManuscriptExportPayload {
  manuscriptId: string;
  title?: string;
  abstract?: string;
  introduction?: string;
  methods?: string;
  results?: string;
  discussion?: string;
  conclusion?: string;
  acknowledgements?: string;
  references?: string;
  figureCaptions?: string[];
  tableCaptions?: string[];
  supplementaryMaterial?: string;
}

/**
 * Scan a manuscript section for PHI
 */
function scanSection(content: string | undefined): { hasPhi: boolean; stats: Record<string, number> } {
  if (!content || content.length < 3) {
    return { hasPhi: false, stats: {} };
  }
  
  const hasPhi = containsPhi(content);
  const stats = hasPhi ? getPhiStats(content) : {};
  
  return { hasPhi, stats };
}

/**
 * Pre-Export PHI Gate
 * 
 * Validates that a manuscript is free of PHI before export.
 * 
 * @param manuscript - Complete manuscript payload to scan
 * @param userId - User requesting export (for audit)
 * @returns ExportGateResult with pass/fail status
 */
export async function phiPreExportGate(
  manuscript: ManuscriptExportPayload,
  userId: string
): Promise<ExportGateResult> {
  const startTime = Date.now();
  const governanceMode = await getMode();
  
  const findingsBySection: Record<string, number> = {};
  const scannedSections: string[] = [];
  let totalFindings = 0;
  
  // Define sections to scan
  const sections = [
    { name: 'title', content: manuscript.title },
    { name: 'abstract', content: manuscript.abstract },
    { name: 'introduction', content: manuscript.introduction },
    { name: 'methods', content: manuscript.methods },
    { name: 'results', content: manuscript.results },
    { name: 'discussion', content: manuscript.discussion },
    { name: 'conclusion', content: manuscript.conclusion },
    { name: 'acknowledgements', content: manuscript.acknowledgements },
    { name: 'references', content: manuscript.references },
    { name: 'supplementary', content: manuscript.supplementaryMaterial },
  ];
  
  // Scan each section
  for (const section of sections) {
    if (section.content) {
      scannedSections.push(section.name);
      const result = scanSection(section.content);
      
      if (result.hasPhi) {
        const sectionFindings = Object.values(result.stats).reduce((a, b) => a + b, 0);
        findingsBySection[section.name] = sectionFindings;
        totalFindings += sectionFindings;
      }
    }
  }
  
  // Scan figure captions
  if (manuscript.figureCaptions && manuscript.figureCaptions.length > 0) {
    scannedSections.push('figureCaptions');
    for (const caption of manuscript.figureCaptions) {
      const result = scanSection(caption);
      if (result.hasPhi) {
        const findings = Object.values(result.stats).reduce((a, b) => a + b, 0);
        findingsBySection['figureCaptions'] = (findingsBySection['figureCaptions'] || 0) + findings;
        totalFindings += findings;
      }
    }
  }
  
  // Scan table captions
  if (manuscript.tableCaptions && manuscript.tableCaptions.length > 0) {
    scannedSections.push('tableCaptions');
    for (const caption of manuscript.tableCaptions) {
      const result = scanSection(caption);
      if (result.hasPhi) {
        const findings = Object.values(result.stats).reduce((a, b) => a + b, 0);
        findingsBySection['tableCaptions'] = (findingsBySection['tableCaptions'] || 0) + findings;
        totalFindings += findings;
      }
    }
  }
  
  const hasPhi = totalFindings > 0;
  const scanDurationMs = Date.now() - startTime;
  
  // Determine if export should be blocked
  const passed = !hasPhi || governanceMode === 'DEMO';
  
  // Log the scan result
  await logAction({
    eventType: hasPhi ? 'PHI_DETECTED' : 'PHI_SCAN_CLEAN',
    action: 'PRE_EXPORT_GATE',
    userId,
    resourceType: 'MANUSCRIPT',
    resourceId: manuscript.manuscriptId,
    details: {
      totalFindings,
      findingsBySection,
      scannedSections,
      passed,
      mode: governanceMode,
      scanDurationMs
    },
    severity: hasPhi ? (governanceMode === 'LIVE' ? 'HIGH' : 'MEDIUM') : 'INFO'
  });
  
  const result: ExportGateResult = {
    passed,
    hasPhi,
    totalFindings,
    findingsBySection,
    scannedSections,
    mode: governanceMode,
    scanDurationMs
  };
  
  if (!passed) {
    result.blockedReason = `PHI detected in ${Object.keys(findingsBySection).length} section(s). ` +
      `Export blocked in LIVE mode. Please review and remove PHI before exporting.`;
  }
  
  return result;
}

/**
 * Quick check if manuscript can be exported
 */
export async function canExport(
  manuscript: ManuscriptExportPayload,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const result = await phiPreExportGate(manuscript, userId);
  
  return {
    allowed: result.passed,
    reason: result.blockedReason
  };
}

export default phiPreExportGate;
