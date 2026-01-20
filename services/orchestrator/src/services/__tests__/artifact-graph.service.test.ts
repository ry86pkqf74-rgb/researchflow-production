/**
 * Tests for ArtifactGraphService
 *
 * Tests artifact provenance tracking, graph operations, and cycle detection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArtifactGraphService } from '../artifact-graph.service';

// Mock database module
vi.mock('../../lib/db', () => ({
  db: {
    query: vi.fn()
  }
}));

import { db } from '../../lib/db';

describe('ArtifactGraphService', () => {
  let service: ArtifactGraphService;

  beforeEach(() => {
    service = new ArtifactGraphService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createArtifact', () => {
    it('should create a new artifact with required fields', async () => {
      const mockArtifact = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'manuscript',
        name: 'Test Manuscript',
        status: 'draft',
        owner_user_id: 'user-1',
        organization_id: 'org-1',
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {},
        phi_scanned: false,
        phi_findings_count: 0
      };

      (db.query as any).mockResolvedValueOnce({ rows: [mockArtifact] });

      const result = await service.createArtifact({
        type: 'manuscript',
        name: 'Test Manuscript',
        ownerUserId: 'user-1',
        organizationId: 'org-1'
      });

      expect(db.query).toHaveBeenCalledTimes(2); // INSERT + audit log
      expect(result.name).toBe('Test Manuscript');
      expect(result.type).toBe('manuscript');
    });

    it('should set default status to draft', async () => {
      const mockArtifact = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'manuscript',
        name: 'Test Manuscript',
        status: 'draft',
        owner_user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {},
        phi_scanned: false,
        phi_findings_count: 0
      };

      (db.query as any).mockResolvedValueOnce({ rows: [mockArtifact] });

      const result = await service.createArtifact({
        type: 'manuscript',
        name: 'Test Manuscript',
        ownerUserId: 'user-1'
      });

      expect(result.status).toBe('draft');
    });
  });

  describe('getArtifact', () => {
    it('should return artifact by ID', async () => {
      const mockArtifact = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'manuscript',
        name: 'Test Manuscript',
        status: 'active',
        owner_user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
        metadata: { custom: 'data' },
        phi_scanned: true,
        phi_status: 'PASS',
        phi_findings_count: 0
      };

      (db.query as any).mockResolvedValueOnce({ rows: [mockArtifact] });

      const result = await service.getArtifact('123e4567-e89b-12d3-a456-426614174000');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockArtifact.id);
      expect(result?.name).toBe('Test Manuscript');
    });

    it('should return null for non-existent artifact', async () => {
      (db.query as any).mockResolvedValueOnce({ rows: [] });

      const result = await service.getArtifact('non-existent-id');

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted artifacts', async () => {
      (db.query as any).mockResolvedValueOnce({ rows: [] });

      const result = await service.getArtifact('deleted-artifact-id');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
      expect(result).toBeNull();
    });
  });

  describe('linkArtifacts', () => {
    it('should create edge between artifacts', async () => {
      const sourceId = '111e4567-e89b-12d3-a456-426614174000';
      const targetId = '222e4567-e89b-12d3-a456-426614174000';

      // Mock cycle check (no cycle)
      (db.query as any).mockResolvedValueOnce({ rows: [] });

      // Mock source and target artifacts exist
      (db.query as any).mockResolvedValueOnce({
        rows: [{
          id: sourceId,
          type: 'dataset',
          name: 'Source Dataset',
          owner_user_id: 'user-1',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      (db.query as any).mockResolvedValueOnce({
        rows: [{
          id: targetId,
          type: 'analysis',
          name: 'Target Analysis',
          owner_user_id: 'user-1',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      // Mock edge creation
      const mockEdge = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        source_artifact_id: sourceId,
        target_artifact_id: targetId,
        relation_type: 'derived_from',
        created_at: new Date(),
        metadata: {}
      };

      (db.query as any).mockResolvedValueOnce({ rows: [mockEdge] });
      (db.query as any).mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await service.linkArtifacts(
        {
          sourceArtifactId: sourceId,
          targetArtifactId: targetId,
          relationType: 'derived_from'
        },
        'user-1'
      );

      expect(result.sourceArtifactId).toBe(sourceId);
      expect(result.targetArtifactId).toBe(targetId);
      expect(result.relationType).toBe('derived_from');
    });

    it('should reject edge that would create cycle', async () => {
      const sourceId = '111e4567-e89b-12d3-a456-426614174000';
      const targetId = '222e4567-e89b-12d3-a456-426614174000';

      // Mock cycle check (cycle detected)
      (db.query as any).mockResolvedValueOnce({ rows: [{ exists: true }] });

      await expect(
        service.linkArtifacts(
          {
            sourceArtifactId: sourceId,
            targetArtifactId: targetId,
            relationType: 'derived_from'
          },
          'user-1'
        )
      ).rejects.toThrow('cycle');
    });
  });

  describe('getArtifactGraph', () => {
    it('should retrieve graph with upstream and downstream', async () => {
      const rootId = '111e4567-e89b-12d3-a456-426614174000';

      // Mock upstream query
      (db.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: '000e4567-e89b-12d3-a456-426614174000',
            type: 'dataset',
            name: 'Source Dataset',
            owner_user_id: 'user-1',
            created_at: new Date(),
            updated_at: new Date(),
            edge_id: 'edge-1',
            relation_type: 'derived_from',
            edge_created_at: new Date()
          }
        ]
      });

      // Mock downstream query
      (db.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: '222e4567-e89b-12d3-a456-426614174000',
            type: 'manuscript',
            name: 'Target Manuscript',
            owner_user_id: 'user-1',
            created_at: new Date(),
            updated_at: new Date(),
            edge_id: 'edge-2',
            relation_type: 'uses',
            edge_created_at: new Date()
          }
        ]
      });

      const result = await service.getArtifactGraph(rootId, 2, 'both');

      expect(result.rootArtifactId).toBe(rootId);
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('should limit depth to specified value', async () => {
      const rootId = '111e4567-e89b-12d3-a456-426614174000';

      (db.query as any).mockResolvedValue({ rows: [] });

      await service.getArtifactGraph(rootId, 3, 'upstream');

      // Check that depth parameter was passed correctly
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('depth < $2'),
        [rootId, 3]
      );
    });
  });

  describe('checkArtifactOutdated', () => {
    it('should detect outdated artifact when upstream changed', async () => {
      const artifactId = '111e4567-e89b-12d3-a456-426614174000';

      const oldDate = new Date('2024-01-01T00:00:00Z');
      const newDate = new Date('2024-01-02T00:00:00Z');

      // Mock getArtifactGraph call
      (db.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 'source-id',
            type: 'dataset',
            name: 'Source Dataset',
            updated_at: newDate, // Updated recently
            owner_user_id: 'user-1',
            created_at: oldDate,
            edge_id: 'edge-1',
            source_artifact_id: 'source-id',
            target_artifact_id: artifactId,
            relation_type: 'derived_from',
            edge_created_at: oldDate, // Edge created before update
            metadata: {}
          }
        ]
      });

      (db.query as any).mockResolvedValueOnce({ rows: [] }); // Downstream

      const result = await service.checkArtifactOutdated(artifactId);

      expect(result.isOutdated).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons[0].reason).toBe('source_updated');
    });

    it('should return not outdated when upstream unchanged', async () => {
      const artifactId = '111e4567-e89b-12d3-a456-426614174000';

      const oldDate = new Date('2024-01-01T00:00:00Z');

      // Mock getArtifactGraph call
      (db.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 'source-id',
            type: 'dataset',
            name: 'Source Dataset',
            updated_at: oldDate, // Not updated
            owner_user_id: 'user-1',
            created_at: oldDate,
            edge_id: 'edge-1',
            source_artifact_id: 'source-id',
            target_artifact_id: artifactId,
            relation_type: 'derived_from',
            edge_created_at: oldDate,
            metadata: {}
          }
        ]
      });

      (db.query as any).mockResolvedValueOnce({ rows: [] }); // Downstream

      const result = await service.checkArtifactOutdated(artifactId);

      expect(result.isOutdated).toBe(false);
      expect(result.reasons.length).toBe(0);
    });

    it('should detect manual refresh flag', async () => {
      const artifactId = '111e4567-e89b-12d3-a456-426614174000';

      const date = new Date('2024-01-01T00:00:00Z');

      // Mock getArtifactGraph call with needsRefresh flag
      (db.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 'source-id',
            type: 'dataset',
            name: 'Source Dataset',
            updated_at: date,
            owner_user_id: 'user-1',
            created_at: date,
            edge_id: 'edge-1',
            source_artifact_id: 'source-id',
            target_artifact_id: artifactId,
            relation_type: 'derived_from',
            edge_created_at: date,
            metadata: { needsRefresh: true } // Manual flag
          }
        ]
      });

      (db.query as any).mockResolvedValueOnce({ rows: [] }); // Downstream

      const result = await service.checkArtifactOutdated(artifactId);

      expect(result.isOutdated).toBe(true);
      expect(result.reasons.some(r => r.reason === 'manual_flag')).toBe(true);
    });
  });

  describe('softDeleteArtifact', () => {
    it('should soft delete artifact', async () => {
      const artifactId = '111e4567-e89b-12d3-a456-426614174000';

      // Mock getArtifact
      (db.query as any).mockResolvedValueOnce({
        rows: [{
          id: artifactId,
          type: 'manuscript',
          name: 'Test Manuscript',
          owner_user_id: 'user-1',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      // Mock UPDATE query
      (db.query as any).mockResolvedValueOnce({ rows: [] });

      // Mock audit log
      (db.query as any).mockResolvedValueOnce({ rows: [] });
      (db.query as any).mockResolvedValueOnce({ rows: [] });

      await service.softDeleteArtifact(artifactId, 'user-1');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE artifacts SET deleted_at'),
        [artifactId]
      );
    });

    it('should throw error for non-existent artifact', async () => {
      // Mock getArtifact returns null
      (db.query as any).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.softDeleteArtifact('non-existent-id', 'user-1')
      ).rejects.toThrow('not found');
    });
  });

  describe('updateArtifact', () => {
    it('should update artifact fields', async () => {
      const artifactId = '111e4567-e89b-12d3-a456-426614174000';

      const beforeState = {
        id: artifactId,
        type: 'manuscript',
        name: 'Old Name',
        status: 'draft',
        owner_user_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date()
      };

      const afterState = {
        ...beforeState,
        name: 'New Name',
        status: 'active'
      };

      // Mock getArtifact (before)
      (db.query as any).mockResolvedValueOnce({ rows: [beforeState] });

      // Mock UPDATE
      (db.query as any).mockResolvedValueOnce({ rows: [afterState] });

      // Mock audit log
      (db.query as any).mockResolvedValueOnce({ rows: [] });
      (db.query as any).mockResolvedValueOnce({ rows: [] });

      const result = await service.updateArtifact(
        artifactId,
        { name: 'New Name', status: 'active' },
        'user-1'
      );

      expect(result.name).toBe('New Name');
      expect(result.status).toBe('active');
    });
  });
});
