/**
 * Hash Determinism Unit Tests
 * INF-12: Verifies SHA-256 hash stability across runs
 */

import { describe, it, expect } from 'vitest';
import {
  computeSha256,
  verifyHashDeterminism,
  DETERMINISM_TEST_CASES,
  stableJsonStringify,
  computeStableObjectHash,
  verifyObjectHashEquality,
  createManifestEntry,
} from '../utils/hash-determinism';

describe('Hash Determinism Harness', () => {
  describe('computeSha256', () => {
    it('should compute correct hash for empty string', () => {
      const hash = computeSha256('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should compute correct hash for simple text', () => {
      const hash = computeSha256('Hello, World!');
      expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });

    it('should return 64 character hex string', () => {
      const hash = computeSha256('test content');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyHashDeterminism', () => {
    it('should return true for deterministic hashing', () => {
      const result = verifyHashDeterminism('consistent content', 100);
      expect(result).toBe(true);
    });

    it('should be deterministic for JSON content', () => {
      const json = JSON.stringify({ key: 'value', nested: { a: 1, b: 2 } });
      const result = verifyHashDeterminism(json, 50);
      expect(result).toBe(true);
    });

    it('should be deterministic for multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3\n';
      const result = verifyHashDeterminism(content, 50);
      expect(result).toBe(true);
    });

    it('should be deterministic for unicode content', () => {
      const content = 'Hello 世界 🌍 مرحبا';
      const result = verifyHashDeterminism(content, 50);
      expect(result).toBe(true);
    });
  });

  describe('stableJsonStringify', () => {
    it('should produce same output regardless of key order', () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(stableJsonStringify(obj1)).toBe(stableJsonStringify(obj2));
    });

    it('should handle nested objects with sorted keys', () => {
      const obj = { z: 1, a: 2, m: 3 };
      const result = stableJsonStringify(obj);
      expect(result).toBe('{"a":2,"m":3,"z":1}');
    });
  });

  describe('computeStableObjectHash', () => {
    it('should produce identical hashes for equivalent objects', () => {
      const obj1 = { name: 'test', value: 123 };
      const obj2 = { value: 123, name: 'test' };
      expect(computeStableObjectHash(obj1)).toBe(computeStableObjectHash(obj2));
    });
  });

  describe('verifyObjectHashEquality', () => {
    it('should return true for objects with same content', () => {
      const obj1 = { x: 1, y: 2 };
      const obj2 = { y: 2, x: 1 };
      expect(verifyObjectHashEquality(obj1, obj2)).toBe(true);
    });

    it('should return false for objects with different content', () => {
      const obj1 = { x: 1, y: 2 };
      const obj2 = { x: 1, y: 3 };
      expect(verifyObjectHashEquality(obj1, obj2)).toBe(false);
    });
  });

  describe('createManifestEntry', () => {
    it('should create manifest entry with correct hash', () => {
      const content = 'Test artifact content';
      const entry = createManifestEntry('art-001', 'test.txt', content);
      
      expect(entry.artifactId).toBe('art-001');
      expect(entry.filename).toBe('test.txt');
      expect(entry.sha256).toBe(computeSha256(content));
      expect(entry.sizeBytes).toBe(Buffer.byteLength(content, 'utf8'));
      expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should compute correct size for unicode content', () => {
      const content = 'Hello 世界';
      const entry = createManifestEntry('art-002', 'unicode.txt', content);
      expect(entry.sizeBytes).toBe(Buffer.byteLength(content, 'utf8'));
    });
  });

  describe('DETERMINISM_TEST_CASES', () => {
    it('should have known hashes for standard test cases', () => {
      const emptyCase = DETERMINISM_TEST_CASES.find(c => c.name === 'empty string');
      expect(emptyCase).toBeDefined();
      expect(computeSha256('')).toBe(emptyCase!.expectedHash);
    });
  });
});
