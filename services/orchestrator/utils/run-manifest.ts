/**
 * Run Manifest Utilities
 * INF-13: Helper functions for creating and managing runtime manifests
 *
 * All operations are:
 * - Metadata-only (no PHI or content)
 * - Deterministic (reproducible across runs)
 * - Network-agnostic (no external calls)
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  RunManifest,
  ManifestEntry,
  RuntimeConfigSnapshot,
} from "@researchflow/core/types/run-manifest"

/**
 * Generates stable JSON string with sorted keys for deterministic hashing
 * Ensures same content always produces same hash regardless of key order
 */
function stableJsonStringify(obj: unknown): string {
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted);
}

/**
 * Recursively sorts all object keys alphabetically
 * Ensures deterministic serialization
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as object).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return obj;
}

/**
 * Computes SHA-256 hash with stable serialization
 * Same manifest data always produces identical hash
 */
export function computeManifestHash(manifest: RunManifest): string {
  // Create a copy without the deterministicHash field for hashing
  const { deterministicHash, ...manifestForHash } = manifest;

  const jsonString = stableJsonStringify(manifestForHash);
  return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
}

/**
 * Creates a new run manifest with default values
 * Status: 'pending', completedAt: null, deterministicHash: null
 */
export function createRunManifest(config: RuntimeConfigSnapshot): RunManifest {
  return {
    runId: uuidv4(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'pending',
    config,
    artifacts: [],
    pipelineVersion: '1.0.0',
    deterministicHash: null,
  };
}

/**
 * Adds an artifact entry to the manifest
 * Mutates the manifest in place
 *
 * @param manifest - The manifest to update
 * @param entry - The artifact metadata to add
 */
export function addArtifactToManifest(
  manifest: RunManifest,
  entry: ManifestEntry
): void {
  manifest.artifacts.push(entry);
}

/**
 * Finalizes the manifest by:
 * - Setting completedAt to current timestamp
 * - Setting status to 'completed'
 * - Computing and storing the deterministic hash
 *
 * Call this when the run has finished successfully
 */
export function finalizeManifest(manifest: RunManifest): void {
  manifest.completedAt = new Date().toISOString();
  manifest.status = 'completed';
  manifest.deterministicHash = computeManifestHash(manifest);
}

/**
 * Creates a manifest entry from artifact metadata
 * Useful helper for building artifact entries
 *
 * @param artifactId - Unique identifier for the artifact
 * @param filename - Name of the artifact file
 * @param sha256 - SHA-256 hash of the artifact content
 * @param sizeBytes - Size of the artifact in bytes
 */
export function createManifestEntry(
  artifactId: string,
  filename: string,
  sha256: string,
  sizeBytes: number
): ManifestEntry {
  return {
    artifactId,
    filename,
    sha256,
    sizeBytes,
  };
}

/**
 * Validates that a manifest contains only metadata (no PHI/content)
 * Checks for common PHI patterns in string values
 */
export function validateManifestMetadataOnly(manifest: RunManifest): boolean {
  // Manifest should never contain actual content
  const stringified = JSON.stringify(manifest);

  // Check for common PHI patterns (simple checks)
  // These are basic patterns and not comprehensive
  const phi_patterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
    /\b\d{10,}\b/, // Phone-like
    /MRN[:\s]*\d+/, // Medical record numbers
  ];

  for (const pattern of phi_patterns) {
    if (pattern.test(stringified)) {
      return false;
    }
  }

  return true;
}
