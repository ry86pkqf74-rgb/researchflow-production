"""
Schema Migrations for Worker

Handles data migrations between schema versions, applying transformations
to ensure data compatibility when schema changes occur.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Callable
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class SchemaMigration:
    """Handles migration of data between schema versions"""

    def __init__(self):
        self.migrations: Dict[str, Dict[str, Callable]] = {}

    def register_migration(
        self,
        schema_name: str,
        from_version: str,
        to_version: str,
        migration_fn: Callable[[pd.DataFrame], pd.DataFrame]
    ):
        """
        Register a migration function for a specific version transition.

        Args:
            schema_name: Name of the schema
            from_version: Source version
            to_version: Target version
            migration_fn: Function that transforms DataFrame
        """
        key = f"{schema_name}:{from_version}->{to_version}"
        if schema_name not in self.migrations:
            self.migrations[schema_name] = {}
        self.migrations[schema_name][key] = migration_fn
        logger.info(f"Registered migration: {key}")

    def migrate(
        self,
        df: pd.DataFrame,
        schema_name: str,
        from_version: str,
        to_version: str
    ) -> pd.DataFrame:
        """
        Migrate DataFrame from one schema version to another.

        Args:
            df: DataFrame to migrate
            schema_name: Schema name
            from_version: Current version
            to_version: Target version

        Returns:
            Migrated DataFrame
        """
        logger.info(
            f"Migrating {schema_name} from v{from_version} to v{to_version}"
        )

        # Check if direct migration exists
        key = f"{schema_name}:{from_version}->{to_version}"

        if schema_name in self.migrations and key in self.migrations[schema_name]:
            migration_fn = self.migrations[schema_name][key]
            return migration_fn(df)

        # Otherwise, apply automatic migration
        return self._auto_migrate(df, schema_name, from_version, to_version)

    def _auto_migrate(
        self,
        df: pd.DataFrame,
        schema_name: str,
        from_version: str,
        to_version: str
    ) -> pd.DataFrame:
        """
        Attempt automatic migration based on common patterns.

        Handles:
        - Adding columns with defaults
        - Removing columns
        - Type coercion where possible
        """
        logger.info(f"Attempting automatic migration for {schema_name}")

        # Load schema definitions
        from_schema = self._load_schema(schema_name, from_version)
        to_schema = self._load_schema(schema_name, to_version)

        if not from_schema or not to_schema:
            logger.warning("Schema definitions not found, returning DataFrame as-is")
            return df

        migrated_df = df.copy()

        # Get column sets
        from_cols = set(from_schema.get('columns', {}).keys())
        to_cols = set(to_schema.get('columns', {}).keys())

        # Add new columns with defaults
        for col in to_cols - from_cols:
            col_def = to_schema['columns'][col]
            default_value = None if col_def.get('nullable', True) else np.nan

            logger.info(f"Adding column '{col}' with default: {default_value}")
            migrated_df[col] = default_value

        # Remove deprecated columns
        for col in from_cols - to_cols:
            logger.info(f"Removing column '{col}'")
            if col in migrated_df.columns:
                migrated_df = migrated_df.drop(columns=[col])

        # Type coercion for common columns
        for col in from_cols & to_cols:
            old_type = from_schema['columns'][col].get('dtype')
            new_type = to_schema['columns'][col].get('dtype')

            if old_type != new_type:
                logger.info(f"Coercing column '{col}' from {old_type} to {new_type}")
                migrated_df[col] = self._coerce_type(
                    migrated_df[col],
                    new_type
                )

        return migrated_df

    def _coerce_type(self, series: pd.Series, target_type: str) -> pd.Series:
        """Coerce series to target type"""
        try:
            if 'int' in target_type.lower():
                return pd.to_numeric(series, errors='coerce').astype('Int64')
            elif 'float' in target_type.lower():
                return pd.to_numeric(series, errors='coerce')
            elif 'string' in target_type.lower() or 'str' in target_type.lower():
                return series.astype(str)
            elif 'datetime' in target_type.lower():
                return pd.to_datetime(series, errors='coerce')
            elif 'bool' in target_type.lower():
                return series.astype(bool)
            else:
                return series
        except Exception as e:
            logger.warning(f"Type coercion failed: {e}")
            return series

    def _load_schema(self, schema_name: str, version: str) -> Optional[Dict[str, Any]]:
        """Load schema definition from file system"""
        import json
        from pathlib import Path

        schema_dir = Path('/data/schemas')
        schema_path = schema_dir / f"{schema_name}_v{version}.json"

        try:
            with open(schema_path) as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"Schema file not found: {schema_path}")
            return None


# Global migration registry
migration_registry = SchemaMigration()


# Example migrations (register in application initialization)
def register_builtin_migrations():
    """Register common migration patterns"""

    # Example: patient_data 1.0.0 -> 1.1.0
    def patient_data_1_0_to_1_1(df: pd.DataFrame) -> pd.DataFrame:
        """Add email column with null default"""
        df = df.copy()
        df['email'] = None
        return df

    migration_registry.register_migration(
        'patient_data',
        '1.0.0',
        '1.1.0',
        patient_data_1_0_to_1_1
    )

    # Example: patient_data 1.1.0 -> 2.0.0 (breaking: rename column)
    def patient_data_1_1_to_2_0(df: pd.DataFrame) -> pd.DataFrame:
        """Rename patient_id to id"""
        df = df.copy()
        if 'patient_id' in df.columns:
            df = df.rename(columns={'patient_id': 'id'})
        return df

    migration_registry.register_migration(
        'patient_data',
        '1.1.0',
        '2.0.0',
        patient_data_1_1_to_2_0
    )


# Integration with ingestion pipeline
async def schema_migration_stage(job_spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pipeline stage for schema migration.

    Automatically migrates data to the latest schema version.

    Args:
        job_spec: Job specification with DataFrame and schema metadata

    Returns:
        Updated job spec with migrated DataFrame
    """
    df = job_spec["dataframe"]
    schema_name = job_spec.get("dataset_name", "unknown")

    # Get current and target versions
    current_version = job_spec.get("schema_version", "1.0.0")
    target_version = job_spec.get("target_schema_version")

    if not target_version:
        # No migration needed
        logger.info(f"No target version specified, skipping migration")
        return job_spec

    if current_version == target_version:
        logger.info(f"Already at target version {target_version}")
        return job_spec

    # Perform migration
    try:
        migrated_df = migration_registry.migrate(
            df,
            schema_name,
            current_version,
            target_version
        )

        job_spec["dataframe"] = migrated_df
        job_spec["schema_version"] = target_version
        job_spec["migration_applied"] = {
            "from_version": current_version,
            "to_version": target_version,
            "timestamp": datetime.utcnow().isoformat(),
            "row_count_before": len(df),
            "row_count_after": len(migrated_df)
        }

        logger.info(
            f"Successfully migrated {schema_name} from v{current_version} "
            f"to v{target_version}"
        )
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        job_spec["migration_error"] = str(e)

    return job_spec


# Validation after migration
def validate_migrated_data(
    df: pd.DataFrame,
    schema_name: str,
    target_version: str
) -> Dict[str, Any]:
    """
    Validate that migrated data conforms to target schema.

    Args:
        df: Migrated DataFrame
        schema_name: Schema name
        target_version: Target schema version

    Returns:
        Validation report
    """
    from schemas.pandera.schema_registry import get_schema, validate_dataset

    try:
        schema = get_schema(schema_name)
        if schema:
            validated_df = validate_dataset(df, schema_name)
            return {
                "valid": True,
                "schema_version": target_version,
                "row_count": len(validated_df)
            }
        else:
            return {
                "valid": False,
                "error": f"Schema not found: {schema_name}"
            }
    except Exception as e:
        return {
            "valid": False,
            "error": str(e)
        }


# CLI for manual migrations
if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser(description='Schema Migration CLI')
    parser.add_argument('schema_name', help='Schema name')
    parser.add_argument('from_version', help='Source version')
    parser.add_argument('to_version', help='Target version')
    parser.add_argument('input_file', help='Input parquet file')
    parser.add_argument('output_file', help='Output parquet file')

    args = parser.parse_args()

    # Load data
    df = pd.read_parquet(args.input_file)
    print(f"Loaded {len(df)} rows from {args.input_file}")

    # Register migrations
    register_builtin_migrations()

    # Migrate
    migrated_df = migration_registry.migrate(
        df,
        args.schema_name,
        args.from_version,
        args.to_version
    )

    # Save
    migrated_df.to_parquet(args.output_file, index=False)
    print(f"Saved {len(migrated_df)} rows to {args.output_file}")

    # Validate
    validation = validate_migrated_data(
        migrated_df,
        args.schema_name,
        args.to_version
    )
    print(f"\nValidation: {validation}")
