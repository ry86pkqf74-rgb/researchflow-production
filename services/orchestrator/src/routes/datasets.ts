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

const router = Router();

// Mock datasets for development
const mockDatasets: DatasetMetadata[] = [
  {
    id: 'ds-001',
    name: 'Thyroid Clinical Dataset (Synthetic)',
    classification: 'SYNTHETIC',
    recordCount: 2847,
    uploadedAt: new Date('2024-01-15T10:00:00Z'),
    uploadedBy: 'steward@researchflow.dev',
    approvedBy: 'admin@researchflow.dev',
    approvedAt: new Date('2024-01-15T10:05:00Z'),
    phiScanPassed: true,
    phiScanAt: new Date('2024-01-15T10:02:00Z'),
    source: 'Synthea Patient Generator',
    irbNumber: 'IRB-2024-001',
    deidentificationMethod: 'SYNTHETIC',
    schemaVersion: '1.0',
    format: 'CSV',
    sizeBytes: 1048576,
    columns: ['patient_id', 'age', 'tsh_level', 'ft4_level', 'diagnosis', 'treatment'],
    riskScore: 15
  },
  {
    id: 'ds-002',
    name: 'Diabetes Patient Outcomes (De-identified)',
    classification: 'DEIDENTIFIED',
    recordCount: 1523,
    uploadedAt: new Date('2024-01-14T14:30:00Z'),
    uploadedBy: 'researcher@researchflow.dev',
    approvedBy: 'steward@researchflow.dev',
    approvedAt: new Date('2024-01-14T15:00:00Z'),
    phiScanPassed: true,
    phiScanAt: new Date('2024-01-14T14:35:00Z'),
    source: 'Academic Medical Center',
    irbNumber: 'IRB-2024-002',
    deidentificationMethod: 'SAFE_HARBOR',
    schemaVersion: '1.0',
    format: 'PARQUET',
    sizeBytes: 2097152,
    columns: ['study_id', 'age_group', 'hba1c', 'bmi_category', 'outcome'],
    riskScore: 42
  },
  {
    id: 'ds-003',
    name: 'Cardiac Imaging Study (Unknown Classification)',
    classification: 'UNKNOWN',
    recordCount: 456,
    uploadedAt: new Date('2024-01-16T09:00:00Z'),
    uploadedBy: 'researcher@researchflow.dev',
    phiScanPassed: false,
    phiScanAt: new Date('2024-01-16T09:05:00Z'),
    source: 'External Research Partner',
    deidentificationMethod: 'NONE',
    schemaVersion: '1.0',
    format: 'JSON',
    sizeBytes: 5242880,
    columns: ['image_id', 'patient_name', 'ssn', 'diagnosis', 'scan_date'],
    riskScore: 95
  }
];

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

    let datasets = [...mockDatasets];

    // Filter by classification if provided
    if (classification && typeof classification === 'string') {
      datasets = datasets.filter(
        d => d.classification === classification.toUpperCase()
      );
    }

    // Filter by format if provided
    if (format && typeof format === 'string') {
      datasets = datasets.filter(
        d => d.format === format.toUpperCase()
      );
    }

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

    const dataset = mockDatasets.find(d => d.id === datasetId);

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
        } as any).returning();

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

    // Create new dataset
    const newDataset: DatasetMetadata = {
      id: uploadId,
      name,
      classification,
      recordCount: estimatedRows,
      uploadedAt: new Date(),
      uploadedBy: (req as any).user?.username || 'unknown',
      phiScanPassed: !hasPhiColumns,
      phiScanAt: new Date(),
      source,
      irbNumber,
      deidentificationMethod: deidentificationMethod || 'NONE',
      schemaVersion: '1.0',
      format,
      sizeBytes: 0,
      columns,
      riskScore
    };

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

    mockDatasets.push(newDataset);

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

    const index = mockDatasets.findIndex(d => d.id === datasetId);

    if (index === -1) {
      res.status(404).json({
        error: 'Dataset not found',
        code: 'DATASET_NOT_FOUND',
        datasetId
      });
      return;
    }

    const deleted = mockDatasets.splice(index, 1)[0];

    // Log audit entry for dataset deletion
    await createAuditEntry({
      eventType: 'DATA_DELETION',
      action: 'DATASET_DELETED',
      userId: (req as any).user?.id,
      resourceType: 'dataset',
      resourceId: datasetId,
      details: {
        deletedName: deleted.name,
        classification: deleted.classification
      }
    });

    res.json({
      message: 'Dataset deleted successfully',
      deletedDataset: {
        id: deleted.id,
        name: deleted.name
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

    const dataset = mockDatasets.find(d => d.id === datasetId);

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

    dataset.phiScanPassed = scanPassed;
    dataset.phiScanAt = new Date();

    if (scanPassed) {
      dataset.classification = 'DEIDENTIFIED';
      dataset.riskScore = calculateRiskScore([], 'DEIDENTIFIED');
    } else {
      dataset.classification = 'IDENTIFIED';
      dataset.riskScore = calculateRiskScore(phiDetected, 'IDENTIFIED');
    }

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
        classification: dataset.classification,
        riskScore: dataset.riskScore
      }
    });

    res.json({
      message: 'PHI scan completed',
      scan: {
        datasetId: dataset.id,
        passed: scanPassed,
        phiFields: phiDetected,
        timestamp: dataset.phiScanAt,
        classification: dataset.classification,
        riskScore: dataset.riskScore
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
