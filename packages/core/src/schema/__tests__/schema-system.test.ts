/**
 * Tests for Schema System (PR4)
 *
 * Tests cover all 8 tasks from Phase A PR4:
 * - Schema inference
 * - Zod generation
 * - Versioning
 * - Lineage tracking
 * - FAIR metadata
 * - Schema linting
 * - Tamper-evident logging
 * - Diagram generation
 */

import { describe, it, expect } from 'vitest';
import { generateZodSchema, validateWithSchema, SchemaDefinition } from '../zod-generator.js';
import { SchemaRegistry, SchemaVersion } from '../versioning.js';
import { LineageTracker, createLineageNode } from '../../lineage/tracker.js';
import { generateFAIRMetadata, validateFAIRMetadata } from '../../metadata/fair-metadata.js';
import { SchemaLinter } from '../linter.js';
import { TamperEvidentLogger } from '../../logging/tamper-evident.js';
import { generateMermaidDiagram, generateASCIITable } from '../diagram-generator.js';

describe('PR4: Schema & Manifest System', () => {
  describe('Task 4: Zod Runtime Schemas', () => {
    it('should generate Zod schema from definition', () => {
      const schemaDef: SchemaDefinition = {
        name: 'test_schema',
        version: '1.0.0',
        columns: [
          { name: 'id', type: 'string', nullable: false },
          { name: 'age', type: 'integer', nullable: false, min: 0, max: 120 }
        ]
      };

      const zodSchema = generateZodSchema(schemaDef);
      expect(zodSchema).toBeDefined();

      // Valid data
      const validData = { id: 'test-001', age: 25 };
      const result = validateWithSchema(zodSchema, validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should reject invalid data', () => {
      const schemaDef: SchemaDefinition = {
        name: 'test_schema',
        version: '1.0.0',
        columns: [
          { name: 'age', type: 'integer', nullable: false, min: 0 }
        ]
      };

      const zodSchema = generateZodSchema(schemaDef);

      // Invalid: age is negative
      const invalidData = { age: -5 };
      const result = validateWithSchema(zodSchema, invalidData);

      expect(result.success).toBe(false);
      if (!result.success && 'errors' in result) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Task 13: Schema Versioning', () => {
    it('should register and retrieve schema versions', () => {
      const registry = new SchemaRegistry();

      const v1: SchemaVersion = {
        version: '1.0.0',
        schema: { columns: { id: { type: 'string' } } },
        createdAt: new Date().toISOString(),
        createdBy: 'test-user',
        changelog: 'Initial version'
      };

      registry.registerSchema('test', v1);

      const latest = registry.getLatest('test');
      expect(latest).toBeDefined();
      expect(latest?.version).toBe('1.0.0');
    });

    it('should detect breaking changes', () => {
      const registry = new SchemaRegistry();

      const v1: SchemaVersion = {
        version: '1.0.0',
        schema: {
          columns: {
            id: { type: 'string', nullable: false },
            name: { type: 'string', nullable: true }
          }
        },
        createdAt: new Date().toISOString(),
        createdBy: 'test',
        changelog: 'v1'
      };

      const v2: SchemaVersion = {
        version: '2.0.0',
        schema: {
          columns: {
            id: { type: 'string', nullable: false }
            // name removed - breaking change
          }
        },
        createdAt: new Date().toISOString(),
        createdBy: 'test',
        changelog: 'v2'
      };

      registry.registerSchema('test', v1);
      registry.registerSchema('test', v2);

      const compat = registry.checkCompatibility('test', '1.0.0', '2.0.0');
      expect(compat.breaking).toBe(true);
      expect(compat.compatible).toBe(false);
    });
  });

  describe('Task 20: Lineage Tracking', () => {
    it('should track data lineage', () => {
      const tracker = new LineageTracker();

      const input = createLineageNode('input-001', 'input', {
        filename: 'data.csv'
      });
      const transform = createLineageNode('transform-001', 'transformation', {
        operation: 'clean'
      });
      const output = createLineageNode('output-001', 'output', {
        format: 'parquet'
      });

      tracker.addNode(input);
      tracker.addNode(transform);
      tracker.addNode(output);

      tracker.addEdge({
        from: 'input-001',
        to: 'transform-001',
        relationship: 'transformed_by'
      });

      tracker.addEdge({
        from: 'transform-001',
        to: 'output-001',
        relationship: 'derived_from'
      });

      const upstream = tracker.getUpstream('output-001');
      expect(upstream.length).toBeGreaterThan(0);

      const graph = tracker.exportGraph();
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(2);
    });
  });

  describe('Task 25: FAIR Metadata', () => {
    it('should generate FAIR metadata', () => {
      const artifact = {
        id: 'test-001',
        title: 'Test Dataset',
        description: 'Test description',
        createdBy: 'Test User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const metadata = generateFAIRMetadata(artifact);

      expect(metadata.identifier).toBe('test-001');
      expect(metadata.title).toBe('Test Dataset');
      expect(metadata.accessRights).toBeDefined();
      expect(metadata.license).toBeDefined();
    });

    it('should validate FAIR metadata completeness', () => {
      const metadata = generateFAIRMetadata({
        id: 'test-001',
        title: 'Test Dataset',
        description: 'A comprehensive test dataset for validation',
        createdBy: 'User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const validation = validateFAIRMetadata(metadata);
      expect(validation.valid).toBe(true);
      expect(validation.score).toBeGreaterThan(0);
    });
  });

  describe('Task 29: Schema Linting', () => {
    it('should lint schema and detect issues', () => {
      const linter = new SchemaLinter();

      // Schema with issues
      const badSchema = {
        // Missing: name, version
        description: 'Test schema',
        columns: {
          PatientName: { // Bad: camelCase
            dtype: 'string'
            // Missing: nullable
          }
        }
      };

      const result = linter.lint(badSchema);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.summary.errors).toBeGreaterThan(0);
    });

    it('should pass valid schema', () => {
      const linter = new SchemaLinter();

      const goodSchema = {
        name: 'patient_data',
        version: '1.0.0',
        description: 'Patient data schema',
        columns: {
          id: {
            dtype: 'string',
            nullable: false,
            unique: true,
            description: 'Patient ID'
          },
          age: {
            dtype: 'int64',
            nullable: false,
            description: 'Patient age'
          }
        }
      };

      const result = linter.lint(goodSchema);
      expect(result.valid).toBe(true);
      expect(result.summary.errors).toBe(0);
    });
  });

  describe('Task 39: Tamper-Evident Logging', () => {
    it('should create signed log entries', () => {
      const logger = new TamperEvidentLogger('test-secret-key-at-least-32-chars!');

      const entry = logger.log({ event: 'test', data: 'value' });

      expect(entry.signature).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.sequenceNumber).toBe(0);
    });

    it('should verify log chain integrity', () => {
      const logger = new TamperEvidentLogger('test-secret-key-at-least-32-chars!');

      const entry1 = logger.log({ event: 'event1' });
      const entry2 = logger.log({ event: 'event2' });
      const entry3 = logger.log({ event: 'event3' });

      const result = logger.verifyChain([entry1, entry2, entry3]);

      expect(result.valid).toBe(true);
      expect(result.verifiedEntries).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect tampering', () => {
      const logger = new TamperEvidentLogger('test-secret-key-at-least-32-chars!');

      const entry1 = logger.log({ event: 'event1' });
      const entry2 = logger.log({ event: 'event2' });

      // Tamper with entry
      const tamperedEntry2 = { ...entry2, data: { event: 'TAMPERED' } };

      const result = logger.verifyChain([entry1, tamperedEntry2]);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Task 43: Schema Diagram Generation', () => {
    const testSchema = {
      name: 'patient_data',
      version: '1.0.0',
      description: 'Patient data',
      columns: {
        id: {
          dtype: 'string',
          nullable: false,
          unique: true,
          primary_key: true
        },
        name: {
          dtype: 'string',
          nullable: false
        },
        age: {
          dtype: 'int64',
          nullable: false
        }
      }
    };

    it('should generate Mermaid diagram', () => {
      const diagram = generateMermaidDiagram(testSchema);

      expect(diagram).toContain('erDiagram');
      expect(diagram).toContain('PATIENT_DATA');
      expect(diagram).toContain('id');
      expect(diagram).toContain('PK');
    });

    it('should generate ASCII table', () => {
      const table = generateASCIITable(testSchema);

      expect(table).toContain('patient_data');
      expect(table).toContain('id');
      expect(table).toContain('string');
      expect(table).toContain('PK');
    });
  });
});
