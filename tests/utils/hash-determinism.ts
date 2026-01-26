/**
 * Hash Determinism Harness
 * INF-12: Utilities for verifying SHA-256 hash stability
 * 
 * Ensures consistent hash generation across runs for artifact integrity.
 */

import crypto from 'crypto';

/**
 * Computes SHA-256 hash of content (matches server implementation)
 */
export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Verifies hash determinism by computing hash multiple times
 */
export function verifyHashDeterminism(content: string, iterations: number = 10): boolean {
  const hashes = new Set<string>();
  
  for (let i = 0; i < iterations; i++) {
    hashes.add(computeSha256(content));
  }
  
  return hashes.size === 1;
}

/**
 * Test cases for determinism verification
 */
export const DETERMINISM_TEST_CASES = [
  { name: 'empty string', content: '', expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { name: 'simple text', content: 'Hello, World!', expectedHash: 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f' },
  { name: 'json object', content: '{"key":"value"}', expectedHash: '52076f5f2d7a9a37b95cfe73c7a5f2c2c8e57e9e22f8916a8d4a8d5b5f12c5dc' },
  { name: 'multiline content', content: 'Line 1\nLine 2\nLine 3', expectedHash: null }, // Will be computed
  { name: 'unicode content', content: 'Hello 世界 🌍', expectedHash: null }, // Will be computed
];

/**
 * Generates stable JSON string (sorted keys) for deterministic hashing
 */
export function stableJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/**
 * Computes hash of object with stable key ordering
 */
export function computeStableObjectHash(obj: unknown): string {
  return computeSha256(stableJsonStringify(obj));
}

/**
 * Verifies that two objects produce identical hashes regardless of key order
 */
export function verifyObjectHashEquality(obj1: object, obj2: object): boolean {
  return computeStableObjectHash(obj1) === computeStableObjectHash(obj2);
}

/**
 * Creates a manifest entry for an artifact (for INF-13 run manifests)
 */
export interface ManifestEntry {
  artifactId: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
}

export function createManifestEntry(
  artifactId: string,
  filename: string,
  content: string
): ManifestEntry {
  return {
    artifactId,
    filename,
    sha256: computeSha256(content),
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    createdAt: new Date().toISOString(),
  };
}
