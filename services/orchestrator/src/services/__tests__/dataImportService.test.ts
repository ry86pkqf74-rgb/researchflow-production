/**
 * Tests for Data Import Service
 * Task 144 - Data import wizards
 */

import { describe, it, expect } from 'vitest';
import {
  previewSource,
  createImportJob,
  getImportJob,
  listImportJobs,
  cancelImportJob,
  executeImport,
} from '../dataImportService';

describe('DataImportService', () => {
  const userId = 'test-user';
  const tenantId = 'test-tenant';

  describe('previewSource', () => {
    it('should preview CSV source', async () => {
      const preview = await previewSource('CSV', {
        content: 'name,age,email\nJohn,30,john@example.com\nJane,25,jane@example.com',
      });

      expect(preview.columns.length).toBeGreaterThan(0);
      expect(preview.sampleData.length).toBeGreaterThan(0);
      expect(preview.totalRows).toBeGreaterThan(0);
    });

    it('should detect column types', async () => {
      const preview = await previewSource('CSV', {
        content: 'name,age,active\nJohn,30,true\nJane,25,false',
      });

      expect(preview.columns.some(c => c.detectedType === 'string')).toBe(true);
      expect(preview.columns.some(c => c.detectedType === 'number')).toBe(true);
      expect(preview.columns.some(c => c.detectedType === 'boolean')).toBe(true);
    });

    it('should detect PHI in data', async () => {
      const preview = await previewSource('CSV', {
        content: 'name,ssn,dob\nJohn Doe,123-45-6789,1990-01-15',
      });

      expect(preview.phiWarnings).toBeDefined();
      expect(preview.phiWarnings!.length).toBeGreaterThan(0);
      expect(preview.phiWarnings!.some(w => w.pattern === 'SSN')).toBe(true);
    });

    it('should preview JSON source', async () => {
      const preview = await previewSource('JSON', {
        content: JSON.stringify([
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ]),
      });

      expect(preview.columns.length).toBe(2);
      expect(preview.totalRows).toBe(2);
    });
  });

  describe('createImportJob', () => {
    it('should create a new import job', () => {
      const job = createImportJob({
        name: 'Test Import',
        sourceType: 'CSV',
        sourceConfig: { content: 'a,b\n1,2' },
        targetType: 'NEW_DATASET',
      }, userId, tenantId);

      expect(job.id).toBeDefined();
      expect(job.name).toBe('Test Import');
      expect(job.status).toBe('PENDING');
      expect(job.createdBy).toBe(userId);
    });

    it('should create job with column mapping', () => {
      const job = createImportJob({
        name: 'Mapped Import',
        sourceType: 'CSV',
        sourceConfig: { content: 'a,b\n1,2' },
        targetType: 'NEW_DATASET',
        columnMapping: {
          a: { targetColumn: 'column_a', transform: 'TO_NUMBER' },
        },
      }, userId, tenantId);

      expect(job.config.columnMapping).toBeDefined();
      expect(job.config.columnMapping?.a.targetColumn).toBe('column_a');
    });
  });

  describe('getImportJob', () => {
    it('should return job by id', () => {
      const created = createImportJob({
        name: 'Get Test',
        sourceType: 'CSV',
        sourceConfig: {},
        targetType: 'NEW_DATASET',
      }, userId, tenantId);

      const job = getImportJob(created.id);
      expect(job).toBeDefined();
      expect(job?.id).toBe(created.id);
    });

    it('should return undefined for unknown job', () => {
      const job = getImportJob('non-existent-job');
      expect(job).toBeUndefined();
    });
  });

  describe('listImportJobs', () => {
    it('should list jobs for tenant', () => {
      const testTenantId = `list-tenant-${Date.now()}`;

      createImportJob({
        name: 'Job 1',
        sourceType: 'CSV',
        sourceConfig: {},
        targetType: 'NEW_DATASET',
      }, userId, testTenantId);

      createImportJob({
        name: 'Job 2',
        sourceType: 'CSV',
        sourceConfig: {},
        targetType: 'NEW_DATASET',
      }, userId, testTenantId);

      const jobs = listImportJobs(testTenantId);
      expect(jobs.length).toBe(2);
    });

    it('should filter by status', () => {
      const testTenantId = `status-tenant-${Date.now()}`;

      createImportJob({
        name: 'Pending Job',
        sourceType: 'CSV',
        sourceConfig: {},
        targetType: 'NEW_DATASET',
      }, userId, testTenantId);

      const jobs = listImportJobs(testTenantId, { status: 'PENDING' });
      expect(jobs.every(j => j.status === 'PENDING')).toBe(true);
    });
  });

  describe('cancelImportJob', () => {
    it('should cancel a pending job', () => {
      const job = createImportJob({
        name: 'Cancel Test',
        sourceType: 'CSV',
        sourceConfig: {},
        targetType: 'NEW_DATASET',
      }, userId, tenantId);

      const success = cancelImportJob(job.id);
      expect(success).toBe(true);

      const cancelled = getImportJob(job.id);
      expect(cancelled?.status).toBe('CANCELLED');
    });

    it('should return false for completed job', async () => {
      const job = createImportJob({
        name: 'Complete Test',
        sourceType: 'CSV',
        sourceConfig: { content: 'a,b\n1,2' },
        targetType: 'NEW_DATASET',
      }, userId, tenantId);

      await executeImport(job.id);

      const success = cancelImportJob(job.id);
      expect(success).toBe(false);
    });
  });

  describe('executeImport', () => {
    it('should execute import and update status', async () => {
      const job = createImportJob({
        name: 'Execute Test',
        sourceType: 'CSV',
        sourceConfig: { content: 'a,b\n1,2\n3,4' },
        targetType: 'NEW_DATASET',
      }, userId, tenantId);

      const result = await executeImport(job.id);

      expect(result.status).toBe('COMPLETED');
      expect(result.result).toBeDefined();
      expect(result.result!.successCount).toBeGreaterThan(0);
    });

    it('should throw error for non-existent job', async () => {
      await expect(executeImport('non-existent')).rejects.toThrow('Job not found');
    });
  });
});
