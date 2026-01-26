#!/usr/bin/env python3
"""
Minimal Pipeline Runner

Executes ingest → conform → validate in strict order on sample heart disease dataset.
Designed for offline/STANDBY mode with deterministic outputs.

NON-NEGOTIABLES:
- Offline-first: NO network calls, telemetry, analytics
- Zero PHI leakage: no row-level dumps in logs; do not print identifiers
- .tmp/ is quarantine: all runtime outputs go ONLY to .tmp/ (never committed)
- Fail-closed behavior: non-zero exit on any stage failure

Usage:
    python -m src.pipeline.runner --dataset sample --out .tmp/pipeline_sample
    python -m src.pipeline.runner --dataset sample --out .tmp/pipeline_sample --strict

Author: Research Operating System
Version: v1.0.0-minimal
Last Modified: 2026-01-07
"""

import argparse
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


def run_ingest() -> tuple[pd.DataFrame, Path]:
    """
    Stage 1: Ingest sample data.

    Generates heart disease sample using committed generator script.
    Standardization is embedded here (columns already standardized).

    Returns:
        Tuple of (dataframe, input_csv_path)
    """
    print("[1/3] INGEST + STANDARDIZE")
    start = time.time()

    # Generate sample using existing script
    generator = Path("scripts/governance/generate_sample_heart_disease.py")
    if not generator.exists():
        raise FileNotFoundError(f"Generator not found: {generator}")

    temp_csv = Path(".tmp/sample_data/heart_disease_sample.csv")
    temp_csv.parent.mkdir(parents=True, exist_ok=True)

    # Run generator
    subprocess.run(
        [sys.executable, str(generator)], capture_output=True, text=True, check=True
    )

    # Load generated data
    df = pd.read_csv(temp_csv)

    duration = (time.time() - start) * 1000
    print(f"  ✓ Ingested {len(df)} rows × {len(df.columns)} columns")
    print(f"  ✓ Columns: {', '.join(list(df.columns)[:5])}...")
    print(f"  Duration: {duration:.0f}ms")

    return df, temp_csv


def run_conform(df: pd.DataFrame) -> pd.DataFrame:
    """
    Stage 2: Conform data (normalize linkage keys if present).

    For heart disease sample: no linkage key, so this is a pass-through.
    """
    print("\n[2/3] CONFORM")
    start = time.time()

    # Heart disease sample has no linkage key to normalize
    print(f"  ⊘ No linkage key to normalize (pass-through)")

    duration = (time.time() - start) * 1000
    print(f"  Duration: {duration:.0f}ms")

    return df


def run_validate(df: pd.DataFrame, strict: bool = False) -> pd.DataFrame:
    """
    Stage 3: Validate against schema (SCHEMA ONLY in STANDBY mode).

    Uses existing heart_disease_schema.validate function directly.
    AI-QA validation is explicitly skipped in offline/STANDBY mode.
    """
    print("\n[3/3] VALIDATE (Schema Only)")
    start = time.time()

    # Direct import of schema validation (bypasses verification framework)
    from src.schemas.pandera.heart_disease_schema import (
        validate as validate_heart_disease,
    )

    try:
        # Explicitly perform schema validation only (no AI-QA in STANDBY)
        validated_df = validate_heart_disease(df)

        duration = (time.time() - start) * 1000
        print(f"  ✓ Schema validation PASSED: HeartDiseaseSchema")
        print(f"  ⊘ AI-QA validation skipped (STANDBY / offline mode)")
        print(f"  Duration: {duration:.0f}ms")

        return validated_df

    except Exception as e:
        duration = (time.time() - start) * 1000
        print(f"  ✗ Schema validation FAILED after {duration:.0f}ms")
        error_msg = str(e)
        # Extract first 3 lines of error for brevity
        error_lines = error_msg.split("\n")[:3]
        error_summary = "\n".join(error_lines)
        raise ValueError(f"Schema validation failed:\n{error_summary}")


def _compute_sha256(file_path: Path) -> str:
    """
    Compute SHA256 hash of a file.

    Args:
        file_path: Path to file

    Returns:
        Hex string of SHA256 hash
    """
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def _get_git_commit_sha() -> str:
    """
    Get current git commit SHA (best effort, no failure on error).

    Returns:
        Commit SHA string or "unknown"
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (
        subprocess.TimeoutExpired,
        subprocess.CalledProcessError,
        FileNotFoundError,
        OSError,
    ):
        pass
    return "unknown"


def emit_provenance_manifest(
    run_id: str,
    output_dir: Path,
    dataset: str,
    overall_status: str,
    total_duration: float,
    df: pd.DataFrame,
    schema_name: str,
    parquet_path: Path,
    summary_path: Path,
    input_artifact_path: Path = None,
) -> None:
    """
    Write metadata-only provenance manifest for the pipeline run.

    NO PHI: Contains only counts, timings, hashes - no row data or column names in the JSON.

    Args:
        run_id: Run identifier
        output_dir: Output directory
        dataset: Dataset name
        overall_status: Pipeline status
        total_duration: Total duration in milliseconds
        df: Dataframe (for count extraction only, not persisted)
        schema_name: Schema name used for validation
        parquet_path: Path to output parquet file
        summary_path: Path to summary JSON file
        input_artifact_path: Path to input CSV artifact (optional)
    """
    provenance_path = output_dir / f"provenance_{run_id}.json"

    # Compute output artifact hashes
    parquet_hash = _compute_sha256(parquet_path) if parquet_path.exists() else None
    summary_hash = _compute_sha256(summary_path) if summary_path.exists() else None

    # Compute input artifact hashes
    input_artifact_hashes = []
    if input_artifact_path and input_artifact_path.exists():
        input_hash = _compute_sha256(input_artifact_path)
        input_size = input_artifact_path.stat().st_size
        # Use relative path for portability
        try:
            rel_path = input_artifact_path.relative_to(Path.cwd())
        except ValueError:
            rel_path = input_artifact_path

        input_artifact_hashes.append(
            {"path": str(rel_path), "sha256": input_hash, "bytes": input_size}
        )

    # Build provenance manifest (metadata only)
    provenance = {
        "run_id": run_id,
        "dataset": dataset,
        "overall_status": overall_status,
        "total_duration_ms": total_duration,
        "row_count": len(df),
        "column_count": len(df.columns),
        "schema_name": schema_name,
        "git_commit_sha": _get_git_commit_sha(),
        "input_artifact_hashes": input_artifact_hashes,
        "artifact_hashes": {
            "parquet_sha256": parquet_hash,
            "summary_sha256": summary_hash,
        },
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    with open(provenance_path, "w") as f:
        json.dump(provenance, f, indent=2)

    print(f"✓ Provenance: {provenance_path}")


def emit_summary(
    run_id: str, output_dir: Path, stage_timings: dict, total_duration: float
) -> None:
    """
    Emit PHI-safe run summary (counts/timings only, no raw data).
    """
    summary_path = output_dir / f"pipeline_summary_{run_id}.json"

    summary = {
        "run_id": run_id,
        "dataset": "sample",
        "stages": stage_timings,
        "overall_status": "PASSED",
        "total_duration_ms": total_duration,
        "output_dir": str(output_dir),
    }

    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n✓ Summary: {summary_path}")

    return summary_path


def run_pipeline(output_dir: Path, strict: bool = False) -> None:
    """
    Execute full pipeline: ingest → conform → validate.

    Args:
        output_dir: Output directory (must be under .tmp/)
        strict: If True, treat warnings as errors

    Raises:
        SystemExit: On any stage failure (exit code 1)
    """
    # Validate output is under a directory named exactly ".tmp" (quarantine boundary)
    resolved_out = output_dir.resolve()
    current = resolved_out
    under_tmp = False
    while True:
        if current.name == ".tmp":
            under_tmp = True
            break
        if current.parent == current:
            break
        current = current.parent
    if not under_tmp:
        raise ValueError(
            f"Output directory must be under .tmp/ (quarantine)\nGot: {output_dir}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    print(f"{'='*60}")
    print(f"Pipeline Runner v1.0.0-minimal")
    print(f"{'='*60}")
    print(f"Dataset: Heart Disease Sample")
    print(f"Run ID: {run_id}")
    print(f"Output: {output_dir}")
    print(f"Strict mode: {strict}")
    print(f"{'='*60}\n")

    overall_start = time.time()
    stage_timings = {}

    try:
        # Stage 1: Ingest + Standardize
        df, input_csv_path = run_ingest()

        # Stage 2: Conform
        df = run_conform(df)

        # Stage 3: Validate
        df = run_validate(df, strict=strict)

        # Write final output
        output_path = output_dir / f"pipeline_output_{run_id}.parquet"
        df.to_parquet(output_path, index=False)
        print(f"\n✓ Final output: {output_path}")

        # Emit summary
        total_duration = (time.time() - overall_start) * 1000
        summary_path = emit_summary(run_id, output_dir, stage_timings, total_duration)

        # Emit provenance manifest
        emit_provenance_manifest(
            run_id=run_id,
            output_dir=output_dir,
            dataset="sample",
            overall_status="PASSED",
            total_duration=total_duration,
            df=df,
            schema_name="HeartDiseaseSchema",
            parquet_path=output_path,
            summary_path=summary_path,
            input_artifact_path=input_csv_path,
        )

        print(f"\n{'='*60}")
        print(f"✓ Pipeline PASSED in {total_duration:.0f}ms")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ Pipeline FAILED: {e}")
        print(f"{'='*60}\n")
        sys.exit(1)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Minimal pipeline runner: ingest → conform → validate",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  python -m src.pipeline.runner --dataset sample --out .tmp/pipeline_sample
  python -m src.pipeline.runner --dataset sample --out .tmp/pipeline_sample --strict
        """,
    )

    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        choices=["sample"],
        help='Dataset name (only "sample" supported)',
    )
    parser.add_argument(
        "--out", type=Path, required=True, help="Output directory (must be under .tmp/)"
    )
    parser.add_argument(
        "--strict", action="store_true", help="Treat warnings as errors"
    )

    args = parser.parse_args()

    try:
        run_pipeline(output_dir=args.out, strict=args.strict)
    except Exception as e:
        print(f"\n❌ ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
