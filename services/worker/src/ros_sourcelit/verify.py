"""
ROS Sourcelit Index Verifier

Verifies index integrity, determinism, and completeness.
Exits non-zero on violations (CI-safe).

Last Updated: 2026-01-13
"""

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import yaml


def _collect_diagnostics(
    index_path: str,
    config_path: str = "config/sourcelit.yaml",
    check_determinism: bool = True,
    check_completeness: bool = True,
) -> Dict[str, Any]:
    """
    Collect verification diagnostics without printing or exiting.

    Args:
        index_path: Path to index.json
        config_path: Path to config file
        check_determinism: Verify deterministic ordering
        check_completeness: Verify MVP completeness requirements

    Returns:
        Dict with status, violations, and metadata
    """
    violations: List[str] = []
    checks: Dict[str, str] = {}

    # Load index
    index_file = Path(index_path)
    if not index_file.exists():
        return {
            "status": "failed",
            "violations": [f"Index not found: {index_path}"],
            "entry_count": 0,
            "index_hash": None,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "repo_metadata": {},
            "config_summary": {},
            "checks": {},
        }

    with open(index_file, "r") as f:
        index = json.load(f)

    entries = index.get("entries", [])
    entry_count = len(entries)
    index_hash = index.get("index_hash", "")
    git_metadata = index.get("git_metadata", {})

    # Load config
    config_summary = {}
    try:
        if Path(config_path).exists():
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)
                config_summary = {
                    "profile": config.get("profile", "unknown"),
                    "include_paths": config.get("indexing", {}).get("include_paths", []),
                    "exclude_patterns": config.get("indexing", {}).get("exclude_patterns", []),
                }
    except Exception as e:
        config_summary = {"error": f"Failed to load config: {e}"}

    # Check 1: Deterministic ordering
    if check_determinism:
        paths = [e["path"] for e in entries]
        sorted_paths = sorted(paths)
        if paths != sorted_paths:
            violations.append("Entries not sorted alphabetically")
            checks["determinism"] = "failed"
        else:
            checks["determinism"] = "passed"

        # Verify hash
        entries_json = json.dumps(entries, sort_keys=True)
        computed_hash = hashlib.sha256(entries_json.encode()).hexdigest()
        expected_hash = index_hash.replace("sha256:", "")
        if computed_hash != expected_hash:
            violations.append(
                f"Hash mismatch: expected {expected_hash[:8]}..., got {computed_hash[:8]}..."
            )
            checks["hash_verification"] = "failed"
        else:
            checks["hash_verification"] = "passed"

    # Check 2: No content exposure
    has_content = False
    for entry in entries:
        if any(k in entry for k in ["content", "body", "raw", "snippet", "text", "data"]):
            has_content = True
            violations.append(f"Entry {entry['path']} exposes file content")
    checks["content_exposure"] = "failed" if has_content else "passed"

    # Check 3: No restricted paths
    restricted_patterns = ["data/restricted", ".parquet", ".xlsx", ".csv", ".env"]
    restricted_found = []
    for entry in entries:
        path = entry.get("path", "")
        for pattern in restricted_patterns:
            if pattern in path:
                restricted_found.append(path)
                violations.append(f"Restricted path indexed: {path}")
    checks["restricted_paths"] = "failed" if restricted_found else "passed"

    # Check 4: MVP completeness
    if check_completeness:
        paths = [e["path"] for e in entries]

        # Must have TOOL_REGISTRY.yaml
        if not any("TOOL_REGISTRY.yaml" in p for p in paths):
            violations.append("Missing TOOL_REGISTRY.yaml")
            checks["tool_registry"] = "failed"
        else:
            checks["tool_registry"] = "passed"

        # Must have INTEGRATION_REGISTRY.yaml
        if not any("INTEGRATION_REGISTRY.yaml" in p for p in paths):
            violations.append("Missing INTEGRATION_REGISTRY.yaml")
            checks["integration_registry"] = "failed"
        else:
            checks["integration_registry"] = "passed"

        # Must have governance docs
        gov_paths = [p for p in paths if "docs/governance/" in p]
        if len(gov_paths) < 20:
            violations.append(
                f"Insufficient governance docs: {len(gov_paths)} (expected >= 20)"
            )
            checks["governance_docs"] = "failed"
        else:
            checks["governance_docs"] = "passed"

    # Check 5: Output location
    if not index_path.startswith(".tmp/"):
        violations.append(f"Index not in .tmp/: {index_path}")
        checks["output_location"] = "failed"
    else:
        checks["output_location"] = "passed"

    # Build diagnostics result
    status = "passed" if not violations else "failed"

    # Extract safe repo metadata
    repo_metadata = {
        "head_sha": git_metadata.get("head_sha", "unknown"),
        "head_ref": git_metadata.get("head_ref", "unknown"),
        "commit_time_utc": git_metadata.get("commit_time_utc", "unknown"),
    }

    return {
        "status": status,
        "violations": violations,
        "entry_count": entry_count,
        "index_hash": index_hash,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo_metadata": repo_metadata,
        "config_summary": config_summary,
        "checks": checks,
    }


def verify_index(
    index_path: str,
    config_path: str = "config/sourcelit.yaml",
    check_determinism: bool = True,
    check_completeness: bool = True,
    json_output: bool = False,
    json_output_path: Optional[str] = None,
) -> None:
    """
    Verify index integrity with optional JSON diagnostics export.

    Args:
        index_path: Path to index.json
        config_path: Path to config file
        check_determinism: Verify deterministic ordering
        check_completeness: Verify MVP completeness requirements
        json_output: If True, output JSON diagnostics
        json_output_path: Optional path to write JSON diagnostics

    Raises:
        SystemExit: Exits non-zero on violations
    """
    # Collect diagnostics
    diagnostics = _collect_diagnostics(
        index_path, config_path, check_determinism, check_completeness
    )

    # Handle JSON output
    if json_output:
        json_str = json.dumps(diagnostics, indent=2)

        if json_output_path:
            # Write to file
            output_file = Path(json_output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(json_str)
            print(f"Diagnostics written to: {json_output_path}")
        else:
            # Print to stdout
            print(json_str)

        # Exit with appropriate code
        sys.exit(0 if diagnostics["status"] == "passed" else 1)

    # Standard output mode (original behavior)
    violations = diagnostics["violations"]
    checks = diagnostics["checks"]

    # Load index for display
    index_file = Path(index_path)
    if not index_file.exists():
        print(f"❌ Index not found: {index_path}")
        sys.exit(1)

    with open(index_file, "r") as f:
        index = json.load(f)

    entries = index.get("entries", [])

    print(f"Verifying index: {index_path}")
    print(f"Entries: {len(entries)}")
    print(f"Hash: {index.get('index_hash')}")
    print()

    # Display checks
    if check_determinism:
        print("Checking deterministic ordering...")
        if checks.get("determinism") == "passed":
            print("  ✓ Entries sorted alphabetically")
        else:
            print("  ❌ Entries not sorted alphabetically")

        if checks.get("hash_verification") == "passed":
            print("  ✓ Hash matches content")
        else:
            print("  ❌ Hash mismatch")

    print("\nChecking content exposure policy...")
    if checks.get("content_exposure") == "passed":
        print("  ✓ No file content exposure")
    else:
        print("  ❌ File content exposure detected")

    print("\nChecking for restricted paths...")
    if checks.get("restricted_paths") == "passed":
        print("  ✓ No restricted paths indexed")
    else:
        print("  ❌ Restricted paths found")

    if check_completeness:
        print("\nChecking MVP completeness...")
        if checks.get("tool_registry") == "passed":
            print("  ✓ TOOL_REGISTRY.yaml present")
        else:
            print("  ❌ Missing TOOL_REGISTRY.yaml")

        if checks.get("integration_registry") == "passed":
            print("  ✓ INTEGRATION_REGISTRY.yaml present")
        else:
            print("  ❌ Missing INTEGRATION_REGISTRY.yaml")

        if checks.get("governance_docs") == "passed":
            print("  ✓ Governance docs present")
        else:
            print("  ❌ Insufficient governance docs")

    print("\nChecking output location...")
    if checks.get("output_location") == "passed":
        print(f"  ✓ Index in .tmp/ (runtime-only)")
    else:
        print(f"  ❌ Index not in .tmp/")

    # Summary
    print()
    print("=" * 60)
    if violations:
        print(f"❌ VERIFICATION FAILED: {len(violations)} violations")
        for v in violations:
            print(f"   - {v}")
        sys.exit(1)
    else:
        print("✅ VERIFICATION PASSED")
        print(f"   {len(entries)} entries indexed")
        print(f"   Hash: {index.get('index_hash')}")
        sys.exit(0)


def main():
    """CLI entrypoint."""
    import argparse

    parser = argparse.ArgumentParser(description="Verify ROS Sourcelit index")
    parser.add_argument(
        "--index", default=".tmp/sourcelit/index.json", help="Path to index.json"
    )
    parser.add_argument(
        "--config", default="config/sourcelit.yaml", help="Path to config"
    )
    parser.add_argument(
        "--check-determinism",
        action="store_true",
        default=True,
        help="Verify deterministic ordering",
    )
    parser.add_argument(
        "--check-completeness",
        action="store_true",
        default=True,
        help="Verify MVP completeness",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output diagnostics as JSON",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Optional output path for JSON diagnostics (implies --json)",
    )
    args = parser.parse_args()

    # --out implies --json mode
    json_mode = args.json or (args.out is not None)

    verify_index(
        args.index,
        args.config,
        args.check_determinism,
        args.check_completeness,
        json_mode,
        args.out,
    )


if __name__ == "__main__":
    main()
