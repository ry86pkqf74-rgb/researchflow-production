/**
 * Schema Versioning System
 *
 * Implements semantic versioning (semver) for schemas with migration support,
 * compatibility checking, and version history tracking.
 *
 * Features:
 * - Semantic versioning (MAJOR.MINOR.PATCH)
 * - Automatic compatibility detection
 * - Migration path calculation
 * - Version history and changelog
 * - Rollback support
 */

import semver from 'semver';

export interface SchemaVersion {
  version: string; // semver format (e.g., "1.2.3")
  schema: any; // The actual schema definition
  createdAt: string; // ISO 8601 timestamp
  createdBy: string; // User/system that created this version
  changelog: string; // Description of changes
  migrationNotes?: string; // Instructions for migrating data
  deprecated?: boolean; // If true, version is deprecated
  deprecationDate?: string; // When it was deprecated
}

export interface SchemaMigration {
  fromVersion: string;
  toVersion: string;
  type: 'major' | 'minor' | 'patch';
  breaking: boolean;
  migrationSteps: MigrationStep[];
  automated: boolean; // Can migration be automated?
}

export interface MigrationStep {
  action: 'add_column' | 'remove_column' | 'rename_column' | 'change_type' | 'add_constraint' | 'remove_constraint' | 'transform_data';
  description: string;
  column?: string;
  oldName?: string;
  newName?: string;
  newType?: string;
  defaultValue?: any;
  transformFn?: string; // JavaScript function as string for data transformation
}

export interface CompatibilityReport {
  compatible: boolean;
  compatibilityLevel: 'full' | 'backward' | 'forward' | 'none';
  changes: SchemaChange[];
  breaking: boolean;
  warnings: string[];
  recommendedVersion: string;
}

export interface SchemaChange {
  type: 'column_added' | 'column_removed' | 'column_renamed' | 'type_changed' | 'constraint_added' | 'constraint_removed';
  severity: 'breaking' | 'warning' | 'info';
  column: string;
  oldValue?: any;
  newValue?: any;
  message: string;
}

/**
 * Schema Registry with Version Management
 */
export class SchemaRegistry {
  private versions: Map<string, SchemaVersion[]> = new Map();
  private migrations: Map<string, SchemaMigration> = new Map();

  /**
   * Register a new schema version
   */
  registerSchema(name: string, versionData: SchemaVersion): void {
    // Validate semver
    if (!semver.valid(versionData.version)) {
      throw new Error(`Invalid semver version: ${versionData.version}`);
    }

    // Get existing versions
    const existing = this.versions.get(name) || [];

    // Check for duplicate version
    if (existing.some(v => v.version === versionData.version)) {
      throw new Error(`Version ${versionData.version} already exists for schema ${name}`);
    }

    // Add new version
    existing.push(versionData);

    // Sort by version (descending)
    existing.sort((a, b) => semver.rcompare(a.version, b.version));

    this.versions.set(name, existing);
  }

  /**
   * Get the latest version of a schema
   */
  getLatest(name: string): SchemaVersion | undefined {
    const versions = this.versions.get(name);
    if (!versions || versions.length === 0) {
      return undefined;
    }

    // Find latest non-deprecated version
    const latest = versions.find(v => !v.deprecated);
    return latest || versions[0];
  }

  /**
   * Get a specific version
   */
  getVersion(name: string, version: string): SchemaVersion | undefined {
    const versions = this.versions.get(name) || [];
    return versions.find(v => v.version === version);
  }

  /**
   * Get all versions for a schema
   */
  getAllVersions(name: string): SchemaVersion[] {
    return this.versions.get(name) || [];
  }

  /**
   * Check if two versions are compatible
   */
  isCompatible(name: string, fromVersion: string, toVersion: string): boolean {
    const report = this.checkCompatibility(name, fromVersion, toVersion);
    return report.compatible;
  }

  /**
   * Get detailed compatibility report
   */
  checkCompatibility(
    name: string,
    fromVersion: string,
    toVersion: string
  ): CompatibilityReport {
    const from = this.getVersion(name, fromVersion);
    const to = this.getVersion(name, toVersion);

    if (!from || !to) {
      throw new Error(`Version not found: ${name} ${!from ? fromVersion : toVersion}`);
    }

    // Compare versions
    const changes = this.detectChanges(from.schema, to.schema);
    const breaking = changes.some(c => c.severity === 'breaking');

    // Determine compatibility level
    let compatibilityLevel: CompatibilityReport['compatibilityLevel'];
    const versionDiff = semver.diff(fromVersion, toVersion);

    if (versionDiff === 'major') {
      compatibilityLevel = 'none'; // Major versions can have breaking changes
    } else if (versionDiff === 'minor') {
      compatibilityLevel = breaking ? 'none' : 'backward'; // Minor should be backward compatible
    } else {
      compatibilityLevel = 'full'; // Patch should be fully compatible
    }

    const warnings: string[] = [];

    // Generate warnings
    if (breaking && versionDiff !== 'major') {
      warnings.push(`Breaking changes detected in ${versionDiff} version bump. Consider incrementing major version.`);
    }

    if (from.deprecated) {
      warnings.push(`Source version ${fromVersion} is deprecated.`);
    }

    // Recommend next version
    const recommendedVersion = this.recommendNextVersion(fromVersion, changes);

    return {
      compatible: !breaking,
      compatibilityLevel,
      changes,
      breaking,
      warnings,
      recommendedVersion
    };
  }

  /**
   * Detect changes between two schemas
   */
  private detectChanges(oldSchema: any, newSchema: any): SchemaChange[] {
    const changes: SchemaChange[] = [];

    const oldCols = new Set(Object.keys(oldSchema.columns || {}));
    const newCols = new Set(Object.keys(newSchema.columns || {}));

    // Columns added
    for (const col of newCols) {
      if (!oldCols.has(col)) {
        const colDef = newSchema.columns[col];
        const severity = colDef.nullable ? 'info' : 'warning';

        changes.push({
          type: 'column_added',
          severity,
          column: col,
          newValue: colDef,
          message: `Added column '${col}'${!colDef.nullable ? ' (non-nullable)' : ''}`
        });
      }
    }

    // Columns removed
    for (const col of oldCols) {
      if (!newCols.has(col)) {
        changes.push({
          type: 'column_removed',
          severity: 'breaking',
          column: col,
          oldValue: oldSchema.columns[col],
          message: `Removed column '${col}'`
        });
      }
    }

    // Columns modified
    for (const col of oldCols) {
      if (newCols.has(col)) {
        const oldCol = oldSchema.columns[col];
        const newCol = newSchema.columns[col];

        // Type changed
        if (oldCol.dtype !== newCol.dtype) {
          changes.push({
            type: 'type_changed',
            severity: 'breaking',
            column: col,
            oldValue: oldCol.dtype,
            newValue: newCol.dtype,
            message: `Changed type of '${col}' from ${oldCol.dtype} to ${newCol.dtype}`
          });
        }

        // Nullability changed
        if (oldCol.nullable && !newCol.nullable) {
          changes.push({
            type: 'constraint_added',
            severity: 'breaking',
            column: col,
            message: `Made column '${col}' non-nullable`
          });
        } else if (!oldCol.nullable && newCol.nullable) {
          changes.push({
            type: 'constraint_removed',
            severity: 'info',
            column: col,
            message: `Made column '${col}' nullable`
          });
        }
      }
    }

    return changes;
  }

  /**
   * Recommend next version based on changes
   */
  private recommendNextVersion(currentVersion: string, changes: SchemaChange[]): string {
    const hasBreaking = changes.some(c => c.severity === 'breaking');
    const hasFeatures = changes.some(c => c.type === 'column_added' || c.type === 'constraint_removed');

    const parsed = semver.parse(currentVersion);
    if (!parsed) {
      throw new Error(`Invalid version: ${currentVersion}`);
    }

    if (hasBreaking) {
      return semver.inc(currentVersion, 'major')!;
    } else if (hasFeatures) {
      return semver.inc(currentVersion, 'minor')!;
    } else {
      return semver.inc(currentVersion, 'patch')!;
    }
  }

  /**
   * Create migration between two versions
   */
  createMigration(
    name: string,
    fromVersion: string,
    toVersion: string
  ): SchemaMigration {
    const from = this.getVersion(name, fromVersion);
    const to = this.getVersion(name, toVersion);

    if (!from || !to) {
      throw new Error(`Version not found`);
    }

    const changes = this.detectChanges(from.schema, to.schema);
    const breaking = changes.some(c => c.severity === 'breaking');

    const versionDiff = semver.diff(fromVersion, toVersion);
    const type = versionDiff?.includes('major') ? 'major' :
                 versionDiff?.includes('minor') ? 'minor' : 'patch';

    // Convert changes to migration steps
    const migrationSteps: MigrationStep[] = changes.map(change => {
      switch (change.type) {
        case 'column_added':
          return {
            action: 'add_column',
            description: change.message,
            column: change.column,
            newType: change.newValue?.dtype,
            defaultValue: change.newValue?.nullable ? null : undefined
          };

        case 'column_removed':
          return {
            action: 'remove_column',
            description: change.message,
            column: change.column
          };

        case 'type_changed':
          return {
            action: 'change_type',
            description: change.message,
            column: change.column,
            newType: change.newValue
          };

        default:
          return {
            action: 'transform_data',
            description: change.message,
            column: change.column
          };
      }
    });

    // Check if migration can be automated
    const automated = migrationSteps.every(step =>
      step.action !== 'transform_data' &&
      step.action !== 'change_type'
    );

    const migration: SchemaMigration = {
      fromVersion,
      toVersion,
      type,
      breaking,
      migrationSteps,
      automated
    };

    // Cache migration
    const migrationKey = `${name}:${fromVersion}->${toVersion}`;
    this.migrations.set(migrationKey, migration);

    return migration;
  }

  /**
   * Get migration path from one version to another
   */
  getMigrationPath(
    name: string,
    fromVersion: string,
    toVersion: string
  ): SchemaMigration[] {
    const allVersions = this.getAllVersions(name);

    if (allVersions.length === 0) {
      return [];
    }

    // Find path between versions
    const path: SchemaMigration[] = [];

    // For simplicity, assume direct migration
    // Production would implement shortest path through version graph
    const migration = this.createMigration(name, fromVersion, toVersion);
    path.push(migration);

    return path;
  }

  /**
   * Deprecate a version
   */
  deprecateVersion(name: string, version: string, reason: string): void {
    const schemaVersion = this.getVersion(name, version);

    if (!schemaVersion) {
      throw new Error(`Version not found: ${name} ${version}`);
    }

    schemaVersion.deprecated = true;
    schemaVersion.deprecationDate = new Date().toISOString();
    schemaVersion.changelog += `\n\nDEPRECATED: ${reason}`;
  }

  /**
   * Get version history for a schema
   */
  getHistory(name: string): { version: string; date: string; changes: string }[] {
    const versions = this.getAllVersions(name);

    return versions.map(v => ({
      version: v.version,
      date: v.createdAt,
      changes: v.changelog
    }));
  }

  /**
   * Export registry to JSON
   */
  toJSON(): any {
    const data: any = {
      schemas: {},
      migrations: {}
    };

    for (const [name, versions] of this.versions.entries()) {
      data.schemas[name] = versions;
    }

    for (const [key, migration] of this.migrations.entries()) {
      data.migrations[key] = migration;
    }

    return data;
  }

  /**
   * Import registry from JSON
   */
  fromJSON(data: any): void {
    if (data.schemas) {
      for (const [name, versions] of Object.entries<any>(data.schemas)) {
        this.versions.set(name, versions);
      }
    }

    if (data.migrations) {
      for (const [key, migration] of Object.entries<any>(data.migrations)) {
        this.migrations.set(key, migration);
      }
    }
  }
}

// Singleton instance
export const schemaRegistry = new SchemaRegistry();

// Export helper functions
export function registerSchema(name: string, version: SchemaVersion): void {
  schemaRegistry.registerSchema(name, version);
}

export function getLatestSchema(name: string): SchemaVersion | undefined {
  return schemaRegistry.getLatest(name);
}

export function getSchemaVersion(name: string, version: string): SchemaVersion | undefined {
  return schemaRegistry.getVersion(name, version);
}

export function checkSchemaCompatibility(
  name: string,
  from: string,
  to: string
): CompatibilityReport {
  return schemaRegistry.checkCompatibility(name, from, to);
}
