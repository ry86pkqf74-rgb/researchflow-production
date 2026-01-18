/**
 * Synthetic test fixtures for artifact testing
 * INF-12: Metadata-only test data (no PHI, no real content)
 * 
 * These fixtures contain ONLY metadata - no actual research content,
 * no PHI, no snippets. Safe for CI/offline testing.
 */

import type { InsertArtifact, InsertArtifactVersion, ArtifactType } from '../../packages/core/types/schema';

export const SYNTHETIC_RESEARCH_ID = 'TEST-20260116-SYNTH01';
export const SYNTHETIC_SESSION_ID = 'SES-TEST-001';

export const syntheticArtifacts: InsertArtifact[] = [
  {
    researchId: SYNTHETIC_RESEARCH_ID,
    stageId: 'stage-1',
    artifactType: 'manuscript',
    filename: 'test-manuscript-v1.md',
    mimeType: 'text/markdown',
    content: '# Test Manuscript\n\nThis is synthetic test content for integration testing.',
    sizeBytes: 72,
    sha256Hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    createdBy: 'test-researcher',
  },
  {
    researchId: SYNTHETIC_RESEARCH_ID,
    stageId: 'stage-3',
    artifactType: 'irb_document',
    filename: 'test-irb-proposal.md',
    mimeType: 'text/markdown',
    content: '# IRB Proposal\n\nSynthetic IRB document for testing purposes only.',
    sizeBytes: 64,
    sha256Hash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    createdBy: 'test-researcher',
  },
  {
    researchId: SYNTHETIC_RESEARCH_ID,
    stageId: 'stage-9',
    artifactType: 'analysis_output',
    filename: 'test-analysis.json',
    mimeType: 'application/json',
    content: JSON.stringify({
      type: 'synthetic',
      records: 0,
      metrics: { test: true }
    }),
    sizeBytes: 51,
    sha256Hash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    createdBy: 'test-researcher',
  },
  {
    researchId: SYNTHETIC_RESEARCH_ID,
    stageId: 'stage-5',
    artifactType: 'config_snapshot',
    filename: 'config-snapshot.json',
    mimeType: 'application/json',
    content: JSON.stringify({
      version: '1.0.0',
      mode: 'STANDBY',
      timestamp: '2026-01-16T00:00:00.000Z'
    }),
    sizeBytes: 65,
    sha256Hash: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    createdBy: 'system',
  },
  {
    researchId: SYNTHETIC_RESEARCH_ID,
    stageId: 'stage-13',
    artifactType: 'execution_log',
    filename: 'execution-log.jsonl',
    mimeType: 'application/x-jsonlines',
    content: '{"event":"start","timestamp":"2026-01-16T00:00:00Z"}\n{"event":"complete","timestamp":"2026-01-16T00:01:00Z"}',
    sizeBytes: 108,
    sha256Hash: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    createdBy: 'system',
  }
];

export const syntheticVersions: Omit<InsertArtifactVersion, 'artifactId'>[] = [
  {
    versionNumber: 1,
    content: '# Test Manuscript v1\n\nInitial version.',
    sizeBytes: 40,
    sha256Hash: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
    createdBy: 'test-researcher',
    changeDescription: 'Initial creation',
  },
  {
    versionNumber: 2,
    content: '# Test Manuscript v2\n\nUpdated with additional content.',
    sizeBytes: 57,
    sha256Hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    createdBy: 'test-researcher',
    changeDescription: 'Added methodology section',
  }
];

export const expectedArtifactTypes: ArtifactType[] = [
  'manuscript',
  'irb_document',
  'analysis_output',
  'dataset',
  'config_snapshot',
  'execution_log'
];

export const invalidArtifactPayloads = [
  { reason: 'missing researchId', payload: { stageId: 's1', artifactType: 'manuscript', filename: 'x.md', mimeType: 'text/plain', content: 'x', createdBy: 'x' } },
  { reason: 'invalid artifactType', payload: { researchId: 'R1', stageId: 's1', artifactType: 'invalid_type', filename: 'x.md', mimeType: 'text/plain', content: 'x', createdBy: 'x' } },
];
