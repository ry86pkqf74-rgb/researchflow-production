/**
 * Datasets Persistence Service
 *
 * Provides database-backed persistence for dataset metadata.
 * Replaces in-memory mockDatasets array for production use.
 */

import { db } from '../../db';
import { datasets } from '@researchflow/core/schema';
import { eq, ilike, and, sql } from 'drizzle-orm';
import { DatasetMetadata } from '@researchflow/core/types/classification';

// In-memory fallback with seed data for when DB is unavailable
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
 * Convert database record to DatasetMetadata format
 */
function dbRecordToMetadata(record: any): DatasetMetadata {
  const metadata = record.metadata || {};
  return {
    id: record.id,
    name: record.filename,
    classification: record.classification,
    recordCount: record.rowCount || 0,
    uploadedAt: record.uploadedAt,
    uploadedBy: record.uploadedBy || 'unknown',
    approvedBy: metadata.approvedBy,
    approvedAt: metadata.approvedAt ? new Date(metadata.approvedAt) : undefined,
    phiScanPassed: metadata.phiScanPassed ?? false,
    phiScanAt: metadata.phiScanAt ? new Date(metadata.phiScanAt) : undefined,
    source: metadata.source,
    irbNumber: metadata.irbNumber,
    deidentificationMethod: metadata.deidentificationMethod,
    schemaVersion: metadata.schemaVersion || '1.0',
    format: record.format || 'UNKNOWN',
    sizeBytes: record.sizeBytes || 0,
    columns: metadata.columns || [],
    riskScore: record.riskScore || 0
  };
}

/**
 * Get all datasets with optional filters
 */
export async function getDatasets(filters?: {
  classification?: string;
  format?: string;
}): Promise<DatasetMetadata[]> {
  if (!db) {
    console.warn('[Datasets] No database connection, using mock data');
    let result = [...mockDatasets];
    if (filters?.classification) {
      result = result.filter(d => d.classification === filters.classification.toUpperCase());
    }
    if (filters?.format) {
      result = result.filter(d => d.format === filters.format.toUpperCase());
    }
    return result;
  }

  try {
    const conditions = [];

    if (filters?.classification) {
      conditions.push(eq(datasets.classification, filters.classification.toUpperCase()));
    }
    if (filters?.format) {
      conditions.push(eq(datasets.format, filters.format.toUpperCase()));
    }

    const query = conditions.length > 0
      ? db.select().from(datasets).where(and(...conditions))
      : db.select().from(datasets);

    const records = await query;

    // If no records in DB, return mock data
    if (records.length === 0) {
      return mockDatasets;
    }

    return records.map(dbRecordToMetadata);
  } catch (error) {
    console.error('[Datasets] Failed to fetch datasets:', error);
    return mockDatasets;
  }
}

/**
 * Get a dataset by ID
 */
export async function getDatasetById(id: string): Promise<DatasetMetadata | null> {
  if (!db) {
    return mockDatasets.find(d => d.id === id) || null;
  }

  try {
    const records = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id))
      .limit(1);

    if (records.length === 0) {
      // Check mock data as fallback
      return mockDatasets.find(d => d.id === id) || null;
    }

    return dbRecordToMetadata(records[0]);
  } catch (error) {
    console.error('[Datasets] Failed to fetch dataset:', error);
    return mockDatasets.find(d => d.id === id) || null;
  }
}

/**
 * Create a new dataset
 */
export async function createDataset(data: {
  filename: string;
  classification: string;
  format: string;
  sizeBytes: number;
  rowCount?: number;
  columnCount?: number;
  uploadedBy: string;
  metadata?: any;
}): Promise<DatasetMetadata> {
  const id = `ds-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  if (!db) {
    const newDataset: DatasetMetadata = {
      id,
      name: data.filename,
      classification: data.classification,
      recordCount: data.rowCount || 0,
      uploadedAt: new Date(),
      uploadedBy: data.uploadedBy,
      phiScanPassed: false,
      schemaVersion: '1.0',
      format: data.format,
      sizeBytes: data.sizeBytes,
      columns: data.metadata?.columns || [],
      riskScore: 0
    };
    mockDatasets.push(newDataset);
    return newDataset;
  }

  try {
    const [record] = await db
      .insert(datasets)
      .values({
        id,
        filename: data.filename,
        classification: data.classification,
        format: data.format,
        sizeBytes: data.sizeBytes,
        rowCount: data.rowCount,
        columnCount: data.columnCount,
        uploadedBy: data.uploadedBy,
        metadata: data.metadata || {},
      })
      .returning();

    return dbRecordToMetadata(record);
  } catch (error) {
    console.error('[Datasets] Failed to create dataset:', error);
    throw error;
  }
}

/**
 * Update a dataset
 */
export async function updateDataset(
  id: string,
  updates: Partial<{
    classification: string;
    riskScore: number;
    metadata: any;
  }>
): Promise<DatasetMetadata | null> {
  if (!db) {
    const idx = mockDatasets.findIndex(d => d.id === id);
    if (idx >= 0) {
      if (updates.classification) mockDatasets[idx].classification = updates.classification;
      if (updates.riskScore !== undefined) mockDatasets[idx].riskScore = updates.riskScore;
      return mockDatasets[idx];
    }
    return null;
  }

  try {
    const [record] = await db
      .update(datasets)
      .set(updates)
      .where(eq(datasets.id, id))
      .returning();

    if (!record) return null;
    return dbRecordToMetadata(record);
  } catch (error) {
    console.error('[Datasets] Failed to update dataset:', error);
    return null;
  }
}

/**
 * Delete a dataset
 */
export async function deleteDataset(id: string): Promise<boolean> {
  if (!db) {
    const idx = mockDatasets.findIndex(d => d.id === id);
    if (idx >= 0) {
      mockDatasets.splice(idx, 1);
      return true;
    }
    return false;
  }

  try {
    const result = await db
      .delete(datasets)
      .where(eq(datasets.id, id))
      .returning({ id: datasets.id });

    return result.length > 0;
  } catch (error) {
    console.error('[Datasets] Failed to delete dataset:', error);
    return false;
  }
}

/**
 * Check if persistence service is healthy
 */
export async function isHealthy(): Promise<boolean> {
  if (!db) {
    return true; // Memory fallback is always "healthy"
  }

  try {
    await db.select({ count: sql`count(*)` }).from(datasets).limit(1);
    return true;
  } catch {
    return false;
  }
}
