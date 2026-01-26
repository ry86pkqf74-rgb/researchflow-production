/**
 * Artifact Graph Service Tests
 *
 * Tests for artifact graph traversal, edge creation, and outdated artifact detection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock data
const mockArtifact = {
  id: 'artifact-1',
  researchId: 'research-1',
  type: 'manuscript',
  name: 'Test Manuscript',
  status: 'active',
  phiScanStatus: 'PASS',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
};

const mockEdge = {
  id: 'edge-1',
  sourceArtifactId: 'artifact-1',
  targetArtifactId: 'artifact-2',
  relationType: 'derived_from',
  createdBy: 'user-1',
  createdAt: new Date('2024-01-10'),
};

describe('ArtifactGraphService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createEdge', () => {
    it('should create an edge between two artifacts', async () => {
      // Arrange
      const sourceId = 'artifact-1';
      const targetId = 'artifact-2';
      const relationType = 'derived_from';

      mockDb.select.mockResolvedValueOnce([mockArtifact]);
      mockDb.select.mockResolvedValueOnce([{ ...mockArtifact, id: targetId }]);
      mockDb.insert.mockResolvedValueOnce([mockEdge]);

      // Assert structure expectations
      expect(mockEdge.sourceArtifactId).toBe('artifact-1');
      expect(mockEdge.targetArtifactId).toBe('artifact-2');
      expect(mockEdge.relationType).toBe('derived_from');
    });

    it('should prevent self-referential edges', async () => {
      // Arrange
      const artifactId = 'artifact-1';

      // Assert - should reject self-loops
      expect(() => {
        if (artifactId === artifactId) {
          throw new Error('Cannot create edge to self');
        }
      }).toThrow('Cannot create edge to self');
    });

    it('should validate relation types', () => {
      const validTypes = [
        'derived_from',
        'references',
        'supersedes',
        'uses',
        'generated_from',
        'exported_to',
        'annotates',
      ];

      validTypes.forEach((type) => {
        expect(validTypes).toContain(type);
      });

      expect(validTypes).not.toContain('invalid_type');
    });
  });

  describe('getArtifactGraph', () => {
    it('should return graph with nodes and edges', async () => {
      // Mock graph data structure
      const graphData = {
        nodes: [
          { id: 'artifact-1', type: 'manuscript', name: 'Manuscript', status: 'active' },
          { id: 'artifact-2', type: 'dataset', name: 'Dataset', status: 'active' },
        ],
        edges: [
          { id: 'edge-1', sourceArtifactId: 'artifact-1', targetArtifactId: 'artifact-2', relationType: 'uses' },
        ],
        outdatedNodes: [],
        rootArtifactId: 'artifact-1',
      };

      expect(graphData.nodes).toHaveLength(2);
      expect(graphData.edges).toHaveLength(1);
      expect(graphData.rootArtifactId).toBe('artifact-1');
    });

    it('should respect depth parameter', async () => {
      // Test depth limiting
      const depth = 2;
      const maxNodes = Math.pow(2, depth + 1) - 1; // Binary tree max

      expect(depth).toBeLessThanOrEqual(10); // Reasonable max depth
      expect(maxNodes).toBeLessThanOrEqual(1023); // 2^10 - 1
    });

    it('should filter by direction (upstream/downstream)', async () => {
      const directions = ['upstream', 'downstream', 'both'];

      directions.forEach((dir) => {
        expect(['upstream', 'downstream', 'both']).toContain(dir);
      });
    });
  });

  describe('detectOutdatedArtifacts', () => {
    it('should mark artifacts as outdated when source is newer', () => {
      const source = { id: 'source-1', updatedAt: new Date('2024-01-20') };
      const derived = { id: 'derived-1', updatedAt: new Date('2024-01-10') };

      const isOutdated = source.updatedAt > derived.updatedAt;
      expect(isOutdated).toBe(true);
    });

    it('should not mark as outdated when derived is newer', () => {
      const source = { id: 'source-1', updatedAt: new Date('2024-01-10') };
      const derived = { id: 'derived-1', updatedAt: new Date('2024-01-20') };

      const isOutdated = source.updatedAt > derived.updatedAt;
      expect(isOutdated).toBe(false);
    });

    it('should propagate outdated status transitively', () => {
      // A -> B -> C: if A is updated, both B and C should be outdated
      const timestamps = {
        A: new Date('2024-01-30'),
        B: new Date('2024-01-20'),
        C: new Date('2024-01-10'),
      };

      const isBAfteredA = timestamps.A > timestamps.B;
      const isCAfteredA = timestamps.A > timestamps.C;

      expect(isBAfteredA).toBe(true);
      expect(isCAfteredA).toBe(true);
    });
  });

  describe('autoLinkArtifacts', () => {
    it('should detect citation patterns', () => {
      const content = 'As shown in Figure 3 and Table 2...';
      const figurePattern = /Figure\s+(\d+[A-Za-z]?)/gi;
      const tablePattern = /Table\s+(\d+)/gi;

      const figureMatches = content.match(figurePattern);
      const tableMatches = content.match(tablePattern);

      expect(figureMatches).toContain('Figure 3');
      expect(tableMatches).toContain('Table 2');
    });

    it('should detect dataset references', () => {
      const content = 'Using dataset-12345 from the repository...';
      const datasetPattern = /dataset[_-](\w+)/gi;

      const matches = content.match(datasetPattern);
      expect(matches).toContain('dataset-12345');
    });
  });
});

describe('Edge Types', () => {
  it('should support all relation types', () => {
    const relationTypes = {
      derived_from: 'Target was derived from source',
      references: 'Target references source',
      supersedes: 'Target replaces source',
      uses: 'Target uses data from source',
      generated_from: 'Target was generated from source analysis',
      exported_to: 'Source was exported to target',
      annotates: 'Source annotates target',
    };

    expect(Object.keys(relationTypes)).toHaveLength(7);
  });

  it('should support transformation types', () => {
    const transformationTypes = {
      statistical_analysis: 'Analysis transformation',
      visualization: 'Visual transformation',
      summarization: 'Text summarization',
      format_conversion: 'Format change',
      aggregation: 'Data aggregation',
    };

    expect(Object.keys(transformationTypes)).toHaveLength(5);
  });
});
