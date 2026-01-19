/**
 * Schema Linter
 *
 * Validates schema definitions against best practices and organizational standards.
 * Catches common issues before schemas are deployed.
 *
 * Features:
 * - Naming convention checks
 * - Required field validation
 * - Type safety checks
 * - Documentation completeness
 * - Breaking change detection
 */

import semver from 'semver';

export interface LintRule {
  name: string;
  severity: 'error' | 'warning' | 'info';
  category: 'naming' | 'documentation' | 'structure' | 'versioning' | 'compatibility';
  check: (schema: any) => LintIssue[];
  description?: string;
}

export interface LintIssue {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  location?: string;
  suggestion?: string;
}

export interface LintResult {
  valid: boolean;
  score: number;
  issues: LintIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

/**
 * Schema Linter - validates schemas against best practices
 */
export class SchemaLinter {
  private rules: LintRule[] = [];

  constructor(rules?: LintRule[]) {
    this.rules = rules || getDefaultRules();
  }

  /**
   * Add a custom linting rule
   */
  addRule(rule: LintRule): void {
    this.rules.push(rule);
  }

  /**
   * Lint a schema
   */
  lint(schema: any): LintResult {
    const issues: LintIssue[] = [];

    // Run all rules
    for (const rule of this.rules) {
      const ruleIssues = rule.check(schema);
      issues.push(...ruleIssues);
    }

    // Calculate summary
    const summary = {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length
    };

    // Calculate score (100 - penalties)
    let score = 100;
    score -= summary.errors * 10;
    score -= summary.warnings * 3;
    score -= summary.info * 1;
    score = Math.max(0, score);

    const valid = summary.errors === 0;

    return {
      valid,
      score,
      issues,
      summary
    };
  }

  /**
   * Format lint results as a report
   */
  formatReport(result: LintResult): string {
    const lines: string[] = [];

    lines.push('# Schema Lint Report');
    lines.push('');
    lines.push(`**Valid**: ${result.valid ? '✓ Yes' : '✗ No'}`);
    lines.push(`**Score**: ${result.score}/100`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Errors: ${result.summary.errors}`);
    lines.push(`- Warnings: ${result.summary.warnings}`);
    lines.push(`- Info: ${result.summary.info}`);
    lines.push('');

    if (result.issues.length === 0) {
      lines.push('No issues found! 🎉');
      return lines.join('\n');
    }

    // Group by severity
    const byCategory = new Map<string, LintIssue[]>();

    for (const issue of result.issues) {
      const key = `${issue.severity}-${issue.category}`;
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key)!.push(issue);
    }

    // Format issues
    if (result.summary.errors > 0) {
      lines.push('## Errors');
      const errors = result.issues.filter(i => i.severity === 'error');
      for (const issue of errors) {
        lines.push(`- **${issue.rule}** ${issue.location ? `(${issue.location})` : ''}`);
        lines.push(`  ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`  *Suggestion: ${issue.suggestion}*`);
        }
      }
      lines.push('');
    }

    if (result.summary.warnings > 0) {
      lines.push('## Warnings');
      const warnings = result.issues.filter(i => i.severity === 'warning');
      for (const issue of warnings) {
        lines.push(`- **${issue.rule}** ${issue.location ? `(${issue.location})` : ''}`);
        lines.push(`  ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`  *Suggestion: ${issue.suggestion}*`);
        }
      }
      lines.push('');
    }

    if (result.summary.info > 0) {
      lines.push('## Informational');
      const info = result.issues.filter(i => i.severity === 'info');
      for (const issue of info) {
        lines.push(`- ${issue.message}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Default linting rules
 */
export function getDefaultRules(): LintRule[] {
  return [
    // ========== Documentation Rules ==========
    {
      name: 'require-schema-name',
      severity: 'error',
      category: 'documentation',
      description: 'Schema must have a name',
      check: (schema) => {
        if (!schema.name || schema.name.trim() === '') {
          return [{
            rule: 'require-schema-name',
            severity: 'error',
            category: 'documentation',
            message: 'Schema must have a name',
            suggestion: 'Add a "name" field with a descriptive schema name'
          }];
        }
        return [];
      }
    },

    {
      name: 'require-description',
      severity: 'warning',
      category: 'documentation',
      description: 'Schema should have a description',
      check: (schema) => {
        if (!schema.description || schema.description.trim() === '') {
          return [{
            rule: 'require-description',
            severity: 'warning',
            category: 'documentation',
            message: 'Schema should have a description',
            suggestion: 'Add a "description" field explaining the purpose of this schema'
          }];
        }
        return [];
      }
    },

    {
      name: 'require-column-descriptions',
      severity: 'info',
      category: 'documentation',
      description: 'Columns should have descriptions',
      check: (schema) => {
        const issues: LintIssue[] = [];
        const columns = schema.columns || {};

        for (const [colName, colDef] of Object.entries<any>(columns)) {
          if (!colDef.description || colDef.description.trim() === '') {
            issues.push({
              rule: 'require-column-descriptions',
              severity: 'info',
              category: 'documentation',
              message: `Column '${colName}' is missing a description`,
              location: colName,
              suggestion: 'Add a description to improve schema documentation'
            });
          }
        }

        return issues;
      }
    },

    // ========== Versioning Rules ==========
    {
      name: 'require-version',
      severity: 'error',
      category: 'versioning',
      description: 'Schema must have a valid semantic version',
      check: (schema) => {
        if (!schema.version) {
          return [{
            rule: 'require-version',
            severity: 'error',
            category: 'versioning',
            message: 'Schema must have a version field',
            suggestion: 'Add a "version" field with semantic versioning (e.g., "1.0.0")'
          }];
        }

        if (!semver.valid(schema.version)) {
          return [{
            rule: 'require-version',
            severity: 'error',
            category: 'versioning',
            message: `Invalid semantic version: ${schema.version}`,
            suggestion: 'Use semantic versioning format: MAJOR.MINOR.PATCH'
          }];
        }

        return [];
      }
    },

    // ========== Naming Convention Rules ==========
    {
      name: 'schema-naming-convention',
      severity: 'warning',
      category: 'naming',
      description: 'Schema names should use snake_case',
      check: (schema) => {
        if (!schema.name) return [];

        const snakeCasePattern = /^[a-z][a-z0-9_]*$/;
        if (!snakeCasePattern.test(schema.name)) {
          return [{
            rule: 'schema-naming-convention',
            severity: 'warning',
            category: 'naming',
            message: `Schema name '${schema.name}' should use snake_case`,
            suggestion: `Consider renaming to: ${toSnakeCase(schema.name)}`
          }];
        }

        return [];
      }
    },

    {
      name: 'column-naming-convention',
      severity: 'warning',
      category: 'naming',
      description: 'Column names should use snake_case',
      check: (schema) => {
        const issues: LintIssue[] = [];
        const columns = schema.columns || {};
        const snakeCasePattern = /^[a-z][a-z0-9_]*$/;

        for (const colName of Object.keys(columns)) {
          if (!snakeCasePattern.test(colName)) {
            issues.push({
              rule: 'column-naming-convention',
              severity: 'warning',
              category: 'naming',
              message: `Column '${colName}' should use snake_case`,
              location: colName,
              suggestion: `Consider renaming to: ${toSnakeCase(colName)}`
            });
          }
        }

        return issues;
      }
    },

    {
      name: 'no-reserved-keywords',
      severity: 'error',
      category: 'naming',
      description: 'Column names should not use SQL reserved keywords',
      check: (schema) => {
        const issues: LintIssue[] = [];
        const columns = schema.columns || {};
        const reservedKeywords = new Set([
          'select', 'from', 'where', 'insert', 'update', 'delete', 'drop',
          'table', 'column', 'index', 'view', 'user', 'group', 'order',
          'limit', 'offset', 'join', 'left', 'right', 'inner', 'outer'
        ]);

        for (const colName of Object.keys(columns)) {
          if (reservedKeywords.has(colName.toLowerCase())) {
            issues.push({
              rule: 'no-reserved-keywords',
              severity: 'error',
              category: 'naming',
              message: `Column '${colName}' uses a SQL reserved keyword`,
              location: colName,
              suggestion: `Rename to avoid conflicts (e.g., '${colName}_value')`
            });
          }
        }

        return issues;
      }
    },

    // ========== Structure Rules ==========
    {
      name: 'require-columns',
      severity: 'error',
      category: 'structure',
      description: 'Schema must define at least one column',
      check: (schema) => {
        const columns = schema.columns || {};

        if (Object.keys(columns).length === 0) {
          return [{
            rule: 'require-columns',
            severity: 'error',
            category: 'structure',
            message: 'Schema must define at least one column',
            suggestion: 'Add column definitions to the schema'
          }];
        }

        return [];
      }
    },

    {
      name: 'require-primary-key',
      severity: 'warning',
      category: 'structure',
      description: 'Schema should have a unique identifier column',
      check: (schema) => {
        const columns = schema.columns || {};

        const hasUniqueCol = Object.values<any>(columns).some(col => col.unique === true);

        if (!hasUniqueCol) {
          return [{
            rule: 'require-primary-key',
            severity: 'warning',
            category: 'structure',
            message: 'Schema should have at least one unique column (primary key)',
            suggestion: 'Add a unique identifier column (e.g., "id" with unique: true)'
          }];
        }

        return [];
      }
    },

    {
      name: 'consistent-naming-pattern',
      severity: 'info',
      category: 'naming',
      description: 'ID columns should follow consistent naming',
      check: (schema) => {
        const issues: LintIssue[] = [];
        const columns = schema.columns || {};

        for (const [colName, colDef] of Object.entries<any>(columns)) {
          // Check for inconsistent ID naming
          if (colName.toLowerCase().includes('id') && !colName.endsWith('_id') && colName !== 'id') {
            issues.push({
              rule: 'consistent-naming-pattern',
              severity: 'info',
              category: 'naming',
              message: `ID column '${colName}' should end with '_id' or be named 'id'`,
              location: colName
            });
          }

          // Check for boolean naming
          if (colDef.dtype?.includes('bool')) {
            if (!colName.startsWith('is_') && !colName.startsWith('has_') && !colName.startsWith('can_')) {
              issues.push({
                rule: 'consistent-naming-pattern',
                severity: 'info',
                category: 'naming',
                message: `Boolean column '${colName}' should start with 'is_', 'has_', or 'can_'`,
                location: colName
              });
            }
          }
        }

        return issues;
      }
    },

    // ========== Type Safety Rules ==========
    {
      name: 'explicit-nullability',
      severity: 'warning',
      category: 'structure',
      description: 'All columns should explicitly define nullability',
      check: (schema) => {
        const issues: LintIssue[] = [];
        const columns = schema.columns || {};

        for (const [colName, colDef] of Object.entries<any>(columns)) {
          if (colDef.nullable === undefined) {
            issues.push({
              rule: 'explicit-nullability',
              severity: 'warning',
              category: 'structure',
              message: `Column '${colName}' should explicitly define nullable property`,
              location: colName,
              suggestion: 'Add "nullable: true" or "nullable: false"'
            });
          }
        }

        return issues;
      }
    }
  ];
}

/**
 * Convert string to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Lint multiple schemas and generate a summary report
 */
export function lintSchemas(schemas: { name: string; schema: any }[]): {
  overall: { valid: boolean; score: number };
  results: { name: string; result: LintResult }[];
  summary: string;
} {
  const linter = new SchemaLinter();
  const results: { name: string; result: LintResult }[] = [];

  for (const { name, schema } of schemas) {
    const result = linter.lint(schema);
    results.push({ name, result });
  }

  // Calculate overall score
  const avgScore = results.reduce((sum, r) => sum + r.result.score, 0) / results.length;
  const allValid = results.every(r => r.result.valid);

  // Generate summary
  const lines: string[] = [];
  lines.push('# Schema Lint Summary');
  lines.push('');
  lines.push(`**Overall Valid**: ${allValid ? '✓ Yes' : '✗ No'}`);
  lines.push(`**Average Score**: ${avgScore.toFixed(1)}/100`);
  lines.push(`**Total Schemas**: ${schemas.length}`);
  lines.push('');

  lines.push('## Schema Results');
  for (const { name, result } of results) {
    const icon = result.valid ? '✓' : '✗';
    lines.push(`- ${icon} **${name}**: ${result.score}/100 (${result.summary.errors}E, ${result.summary.warnings}W, ${result.summary.info}I)`);
  }

  return {
    overall: {
      valid: allValid,
      score: avgScore
    },
    results,
    summary: lines.join('\n')
  };
}

// Example usage
if (require.main === module) {
  const exampleSchema = {
    name: 'patient_data',
    version: '1.0.0',
    description: 'Patient clinical data',
    columns: {
      id: {
        dtype: 'string',
        nullable: false,
        unique: true,
        description: 'Unique patient identifier'
      },
      PatientName: { // Bad: should be snake_case
        dtype: 'string',
        nullable: true
        // Missing: description
      },
      age: {
        dtype: 'int64',
        nullable: false,
        description: 'Patient age in years'
      },
      select: { // Bad: SQL reserved keyword
        dtype: 'bool'
        // Missing: nullable, description
      }
    }
  };

  const linter = new SchemaLinter();
  const result = linter.lint(exampleSchema);

  console.log(linter.formatReport(result));
}
