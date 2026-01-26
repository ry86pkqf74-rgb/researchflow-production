#!/usr/bin/env python3
"""
Schema Version Metadata Validation and Migration CLI.

Provides tools to check and migrate schema version metadata in Parquet files.

Commands:
    check: Scan directory for Parquet files and report metadata status
    migrate: Add/update schema metadata to Parquet files

Usage:
    # Check all Parquet files in directory
    python -m src.validation.schema_version_metadata check \\
        --input data/processed \\
        --strict

    # Migrate specific file
    python -m src.validation.schema_version_metadata migrate \\
        --input data/processed/thyroid.parquet \\
        --schema-id thyroid \\
        --schema-version v1.0.0

    # Migrate all files in directory (prompts for confirmation)
    python -m src.validation.schema_version_metadata migrate \\
        --input data/processed \\
        --schema-id thyroid \\
        --schema-version v1.0.0 \\
        --pattern "thyroid_*.parquet"

Governance:
    - check command reports missing/mismatched metadata
    - migrate command requires explicit schema ID and version
    - Migration is opt-in and governed (approval required for frozen data)
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not available", file=sys.stderr)
    sys.exit(1)

from src.io.parquet_io import (
    get_parquet_schema_metadata,
    update_parquet_schema_metadata,
)


def check_directory(
    directory: Path,
    pattern: str = "*.parquet",
    recursive: bool = True,
    strict: bool = False,
) -> Tuple[bool, Dict[str, List[Dict]]]:
    """
    Check all Parquet files in directory for schema metadata.

    Args:
        directory: Directory to scan
        pattern: Glob pattern for matching files
        recursive: Scan subdirectories
        strict: Fail on missing metadata

    Returns:
        Tuple of (passed, results_dict)
        - passed: True if all files have metadata (or strict=False)
        - results_dict: Dictionary with keys: complete, missing_metadata, errors
    """
    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    if not directory.is_dir():
        raise ValueError(f"Not a directory: {directory}")

    # Find all Parquet files
    if recursive:
        files = sorted(directory.rglob(pattern))
    else:
        files = sorted(directory.glob(pattern))

    complete = []
    missing_metadata = []
    errors = []

    for file_path in files:
        relative_path = file_path.relative_to(directory)

        try:
            metadata = get_parquet_schema_metadata(file_path)

            if metadata["schema_id"] is None or metadata["schema_version"] is None:
                missing_metadata.append(
                    {
                        "path": str(relative_path),
                        "schema_id": metadata.get("schema_id"),
                        "schema_version": metadata.get("schema_version"),
                    }
                )
            else:
                complete.append(
                    {
                        "path": str(relative_path),
                        "schema_id": metadata["schema_id"],
                        "schema_version": metadata["schema_version"],
                    }
                )
        except Exception as e:
            errors.append(
                {
                    "path": str(relative_path),
                    "error": str(e),
                }
            )

    results = {
        "complete": complete,
        "missing_metadata": missing_metadata,
        "errors": errors,
    }

    passed = len(missing_metadata) == 0 and len(errors) == 0
    if strict and not passed:
        passed = False

    return passed, results


def format_check_report(results: Dict[str, List[Dict]], strict: bool = False) -> str:
    """
    Format check results as human-readable report.

    Args:
        results: Results dictionary from check_directory()
        strict: Whether strict mode was used

    Returns:
        Formatted report string
    """
    lines = []
    lines.append("=" * 80)
    lines.append("SCHEMA VERSION METADATA CHECK")
    lines.append("=" * 80)
    lines.append("")

    if results["complete"]:
        lines.append(f"✓ FILES WITH COMPLETE METADATA ({len(results['complete'])}):")
        for item in results["complete"]:
            lines.append(f"  {item['path']}")
            lines.append(f"    schema_id: {item['schema_id']}")
            lines.append(f"    schema_version: {item['schema_version']}")
        lines.append("")

    if results["missing_metadata"]:
        lines.append(f"⚠️  FILES MISSING METADATA ({len(results['missing_metadata'])}):")
        for item in results["missing_metadata"]:
            lines.append(f"  {item['path']}")
            if item.get("schema_id"):
                lines.append(f"    schema_id: {item['schema_id']}")
            else:
                lines.append(f"    schema_id: MISSING")
            if item.get("schema_version"):
                lines.append(f"    schema_version: {item['schema_version']}")
            else:
                lines.append(f"    schema_version: MISSING")
        lines.append("")

    if results["errors"]:
        lines.append(f"❌ FILES WITH ERRORS ({len(results['errors'])}):")
        for item in results["errors"]:
            lines.append(f"  {item['path']}: {item['error']}")
        lines.append("")

    lines.append("=" * 80)
    lines.append("")

    # Summary
    total = (
        len(results["complete"])
        + len(results["missing_metadata"])
        + len(results["errors"])
    )
    lines.append(
        f"SUMMARY: {len(results['complete'])}/{total} files have complete metadata"
    )
    lines.append("")

    if not results["missing_metadata"] and not results["errors"]:
        lines.append("✓ ALL FILES HAVE SCHEMA VERSION METADATA")
        return "\n".join(lines)

    # Remediation guidance
    if results["missing_metadata"]:
        lines.append("REMEDIATION:")
        lines.append("Files missing metadata need migration:")
        lines.append("")
        lines.append("  python -m src.validation.schema_version_metadata migrate \\")
        lines.append("      --input <path/to/file.parquet> \\")
        lines.append("      --schema-id <schema_id> \\")
        lines.append("      --schema-version <version>")
        lines.append("")
        lines.append(
            "See docs/validation/SCHEMA_VERSION_METADATA_POLICY.md for guidance"
        )

    return "\n".join(lines)


def migrate_file(
    file_path: Path, schema_id: str, schema_version: str, dry_run: bool = False
) -> None:
    """
    Migrate single Parquet file to add schema metadata.

    Args:
        file_path: Path to Parquet file
        schema_id: Schema identifier to embed
        schema_version: Schema version to embed
        dry_run: If True, only print what would be done

    Raises:
        FileNotFoundError: If file does not exist
        ValueError: If schema_id or schema_version are empty
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if dry_run:
        print(f"[DRY RUN] Would migrate: {file_path}")
        print(f"          schema_id: {schema_id}")
        print(f"          schema_version: {schema_version}")
        return

    # Check existing metadata
    existing_metadata = get_parquet_schema_metadata(file_path)

    if existing_metadata["schema_id"] or existing_metadata["schema_version"]:
        print(f"⚠️  File already has metadata: {file_path}")
        print(f"   Existing schema_id: {existing_metadata['schema_id']}")
        print(f"   Existing schema_version: {existing_metadata['schema_version']}")
        print(f"   Overwriting with:")
        print(f"   New schema_id: {schema_id}")
        print(f"   New schema_version: {schema_version}")

    # Migrate
    update_parquet_schema_metadata(
        file_path, schema_id=schema_id, schema_version=schema_version
    )

    print(f"✓ Migrated: {file_path}")


def migrate_directory(
    directory: Path,
    schema_id: str,
    schema_version: str,
    pattern: str = "*.parquet",
    recursive: bool = True,
    dry_run: bool = False,
    require_confirmation: bool = True,
) -> None:
    """
    Migrate all Parquet files in directory.

    Args:
        directory: Directory to scan
        schema_id: Schema identifier to embed
        schema_version: Schema version to embed
        pattern: Glob pattern for matching files
        recursive: Scan subdirectories
        dry_run: If True, only print what would be done
        require_confirmation: Prompt for confirmation before migrating

    Raises:
        FileNotFoundError: If directory does not exist
    """
    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    if not directory.is_dir():
        raise ValueError(f"Not a directory: {directory}")

    # Find all Parquet files
    if recursive:
        files = sorted(directory.rglob(pattern))
    else:
        files = sorted(directory.glob(pattern))

    if not files:
        print(f"No files found matching pattern: {pattern}")
        return

    print(f"Found {len(files)} files to migrate:")
    for file_path in files:
        relative_path = file_path.relative_to(directory)
        print(f"  {relative_path}")
    print("")
    print(f"Schema ID: {schema_id}")
    print(f"Schema Version: {schema_version}")
    print("")

    if require_confirmation and not dry_run:
        response = input("Proceed with migration? [y/N]: ")
        if response.lower() != "y":
            print("Migration cancelled")
            return

    # Migrate each file
    for file_path in files:
        try:
            migrate_file(file_path, schema_id, schema_version, dry_run=dry_run)
        except Exception as e:
            print(f"❌ Failed to migrate {file_path}: {e}", file=sys.stderr)
            continue


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Schema version metadata validation and migration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Check command
    check_parser = subparsers.add_parser(
        "check", help="Check Parquet files for schema metadata"
    )
    check_parser.add_argument(
        "--input", type=Path, required=True, help="Directory containing Parquet files"
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
    check_parser.add_argument(
        "--strict", action="store_true", help="Fail on missing metadata (exit code 1)"
    )
    check_parser.add_argument(
        "--json", action="store_true", help="Output results as JSON"
    )

    # Migrate command
    migrate_parser = subparsers.add_parser(
        "migrate", help="Add/update schema metadata to Parquet files"
    )
    migrate_parser.add_argument(
        "--input", type=Path, required=True, help="Parquet file or directory to migrate"
    )
    migrate_parser.add_argument(
        "--schema-id",
        type=str,
        required=True,
        help='Schema identifier (e.g., "heart_disease", "thyroid_pathology")',
    )
    migrate_parser.add_argument(
        "--schema-version",
        type=str,
        required=True,
        help='Schema version (e.g., "v1.0.0")',
    )
    migrate_parser.add_argument(
        "--pattern",
        type=str,
        default="*.parquet",
        help="Glob pattern for matching files (default: *.parquet)",
    )
    migrate_parser.add_argument(
        "--no-recursive", action="store_true", help="Do not scan subdirectories"
    )
    migrate_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without modifying files",
    )
    migrate_parser.add_argument(
        "--yes", action="store_true", help="Skip confirmation prompt"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        if args.command == "check":
            print(f"Checking schema metadata in: {args.input}")
            print(f"Pattern: {args.pattern}")
            print(f"Strict mode: {args.strict}")
            print("")

            passed, results = check_directory(
                args.input,
                pattern=args.pattern,
                recursive=not args.no_recursive,
                strict=args.strict,
            )

            if args.json:
                print(json.dumps(results, indent=2))
            else:
                report = format_check_report(results, strict=args.strict)
                print(report)

            if passed:
                sys.exit(0)
            else:
                if args.strict:
                    print("❌ CHECK FAILED (strict mode)")
                else:
                    print("⚠️  CHECK COMPLETED WITH WARNINGS")
                sys.exit(1 if args.strict else 0)

        elif args.command == "migrate":
            input_path = args.input

            if input_path.is_file():
                # Migrate single file
                print(f"Migrating single file: {input_path}")
                print(f"Schema ID: {args.schema_id}")
                print(f"Schema Version: {args.schema_version}")
                print("")

                migrate_file(
                    input_path,
                    schema_id=args.schema_id,
                    schema_version=args.schema_version,
                    dry_run=args.dry_run,
                )

                print("")
                print("✓ Migration complete")
                sys.exit(0)

            elif input_path.is_dir():
                # Migrate directory
                migrate_directory(
                    input_path,
                    schema_id=args.schema_id,
                    schema_version=args.schema_version,
                    pattern=args.pattern,
                    recursive=not args.no_recursive,
                    dry_run=args.dry_run,
                    require_confirmation=not args.yes,
                )

                print("")
                if args.dry_run:
                    print("✓ Dry run complete")
                else:
                    print("✓ Migration complete")
                sys.exit(0)
            else:
                print(
                    f"ERROR: Input path does not exist: {input_path}", file=sys.stderr
                )
                sys.exit(1)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
