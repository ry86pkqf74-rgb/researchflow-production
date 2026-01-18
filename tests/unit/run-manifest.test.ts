/**
 * Run Manifest Unit Tests
 * INF-13: Verifies manifest creation, hash stability, and metadata-only tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRunManifest,
  addArtifactToManifest,
  finalizeManifest,
  computeManifestHash,
  createManifestEntry,
  validateManifestMetadataOnly,
} from '@apps/api-node/utils/run-manifest';
import type {
  RunManifest,
  RuntimeConfigSnapshot,
  ManifestEntry,
} from '@packages/core/types/run-manifest';

describe('Run Manifest System (INF-13)', () => {
  let config: RuntimeConfigSnapshot;
  let manifest: RunManifest;

  beforeEach(() => {
    config = {
      ros_mode: 'STANDBY',
      no_network: false,
      mock_only: true,
    };
    manifest = createRunManifest(config);
  });

  describe('createRunManifest', () => {
    it('should create manifest with correct defaults', () => {
      expect(manifest.runId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(manifest.status).toBe('pending');
      expect(manifest.completedAt).toBeNull();
      expect(manifest.artifacts).toEqual([]);
      expect(manifest.pipelineVersion).toBe('1.0.0');
      expect(manifest.deterministicHash).toBeNull();
    });

    it('should set startedAt to ISO timestamp', () => {
      expect(manifest.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should preserve runtime config', () => {
      expect(manifest.config).toEqual(config);
      expect(manifest.config.ros_mode).toBe('STANDBY');
      expect(manifest.config.no_network).toBe(false);
      expect(manifest.config.mock_only).toBe(true);
    });

    it('should create unique manifests with different runIds', () => {
      const manifest2 = createRunManifest(config);
      expect(manifest.runId).not.toBe(manifest2.runId);
    });

    it('should create different startedAt timestamps for different calls', async () => {
      const manifest1 = createRunManifest(config);
      await new Promise(resolve => setTimeout(resolve, 10));
      const manifest2 = createRunManifest(config);
      expect(manifest1.startedAt).not.toBe(manifest2.startedAt);
    });

    it('should support different runtime configs', () => {
      const activeConfig: RuntimeConfigSnapshot = {
        ros_mode: 'ACTIVE',
        no_network: true,
        mock_only: false,
      };
      const activeManifest = createRunManifest(activeConfig);
      expect(activeManifest.config.ros_mode).toBe('ACTIVE');
      expect(activeManifest.config.no_network).toBe(true);
    });
  });

  describe('createManifestEntry', () => {
    it('should create manifest entry with all required fields', () => {
      const entry = createManifestEntry(
        'art-001',
        'output.txt',
        'abc123',
        1024
      );

      expect(entry.artifactId).toBe('art-001');
      expect(entry.filename).toBe('output.txt');
      expect(entry.sha256).toBe('abc123');
      expect(entry.sizeBytes).toBe(1024);
    });

    it('should accept various filename formats', () => {
      const filenames = [
        'simple.txt',
        'path/to/file.json',
        'file-with-dashes.csv',
        'file_with_underscores.pdf',
      ];

      for (const filename of filenames) {
        const entry = createManifestEntry('art-id', filename, 'hash', 100);
        expect(entry.filename).toBe(filename);
      }
    });
  });

  describe('addArtifactToManifest', () => {
    it('should add artifact to empty manifest', () => {
      const entry = createManifestEntry('art-001', 'test.txt', 'hash1', 100);
      addArtifactToManifest(manifest, entry);

      expect(manifest.artifacts).toHaveLength(1);
      expect(manifest.artifacts[0]).toEqual(entry);
    });

    it('should add multiple artifacts to manifest', () => {
      const entry1 = createManifestEntry('art-001', 'test1.txt', 'hash1', 100);
      const entry2 = createManifestEntry('art-002', 'test2.txt', 'hash2', 200);

      addArtifactToManifest(manifest, entry1);
      addArtifactToManifest(manifest, entry2);

      expect(manifest.artifacts).toHaveLength(2);
      expect(manifest.artifacts[0].artifactId).toBe('art-001');
      expect(manifest.artifacts[1].artifactId).toBe('art-002');
    });

    it('should preserve artifact order', () => {
      const entries = [
        createManifestEntry('art-1', 'a.txt', 'hash1', 100),
        createManifestEntry('art-2', 'b.txt', 'hash2', 200),
        createManifestEntry('art-3', 'c.txt', 'hash3', 300),
      ];

      for (const entry of entries) {
        addArtifactToManifest(manifest, entry);
      }

      expect(manifest.artifacts.map(a => a.artifactId)).toEqual([
        'art-1',
        'art-2',
        'art-3',
      ]);
    });
  });

  describe('computeManifestHash', () => {
    it('should compute deterministic hash for same manifest data', () => {
      const entry = createManifestEntry('art-001', 'test.txt', 'abc123', 1024);
      addArtifactToManifest(manifest, entry);

      const hash1 = computeManifestHash(manifest);
      const hash2 = computeManifestHash(manifest);

      expect(hash1).toBe(hash2);
    });

    it('should produce 64-character hex string', () => {
      const hash = computeManifestHash(manifest);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce identical hashes for manifests with same data', () => {
      const manifest2 = createRunManifest(config);
      manifest.runId = manifest2.runId; // Make runIds same
      manifest.startedAt = manifest2.startedAt; // Make timestamps same

      const hash1 = computeManifestHash(manifest);
      const hash2 = computeManifestHash(manifest2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different manifest data', () => {
      const entry1 = createManifestEntry('art-001', 'test1.txt', 'hash1', 100);
      const entry2 = createManifestEntry('art-002', 'test2.txt', 'hash2', 200);

      const manifest1 = createRunManifest(config);
      const manifest2 = createRunManifest(config);

      manifest1.runId = manifest2.runId;
      manifest1.startedAt = manifest2.startedAt;

      addArtifactToManifest(manifest1, entry1);
      addArtifactToManifest(manifest2, entry2);

      expect(computeManifestHash(manifest1)).not.toBe(
        computeManifestHash(manifest2)
      );
    });

    it('should handle manifests with no artifacts', () => {
      const hash = computeManifestHash(manifest);
      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle manifests with many artifacts', () => {
      for (let i = 0; i < 100; i++) {
        const entry = createManifestEntry(
          `art-${i}`,
          `file${i}.txt`,
          `hash${i}`,
          100 * i
        );
        addArtifactToManifest(manifest, entry);
      }

      const hash = computeManifestHash(manifest);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('finalizeManifest', () => {
    it('should set completedAt to ISO timestamp', () => {
      finalizeManifest(manifest);

      expect(manifest.completedAt).toBeTruthy();
      expect(manifest.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should set status to completed', () => {
      expect(manifest.status).toBe('pending');
      finalizeManifest(manifest);
      expect(manifest.status).toBe('completed');
    });

    it('should compute and store deterministicHash', () => {
      expect(manifest.deterministicHash).toBeNull();

      finalizeManifest(manifest);

      expect(manifest.deterministicHash).toBeTruthy();
      expect(manifest.deterministicHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should store hash that matches independent computation', () => {
      finalizeManifest(manifest);

      const storedHash = manifest.deterministicHash;
      const recomputedHash = computeManifestHash(manifest);

      expect(storedHash).toBe(recomputedHash);
    });

    it('should finalize manifest with artifacts', () => {
      const entry = createManifestEntry('art-001', 'test.txt', 'hash1', 100);
      addArtifactToManifest(manifest, entry);

      finalizeManifest(manifest);

      expect(manifest.status).toBe('completed');
      expect(manifest.deterministicHash).toBeTruthy();
      expect(manifest.artifacts).toHaveLength(1);
    });
  });

  describe('validateManifestMetadataOnly', () => {
    it('should return true for valid metadata-only manifest', () => {
      expect(validateManifestMetadataOnly(manifest)).toBe(true);
    });

    it('should return true for manifest with artifacts', () => {
      const entry = createManifestEntry('art-001', 'test.txt', 'abc123', 1024);
      addArtifactToManifest(manifest, entry);

      expect(validateManifestMetadataOnly(manifest)).toBe(true);
    });

    it('should return true for finalized manifest', () => {
      finalizeManifest(manifest);
      expect(validateManifestMetadataOnly(manifest)).toBe(true);
    });

    it('should reject manifest with SSN-like content', () => {
      // Create a manifest with PHI-like data
      (manifest as any).phi_test = '123-45-6789';

      expect(validateManifestMetadataOnly(manifest)).toBe(false);
    });

    it('should reject manifest with MRN-like content', () => {
      (manifest as any).mrn_test = 'MRN: 987654321';

      expect(validateManifestMetadataOnly(manifest)).toBe(false);
    });
  });

  describe('Deterministic JSON Output', () => {
    it('should have consistent key ordering in computed hash', () => {
      const entry1 = createManifestEntry('art-001', 'file.txt', 'hash1', 100);
      const entry2 = createManifestEntry('art-002', 'file2.txt', 'hash2', 200);

      addArtifactToManifest(manifest, entry1);
      addArtifactToManifest(manifest, entry2);

      const hash1 = computeManifestHash(manifest);

      // Recompute multiple times - should always be identical
      for (let i = 0; i < 10; i++) {
        expect(computeManifestHash(manifest)).toBe(hash1);
      }
    });

    it('should produce same hash regardless of how manifest was built', () => {
      const manifest2 = createRunManifest(config);

      // Sync the mutable fields
      manifest.runId = manifest2.runId;
      manifest.startedAt = manifest2.startedAt;

      const entry1a = createManifestEntry('art-a', 'file1.txt', 'hash1', 100);
      const entry1b = createManifestEntry('art-b', 'file2.txt', 'hash2', 200);

      const entry2a = createManifestEntry('art-a', 'file1.txt', 'hash1', 100);
      const entry2b = createManifestEntry('art-b', 'file2.txt', 'hash2', 200);

      addArtifactToManifest(manifest, entry1a);
      addArtifactToManifest(manifest, entry1b);

      addArtifactToManifest(manifest2, entry2a);
      addArtifactToManifest(manifest2, entry2b);

      expect(computeManifestHash(manifest)).toBe(computeManifestHash(manifest2));
    });
  });

  describe('End-to-End Workflow', () => {
    it('should handle complete manifest lifecycle', () => {
      // Create manifest
      const testConfig: RuntimeConfigSnapshot = {
        ros_mode: 'ACTIVE',
        no_network: true,
        mock_only: false,
      };
      const testManifest = createRunManifest(testConfig);

      expect(testManifest.status).toBe('pending');
      expect(testManifest.deterministicHash).toBeNull();

      // Add artifacts
      const artifact1 = createManifestEntry(
        'art-results-001',
        'analysis_results.json',
        'abcd1234efgh5678',
        2048
      );
      const artifact2 = createManifestEntry(
        'art-report-001',
        'execution_report.txt',
        'ijkl9012mnop3456',
        512
      );

      addArtifactToManifest(testManifest, artifact1);
      addArtifactToManifest(testManifest, artifact2);

      expect(testManifest.artifacts).toHaveLength(2);

      // Finalize manifest
      finalizeManifest(testManifest);

      expect(testManifest.status).toBe('completed');
      expect(testManifest.completedAt).toBeTruthy();
      expect(testManifest.deterministicHash).toBeTruthy();

      // Validate
      expect(validateManifestMetadataOnly(testManifest)).toBe(true);

      // Verify hash stability
      expect(computeManifestHash(testManifest)).toBe(testManifest.deterministicHash);
    });

    it('should verify manifest integrity across multiple operations', () => {
      const testManifest = createRunManifest(config);
      const initialHash = computeManifestHash(testManifest);

      // Hash should not change with no modifications
      expect(computeManifestHash(testManifest)).toBe(initialHash);

      // Hash should change when artifacts are added
      const entry = createManifestEntry('art-001', 'test.txt', 'hash1', 100);
      addArtifactToManifest(testManifest, entry);

      const hashWithArtifact = computeManifestHash(testManifest);
      expect(hashWithArtifact).not.toBe(initialHash);

      // Finalization changes the manifest (adds completedAt, changes status)
      // so the hash will be different, but should match freshly computed hash
      finalizeManifest(testManifest);
      expect(testManifest.deterministicHash).toBe(computeManifestHash(testManifest));
    });
  });
});
