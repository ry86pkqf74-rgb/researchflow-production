/**
 * INF-14: Validation Suites Tests
 * Tests for Pandera-style validation system
 */

import { describe, it, expect } from 'vitest';
import {
  ArtifactType,
  createValidationSuite,
  manuscriptValidationSuite,
  datasetSchemaValidationSuite,
  configSnapshotValidationSuite,
  analysisResultValidationSuite,
  VALIDATION_SUITES,
  getValidationSuite,
  validateArtifact,
  listAvailableSuites,
  invariantNoPHI,
  invariantValidJSON,
  invariantMaxSize,
  invariantNonEmpty,
  invariantValidTimestamp,
  invariantRequiredFields,
  detectPHIPatterns,
  validateJSON,
  validateSize,
} from '@apps/api-node/validation';

describe('INF-14: Validation Suites', () => {
  describe('Invariant Checks', () => {
    describe('invariantNoPHI', () => {
      it('should return true for content without PHI', () => {
        expect(invariantNoPHI('This is clean content')).toBe(true);
        expect(invariantNoPHI('Research findings show positive outcomes')).toBe(true);
      });

      it('should return false for SSN patterns', () => {
        expect(invariantNoPHI('Patient SSN: 123-45-6789')).toBe(false);
        expect(invariantNoPHI('SSN 123456789')).toBe(false);
      });

      it('should return false for email addresses', () => {
        expect(invariantNoPHI('Contact: john.doe@hospital.com')).toBe(false);
      });

      it('should return false for phone numbers', () => {
        expect(invariantNoPHI('Call 555-123-4567')).toBe(false);
        expect(invariantNoPHI('Phone: (555) 123-4567')).toBe(false);
      });

      it('should return false for MRN patterns', () => {
        expect(invariantNoPHI('MRN: ABC123456')).toBe(false);
        expect(invariantNoPHI('Patient ID: XYZ789012')).toBe(false);
      });

      it('should return true for empty/null content', () => {
        expect(invariantNoPHI('')).toBe(true);
        expect(invariantNoPHI(null as unknown as string)).toBe(true);
      });
    });

    describe('detectPHIPatterns', () => {
      it('should detect multiple PHI patterns', () => {
        const content = 'Patient: Dr. John Smith, SSN: 123-45-6789, Email: john@hospital.com';
        const result = detectPHIPatterns(content);
        
        expect(result.hasPHI).toBe(true);
        expect(result.totalMatches).toBeGreaterThan(0);
        expect(result.detectedPatterns.length).toBeGreaterThan(0);
      });

      it('should return empty results for clean content', () => {
        const result = detectPHIPatterns('Clean research content');
        expect(result.hasPHI).toBe(false);
        expect(result.totalMatches).toBe(0);
        expect(result.detectedPatterns).toHaveLength(0);
      });
    });

    describe('invariantValidJSON', () => {
      it('should return true for valid JSON', () => {
        expect(invariantValidJSON('{"key": "value"}')).toBe(true);
        expect(invariantValidJSON('[1, 2, 3]')).toBe(true);
        expect(invariantValidJSON('"string"')).toBe(true);
        expect(invariantValidJSON('123')).toBe(true);
        expect(invariantValidJSON('true')).toBe(true);
        expect(invariantValidJSON('null')).toBe(true);
      });

      it('should return false for invalid JSON', () => {
        expect(invariantValidJSON('{invalid}')).toBe(false);
        expect(invariantValidJSON('not json')).toBe(false);
        expect(invariantValidJSON('')).toBe(false);
        expect(invariantValidJSON(null as unknown as string)).toBe(false);
      });
    });

    describe('validateJSON', () => {
      it('should return valid result for valid JSON', () => {
        const result = validateJSON('{"key": "value"}');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should return error details for invalid JSON', () => {
        const result = validateJSON('{invalid}');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('invariantMaxSize', () => {
      it('should return true for content within size limit', () => {
        expect(invariantMaxSize('small', 1000)).toBe(true);
        expect(invariantMaxSize('test', 10)).toBe(true);
      });

      it('should return false for content exceeding size limit', () => {
        expect(invariantMaxSize('This is too long', 5)).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(invariantMaxSize('', 0)).toBe(true);
        expect(invariantMaxSize('a', 0)).toBe(false);
        expect(invariantMaxSize(null as unknown as string, 100)).toBe(true);
      });

      it('should handle unicode correctly', () => {
        const result = validateSize('Hello 世界', 100);
        expect(result.sizeBytes).toBe(12);
      });
    });

    describe('invariantNonEmpty', () => {
      it('should return true for non-empty values', () => {
        expect(invariantNonEmpty('content')).toBe(true);
        expect(invariantNonEmpty([1, 2])).toBe(true);
        expect(invariantNonEmpty({ key: 'value' })).toBe(true);
        expect(invariantNonEmpty(123)).toBe(true);
      });

      it('should return false for empty values', () => {
        expect(invariantNonEmpty('')).toBe(false);
        expect(invariantNonEmpty('   ')).toBe(false);
        expect(invariantNonEmpty([])).toBe(false);
        expect(invariantNonEmpty({})).toBe(false);
        expect(invariantNonEmpty(null)).toBe(false);
        expect(invariantNonEmpty(undefined)).toBe(false);
      });
    });

    describe('invariantValidTimestamp', () => {
      it('should return true for valid timestamps', () => {
        expect(invariantValidTimestamp('2024-01-15T10:30:00Z')).toBe(true);
        expect(invariantValidTimestamp('2024-01-15')).toBe(true);
        expect(invariantValidTimestamp(new Date().toISOString())).toBe(true);
      });

      it('should return false for invalid timestamps', () => {
        expect(invariantValidTimestamp('not a date')).toBe(false);
        expect(invariantValidTimestamp('')).toBe(false);
        expect(invariantValidTimestamp(null as unknown as string)).toBe(false);
      });
    });

    describe('invariantRequiredFields', () => {
      it('should return true when all required fields present', () => {
        const data = { name: 'Test', version: '1.0', status: 'active' };
        expect(invariantRequiredFields(data, ['name', 'version'])).toBe(true);
      });

      it('should return false when required fields missing', () => {
        const data = { name: 'Test' };
        expect(invariantRequiredFields(data, ['name', 'version'])).toBe(false);
      });

      it('should return false for empty string values', () => {
        const data = { name: '', version: '1.0' };
        expect(invariantRequiredFields(data, ['name'])).toBe(false);
      });
    });
  });

  describe('Manuscript Validation Suite', () => {
    it('should validate a complete manuscript', () => {
      const validManuscript = {
        title: 'Research Study on Clinical Outcomes',
        abstract: Array(150).fill('word').join(' '),
        sections: [
          { name: 'Introduction', content: 'Introduction content...' },
          { name: 'Methods', content: 'Methods content...' },
          { name: 'Results', content: 'Results content...' },
          { name: 'Discussion', content: 'Discussion content...' },
        ],
        authors: [
          { name: 'Researcher One', affiliation: 'University' },
        ],
        keywords: ['clinical', 'outcomes', 'research'],
      };

      const result = manuscriptValidationSuite.validate(validManuscript);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for manuscript without title', () => {
      const invalidManuscript = {
        abstract: 'Test abstract',
        sections: [],
      };

      const result = manuscriptValidationSuite.validate(invalidManuscript);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'has_title')).toBe(true);
    });

    it('should fail for manuscript with PHI', () => {
      const manuscriptWithPHI = {
        title: 'Study',
        abstract: 'Patient SSN: 123-45-6789',
        sections: [
          { name: 'Introduction', content: 'Intro' },
          { name: 'Methods', content: 'Methods' },
          { name: 'Results', content: 'Results' },
          { name: 'Discussion', content: 'Discussion' },
        ],
        authors: [{ name: 'Author' }],
      };

      const result = manuscriptValidationSuite.validate(manuscriptWithPHI);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'no_phi_in_content')).toBe(true);
    });

    it('should warn about short abstract', () => {
      const manuscript = {
        title: 'Study',
        abstract: 'Short abstract',
        sections: [
          { name: 'Introduction', content: 'Intro' },
          { name: 'Methods', content: 'Methods' },
          { name: 'Results', content: 'Results' },
          { name: 'Discussion', content: 'Discussion' },
        ],
        authors: [{ name: 'Author' }],
      };

      const result = manuscriptValidationSuite.validate(manuscript);
      expect(result.warnings.some(w => w.includes('100-350 words'))).toBe(true);
    });
  });

  describe('Dataset Schema Validation Suite', () => {
    it('should validate a complete dataset schema', () => {
      const validSchema = {
        name: 'patient_demographics',
        version: '1.0.0',
        description: 'Patient demographic data schema',
        columns: [
          { name: 'id', type: 'uuid', nullable: false },
          { name: 'age', type: 'integer', nullable: false },
          { name: 'diagnosis_date', type: 'date', nullable: true },
        ],
        primaryKey: 'id',
      };

      const result = datasetSchemaValidationSuite.validate(validSchema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for schema without columns', () => {
      const invalidSchema = {
        name: 'test_schema',
        columns: [],
      };

      const result = datasetSchemaValidationSuite.validate(invalidSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'has_columns')).toBe(true);
    });

    it('should fail for invalid column types', () => {
      const schemaWithInvalidType = {
        name: 'test_schema',
        columns: [
          { name: 'field', type: 'invalid_type' },
        ],
      };

      const result = datasetSchemaValidationSuite.validate(schemaWithInvalidType);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'columns_have_valid_types')).toBe(true);
    });

    it('should fail for duplicate column names', () => {
      const schemaWithDuplicates = {
        name: 'test_schema',
        columns: [
          { name: 'field', type: 'string' },
          { name: 'field', type: 'integer' },
        ],
      };

      const result = datasetSchemaValidationSuite.validate(schemaWithDuplicates);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'unique_column_names')).toBe(true);
    });
  });

  describe('Config Snapshot Validation Suite', () => {
    it('should validate a complete config snapshot', () => {
      const validConfig = {
        version: '2.0.0',
        environment: 'production',
        settings: {
          maxRetries: 3,
          timeout: 5000,
        },
        features: {
          enableCache: true,
          debugMode: false,
        },
        createdAt: new Date().toISOString(),
        hash: 'a'.repeat(64),
      };

      const result = configSnapshotValidationSuite.validate(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid environment', () => {
      const invalidConfig = {
        version: '1.0.0',
        environment: 'invalid_env',
        settings: {},
        createdAt: new Date().toISOString(),
      };

      const result = configSnapshotValidationSuite.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'valid_environment')).toBe(true);
    });

    it('should warn about secret-like field names', () => {
      const configWithSecrets = {
        version: '1.0.0',
        environment: 'development',
        settings: {
          database_password: 'should_not_be_here',
        },
        createdAt: new Date().toISOString(),
      };

      const result = configSnapshotValidationSuite.validate(configWithSecrets);
      expect(result.warnings.some(w => w.includes('secret'))).toBe(true);
    });
  });

  describe('Analysis Result Validation Suite', () => {
    it('should validate a complete analysis result', () => {
      const validResult = {
        analysisId: 'analysis-001',
        type: 'regression',
        status: 'completed',
        executedAt: new Date().toISOString(),
        results: {
          coefficients: [0.5, 0.3],
          r_squared: 0.85,
        },
        metrics: {
          accuracy: 0.92,
          precision: 0.88,
        },
        parameters: {
          model: 'linear',
          iterations: 1000,
        },
      };

      const result = analysisResultValidationSuite.validate(validResult);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid status', () => {
      const invalidResult = {
        analysisId: 'analysis-001',
        type: 'test',
        status: 'invalid_status',
        executedAt: new Date().toISOString(),
      };

      const result = analysisResultValidationSuite.validate(invalidResult);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'has_status')).toBe(true);
    });

    it('should fail for completed analysis without results', () => {
      const incompleteResult = {
        analysisId: 'analysis-001',
        type: 'test',
        status: 'completed',
        executedAt: new Date().toISOString(),
      };

      const result = analysisResultValidationSuite.validate(incompleteResult);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'has_results_when_completed')).toBe(true);
    });
  });

  describe('Registry and Lookup', () => {
    it('should have all artifact types registered', () => {
      expect(VALIDATION_SUITES.size).toBe(4);
      expect(VALIDATION_SUITES.has(ArtifactType.MANUSCRIPT)).toBe(true);
      expect(VALIDATION_SUITES.has(ArtifactType.DATASET_SCHEMA)).toBe(true);
      expect(VALIDATION_SUITES.has(ArtifactType.CONFIG_SNAPSHOT)).toBe(true);
      expect(VALIDATION_SUITES.has(ArtifactType.ANALYSIS_RESULT)).toBe(true);
    });

    it('should retrieve suite by artifact type', () => {
      const suite = getValidationSuite(ArtifactType.MANUSCRIPT);
      expect(suite).toBeDefined();
      expect(suite?.name).toBe('Manuscript Validation Suite');
    });

    it('should return undefined for unregistered type', () => {
      const suite = getValidationSuite(ArtifactType.FIGURE);
      expect(suite).toBeUndefined();
    });

    it('should validate artifact using registry', () => {
      const manuscript = {
        title: 'Test',
        abstract: Array(150).fill('word').join(' '),
        sections: [
          { name: 'Introduction', content: 'Intro' },
          { name: 'Methods', content: 'Methods' },
          { name: 'Results', content: 'Results' },
          { name: 'Discussion', content: 'Discussion' },
        ],
        authors: [{ name: 'Author' }],
        keywords: ['a', 'b', 'c'],
      };

      const result = validateArtifact(ArtifactType.MANUSCRIPT, manuscript);
      expect(result.artifactType).toBe(ArtifactType.MANUSCRIPT);
      expect(result.valid).toBe(true);
    });

    it('should return error for unregistered artifact type', () => {
      const result = validateArtifact(ArtifactType.FIGURE, {});
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe('suite_lookup');
    });

    it('should list available suites', () => {
      const suites = listAvailableSuites();
      expect(suites.length).toBe(4);
      expect(suites.every(s => s.ruleCount > 0)).toBe(true);
      expect(suites.every(s => s.version)).toBe(true);
    });
  });

  describe('Deterministic Validation', () => {
    it('should produce consistent results across multiple runs', () => {
      const testData = {
        title: 'Test Study',
        abstract: Array(150).fill('word').join(' '),
        sections: [
          { name: 'Introduction', content: 'Intro content' },
          { name: 'Methods', content: 'Methods content' },
          { name: 'Results', content: 'Results content' },
          { name: 'Discussion', content: 'Discussion content' },
        ],
        authors: [{ name: 'Test Author' }],
        keywords: ['test', 'validation', 'determinism'],
      };

      const results = Array.from({ length: 10 }, () =>
        manuscriptValidationSuite.validate(testData)
      );

      const firstResult = results[0];
      results.forEach((result) => {
        expect(result.valid).toBe(firstResult.valid);
        expect(result.errors.length).toBe(firstResult.errors.length);
        expect(result.warnings.length).toBe(firstResult.warnings.length);
        expect(result.ruleCounts).toEqual(firstResult.ruleCounts);
      });
    });

    it('should produce same error messages for same invalid data', () => {
      const invalidData = {
        title: '',
        sections: [],
      };

      const results = Array.from({ length: 5 }, () =>
        manuscriptValidationSuite.validate(invalidData)
      );

      const firstErrors = results[0].errors.map(e => e.message).sort();
      results.forEach((result) => {
        const errors = result.errors.map(e => e.message).sort();
        expect(errors).toEqual(firstErrors);
      });
    });
  });

  describe('Custom Validation Suite', () => {
    it('should create custom validation suite', () => {
      const customRules = [
        {
          name: 'has_id',
          check: (data: unknown) => {
            const d = data as { id?: string };
            return typeof d?.id === 'string' && d.id.length > 0;
          },
          errorMessage: 'Must have an ID',
        },
        {
          name: 'valid_status',
          check: (data: unknown) => {
            const d = data as { status?: string };
            return ['active', 'inactive'].includes(d?.status || '');
          },
          errorMessage: 'Status must be active or inactive',
        },
      ];

      const suite = createValidationSuite(
        'Custom Suite',
        ArtifactType.PROVENANCE_RECORD,
        customRules,
        '1.0.0'
      );

      expect(suite.name).toBe('Custom Suite');
      expect(suite.rules.length).toBe(2);

      const validResult = suite.validate({ id: 'test-1', status: 'active' });
      expect(validResult.valid).toBe(true);

      const invalidResult = suite.validate({ status: 'unknown' });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBe(2);
    });
  });
});
