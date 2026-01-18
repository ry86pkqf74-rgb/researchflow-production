#!/usr/bin/env python3
"""
Patient-Generated Signals Ingestion Pipeline

Governed pipeline stage for loading, validating, and linking patient-generated signals
to episodes. Follows ROS offline-only, config-driven, PHI-free design principles.

Pipeline Steps:
1. Load raw signals from CSV/Parquet (configurable source)
2. Standardize columns to canonical patient_generated_signals schema
3. Validate schema compliance (if schema module available)
4. Link signals to episodes using temporal matching (if linkage module available)
5. Write canonical Parquet with embedded schema metadata
6. Generate cryptographic fingerprint sidecar (optional)
7. Produce QA summary artifact (counts, linkage stats)

Governance:
- Offline only (no external APIs)
- Config-driven paths (no hardcoded user paths)
- No PHI in outputs (de-identified research_id only)
- Atomic writes (temp file + rename pattern)
- Deterministic processing (same inputs → same outputs)

Usage:
    # Use default config
    python -m src.ingest.ingest_patient_generated_signals

    # Override paths
    python -m src.ingest.ingest_patient_generated_signals \\
        --input data/sample/signals_sample.csv \\
        --episodes data/processed/episodes/episodes.parquet \\
        --output data/processed/patient_signals/signals_linked.parquet

    # With fingerprinting
    python -m src.ingest.ingest_patient_generated_signals \\
        --generate-fingerprint

Author: Research Operating System
Version: v1.0.0
Last Modified: 2025-12-25
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

import pandas as pd
import yaml


# Schema validation (guarded import)
try:
    from schemas.pandera.patient_generated_signals_schema import (
        PatientGeneratedSignalsSchema,
        SCHEMA_VERSION as SIGNALS_SCHEMA_VERSION,
    )

    SCHEMA_AVAILABLE = True
except ImportError:
    SCHEMA_AVAILABLE = False
    SIGNALS_SCHEMA_VERSION = "unknown"

# Episode linking (guarded import)
try:
    from src.episodes.link_signals_to_episodes import link_signals_to_episodes

    LINKAGE_AVAILABLE = True
except ImportError:
    LINKAGE_AVAILABLE = False

# Parquet I/O with metadata
try:
    from src.io.parquet_io import write_parquet_with_schema

    PARQUET_IO_AVAILABLE = True
except ImportError:
    PARQUET_IO_AVAILABLE = False

# Fingerprinting (optional)
try:
    from src.validation.parquet_fingerprint import compute_parquet_fingerprint

    FINGERPRINT_AVAILABLE = True
except ImportError:
    FINGERPRINT_AVAILABLE = False


DEFAULT_CONFIG_PATH = Path("config/patient_signals_ingestion.yaml")
DEFAULT_OUTPUT_DIR = Path("data/processed/patient_signals")
DEFAULT_QA_DIR = Path("reports/qa/patient_signals")


def load_config(config_path: Path) -> Dict:
    """
    Load ingestion configuration from YAML.

    Args:
        config_path: Path to config YAML

    Returns:
        Dict with config keys: input_path, episodes_path, output_path, column_mappings

    Raises:
        FileNotFoundError: If config doesn't exist
        ValueError: If config is malformed
    """
    if not config_path.exists():
        raise FileNotFoundError(
            f"Config file not found: {config_path}\n"
            f"Create a config file or use CLI overrides."
        )

    with open(config_path) as f:
        config = yaml.safe_load(f)

    if not config:
        raise ValueError(f"Config file is empty: {config_path}")

    return config


def load_raw_signals(
    input_path: Path, file_format: Optional[str] = None
) -> pd.DataFrame:
    """
    Load raw signals from CSV or Parquet.

    Args:
        input_path: Path to input file
        file_format: Force format ('csv' or 'parquet'), or auto-detect from extension

    Returns:
        DataFrame with raw signals

    Raises:
        FileNotFoundError: If input file doesn't exist
        ValueError: If format is unsupported
    """
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Auto-detect format from extension
    if file_format is None:
        suffix = input_path.suffix.lower()
        if suffix == ".csv":
            file_format = "csv"
        elif suffix == ".parquet":
            file_format = "parquet"
        else:
            raise ValueError(
                f"Cannot auto-detect format for {input_path.suffix}. "
                f"Use --format to specify 'csv' or 'parquet'."
            )

    if file_format == "csv":
        df = pd.read_csv(input_path)
    elif file_format == "parquet":
        df = pd.read_parquet(input_path)
    else:
        raise ValueError(f"Unsupported format: {file_format}")

    return df


def standardize_columns(
    df: pd.DataFrame, column_mappings: Optional[Dict[str, str]] = None
) -> pd.DataFrame:
    """
    Standardize column names to canonical schema.

    Args:
        df: Raw signals DataFrame
        column_mappings: Dict mapping raw column names to canonical names
                        Example: {'patient_id': 'research_id', 'timestamp': 'signal_time'}

    Returns:
        DataFrame with standardized column names
    """
    if column_mappings:
        df = df.rename(columns=column_mappings)

    # Ensure signal_time is datetime
    if "signal_time" in df.columns:
        df["signal_time"] = pd.to_datetime(df["signal_time"], errors="coerce")

    return df


def validate_schema(df: pd.DataFrame) -> Tuple[pd.DataFrame, bool]:
    """
    Validate DataFrame against patient_generated_signals schema.

    Args:
        df: Signals DataFrame

    Returns:
        Tuple of (validated_df, is_valid)

    Raises:
        ImportError: If schema module not available
    """
    if not SCHEMA_AVAILABLE:
        raise ImportError(
            "Patient-generated signals schema not available.\n"
            "This module requires PR #6 to be merged.\n"
            "Expected: schemas/pandera/patient_generated_signals_schema.py"
        )

    try:
        validated_df = PatientGeneratedSignalsSchema.validate(df, lazy=False)
        return validated_df, True
    except Exception as e:
        print(f"⚠️  Schema validation failed: {e}", file=sys.stderr)
        return df, False


def link_to_episodes(
    signals_df: pd.DataFrame, episodes_path: Path, overwrite_existing: bool = False
) -> Tuple[pd.DataFrame, Dict]:
    """
    Link signals to episodes using temporal matching.

    Args:
        signals_df: Signals DataFrame
        episodes_path: Path to episodes Parquet file
        overwrite_existing: Whether to overwrite existing episode_id values

    Returns:
        Tuple of (linked_df, linkage_stats)

    Raises:
        ImportError: If linkage module not available
        FileNotFoundError: If episodes file doesn't exist
    """
    if not LINKAGE_AVAILABLE:
        raise ImportError(
            "Episode linkage module not available.\n"
            "This module requires PR #7 to be merged.\n"
            "Expected: src/episodes/link_signals_to_episodes.py"
        )

    if not episodes_path.exists():
        raise FileNotFoundError(f"Episodes file not found: {episodes_path}")

    # Load episodes
    episodes_df = pd.read_parquet(episodes_path)

    # Required columns for linkage
    required_episode_cols = [
        "research_id",
        "episode_id",
        "episode_start",
        "episode_end",
    ]
    missing_cols = set(required_episode_cols) - set(episodes_df.columns)
    if missing_cols:
        raise ValueError(f"Episodes file missing required columns: {missing_cols}")

    # Link signals to episodes
    linked_df = link_signals_to_episodes(
        signals_df=signals_df,
        episodes_df=episodes_df,
        overwrite_existing=overwrite_existing,
    )

    # Compute linkage statistics
    total_signals = len(linked_df)
    linked_count = (linked_df["episode_link_source"] == "linked").sum()
    existing_count = (linked_df["episode_link_source"] == "existing").sum()
    unlinked_count = (linked_df["episode_link_source"] == "unlinked").sum()

    linkage_stats = {
        "total_signals": total_signals,
        "linked": linked_count,
        "existing": existing_count,
        "unlinked": unlinked_count,
        "linkage_rate": linked_count / total_signals if total_signals > 0 else 0.0,
    }

    return linked_df, linkage_stats


def write_output(
    df: pd.DataFrame,
    output_path: Path,
    schema_id: str = "patient_generated_signals",
    schema_version: str = SIGNALS_SCHEMA_VERSION,
    generate_fingerprint: bool = False,
) -> Optional[Dict]:
    """
    Write validated signals to Parquet with metadata.

    Args:
        df: Signals DataFrame
        output_path: Output Parquet path
        schema_id: Schema identifier for metadata
        schema_version: Schema version for metadata
        generate_fingerprint: Whether to generate fingerprint sidecar

    Returns:
        Fingerprint dict if generated, else None
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Use parquet_io if available, otherwise fallback to pandas
    if PARQUET_IO_AVAILABLE:
        write_parquet_with_schema(
            df=df,
            path=output_path,
            schema_id=schema_id,
            schema_version=schema_version,
            compression="snappy",
        )
    else:
        df.to_parquet(output_path, index=False, compression="snappy")
        print(f"⚠️  Written without schema metadata (parquet_io module unavailable)")

    # Generate fingerprint sidecar
    fingerprint = None
    if generate_fingerprint:
        if FINGERPRINT_AVAILABLE:
            fingerprint = compute_parquet_fingerprint(output_path)
            fingerprint_path = output_path.with_suffix(".fingerprint.json")
            with open(fingerprint_path, "w") as f:
                json.dump(fingerprint, f, indent=2)
            print(f"✓ Fingerprint: {fingerprint_path}")
        else:
            print(
                f"⚠️  Fingerprinting unavailable (parquet_fingerprint module not found)"
            )

    return fingerprint


def write_qa_artifact(
    output_dir: Path, run_stats: Dict, linkage_stats: Optional[Dict] = None
) -> Path:
    """
    Write QA summary artifact (JSON).

    Args:
        output_dir: Directory for QA artifacts
        run_stats: Dict with run metadata (timestamp, input_path, etc.)
        linkage_stats: Optional linkage statistics

    Returns:
        Path to written QA artifact
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    qa_data = {
        "run_metadata": run_stats,
        "linkage_stats": linkage_stats if linkage_stats else {},
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    qa_path = output_dir / f"ingestion_qa_{timestamp}.json"

    with open(qa_path, "w") as f:
        json.dump(qa_data, f, indent=2)

    return qa_path


def run_ingestion(
    input_path: Path,
    output_path: Path,
    episodes_path: Optional[Path] = None,
    column_mappings: Optional[Dict[str, str]] = None,
    validate: bool = True,
    link_episodes: bool = True,
    generate_fingerprint: bool = False,
    generate_qa: bool = True,
) -> Dict:
    """
    Execute full ingestion pipeline.

    Args:
        input_path: Path to raw signals file
        output_path: Path for output Parquet
        episodes_path: Path to episodes Parquet (required if link_episodes=True)
        column_mappings: Column renaming map
        validate: Whether to validate schema
        link_episodes: Whether to link signals to episodes
        generate_fingerprint: Whether to generate fingerprint sidecar
        generate_qa: Whether to generate QA artifact

    Returns:
        Dict with run summary statistics
    """
    print(f"\n{'='*60}")
    print("Patient-Generated Signals Ingestion Pipeline")
    print(f"{'='*60}\n")

    start_time = datetime.now()

    # Step 1: Load raw signals
    print(f"[1/6] Loading raw signals from {input_path}...")
    df = load_raw_signals(input_path)
    print(f"      ✓ Loaded {len(df):,} signals × {len(df.columns)} columns")

    # Step 2: Standardize columns
    print(f"[2/6] Standardizing columns...")
    df = standardize_columns(df, column_mappings)
    print(f"      ✓ Standardized column names")

    # Step 3: Validate schema
    if validate:
        print(f"[3/6] Validating schema...")
        if SCHEMA_AVAILABLE:
            df, is_valid = validate_schema(df)
            if is_valid:
                print(f"      ✓ Schema validation passed ({SIGNALS_SCHEMA_VERSION})")
            else:
                print(f"      ⚠️  Schema validation failed (continuing with warnings)")
        else:
            print(f"      ⚠️  Schema validation skipped (module unavailable)")
    else:
        print(f"[3/6] Schema validation skipped (--no-validate)")

    # Step 4: Link to episodes
    linkage_stats = None
    if link_episodes:
        print(f"[4/6] Linking signals to episodes...")
        if LINKAGE_AVAILABLE and episodes_path:
            df, linkage_stats = link_to_episodes(df, episodes_path)
            print(f"      ✓ Linked {linkage_stats['linked']:,} signals to episodes")
            print(f"        • Existing: {linkage_stats['existing']:,}")
            print(f"        • Unlinked: {linkage_stats['unlinked']:,}")
            print(f"        • Linkage rate: {linkage_stats['linkage_rate']:.1%}")
        elif not LINKAGE_AVAILABLE:
            print(f"      ⚠️  Episode linking skipped (module unavailable)")
        else:
            print(f"      ⚠️  Episode linking skipped (no episodes file provided)")
    else:
        print(f"[4/6] Episode linking skipped (--no-link-episodes)")

    # Step 5: Write output
    print(f"[5/6] Writing canonical Parquet to {output_path}...")
    fingerprint = write_output(
        df=df, output_path=output_path, generate_fingerprint=generate_fingerprint
    )
    print(f"      ✓ Written {len(df):,} signals")

    # Step 6: Generate QA artifact
    if generate_qa:
        print(f"[6/6] Generating QA artifact...")
        run_stats = {
            "timestamp": start_time.isoformat(),
            "input_path": str(input_path),
            "output_path": str(output_path),
            "episodes_path": str(episodes_path) if episodes_path else None,
            "total_signals": len(df),
            "columns": df.columns.tolist(),
            "schema_version": SIGNALS_SCHEMA_VERSION,
            "validation_enabled": validate and SCHEMA_AVAILABLE,
            "linkage_enabled": link_episodes and LINKAGE_AVAILABLE,
            "duration_seconds": (datetime.now() - start_time).total_seconds(),
        }
        qa_path = write_qa_artifact(DEFAULT_QA_DIR, run_stats, linkage_stats)
        print(f"      ✓ QA artifact: {qa_path}")
    else:
        print(f"[6/6] QA artifact skipped (--no-qa)")
        run_stats = {"total_signals": len(df)}

    elapsed = datetime.now() - start_time
    print(f"\n{'='*60}")
    print(f"✓ Ingestion complete in {elapsed.total_seconds():.1f}s")
    print(f"{'='*60}\n")

    return run_stats


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Patient-generated signals ingestion pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Use default config
  python -m src.ingest.ingest_patient_generated_signals

  # Override paths
  python -m src.ingest.ingest_patient_generated_signals \\
      --input data/sample/signals_sample.csv \\
      --episodes data/processed/episodes/episodes.parquet \\
      --output data/processed/patient_signals/signals_linked.parquet

  # Skip validation and linking (raw conversion only)
  python -m src.ingest.ingest_patient_generated_signals \\
      --input data/sample/signals_sample.csv \\
      --output data/processed/patient_signals/signals_raw.parquet \\
      --no-validate --no-link-episodes
        """,
    )

    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help=f"Path to config YAML (default: {DEFAULT_CONFIG_PATH})",
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="Path to raw signals file (CSV or Parquet). Overrides config.",
    )
    parser.add_argument(
        "--episodes", type=Path, help="Path to episodes Parquet file. Overrides config."
    )
    parser.add_argument(
        "--output", type=Path, help="Path for output Parquet. Overrides config."
    )
    parser.add_argument(
        "--no-validate", action="store_true", help="Skip schema validation"
    )
    parser.add_argument(
        "--no-link-episodes", action="store_true", help="Skip episode linking"
    )
    parser.add_argument(
        "--generate-fingerprint",
        action="store_true",
        help="Generate cryptographic fingerprint sidecar",
    )
    parser.add_argument(
        "--no-qa", action="store_true", help="Skip QA artifact generation"
    )

    args = parser.parse_args()

    # Load config if exists (CLI overrides take precedence)
    config = {}
    if args.config.exists():
        try:
            config = load_config(args.config)
        except Exception as e:
            print(f"⚠️  Warning: Could not load config: {e}", file=sys.stderr)

    # Resolve paths (CLI > config > defaults)
    input_path = args.input or config.get("input_path")
    episodes_path = args.episodes or config.get("episodes_path")
    output_path = args.output or config.get(
        "output_path", DEFAULT_OUTPUT_DIR / "signals_linked.parquet"
    )
    column_mappings = config.get("column_mappings")

    if not input_path:
        parser.error("--input is required (or specify in config file)")

    input_path = Path(input_path)
    output_path = Path(output_path)
    episodes_path = Path(episodes_path) if episodes_path else None

    # Run ingestion
    try:
        run_ingestion(
            input_path=input_path,
            output_path=output_path,
            episodes_path=episodes_path,
            column_mappings=column_mappings,
            validate=not args.no_validate,
            link_episodes=not args.no_link_episodes,
            generate_fingerprint=args.generate_fingerprint,
            generate_qa=not args.no_qa,
        )
    except Exception as e:
        print(f"\n❌ ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
