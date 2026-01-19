"""
Schema Inference Integration for Worker

Integrates Pandera schema inference into the worker ingestion pipeline.
Automatically infers schemas from uploaded datasets and stores them in the schema registry.
"""

import sys
sys.path.insert(0, '/app/packages/core/src/schema')

from pandera_inference import (
    infer_schema_from_dataframe,
    schema_to_json,
    compare_schemas,
    SchemaInferenceConfig
)
import pandas as pd
import json
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class WorkerSchemaInference:
    """Schema inference for worker ingestion pipeline"""

    def __init__(
        self,
        schema_output_dir: str = "/data/schemas",
        auto_register: bool = True
    ):
        """
        Args:
            schema_output_dir: Directory to save inferred schemas
            auto_register: If True, automatically register inferred schemas
        """
        self.schema_output_dir = Path(schema_output_dir)
        self.schema_output_dir.mkdir(parents=True, exist_ok=True)
        self.auto_register = auto_register

    async def infer_and_save_schema(
        self,
        df: pd.DataFrame,
        dataset_name: str,
        job_id: str,
        config: Optional[SchemaInferenceConfig] = None
    ) -> Dict[str, Any]:
        """
        Infer schema from DataFrame and save to registry.

        Args:
            df: DataFrame to infer from
            dataset_name: Name of the dataset
            job_id: Job ID for tracking
            config: Optional inference configuration

        Returns:
            Schema metadata including version and path
        """
        logger.info(f"Inferring schema for dataset: {dataset_name} (job={job_id})")

        # Infer schema
        schema = infer_schema_from_dataframe(
            df,
            dataset_name,
            config=config
        )

        # Convert to JSON
        schema_json = schema_to_json(schema)

        # Add metadata
        schema_json["dataset_name"] = dataset_name
        schema_json["job_id"] = job_id
        schema_json["row_count"] = len(df)
        schema_json["column_count"] = len(df.columns)

        # Determine version
        version = await self._determine_version(dataset_name, schema_json)
        schema_json["version"] = version

        # Save to file
        schema_path = self._get_schema_path(dataset_name, version)
        with open(schema_path, 'w') as f:
            json.dump(schema_json, f, indent=2)

        logger.info(f"Schema saved: {schema_path}")

        # Register if enabled
        if self.auto_register:
            await self._register_schema(dataset_name, version, schema_path)

        return {
            "dataset_name": dataset_name,
            "version": version,
            "schema_path": str(schema_path),
            "columns": list(df.columns),
            "row_count": len(df),
            "inferred_at": datetime.utcnow().isoformat()
        }

    async def _determine_version(
        self,
        dataset_name: str,
        new_schema: Dict[str, Any]
    ) -> str:
        """
        Determine version for new schema based on comparison with existing.

        Follows semver:
        - Major: Breaking changes (removed columns, type changes)
        - Minor: Backward-compatible additions (new columns)
        - Patch: Documentation/metadata updates
        """
        # Find latest version
        existing_schemas = list(
            self.schema_output_dir.glob(f"{dataset_name}_v*.json")
        )

        if not existing_schemas:
            return "1.0.0"

        # Load latest schema
        latest_schema_path = sorted(existing_schemas)[-1]
        with open(latest_schema_path) as f:
            latest_schema = json.load(f)

        # Compare schemas (simplified version detection)
        from pandera_inference import schema_from_json
        schema1 = schema_from_json(latest_schema)
        schema2 = schema_from_json(new_schema)

        diff = compare_schemas(schema1, schema2)

        # Parse current version
        current_version = latest_schema.get("version", "1.0.0")
        major, minor, patch = map(int, current_version.split("."))

        # Determine bump
        if not diff["compatible"]:
            # Breaking change
            major += 1
            minor = 0
            patch = 0
        elif diff["columns_added"] or diff["columns_modified"]:
            # New features
            minor += 1
            patch = 0
        else:
            # Patch
            patch += 1

        return f"{major}.{minor}.{patch}"

    def _get_schema_path(self, dataset_name: str, version: str) -> Path:
        """Get file path for schema"""
        return self.schema_output_dir / f"{dataset_name}_v{version}.json"

    async def _register_schema(
        self,
        dataset_name: str,
        version: str,
        schema_path: Path
    ) -> None:
        """Register schema in central registry"""
        registry_path = self.schema_output_dir / "schema_registry.json"

        # Load existing registry
        if registry_path.exists():
            with open(registry_path) as f:
                registry = json.load(f)
        else:
            registry = {"schemas": {}}

        # Add/update entry
        if dataset_name not in registry["schemas"]:
            registry["schemas"][dataset_name] = {
                "versions": [],
                "latest": version
            }

        registry["schemas"][dataset_name]["versions"].append({
            "version": version,
            "path": str(schema_path),
            "registered_at": datetime.utcnow().isoformat()
        })
        registry["schemas"][dataset_name]["latest"] = version

        # Save registry
        with open(registry_path, 'w') as f:
            json.dump(registry, f, indent=2)

        logger.info(f"Registered schema: {dataset_name} v{version}")


# Integration with existing ingestion pipeline
async def infer_schema_stage(job_spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pipeline stage for schema inference.

    Called during ingestion to automatically infer and version schemas.

    Args:
        job_spec: Job specification with DataFrame and metadata

    Returns:
        Updated job spec with schema metadata
    """
    df = job_spec["dataframe"]
    dataset_name = job_spec.get("dataset_name", "unknown")
    job_id = job_spec.get("job_id")

    # Create inference engine
    inference = WorkerSchemaInference()

    # Configure inference based on dataset type
    config = SchemaInferenceConfig(
        strict=job_spec.get("strict_schema", False),
        infer_constraints=job_spec.get("infer_constraints", True)
    )

    # Infer and save
    schema_meta = await inference.infer_and_save_schema(
        df,
        dataset_name,
        job_id,
        config=config
    )

    # Add to job spec
    job_spec["schema_metadata"] = schema_meta

    return job_spec


# Example usage
if __name__ == "__main__":
    import asyncio

    async def test_inference():
        # Sample data
        df = pd.DataFrame({
            'patient_id': ['P001', 'P002', 'P003'],
            'age': [45, 67, 23],
            'diagnosis': ['cancer', 'benign', 'cancer']
        })

        # Infer schema
        inference = WorkerSchemaInference()
        result = await inference.infer_and_save_schema(
            df,
            'patient_data',
            'job_test_001'
        )

        print("Schema inference result:")
        print(json.dumps(result, indent=2))

    asyncio.run(test_inference())
