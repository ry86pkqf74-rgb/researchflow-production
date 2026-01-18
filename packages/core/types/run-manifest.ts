/**
 * Run Manifest System
 * INF-13: Metadata-only manifest for runtime execution tracking
 *
 * Tracks execution metadata without ever containing PHI or actual artifact content.
 * All operations are deterministic for reproducibility.
 */

/**
 * Runtime configuration snapshot for the manifest
 * Captures runtime environment settings without secrets
 */
export interface RuntimeConfigSnapshot {
  ros_mode: 'STANDBY' | 'ACTIVE' | 'SANDBOX';
  no_network: boolean;
  mock_only: boolean;
}

/**
 * Individual artifact entry in the manifest
 * Contains only metadata: no PHI, no content
 */
export interface ManifestEntry {
  artifactId: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
}

/**
 * Complete run manifest
 * Metadata-only tracking of execution for reproducibility
 */
export interface RunManifest {
  runId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: RuntimeConfigSnapshot;
  artifacts: ManifestEntry[];
  pipelineVersion: string;
  deterministicHash: string | null;
}
