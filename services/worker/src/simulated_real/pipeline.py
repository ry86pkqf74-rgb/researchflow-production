"""
Simulated-Real Mode Pipeline Orchestration (PR46)

This module orchestrates the test upload → scan → scrub → profile workflow
for simulated-real mode testing with synthetic PHI-like data.

Governance Reference: docs/plans/PR46_SIMULATED_REAL_MODE.md

Design Principles:
- Deterministic: run_id derived from content hash (no timestamps/random)
- No PHI leakage: Artifacts contain only metadata (counts/types), never values
- Offline-first: No network calls
- Fail-closed: Raise errors on validation failures
- .tmp runtime: All outputs under tmp_root, never committed
"""

import hashlib
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
import io

# Import PHI scanner from web_frontend (canonical source)
from web_frontend.phi_scan import scan_bytes_high_confidence


class SimulatedRealError(ValueError):
    """Base exception for simulated-real pipeline errors (no PHI in messages)."""

    pass


class SentinelMissingError(SimulatedRealError):
    """Raised when synthetic sentinel is not found."""

    pass


# =============================================================================
# DETERMINISTIC RUN ID GENERATION
# =============================================================================


def compute_run_id(
    input_sha256: str, pipeline_version: str, config_hash: str = "default"
) -> str:
    """
    Compute deterministic run_id from input hash + pipeline version + config.

    No timestamps, no random values - purely deterministic.

    Args:
        input_sha256: SHA256 hash of input bytes
        pipeline_version: Pipeline version string
        config_hash: Configuration hash (for reproducibility)

    Returns:
        Deterministic run_id string (hex digest)
    """
    components = f"{input_sha256}:{pipeline_version}:{config_hash}"
    run_hash = hashlib.sha256(components.encode("utf-8")).hexdigest()
    return f"run_{run_hash[:16]}"


# =============================================================================
# JSON WRITING (DETERMINISTIC, NO TIMESTAMPS)
# =============================================================================


def write_json_deterministic(path: Path, data: dict) -> None:
    """
    Write JSON with deterministic formatting (sorted keys, stable output).

    NO timestamps fields in data.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, sort_keys=True)


# =============================================================================
# METADATA-ONLY ARTIFACT GENERATION
# =============================================================================


def generate_phi_scan_report(
    findings: list, file_hash: str, sentinel_verified: bool
) -> dict:
    """
    Generate PHI scan report (metadata only, no values).

    Args:
        findings: List of PHI types found (e.g., ["SSN", "EMAIL"])
        file_hash: SHA256 hash of input file
        sentinel_verified: Whether sentinel was verified

    Returns:
        Metadata-only report dict (no examples, no row indices)
    """
    return {
        "scan_version": "pr46-v1",
        "file_hash": file_hash,
        "findings": sorted(findings),  # Stable ordering
        "sentinel_verified": sentinel_verified,
        "blocked": False,  # Not blocked if we got here
    }


def generate_phi_scrub_manifest(
    scrub_summary: dict, input_hash: str, output_hash: str
) -> dict:
    """
    Generate PHI scrub manifest (metadata only, no values).

    Args:
        scrub_summary: Summary dict from scrubber (counts only)
        input_hash: SHA256 of input
        output_hash: SHA256 of output

    Returns:
        Metadata-only manifest (no examples, no row indices)
    """
    # Extract redactions from scrubber summary
    redactions = scrub_summary.get("redactions", [])

    # Sort for determinism (by rule_id, then column if present)
    sorted_redactions = sorted(
        redactions, key=lambda r: (r.get("column", ""), r["rule_id"])
    )

    return {
        "scrub_version": "pr46-v1",
        "input_hash": input_hash,
        "output_hash": output_hash,
        "redactions": sorted_redactions,
        "mode": "TEST_ONLY",
    }


def generate_dataset_profile(df) -> dict:
    """
    Generate dataset profile (aggregate stats only, no sample values).

    Args:
        df: pandas DataFrame to profile

    Returns:
        Metadata-only profile (no values, no row indices, no samples)
    """
    try:
        import pandas as pd
    except ImportError:
        raise SimulatedRealError("pandas required for dataset profiling")

    # Compute aggregate statistics only
    profile = {
        "profile_version": "pr46-v1",
        "row_count": len(df),
        "column_count": len(df.columns),
        "column_names": sorted(df.columns.tolist()),  # Stable ordering
        "dtypes": {col: str(df[col].dtype) for col in sorted(df.columns)},
        "missing_counts": {
            col: int(df[col].isna().sum()) for col in sorted(df.columns)
        },
    }

    return profile


# =============================================================================
# MAIN PIPELINE ORCHESTRATION
# =============================================================================


def run_simulated_real_from_bytes(
    raw_bytes: bytes,
    *,
    tmp_root: Path,
    pipeline_version: str = "pr46-v1",
    include_scrubbed_dataset: bool = False,
) -> Dict[str, Any]:
    """
    Orchestrate simulated-real pipeline: sentinel check → scan → scrub → profile.

    Args:
        raw_bytes: Raw uploaded file bytes
        tmp_root: Root directory for .tmp outputs (e.g., Path(".tmp"))
        pipeline_version: Pipeline version for reproducibility
        include_scrubbed_dataset: Whether to include scrubbed dataset in work dir

    Returns:
        Pipeline result dict with paths, hashes, and status:
        {
            "run_id": "run_abc123...",
            "input_sha256": "sha256:...",
            "pipeline_version": "pr46-v1",
            "sentinel_verified": true,
            "post_scrub_clean": true,
            "paths": {
                "raw_upload": ".tmp/uploads/run_abc.../raw.csv",
                "phi_scan_report": ".tmp/artifacts/run_abc.../phi_scan_report.json",
                "phi_scrub_manifest": ".tmp/artifacts/run_abc.../phi_scrub_manifest.json",
                "dataset_profile": ".tmp/artifacts/run_abc.../dataset_profile.json",
                "scrubbed_dataset": ".tmp/work/run_abc.../scrubbed.csv" (optional)
            },
            "status": "success"
        }

    Raises:
        SentinelMissingError: If sentinel verification fails (no content in message)
        SimulatedRealError: If pipeline fails (no PHI in message)
    """
    # Import dependencies
    from .sentinel import detect_format_from_bytes, verify_synthetic_sentinel
    from .scrubber import scrub_text_high_confidence, scrub_dataframe_high_confidence

    try:
        import pandas as pd
    except ImportError:
        raise SimulatedRealError("pandas required for pipeline")

    # 1. Compute input hash (deterministic)
    input_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    input_hash_short = f"sha256:{input_sha256[:16]}"

    # 2. Detect format
    try:
        file_format = detect_format_from_bytes(raw_bytes)
    except Exception:
        raise SimulatedRealError("Cannot detect file format")

    # 3. Verify sentinel (fail if missing)
    sentinel_ok = verify_synthetic_sentinel(raw_bytes)
    if not sentinel_ok:
        raise SentinelMissingError(
            "Synthetic sentinel not found. Upload must contain test sentinel marker."
        )

    # 4. Compute deterministic run_id
    run_id = compute_run_id(input_sha256, pipeline_version)

    # 5. Setup directory structure
    upload_dir = tmp_root / "uploads" / run_id
    artifacts_dir = tmp_root / "artifacts" / run_id
    work_dir = tmp_root / "work" / run_id

    upload_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)

    # 6. Write raw upload (quarantine only)
    raw_ext = "csv" if file_format == "csv" else "xlsx"
    raw_path = upload_dir / f"raw.{raw_ext}"
    raw_path.write_bytes(raw_bytes)

    # 7. Pre-scrub PHI scan (counts only)
    pre_scan_findings = scan_bytes_high_confidence(raw_bytes)

    phi_scan_report = generate_phi_scan_report(
        findings=pre_scan_findings, file_hash=input_hash_short, sentinel_verified=True
    )
    phi_scan_report_path = artifacts_dir / "phi_scan_report.json"
    write_json_deterministic(phi_scan_report_path, phi_scan_report)

    # 8. Scrub (CSV only for now; XLSX would need openpyxl)
    if file_format == "csv":
        # Decode to text
        try:
            text_content = raw_bytes.decode("utf-8", errors="strict")
        except UnicodeDecodeError:
            raise SimulatedRealError("Cannot decode CSV as UTF-8")

        # Parse to DataFrame for better scrubbing
        try:
            df = pd.read_csv(io.StringIO(text_content))
        except Exception:
            raise SimulatedRealError("Cannot parse CSV")

        # Scrub DataFrame
        scrubbed_df, scrub_summary = scrub_dataframe_high_confidence(df)

        # Compute output hash
        scrubbed_csv = scrubbed_df.to_csv(index=False)
        output_sha256 = hashlib.sha256(scrubbed_csv.encode("utf-8")).hexdigest()
        output_hash_short = f"sha256:{output_sha256[:16]}"

        # Write scrubbed dataset (if requested)
        scrubbed_path = None
        if include_scrubbed_dataset:
            scrubbed_path = work_dir / "scrubbed.csv"
            scrubbed_df.to_csv(scrubbed_path, index=False)

    else:
        raise SimulatedRealError("XLSX format not yet supported in pipeline")

    # 9. Write scrub manifest (metadata only)
    phi_scrub_manifest = generate_phi_scrub_manifest(
        scrub_summary=scrub_summary,
        input_hash=input_hash_short,
        output_hash=output_hash_short,
    )
    phi_scrub_manifest_path = artifacts_dir / "phi_scrub_manifest.json"
    write_json_deterministic(phi_scrub_manifest_path, phi_scrub_manifest)

    # 10. Post-scrub scan (verify clean)
    post_scan_findings = scan_bytes_high_confidence(scrubbed_csv.encode("utf-8"))
    post_scrub_clean = len(post_scan_findings) == 0

    # 11. Generate dataset profile (metadata only)
    dataset_profile = generate_dataset_profile(scrubbed_df)
    dataset_profile_path = artifacts_dir / "dataset_profile.json"
    write_json_deterministic(dataset_profile_path, dataset_profile)

    # 12. Build result dict
    result = {
        "run_id": run_id,
        "input_sha256": input_hash_short,
        "pipeline_version": pipeline_version,
        "sentinel_verified": True,
        "post_scrub_clean": post_scrub_clean,
        "paths": {
            "raw_upload": str(raw_path.relative_to(tmp_root.parent)),
            "phi_scan_report": str(phi_scan_report_path.relative_to(tmp_root.parent)),
            "phi_scrub_manifest": str(
                phi_scrub_manifest_path.relative_to(tmp_root.parent)
            ),
            "dataset_profile": str(dataset_profile_path.relative_to(tmp_root.parent)),
        },
        "status": "success",
    }

    if scrubbed_path:
        result["paths"]["scrubbed_dataset"] = str(
            scrubbed_path.relative_to(tmp_root.parent)
        )

    return result
