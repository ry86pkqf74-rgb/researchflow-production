#!/usr/bin/env python3
"""
Parquet Fingerprinting for Drift Detection

Provides deterministic cryptographic fingerprinting of Parquet datasets to detect
data drift, corruption, or unexpected modifications. All operations are offline
and use only standard library cryptographic primitives.

Fingerprint Definition:
    SHA-256 hash of:
    1. File bytes (raw file content)
    2. Metadata: row count, column count, column names (sorted)

    This approach balances:
    - Speed: File hash is fast for small-medium files
    - Sensitivity: Detects any file modification
    - Determinism: Same file always produces same fingerprint
    - Metadata awareness: Captures schema structure

Usage:
    # Generate baseline fingerprints
    python -m src.validation.parquet_fingerprint baseline \\
        --input data/processed \\
        --output docs/validation/parquet_fingerprints.json

    # Check against baseline
    python -m src.validation.parquet_fingerprint check \\
        --input data/processed \\
        --baseline docs/validation/parquet_fingerprints.json

Governance:
    - Fully offline (no network calls)
    - Deterministic (same file = same fingerprint)
    - No new dependencies (uses hashlib, json, pathlib from stdlib + pandas/pyarrow already pinned)
    - Composable with existing validation infrastructure
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Dict, Tuple, List, Any

try:
    import pandas as pd
except ImportError:
    print(
        "ERROR: pandas not available. Install with: pip install pandas", file=sys.stderr
    )
    sys.exit(1)


def compute_file_hash(path: Path) -> str:
    """
    Compute SHA-256 hash of file bytes.

    Args:
        path: Path to file

    Returns:
        Hex digest of SHA-256 hash

    Raises:
        FileNotFoundError: If file does not exist
    """
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        # Read in chunks for memory efficiency with large files
        while chunk := f.read(8192):
            sha256.update(chunk)

    return sha256.hexdigest()


def compute_metadata_hash(path: Path) -> str:
    """
    Compute SHA-256 hash of Parquet metadata (row count, column count, column names).

    Args:
        path: Path to Parquet file

    Returns:
        Hex digest of SHA-256 hash of metadata

    Raises:
        FileNotFoundError: If file does not exist
        ValueError: If file is not valid Parquet
    """
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    try:
        # Read only metadata (columns), not full data
        df = pd.read_parquet(path, engine="pyarrow")

        # Create stable metadata representation
        metadata = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": sorted(df.columns.tolist()),  # Sorted for determinism
        }

        # Serialize to JSON with sorted keys for determinism
        metadata_json = json.dumps(metadata, sort_keys=True)

        # Hash the JSON representation
        sha256 = hashlib.sha256()
        sha256.update(metadata_json.encode("utf-8"))

        return sha256.hexdigest()

    except Exception as e:
        raise ValueError(f"Failed to read Parquet metadata from {path}: {e}")


def compute_parquet_fingerprint(path: Path) -> Dict[str, Any]:
    """
    Compute comprehensive fingerprint of Parquet file.

    Fingerprint includes:
    - file_hash: SHA-256 of raw file bytes
    - metadata_hash: SHA-256 of metadata (rows, columns, column names)
    - row_count: Number of rows
    - column_count: Number of columns
    - columns: Sorted list of column names

    Args:
        path: Path to Parquet file (str or Path)

    Returns:
        Dictionary with fingerprint components

    Raises:
        FileNotFoundError: If file does not exist
        ValueError: If file is not valid Parquet
    """
    path = Path(path)

    # Compute file hash (fast, detects any change)
    file_hash = compute_file_hash(path)

    # Read metadata
    df = pd.read_parquet(path, engine="pyarrow")
    row_count = len(df)
    column_count = len(df.columns)
    columns = sorted(df.columns.tolist())

    # Compute metadata hash
    metadata = {
        "row_count": row_count,
        "column_count": column_count,
        "columns": columns,
    }
    metadata_json = json.dumps(metadata, sort_keys=True)
    sha256 = hashlib.sha256()
    sha256.update(metadata_json.encode("utf-8"))
    metadata_hash = sha256.hexdigest()

    # Compute a deterministic sample hash of the first 10 rows for row-level drift detection
    try:
        sample_df = df.head(10)
        sample_json = sample_df.to_json(orient="split", index=False)
        sample_hash = hashlib.sha256(sample_json.encode("utf-8")).hexdigest()
    except Exception:
        sample_hash = ""

    return {
        "file_hash": file_hash,
        "metadata_hash": metadata_hash,
        "row_count": row_count,
        "column_count": column_count,
        "columns": columns,
        "sample_hash": sample_hash,
    }


def compute_directory_fingerprints(
    directory: Path, pattern: str = "*.parquet", recursive: bool = True
) -> Dict[str, Dict[str, Any]]:
    """
    Compute fingerprints for all Parquet files in directory.

    Args:
        directory: Directory to scan
        pattern: Glob pattern for matching files (default: "*.parquet")
        recursive: If True, scan subdirectories (default: True)

    Returns:
        Dictionary mapping relative paths to fingerprints (sorted by path)

    Raises:
        FileNotFoundError: If directory does not exist
    """
    directory = Path(directory)

    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    if not directory.is_dir():
        raise ValueError(f"Not a directory: {directory}")

    # Find all matching files
    if recursive:
        files = sorted(directory.rglob(pattern))
    else:
        files = sorted(directory.glob(pattern))

    # Compute fingerprints for each file
    fingerprints = {}
    for file_path in files:
        # Store relative path for portability
        relative_path = file_path.relative_to(directory)
        try:
            fingerprints[str(relative_path)] = compute_parquet_fingerprint(file_path)
        except (FileNotFoundError, ValueError) as e:
            print(
                f"WARNING: Failed to fingerprint {relative_path}: {e}", file=sys.stderr
            )
            continue

    # Return sorted by path for determinism
    return dict(sorted(fingerprints.items()))


def write_baseline(
    baseline_path: Path, fingerprints: Dict[str, Dict[str, Any]]
) -> None:
    """
    Write baseline fingerprints to JSON file.

    Args:
        baseline_path: Path to baseline file
        fingerprints: Fingerprints dictionary from compute_directory_fingerprints()

    Raises:
        OSError: If file cannot be written
    """
    baseline_path = Path(baseline_path)

    # Create parent directories if needed
    baseline_path.parent.mkdir(parents=True, exist_ok=True)

    # Write with sorted keys for determinism
    with open(baseline_path, "w") as f:
        json.dump(fingerprints, f, indent=2, sort_keys=True)


def read_baseline(baseline_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Read baseline fingerprints from JSON file.

    Args:
        baseline_path: Path to baseline file

    Returns:
        Fingerprints dictionary

    Raises:
        FileNotFoundError: If baseline file does not exist
        json.JSONDecodeError: If baseline file is invalid JSON
    """
    baseline_path = Path(baseline_path)

    if not baseline_path.exists():
        raise FileNotFoundError(f"Baseline file not found: {baseline_path}")

    with open(baseline_path, "r") as f:
        return json.load(f)


def check_against_baseline(
    baseline: Dict[str, Dict[str, Any]], current: Dict[str, Dict[str, Any]]
) -> Tuple[bool, Dict[str, Any]]:
    """
    Check current fingerprints against baseline.

    Detects:
    - Added files (in current but not in baseline)
    - Removed files (in baseline but not in current)
    - Modified files (different file_hash or metadata_hash)

    Args:
        baseline: Baseline fingerprints from read_baseline()
        current: Current fingerprints from compute_directory_fingerprints()

    Returns:
        Tuple of (passed, diff_dict)
        - passed: True if no drift detected
        - diff_dict: Dictionary with keys: added, removed, modified
    """
    baseline_paths = set(baseline.keys())
    current_paths = set(current.keys())

    # Find differences
    added = sorted(current_paths - baseline_paths)
    removed = sorted(baseline_paths - current_paths)

    # Check for modifications in common files (compare file, metadata and sample hashes)
    modified = []
    for path in sorted(baseline_paths & current_paths):
        baseline_fp = baseline[path]
        current_fp = current[path]

        # Check file hash, metadata hash, and sample hash
        if (
            baseline_fp["file_hash"] != current_fp["file_hash"]
            or baseline_fp["metadata_hash"] != current_fp["metadata_hash"]
            or baseline_fp.get("sample_hash") != current_fp.get("sample_hash")
        ):

            modified.append(
                {
                    "path": path,
                    "baseline_file_hash": baseline_fp["file_hash"],
                    "current_file_hash": current_fp["file_hash"],
                    "baseline_metadata_hash": baseline_fp["metadata_hash"],
                    "current_metadata_hash": current_fp["metadata_hash"],
                    "baseline_row_count": baseline_fp["row_count"],
                    "current_row_count": current_fp["row_count"],
                    "baseline_column_count": baseline_fp["column_count"],
                    "current_column_count": current_fp["column_count"],
                    "baseline_sample_hash": baseline_fp.get("sample_hash"),
                    "current_sample_hash": current_fp.get("sample_hash"),
                }
            )

    diff = {
        "added": added,
        "removed": removed,
        "modified": modified,
    }

    passed = len(added) == 0 and len(removed) == 0 and len(modified) == 0

    return passed, diff


def format_diff_report(diff: Dict[str, Any]) -> str:
    """
    Format drift diff as human-readable report.

    Args:
        diff: Diff dictionary from check_against_baseline()

    Returns:
        Formatted report string
    """
    lines = []
    lines.append("=" * 80)
    lines.append("PARQUET DRIFT DETECTION REPORT")
    lines.append("=" * 80)
    lines.append("")

    if diff["added"]:
        lines.append(f"ADDED FILES ({len(diff['added'])}):")
        for path in diff["added"]:
            lines.append(f"  + {path}")
        lines.append("")

    if diff["removed"]:
        lines.append(f"REMOVED FILES ({len(diff['removed'])}):")
        for path in diff["removed"]:
            lines.append(f"  - {path}")
        lines.append("")

    if diff["modified"]:
        lines.append(f"MODIFIED FILES ({len(diff['modified'])}):")
        for mod in diff["modified"]:
            lines.append(f"  ~ {mod['path']}")
            lines.append(
                f"      File hash: {mod['baseline_file_hash'][:16]}... → {mod['current_file_hash'][:16]}..."
            )
            lines.append(
                f"      Metadata hash: {mod['baseline_metadata_hash'][:16]}... → {mod['current_metadata_hash'][:16]}..."
            )
            lines.append(
                f"      Rows: {mod['baseline_row_count']} → {mod['current_row_count']}"
            )
            lines.append(
                f"      Columns: {mod['baseline_column_count']} → {mod['current_column_count']}"
            )
        lines.append("")

    if not diff["added"] and not diff["removed"] and not diff["modified"]:
        lines.append("✓ NO DRIFT DETECTED")
        lines.append("All Parquet files match baseline fingerprints.")
        lines.append("")

    lines.append("=" * 80)

    return "\n".join(lines)


def main():
    """CLI entry point for Parquet fingerprinting."""
    parser = argparse.ArgumentParser(
        description="Parquet fingerprinting for drift detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Baseline generation command
    baseline_parser = subparsers.add_parser(
        "baseline", help="Generate baseline fingerprints"
    )
    baseline_parser.add_argument(
        "--input", type=Path, required=True, help="Directory containing Parquet files"
    )
    baseline_parser.add_argument(
        "--output", type=Path, required=True, help="Output path for baseline JSON"
    )
    baseline_parser.add_argument(
        "--pattern",
        type=str,
        default="*.parquet",
        help="Glob pattern for matching files (default: *.parquet)",
    )
    baseline_parser.add_argument(
        "--no-recursive", action="store_true", help="Do not scan subdirectories"
    )

    # Check command
    check_parser = subparsers.add_parser(
        "check", help="Check current fingerprints against baseline"
    )
    check_parser.add_argument(
        "--input", type=Path, required=True, help="Directory containing Parquet files"
    )
    check_parser.add_argument(
        "--baseline", type=Path, required=True, help="Path to baseline JSON"
    )
    check_parser.add_argument(
        "--pattern",
        type=str,
        default="*.parquet",
        help="Glob pattern for matching files (default: *.parquet)",
    )
    check_parser.add_argument(
        "--no-recursive", action="store_true", help="Do not scan subdirectories"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        if args.command == "baseline":
            print(f"Generating baseline fingerprints from: {args.input}")
            print(f"Pattern: {args.pattern}")
            print("")

            fingerprints = compute_directory_fingerprints(
                args.input, pattern=args.pattern, recursive=not args.no_recursive
            )

            if not fingerprints:
                print(
                    "WARNING: No Parquet files found matching pattern", file=sys.stderr
                )
                sys.exit(1)

            write_baseline(args.output, fingerprints)

            print(f"✓ Baseline written: {args.output}")
            print(f"  Files fingerprinted: {len(fingerprints)}")
            print("")
            print("Files:")
            for path in sorted(fingerprints.keys()):
                fp = fingerprints[path]
                print(
                    f"  {path}: {fp['file_hash'][:16]}... ({fp['row_count']} rows, {fp['column_count']} cols)"
                )

            sys.exit(0)

        elif args.command == "check":
            print(f"Checking fingerprints against baseline: {args.baseline}")
            print(f"Input directory: {args.input}")
            print(f"Pattern: {args.pattern}")
            print("")

            baseline = read_baseline(args.baseline)
            current = compute_directory_fingerprints(
                args.input, pattern=args.pattern, recursive=not args.no_recursive
            )

            passed, diff = check_against_baseline(baseline, current)

            report = format_diff_report(diff)
            print(report)

            if passed:
                print("✓ DRIFT CHECK PASSED")
                sys.exit(0)
            else:
                print("❌ DRIFT DETECTED")
                print("")
                print("Remediation steps:")
                print("1. Review changes above to determine if expected")
                print(
                    "2. If expected: Regenerate baseline with `make fingerprint-baseline`"
                )
                print(
                    "3. If unexpected: Investigate data pipeline for corruption or drift"
                )
                print("4. See docs/validation/DRIFT_DETECTION_POLICY.md for guidance")
                sys.exit(1)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
