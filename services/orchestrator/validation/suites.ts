/**
 * INF-14: Validation Suites (Pandera-style)
 * Validation suite factory and predefined suites for artifact types
 */

import {
  ArtifactType,
  ValidationRule,
  ValidationSuite,
  ValidationResult,
  ValidationError,
  ManuscriptData,
  DatasetSchemaData,
  ConfigSnapshotData,
  AnalysisResultData,
  REQUIRED_MANUSCRIPT_SECTIONS,
  VALID_COLUMN_TYPES,
  VALID_ENVIRONMENTS,
} from './types';

import {
  invariantNoPHI,
  invariantValidJSON,
  invariantMaxSize,
  invariantNonEmpty,
  invariantRequiredFields,
} from './invariants';

export function createValidationSuite(
  name: string,
  artifactType: ArtifactType,
  rules: ValidationRule[],
  version: string = '1.0.0'
): ValidationSuite {
  const validate = (data: unknown): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let passed = 0;
    let failed = 0;

    for (const rule of rules) {
      try {
        const result = rule.check(data);
        if (result) {
          passed++;
        } else {
          failed++;
          const severity = rule.severity || 'error';
          if (severity === 'warning') {
            warnings.push(rule.errorMessage);
          } else {
            errors.push({
              rule: rule.name,
              message: rule.errorMessage,
              path: rule.path,
              severity,
            });
          }
        }
      } catch (e) {
        failed++;
        errors.push({
          rule: rule.name,
          message: `Rule execution error: ${(e as Error).message}`,
          severity: 'error',
          details: { originalError: (e as Error).message },
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
      artifactType,
      ruleCounts: {
        total: rules.length,
        passed,
        failed,
      },
    };
  };

  return {
    name,
    artifactType,
    rules,
    validate,
    version,
  };
}

const manuscriptRules: ValidationRule[] = [
  {
    name: 'has_title',
    check: (data) => {
      const d = data as ManuscriptData;
      return typeof d?.title === 'string' && d.title.trim().length > 0;
    },
    errorMessage: 'Manuscript must have a non-empty title',
    path: 'title',
  },
  {
    name: 'has_abstract',
    check: (data) => {
      const d = data as ManuscriptData;
      return typeof d?.abstract === 'string' && d.abstract.trim().length > 0;
    },
    errorMessage: 'Manuscript must have a non-empty abstract',
    path: 'abstract',
  },
  {
    name: 'abstract_length',
    check: (data) => {
      const d = data as ManuscriptData;
      if (!d?.abstract) return true;
      const wordCount = d.abstract.trim().split(/\s+/).length;
      return wordCount >= 100 && wordCount <= 350;
    },
    errorMessage: 'Abstract should be between 100-350 words',
    severity: 'warning',
    path: 'abstract',
  },
  {
    name: 'has_required_sections',
    check: (data) => {
      const d = data as ManuscriptData;
      if (!d?.sections || !Array.isArray(d.sections)) return false;
      const sectionNames = d.sections.map((s) => s.name?.toLowerCase());
      return REQUIRED_MANUSCRIPT_SECTIONS.every((required) =>
        sectionNames.includes(required)
      );
    },
    errorMessage: `Manuscript must include required sections: ${REQUIRED_MANUSCRIPT_SECTIONS.join(', ')}`,
    path: 'sections',
  },
  {
    name: 'sections_have_content',
    check: (data) => {
      const d = data as ManuscriptData;
      if (!d?.sections || !Array.isArray(d.sections)) return true;
      return d.sections.every(
        (s) => typeof s.content === 'string' && s.content.trim().length > 0
      );
    },
    errorMessage: 'All sections must have non-empty content',
    path: 'sections',
  },
  {
    name: 'has_authors',
    check: (data) => {
      const d = data as ManuscriptData;
      return Array.isArray(d?.authors) && d.authors.length > 0;
    },
    errorMessage: 'Manuscript must have at least one author',
    path: 'authors',
  },
  {
    name: 'authors_have_names',
    check: (data) => {
      const d = data as ManuscriptData;
      if (!d?.authors || !Array.isArray(d.authors)) return true;
      return d.authors.every(
        (a) => typeof a.name === 'string' && a.name.trim().length > 0
      );
    },
    errorMessage: 'All authors must have non-empty names',
    path: 'authors',
  },
  {
    name: 'no_phi_in_content',
    check: (data) => {
      const d = data as ManuscriptData;
      const contentParts = [
        d?.title,
        d?.abstract,
        d?.content,
        ...(d?.sections?.map((s) => s.content) || []),
      ].filter(Boolean);
      return contentParts.every((part) => invariantNoPHI(part as string));
    },
    errorMessage: 'Manuscript contains potential PHI patterns',
    path: 'content',
  },
  {
    name: 'has_keywords',
    check: (data) => {
      const d = data as ManuscriptData;
      return Array.isArray(d?.keywords) && d.keywords.length >= 3;
    },
    errorMessage: 'Manuscript should have at least 3 keywords',
    severity: 'warning',
    path: 'keywords',
  },
];

const datasetSchemaRules: ValidationRule[] = [
  {
    name: 'has_name',
    check: (data) => {
      const d = data as DatasetSchemaData;
      return typeof d?.name === 'string' && d.name.trim().length > 0;
    },
    errorMessage: 'Dataset schema must have a name',
    path: 'name',
  },
  {
    name: 'has_columns',
    check: (data) => {
      const d = data as DatasetSchemaData;
      return Array.isArray(d?.columns) && d.columns.length > 0;
    },
    errorMessage: 'Dataset schema must define at least one column',
    path: 'columns',
  },
  {
    name: 'columns_have_names',
    check: (data) => {
      const d = data as DatasetSchemaData;
      if (!d?.columns || !Array.isArray(d.columns)) return true;
      return d.columns.every(
        (c) => typeof c.name === 'string' && c.name.trim().length > 0
      );
    },
    errorMessage: 'All columns must have non-empty names',
    path: 'columns',
  },
  {
    name: 'columns_have_valid_types',
    check: (data) => {
      const d = data as DatasetSchemaData;
      if (!d?.columns || !Array.isArray(d.columns)) return true;
      return d.columns.every((c) =>
        VALID_COLUMN_TYPES.includes(c.type as typeof VALID_COLUMN_TYPES[number])
      );
    },
    errorMessage: `Column types must be one of: ${VALID_COLUMN_TYPES.join(', ')}`,
    path: 'columns',
  },
  {
    name: 'unique_column_names',
    check: (data) => {
      const d = data as DatasetSchemaData;
      if (!d?.columns || !Array.isArray(d.columns)) return true;
      const names = d.columns.map((c) => c.name);
      return new Set(names).size === names.length;
    },
    errorMessage: 'Column names must be unique',
    path: 'columns',
  },
  {
    name: 'has_primary_key',
    check: (data) => {
      const d = data as DatasetSchemaData;
      return d?.primaryKey !== undefined && d.primaryKey !== null;
    },
    errorMessage: 'Dataset schema should define a primary key',
    severity: 'warning',
    path: 'primaryKey',
  },
  {
    name: 'primary_key_exists_in_columns',
    check: (data) => {
      const d = data as DatasetSchemaData;
      if (!d?.primaryKey || !d?.columns) return true;
      const columnNames = d.columns.map((c) => c.name);
      const pkFields = Array.isArray(d.primaryKey)
        ? d.primaryKey
        : [d.primaryKey];
      return pkFields.every((pk) => columnNames.includes(pk));
    },
    errorMessage: 'Primary key must reference existing columns',
    path: 'primaryKey',
  },
  {
    name: 'has_version',
    check: (data) => {
      const d = data as DatasetSchemaData;
      return typeof d?.version === 'string' && d.version.trim().length > 0;
    },
    errorMessage: 'Dataset schema should have a version',
    severity: 'warning',
    path: 'version',
  },
  {
    name: 'no_phi_in_column_names',
    check: (data) => {
      const d = data as DatasetSchemaData;
      if (!d?.columns) return true;
      const columnNames = d.columns.map((c) => c.name).join(' ');
      return invariantNoPHI(columnNames);
    },
    errorMessage: 'Column names should not contain PHI patterns',
    path: 'columns',
  },
];

const configSnapshotRules: ValidationRule[] = [
  {
    name: 'has_version',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      return typeof d?.version === 'string' && d.version.trim().length > 0;
    },
    errorMessage: 'Config snapshot must have a version',
    path: 'version',
  },
  {
    name: 'has_environment',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      return typeof d?.environment === 'string' && d.environment.trim().length > 0;
    },
    errorMessage: 'Config snapshot must specify an environment',
    path: 'environment',
  },
  {
    name: 'valid_environment',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      if (!d?.environment) return true;
      return VALID_ENVIRONMENTS.includes(
        d.environment as typeof VALID_ENVIRONMENTS[number]
      );
    },
    errorMessage: `Environment must be one of: ${VALID_ENVIRONMENTS.join(', ')}`,
    path: 'environment',
  },
  {
    name: 'has_settings',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      return d?.settings !== undefined && typeof d.settings === 'object';
    },
    errorMessage: 'Config snapshot must have settings object',
    path: 'settings',
  },
  {
    name: 'has_created_at',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      if (!d?.createdAt) return false;
      const date = new Date(d.createdAt);
      return !isNaN(date.getTime());
    },
    errorMessage: 'Config snapshot must have a valid createdAt timestamp',
    path: 'createdAt',
  },
  {
    name: 'has_hash',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      return typeof d?.hash === 'string' && d.hash.length === 64;
    },
    errorMessage: 'Config snapshot should have a 64-character SHA-256 hash',
    severity: 'warning',
    path: 'hash',
  },
  {
    name: 'features_are_boolean',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      if (!d?.features) return true;
      return Object.values(d.features).every((v) => typeof v === 'boolean');
    },
    errorMessage: 'Feature flags must be boolean values',
    path: 'features',
  },
  {
    name: 'no_secrets_in_settings',
    check: (data) => {
      const d = data as ConfigSnapshotData;
      if (!d?.settings) return true;
      const settingsStr = JSON.stringify(d.settings);
      const secretPatterns = [
        /password/i,
        /secret/i,
        /api_key/i,
        /apikey/i,
        /private_key/i,
        /token/i,
      ];
      return !secretPatterns.some((p) => p.test(settingsStr));
    },
    errorMessage: 'Settings should not contain secret-like field names',
    severity: 'warning',
    path: 'settings',
  },
];

const analysisResultRules: ValidationRule[] = [
  {
    name: 'has_analysis_id',
    check: (data) => {
      const d = data as AnalysisResultData;
      return typeof d?.analysisId === 'string' && d.analysisId.trim().length > 0;
    },
    errorMessage: 'Analysis result must have an analysisId',
    path: 'analysisId',
  },
  {
    name: 'has_type',
    check: (data) => {
      const d = data as AnalysisResultData;
      return typeof d?.type === 'string' && d.type.trim().length > 0;
    },
    errorMessage: 'Analysis result must have a type',
    path: 'type',
  },
  {
    name: 'has_status',
    check: (data) => {
      const d = data as AnalysisResultData;
      const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
      return typeof d?.status === 'string' && validStatuses.includes(d.status);
    },
    errorMessage: 'Analysis result must have a valid status (pending, running, completed, failed, cancelled)',
    path: 'status',
  },
  {
    name: 'has_executed_at',
    check: (data) => {
      const d = data as AnalysisResultData;
      if (!d?.executedAt) return false;
      const date = new Date(d.executedAt);
      return !isNaN(date.getTime());
    },
    errorMessage: 'Analysis result must have a valid executedAt timestamp',
    path: 'executedAt',
  },
  {
    name: 'has_results_when_completed',
    check: (data) => {
      const d = data as AnalysisResultData;
      if (d?.status !== 'completed') return true;
      return d?.results !== undefined && d.results !== null;
    },
    errorMessage: 'Completed analysis must have results',
    path: 'results',
  },
  {
    name: 'metrics_are_numeric',
    check: (data) => {
      const d = data as AnalysisResultData;
      if (!d?.metrics) return true;
      return Object.values(d.metrics).every((v) => typeof v === 'number' && !isNaN(v));
    },
    errorMessage: 'All metrics must be numeric values',
    path: 'metrics',
  },
  {
    name: 'no_phi_in_results',
    check: (data) => {
      const d = data as AnalysisResultData;
      if (!d?.results) return true;
      const resultsStr = JSON.stringify(d.results);
      return invariantNoPHI(resultsStr);
    },
    errorMessage: 'Analysis results contain potential PHI patterns',
    path: 'results',
  },
  {
    name: 'has_parameters',
    check: (data) => {
      const d = data as AnalysisResultData;
      return d?.parameters !== undefined && typeof d.parameters === 'object';
    },
    errorMessage: 'Analysis result should document parameters used',
    severity: 'warning',
    path: 'parameters',
  },
];

export const manuscriptValidationSuite = createValidationSuite(
  'Manuscript Validation Suite',
  ArtifactType.MANUSCRIPT,
  manuscriptRules,
  '1.0.0'
);

export const datasetSchemaValidationSuite = createValidationSuite(
  'Dataset Schema Validation Suite',
  ArtifactType.DATASET_SCHEMA,
  datasetSchemaRules,
  '1.0.0'
);

export const configSnapshotValidationSuite = createValidationSuite(
  'Config Snapshot Validation Suite',
  ArtifactType.CONFIG_SNAPSHOT,
  configSnapshotRules,
  '1.0.0'
);

export const analysisResultValidationSuite = createValidationSuite(
  'Analysis Result Validation Suite',
  ArtifactType.ANALYSIS_RESULT,
  analysisResultRules,
  '1.0.0'
);

export const VALIDATION_SUITES: Map<ArtifactType, ValidationSuite> = new Map([
  [ArtifactType.MANUSCRIPT, manuscriptValidationSuite],
  [ArtifactType.DATASET_SCHEMA, datasetSchemaValidationSuite],
  [ArtifactType.CONFIG_SNAPSHOT, configSnapshotValidationSuite],
  [ArtifactType.ANALYSIS_RESULT, analysisResultValidationSuite],
]);

export function getValidationSuite(artifactType: ArtifactType): ValidationSuite | undefined {
  return VALIDATION_SUITES.get(artifactType);
}

export function validateArtifact(
  artifactType: ArtifactType,
  data: unknown
): ValidationResult {
  const suite = VALIDATION_SUITES.get(artifactType);
  if (!suite) {
    return {
      valid: false,
      errors: [
        {
          rule: 'suite_lookup',
          message: `No validation suite found for artifact type: ${artifactType}`,
          severity: 'error',
        },
      ],
      warnings: [],
      validatedAt: new Date().toISOString(),
      artifactType,
      ruleCounts: { total: 0, passed: 0, failed: 1 },
    };
  }
  return suite.validate(data);
}

export function listAvailableSuites(): Array<{
  artifactType: ArtifactType;
  name: string;
  ruleCount: number;
  version: string;
}> {
  return Array.from(VALIDATION_SUITES.entries()).map(([type, suite]) => ({
    artifactType: type,
    name: suite.name,
    ruleCount: suite.rules.length,
    version: suite.version,
  }));
}
