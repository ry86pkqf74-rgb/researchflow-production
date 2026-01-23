/**
 * PHI Input Scan Middleware
 * Phase 1.3: Layer 1 of Three-Layer PHI Audit
 * 
 * Scans incoming requests for PHI before processing.
 * - DEMO mode: Log warning and continue
 * - LIVE mode: Return 422 error
 */

import { Request, Response, NextFunction } from 'express';
import { containsPhi, getPhiStats, scrubLog } from '@researchflow/phi-engine';
import { logAction } from '../services/audit-service';
import { getMode } from '../services/governance-config.service';

export interface PhiScanResult {
  hasPhi: boolean;
  stats: Record<string, number>;
  totalFindings: number;
  scannedAt: string;
  location: 'input' | 'processing' | 'output' | 'export';
  requestPath: string;
  mode: string;
}

// Paths to exclude from PHI scanning (health checks, static files)
const EXCLUDED_PATHS = [
  '/health',
  '/ready',
  '/metrics',
  '/favicon.ico',
  '/api/auth/login',
  '/api/auth/logout',
];

// Fields to scan in request body
const SCANNABLE_FIELDS = [
  'content',
  'text',
  'manuscript',
  'abstract',
  'title',
  'body',
  'data',
  'notes',
  'comments',
];

/**
 * Extract scannable content from request
 */
function extractScannableContent(req: Request): string[] {
  const content: string[] = [];
  
  // Scan body
  if (req.body && typeof req.body === 'object') {
    for (const field of SCANNABLE_FIELDS) {
      if (req.body[field]) {
        if (typeof req.body[field] === 'string') {
          content.push(req.body[field]);
        } else if (typeof req.body[field] === 'object') {
          content.push(JSON.stringify(req.body[field]));
        }
      }
    }
    
    // If no specific fields, scan entire body
    if (content.length === 0) {
      content.push(JSON.stringify(req.body));
    }
  }
  
  // Scan query parameters
  if (req.query && Object.keys(req.query).length > 0) {
    content.push(JSON.stringify(req.query));
  }
  
  return content;
}

/**
 * PHI Input Scan Middleware
 * 
 * Attaches phiScanResult to request for downstream audit logging.
 */
export async function phiInputScanMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip excluded paths
  if (EXCLUDED_PATHS.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Skip non-content requests
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method) && !req.query.q) {
    return next();
  }
  
  const governanceMode = await getMode();
  const startTime = Date.now();
  
  try {
    const contentToScan = extractScannableContent(req);
    const fullContent = contentToScan.join(' ');
    
    if (!fullContent || fullContent.length < 3) {
      return next();
    }
    
    const hasPhi = containsPhi(fullContent);
    const stats = hasPhi ? getPhiStats(fullContent) : {};
    const totalFindings = Object.values(stats).reduce((a, b) => a + b, 0);
    
    const scanResult: PhiScanResult = {
      hasPhi,
      stats,
      totalFindings,
      scannedAt: new Date().toISOString(),
      location: 'input',
      requestPath: req.path,
      mode: governanceMode
    };
    
    // Attach to request for downstream use
    (req as any).phiScanResult = scanResult;
    
    if (hasPhi) {
      // Log PHI detection (without PHI values)
      await logAction({
        eventType: 'PHI_DETECTED',
        action: 'INPUT_SCAN',
        userId: (req as any).user?.id || 'anonymous',
        resourceType: 'REQUEST',
        resourceId: req.path,
        details: {
          stats,
          totalFindings,
          mode: governanceMode,
          scanDurationMs: Date.now() - startTime
        },
        severity: totalFindings > 5 ? 'HIGH' : 'MEDIUM'
      });
      
      if (governanceMode === 'LIVE') {
        // Block request in LIVE mode
        res.status(422).json({
          error: 'PHI_DETECTED',
          message: 'Protected Health Information detected in request. Please remove PHI before resubmitting.',
          findingsCount: totalFindings,
          findingTypes: Object.keys(stats),
          mode: 'LIVE'
        });
        return;
      }
      
      // DEMO mode: log warning and continue
      console.warn(
        `[PHI-INPUT-SCAN] PHI detected in ${req.method} ${req.path} ` +
        `(${totalFindings} findings, types: ${Object.keys(stats).join(', ')}). ` +
        `Continuing in DEMO mode.`
      );
    }
    
    next();
  } catch (error) {
    console.error('[PHI-INPUT-SCAN] Error during scan:', scrubLog(String(error)));
    // Don't block on scan errors - log and continue
    next();
  }
}

/**
 * Express middleware factory with custom options
 */
export function createPhiInputScanMiddleware(options: {
  excludePaths?: string[];
  scanFields?: string[];
  blockOnError?: boolean;
} = {}) {
  const excludePaths = options.excludePaths || EXCLUDED_PATHS;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    return phiInputScanMiddleware(req, res, next);
  };
}

export default phiInputScanMiddleware;
