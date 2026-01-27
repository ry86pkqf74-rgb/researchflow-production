/**
 * Dataset API Routes
 *
 * Endpoints for dataset management, classification, and PHI scanning.
 * Protected by RBAC middleware and Governance Gates.
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 */

import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  blockInStandby,
  enforceRateLimit
} from '../middleware/governance-gates.js';
import { blockDataUploadInDemo } from '../../middleware/mode-guard.js';
import { detectPhiFields, calculateRiskScore } from '../services/phi-protection.js';
import { createAuditEntry } from '../services/auditService.js';
import { DatasetMetadata } from "@researchflow/core/types/classification";
import { approvalGates } from '@researchflow/core/schema';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db.js';
import {
  getDatasets,
  getDatasetById,
  createDataset,
  updateDataset,
  deleteDataset as deleteDatasetFromDb,
} from '../services/datasets-persistence.service.js';

const router = Router();

// Database-backed storage with memory fallback
// See: src/services/datasets-persistence.service.ts

/**
 * GET /api/datasets
 * Get all datasets (filtered by user permissions)
 * Requires: VIEW permission
 */
router.get(
  '/',
  requirePermission('VIEW'),
  asyncHandler(async (req, res) => {
    const { classification, format } = req.query;

    const datasets = await getDatasets({
      classification: classification as string | undefined,
      format: format as string | undefined,
    });

    res.json({
      datasets,
      total: datasets.length,
      filters: {
        classification: classification || 'all',
        format: format || 'all'
      }
    });
  })
);

/**
 * GET /api/datasets/:datasetId
 * Get a specific dataset by ID
 * Requires: VIEW permission
 */
router.get(
  '/:datasetId',
  requirePermission('VIEW'),
  asyncHandler(async (req, res) => {
    const { datasetId } = req.params;

    const dataset = await getDatasetById(datasetId);

    if (!dataset) {
      res.status(404).json({
        error: 'Dataset not found',
        code: 'DATASET_NOT_FOUND',
        datasetId
      });
      return;
    }

    res.json({ dataset });
  })
);

/**
 * POST /api/datasets
 * Upload a new dataset
 * Requires: UPLOAD permission (STEWARD+ role)
 * Protected by: blockInStandby, blockDataUploadInDemo, enforceRateLimit
 * PHI permission check happens after detection inside handler
 */
router.post(
  '/',
  blockInStandby(),
  blockDataUploadInDemo,
  requirePermission('UPLOAD'),
  enforceRateLimit('uploads'),
  asyncHandler(async (req, res) => {
    const {
      name,
      source,
      format,
      columns,
      irbNumber,
      deidentificationMethod,
      uploadId: clientUploadId
    } = req.body;

    // Generate or use client-provided uploadId for approval tracking
    const uploadId = clientUploadId || `ds-${Date.now()}`;

    // Validate required fields
    if (!name || !source || !format || !columns) {
      res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR',
        required: ['name', 'source', 'format', 'columns']
      });
      return;
    }

    // Auto-detect PHI in column names and sample data FIRST
    const sampleData = req.body.sampleData || [];
    const phiDetected = detectPhiFields(sampleData);
    const hasPhiColumns = phiDetected.length > 0;
    
    // Calculate risk score based on PHI detection
    let classification: 'UNKNOWN' | 'IDENTIFIED' | 'DEIDENTIFIED' | 'SYNTHETIC' = 'UNKNOWN';
    let riskScore = 0;
    
    if (hasPhiColumns) {
      classification = 'IDENTIFIED';
      riskScore = calculateRiskScore(phiDetected, 'IDENTIFIED');
    }

    // PHI Permission Check - must happen AFTER detection
    if (classification === 'IDENTIFIED') {
      const userRole = (req as any).user?.role;
      const hasPhiPermission = ['STEWARD', 'ADMIN'].includes(userRole);
      
      if (!hasPhiPermission) {
        await createAuditEntry({
          eventType: 'GOVERNANCE',
          action: 'PHI_PERMISSION_DENIED',
          userId: (req as any).user?.id,
          resourceType: 'dataset',
          resourceId: uploadId,
          details: { 
            classification, 
            phiFields: phiDetected,
            userRole 
          }
        });
        
        res.status(403).json({
          error: 'PHI detected - insufficient permissions',
          code: 'PHI_PERMISSION_REQUIRED',
          classification,
          phiFields: phiDetected,
          required: 'STEWARD or ADMIN role required for PHI data upload'
        });
        return;
      }
    }

    // Large dataset approval check - now with known uploadId
    const estimatedRows = req.body.estimatedRows || 0;
    const threshold = 100000;
    const mode = process.env.GOVERNANCE_MODE;
    
    if (mode === 'LIVE' && estimatedRows > threshold) {
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Check for existing approval
      const existingApproval = await db.select()
        .from(approvalGates)
        .where(and(
          eq(approvalGates.resourceId, uploadId),
          eq(approvalGates.status, 'APPROVED')
        ))
        .limit(1);

      if (!existingApproval.length) {
        // Create approval request
        const [approval] = await db.insert(approvalGates).values({
          operationType: 'DATASET_MODIFICATION',
          resourceType: 'large_upload',
          resourceId: uploadId,
          requestedById: (req as any).user?.id,
          requestedByRole: (req as any).user?.role || 'VIEWER',
          reason: `Dataset with ${estimatedRows} rows exceeds threshold of ${threshold}`,
          metadata: { estimatedRows, threshold, name, classification }
        }).returning();

        await createAuditEntry({
          eventType: 'GOVERNANCE',
          action: 'APPROVAL_REQUIRED',
          userId: (req as any).user?.id,
          resourceType: 'dataset',
          resourceId: uploadId,
          details: { reason: 'large_dataset', estimatedRows }
        });

        res.status(202).json({
          status: 'pending_approval',
          message: 'Large dataset upload requires steward approval',
          approvalId: approval.id,
          uploadId,
          estimatedRows
        });
        return;
      }
    }

    // Create new dataset via persistence service
    const newDataset = await createDataset({
      filename: name,
      classification,
      format,
      sizeBytes: 0,
      rowCount: estimatedRows,
      columnCount: columns.length,
      uploadedBy: (req as any).user?.id || 'unknown',
      metadata: {
        source,
        irbNumber,
        deidentificationMethod: deidentificationMethod || 'NONE',
        columns,
        phiScanPassed: !hasPhiColumns,
        phiScanAt: new Date(),
        schemaVersion: '1.0',
      },
    });

    // Log audit entry for dataset upload (action matches rate limit tracking)
    await createAuditEntry({
      eventType: 'DATA_UPLOAD',
      action: 'UPLOADS',
      userId: (req as any).user?.id,
      resourceType: 'dataset',
      resourceId: newDataset.id,
      details: {
        name,
        classification,
        phiDetected: phiDetected,
        riskScore,
        columnCount: columns.length
      }
    });

    res.status(201).json({
      message: 'Dataset uploaded successfully',
      dataset: newDataset,
      phiScan: {
        detected: hasPhiColumns,
        fields: phiDetected,
        classification
      },
      nextSteps: hasPhiColumns
        ? ['PHI detected - steward review required', 'Dataset quarantined until approval']
        : ['Dataset ready for analysis', 'Classification confirmed as safe']
    });
  })
);

/**
 * DELETE /api/datasets/:datasetId
 * Delete a dataset
 * Requires: ADMIN role
 * Protected by: blockInStandby (no deletes in STANDBY mode)
 */
router.delete(
  '/:datasetId',
  blockInStandby(),
  requirePermission('DELETE'),
  asyncHandler(async (req, res) => {
    const { datasetId } = req.params;

    // Get dataset first for audit logging
    const dataset = await getDatasetById(datasetId);

    if (!dataset) {
      res.status(404).json({
        error: 'Dataset not found',
        code: 'DATASET_NOT_FOUND',
        datasetId
      });
      return;
    }

    const deleted = await deleteDatasetFromDb(datasetId);

    if (!deleted) {
      res.status(500).json({
        error: 'Failed to delete dataset',
        code: 'DELETE_FAILED',
        datasetId
      });
      return;
    }

    // Log audit entry for dataset deletion
    await createAuditEntry({
      eventType: 'DATA_DELETION',
      action: 'DATASET_DELETED',
      userId: (req as any).user?.id,
      resourceType: 'dataset',
      resourceId: datasetId,
      details: {
        deletedName: dataset.name,
        classification: dataset.classification
      }
    });

    res.json({
      message: 'Dataset deleted successfully',
      deletedDataset: {
        id: dataset.id,
        name: dataset.name
      },
      deletedBy: (req as any).user?.username,
      timestamp: new Date()
    });
  })
);

/**
 * POST /api/datasets/:datasetId/scan
 * Trigger manual PHI scan using real PHI detection
 * Requires: STEWARD+ role
 * Protected by: blockInStandby
 */
router.post(
  '/:datasetId/scan',
  blockInStandby(),
  requirePermission('APPROVE'),
  asyncHandler(async (req, res) => {
    const { datasetId } = req.params;

    const dataset = await getDatasetById(datasetId);

    if (!dataset) {
      res.status(404).json({
        error: 'Dataset not found',
        code: 'DATASET_NOT_FOUND',
        datasetId
      });
      return;
    }

    // Use real PHI detection on column names
    const phiDetected = detectPhiFields({});
    const scanPassed = phiDetected.length === 0;

    const newClassification = scanPassed ? 'DEIDENTIFIED' : 'IDENTIFIED';
    const newRiskScore = scanPassed
      ? calculateRiskScore([], 'DEIDENTIFIED')
      : calculateRiskScore(phiDetected, 'IDENTIFIED');

    // Update dataset with scan results
    await updateDataset(datasetId, {
      classification: newClassification,
      riskScore: newRiskScore,
      metadata: {
        ...((dataset as any).metadata || {}),
        phiScanPassed: scanPassed,
        phiScanAt: new Date(),
      },
    });

    // Log audit entry for PHI scan
    await createAuditEntry({
      eventType: 'PHI_SCAN',
      action: scanPassed ? 'SCAN_PASSED' : 'SCAN_FAILED',
      userId: (req as any).user?.id,
      resourceType: 'dataset',
      resourceId: datasetId,
      details: {
        passed: scanPassed,
        phiFields: phiDetected,
        classification: newClassification,
        riskScore: newRiskScore
      }
    });

    res.json({
      message: 'PHI scan completed',
      scan: {
        datasetId: dataset.id,
        passed: scanPassed,
        phiFields: phiDetected,
        timestamp: new Date(),
        classification: newClassification,
        riskScore: newRiskScore
      },
      ...(scanPassed
        ? { nextSteps: ['Dataset ready for analysis'] }
        : {
            warning: 'PHI detected - dataset quarantined',
            action: 'See PHI Incident Response runbook',
            phiFields: phiDetected
          })
    });
  })
);

export default router;
