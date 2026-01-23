/**
 * PHI Middleware Module
 * Phase 1.3: Three-Layer PHI Audit System
 */

export { 
  phiInputScanMiddleware, 
  createPhiInputScanMiddleware,
  type PhiScanResult 
} from './phiInputScanMiddleware';

export { 
  phiPreExportGate, 
  canExport,
  type ExportGateResult,
  type ManuscriptExportPayload 
} from './phiPreExportGate';
