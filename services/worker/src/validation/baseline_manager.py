"""Baseline manager utilities for dataset drift detection.

This module provides helper functions to create and check dataset baselines
using the Parquet fingerprint utilities. A baseline captures the schema
fingerprint and sample hash of a dataset at a point in time; future
datasets can be compared against this baseline to detect changes in
row counts, column names, or hash mismatches.

The baseline format is a simple JSON object storing the fingerprint
dictionary returned by ``compute_parquet_fingerprint`` from
``src.validation.parquet_fingerprint``. Baselines are stored in
``.tmp/baselines/`` and named after the original file.

Example usage:

    from src.validation import baseline_manager
    # Create a baseline
    baseline_manager.save_baseline("data/my_dataset.parquet")

    # Check a new file against the baseline
    report = baseline_manager.check_against_baseline("data/new_dataset.parquet")
    if report["drift_detected"]:
        print("Dataset drift detected:", report["diff"])

"""

from __future__ import annotations

import json
import os
from typing import Any, Dict

from .parquet_fingerprint import compute_parquet_fingerprint

# Directory where baselines are stored.  Baselines are stored under
# ``.tmp/baselines`` relative to the project root.  This directory is
# created on-demand when saving baselines.
BASELINE_DIR = os.path.join(os.getcwd(), ".tmp", "baselines")


def _ensure_baseline_dir() -> None:
    """Ensure that the baseline directory exists."""
    os.makedirs(BASELINE_DIR, exist_ok=True)


def save_baseline(parquet_path: str, baseline_name: str | None = None) -> str:
    """Compute a fingerprint for ``parquet_path`` and save it as a baseline.

    Args:
        parquet_path: Path to the Parquet file to fingerprint.
        baseline_name: Optional name for the baseline file. If omitted,
            the baseline file will be named after the input file with a
            ``.baseline.json`` suffix.

    Returns:
        The path to the saved baseline JSON file.
    """
    _ensure_baseline_dir()
    fingerprint = compute_parquet_fingerprint(parquet_path)
    if baseline_name is None:
        base_name = os.path.basename(parquet_path)
        baseline_name = f"{base_name}.baseline.json"
    baseline_path = os.path.join(BASELINE_DIR, baseline_name)
    with open(baseline_path, "w", encoding="utf-8") as f:
        json.dump(fingerprint, f, indent=2, sort_keys=True)
    return baseline_path


def load_baseline(baseline_path: str) -> Dict[str, Any]:
    """Load a baseline file from disk and return the fingerprint dict.

    Args:
        baseline_path: Path to the baseline JSON file.

    Returns:
        The fingerprint dictionary stored in the baseline file.

    Raises:
        FileNotFoundError: If the baseline file does not exist.
        json.JSONDecodeError: If the baseline file is not valid JSON.
    """
    if not os.path.exists(baseline_path):
        raise FileNotFoundError(f"Baseline file not found: {baseline_path}")
    with open(baseline_path, "r", encoding="utf-8") as f:
        return json.load(f)


def check_against_baseline(parquet_path: str, baseline_path: str) -> Dict[str, Any]:
    """Compare a Parquet file to a saved baseline and return a drift report.

    Args:
        parquet_path: Path to the Parquet file to check.
        baseline_path: Path to the saved baseline JSON file.

    Returns:
        A dict containing ``drift_detected`` (bool) and ``diff`` (dict)
        summarizing any differences between the current fingerprint and the
        baseline fingerprint.  The diff includes keys for ``schema``,
        ``row_count``, and ``sample_hash`` indicating whether they differ.
        If an error occurs (missing or malformed baseline), ``error`` key
        will be present with the error message.
    """
    try:
        current_fp = compute_parquet_fingerprint(parquet_path)
    except (FileNotFoundError, ValueError) as e:
        return {
            "drift_detected": True,
            "error": f"Failed to read parquet: {e}",
            "diff": {},
        }

    try:
        baseline_fp = load_baseline(baseline_path)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        return {
            "drift_detected": True,
            "error": f"Failed to load baseline: {e}",
            "diff": {},
        }

    drift_detected = False
    diff: Dict[str, Any] = {}

    # Compare row_count
    baseline_row_count = baseline_fp.get("row_count")
    current_row_count = current_fp.get("row_count")
    if baseline_row_count != current_row_count:
        drift_detected = True
        diff["row_count"] = {
            "baseline": baseline_row_count,
            "current": current_row_count,
        }

    # Compare schema (columns)
    baseline_columns = baseline_fp.get("columns", [])
    current_columns = current_fp.get("columns", [])
    if baseline_columns != current_columns:
        drift_detected = True
        diff["schema"] = {"baseline": baseline_columns, "current": current_columns}

    # Compare sample_hash
    baseline_sample_hash = baseline_fp.get("sample_hash")
    current_sample_hash = current_fp.get("sample_hash")
    if baseline_sample_hash != current_sample_hash:
        drift_detected = True
        diff["sample_hash"] = {
            "baseline": baseline_sample_hash,
            "current": current_sample_hash,
        }

    return {"drift_detected": drift_detected, "diff": diff}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Create or check dataset baselines.")
    subparsers = parser.add_subparsers(dest="command")

    create_parser = subparsers.add_parser(
        "create", help="Create a baseline for a Parquet file"
    )
    create_parser.add_argument("parquet_path", help="Path to Parquet file")
    create_parser.add_argument("--name", help="Optional baseline name")

    check_parser = subparsers.add_parser(
        "check", help="Check a Parquet file against a baseline"
    )
    check_parser.add_argument("parquet_path", help="Path to Parquet file")
    check_parser.add_argument("baseline_path", help="Path to baseline JSON file")

    args = parser.parse_args()
    if args.command == "create":
        path = save_baseline(args.parquet_path, args.name)
        print(f"Baseline saved to {path}")
    elif args.command == "check":
        report = check_against_baseline(args.parquet_path, args.baseline_path)
        if report.get("error"):
            print(f"ERROR: {report['error']}")
        elif report.get("drift_detected"):
            print("DRIFT DETECTED:")
            print(json.dumps(report["diff"], indent=2))
        else:
            print("No drift detected - dataset matches baseline.")
    else:
        parser.print_help()
