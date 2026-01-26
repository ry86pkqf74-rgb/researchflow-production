/**
 * Artifact Schema Validation Tests
 * INF-12: Unit tests for artifact schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  artifactSchema,
  insertArtifactSchema,
  artifactVersionSchema,
  insertArtifactVersionSchema,
  ARTIFACT_TYPES,
} from '@packages/core/types/schema';
import { syntheticArtifacts, invalidArtifactPayloads, expectedArtifactTypes } from '../fixtures/synthetic-artifacts';

describe('Artifact Schema Validation', () => {
  describe('artifactSchema', () => {
    it('should validate a complete artifact object', () => {
      const validArtifact = {
        id: 'art-001',
        researchId: 'RES-001',
        stageId: 'stage-1',
        artifactType: 'manuscript' as const,
        filename: 'test.md',
        mimeType: 'text/markdown',
        content: 'Test content',
        sizeBytes: 12,
        sha256Hash: 'abc123def456',
        createdAt: new Date(),
        createdBy: 'test-user',
        currentVersionId: null,
      };

      const result = artifactSchema.safeParse(validArtifact);
      expect(result.success).toBe(true);
    });

    it('should reject invalid artifact types', () => {
      const invalid = {
        id: 'art-001',
        researchId: 'RES-001',
        stageId: 'stage-1',
        artifactType: 'invalid_type',
        filename: 'test.md',
        mimeType: 'text/markdown',
        content: 'Test content',
        sizeBytes: 12,
        sha256Hash: 'abc123def456',
        createdAt: new Date(),
        createdBy: 'test-user',
        currentVersionId: null,
      };

      const result = artifactSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('insertArtifactSchema', () => {
    it('should validate insert payload without auto-generated fields', () => {
      const insertPayload = {
        researchId: 'RES-001',
        stageId: 'stage-1',
        artifactType: 'manuscript' as const,
        filename: 'test.md',
        mimeType: 'text/markdown',
        content: 'Test content',
        sizeBytes: 12,
        sha256Hash: 'abc123def456',
        createdBy: 'test-user',
      };

      const result = insertArtifactSchema.safeParse(insertPayload);
      expect(result.success).toBe(true);
    });

    it('should validate all synthetic artifacts', () => {
      syntheticArtifacts.forEach((artifact, index) => {
        const result = insertArtifactSchema.safeParse(artifact);
        expect(result.success, `Artifact ${index} should be valid`).toBe(true);
      });
    });

    it('should reject payloads missing required fields', () => {
      invalidArtifactPayloads.forEach(({ reason, payload }) => {
        const result = insertArtifactSchema.safeParse(payload);
        expect(result.success, `Should reject: ${reason}`).toBe(false);
      });
    });
  });

  describe('ARTIFACT_TYPES', () => {
    it('should contain all expected artifact types', () => {
      expectedArtifactTypes.forEach(type => {
        expect(ARTIFACT_TYPES).toContain(type);
      });
    });

    it('should have exactly 6 artifact types', () => {
      expect(ARTIFACT_TYPES.length).toBe(6);
    });
  });

  describe('artifactVersionSchema', () => {
    it('should validate a complete version object', () => {
      const validVersion = {
        id: 'ver-001',
        artifactId: 'art-001',
        versionNumber: 1,
        content: 'Version content',
        sizeBytes: 15,
        sha256Hash: 'hash123',
        createdAt: new Date(),
        createdBy: 'test-user',
        changeDescription: 'Initial version',
      };

      const result = artifactVersionSchema.safeParse(validVersion);
      expect(result.success).toBe(true);
    });

    it('should require positive version numbers', () => {
      const invalidVersion = {
        id: 'ver-001',
        artifactId: 'art-001',
        versionNumber: -1,
        content: 'Content',
        sizeBytes: 7,
        sha256Hash: 'hash123',
        createdAt: new Date(),
        createdBy: 'test-user',
        changeDescription: 'Test',
      };

      const result = artifactVersionSchema.safeParse(invalidVersion);
      expect(result.success).toBe(false);
    });
  });

  describe('insertArtifactVersionSchema', () => {
    it('should validate insert payload for versions', () => {
      const insertPayload = {
        artifactId: 'art-001',
        versionNumber: 2,
        content: 'Updated content',
        sizeBytes: 15,
        sha256Hash: 'abc123def456',
        createdBy: 'test-user',
        changeDescription: 'Added new section',
      };

      const result = insertArtifactVersionSchema.safeParse(insertPayload);
      expect(result.success).toBe(true);
    });
  });
});
