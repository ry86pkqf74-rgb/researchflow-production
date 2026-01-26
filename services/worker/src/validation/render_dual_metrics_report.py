#!/usr/bin/env python3
"""
Dual-Metrics Markdown Summary Report Generator

Generates human-readable, publication-friendly Markdown reports from QA artifacts
containing dual strict/tolerant validation metrics.

Governance:
    - Offline only (no network calls)
    - Uses only Python stdlib (json, pathlib, datetime, subprocess)
    - No PHI or patient-level data
    - Deterministic output ordering (sorted metric names)

Usage:
    # Auto-detect newest QA artifact
    python -m src.validation.render_dual_metrics_report

    # Explicit QA artifact
    python -m src.validation.render_dual_metrics_report \\
        --qa-json reports/qa/QA_20251225_120000.json \\
        --output docs/validation/DUAL_METRICS_SUMMARY.md

    # Write both committable and local copies
    python -m src.validation.render_dual_metrics_report --also-write-local

Makefile:
    make dual-metrics-report
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple


def get_git_commit_hash() -> str:
    """Get current git commit hash (short form)."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        return result.stdout.strip()
    except (
        subprocess.CalledProcessError,
        subprocess.TimeoutExpired,
        FileNotFoundError,
    ):
        return "unknown"


def find_newest_qa_json(qa_dir: Path) -> Optional[Path]:
    """Find newest QA_*.json file in directory by modification time."""
    qa_files = list(qa_dir.glob("QA_*.json"))
    if not qa_files:
        return None
    # Sort by mtime, newest first
    qa_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return qa_files[0]


def load_qa_artifact(qa_json_path: Path) -> Dict[str, Any]:
    """Load and parse QA artifact JSON."""
    if not qa_json_path.exists():
        raise FileNotFoundError(f"QA artifact not found: {qa_json_path}")

    with open(qa_json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_dual_metrics(qa_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract dual_metrics section from QA artifact."""
    return qa_data.get("dual_metrics")


def compute_summary_stats(dual_metrics: Dict[str, Any]) -> Dict[str, int]:
    """Compute aggregate statistics from dual metrics."""
    strict_pass_count = 0
    strict_fail_count = 0
    tolerant_pass_count = 0
    tolerant_fail_count = 0
    total_count = len(dual_metrics)

    for metric_name, metric_data in dual_metrics.items():
        if isinstance(metric_data, dict):
            # Strict status
            if metric_data.get("strict_pass") is True:
                strict_pass_count += 1
            elif metric_data.get("strict_pass") is False:
                strict_fail_count += 1

            # Tolerant status
            if metric_data.get("tolerant_pass") is True:
                tolerant_pass_count += 1
            elif metric_data.get("tolerant_pass") is False:
                tolerant_fail_count += 1

    return {
        "total": total_count,
        "strict_pass": strict_pass_count,
        "strict_fail": strict_fail_count,
        "tolerant_pass": tolerant_pass_count,
        "tolerant_fail": tolerant_fail_count,
    }


def find_top_issues(
    dual_metrics: Dict[str, Any], limit: int = 5
) -> List[Tuple[str, Dict[str, Any]]]:
    """Find metrics with largest deviations or failures."""
    issues = []

    for metric_name, metric_data in dual_metrics.items():
        if not isinstance(metric_data, dict):
            continue

        # Prioritize strict failures, then tolerant failures, then by deviation magnitude
        strict_fail = metric_data.get("strict_pass") is False
        tolerant_fail = metric_data.get("tolerant_pass") is False
        deviation = metric_data.get("deviation")

        # Compute priority score (higher = more important)
        priority = 0
        if strict_fail:
            priority += 1000
        if tolerant_fail:
            priority += 100
        if deviation is not None:
            try:
                priority += abs(float(deviation))
            except (ValueError, TypeError):
                pass

        issues.append((metric_name, metric_data, priority))

    # Sort by priority (highest first), then by metric name for determinism
    issues.sort(key=lambda x: (-x[2], x[0]))

    # Return top N (without priority score)
    return [(name, data) for name, data, _ in issues[:limit]]


def format_metric_value(value: Any) -> str:
    """Format metric value for display."""
    if value is None:
        return "—"
    elif isinstance(value, bool):
        return "✓" if value else "✗"
    elif isinstance(value, (int, float)):
        return f"{value:,.2f}" if isinstance(value, float) else f"{value:,}"
    else:
        return str(value)


def generate_markdown_report(
    qa_json_path: Path,
    qa_data: Dict[str, Any],
    dual_metrics: Optional[Dict[str, Any]],
    timestamp: str,
    git_hash: str,
) -> str:
    """Generate Markdown report from dual metrics."""
    lines = []

    # Header
    lines.append("# Dual-Metrics Validation Summary")
    lines.append("")
    lines.append("**Automated validation report with strict/tolerant thresholds**")
    lines.append("")

    # Metadata
    lines.append("## Report Metadata")
    lines.append("")
    lines.append(f"- **Generated**: {timestamp}")
    lines.append(f"- **Git Commit**: `{git_hash}`")
    lines.append(f"- **QA Artifact**: `{qa_json_path.name}`")
    lines.append(f"- **Run ID**: `{qa_data.get('run_id', 'unknown')}`")
    lines.append("")

    # Check if dual metrics exist
    if dual_metrics is None or len(dual_metrics) == 0:
        lines.append("## Status")
        lines.append("")
        lines.append("⚠️ **No dual metrics found in artifact**")
        lines.append("")
        lines.append("This QA artifact does not contain dual-metrics validation data.")
        lines.append(
            "To generate dual metrics, ensure the validation pipeline includes"
        )
        lines.append("strict/tolerant threshold evaluations.")
        lines.append("")
        return "\n".join(lines)

    # Summary statistics
    stats = compute_summary_stats(dual_metrics)
    lines.append("## Validation Status")
    lines.append("")
    lines.append(f"**Total Metrics**: {stats['total']}")
    lines.append("")

    # Strict status
    strict_status_icon = "✅" if stats["strict_fail"] == 0 else "❌"
    lines.append(f"### Strict Validation {strict_status_icon}")
    lines.append("")
    lines.append(f"- **Passed**: {stats['strict_pass']} / {stats['total']}")
    lines.append(f"- **Failed**: {stats['strict_fail']} / {stats['total']}")
    lines.append("")
    if stats["strict_fail"] == 0:
        lines.append("All metrics passed strict validation (exact match criteria).")
    else:
        lines.append(f"{stats['strict_fail']} metric(s) failed strict validation.")
        lines.append(
            "Strict failures indicate exact-match criteria not met (blocking condition)."
        )
    lines.append("")

    # Tolerant status
    tolerant_status_icon = "✅" if stats["tolerant_fail"] == 0 else "⚠️"
    lines.append(f"### Tolerant Validation {tolerant_status_icon}")
    lines.append("")
    lines.append(f"- **Passed**: {stats['tolerant_pass']} / {stats['total']}")
    lines.append(f"- **Failed**: {stats['tolerant_fail']} / {stats['total']}")
    lines.append("")
    if stats["tolerant_fail"] == 0:
        lines.append("All metrics passed tolerant validation (within threshold).")
    else:
        lines.append(f"{stats['tolerant_fail']} metric(s) failed tolerant validation.")
        lines.append(
            "Tolerant failures indicate values outside acceptable threshold (monitoring/alert)."
        )
    lines.append("")

    # Detailed metrics table
    lines.append("## Detailed Metrics")
    lines.append("")
    lines.append("| Metric | Strict | Tolerant | Deviation | Unit | Notes |")
    lines.append("|--------|--------|----------|-----------|------|-------|")

    # Sort metrics alphabetically for determinism
    for metric_name in sorted(dual_metrics.keys()):
        metric_data = dual_metrics[metric_name]
        if not isinstance(metric_data, dict):
            continue

        strict_val = format_metric_value(metric_data.get("strict_pass"))
        tolerant_val = format_metric_value(metric_data.get("tolerant_pass"))
        deviation = format_metric_value(metric_data.get("deviation"))
        unit = metric_data.get("deviation_unit", "—")
        notes = metric_data.get("notes", "—")
        if notes is None:
            notes = "—"

        lines.append(
            f"| {metric_name} | {strict_val} | {tolerant_val} | {deviation} | {unit} | {notes} |"
        )

    lines.append("")

    # Top issues section
    lines.append("## Top Issues")
    lines.append("")
    top_issues = find_top_issues(dual_metrics, limit=5)

    if not top_issues:
        lines.append("*No significant issues detected.*")
        lines.append("")
    else:
        lines.append("The following metrics have the largest deviations or failures:")
        lines.append("")

        for i, (metric_name, metric_data) in enumerate(top_issues, 1):
            strict_fail = metric_data.get("strict_pass") is False
            tolerant_fail = metric_data.get("tolerant_pass") is False
            deviation = metric_data.get("deviation")
            unit = metric_data.get("deviation_unit", "")

            status_parts = []
            if strict_fail:
                status_parts.append("strict fail")
            if tolerant_fail:
                status_parts.append("tolerant fail")
            status_str = ", ".join(status_parts) if status_parts else "within tolerance"

            deviation_str = ""
            if deviation is not None:
                deviation_str = f" (deviation: {format_metric_value(deviation)} {unit})"

            lines.append(f"{i}. **{metric_name}**: {status_str}{deviation_str}")

        lines.append("")

    # Interpretation guidance
    lines.append("## Interpretation Guide")
    lines.append("")
    lines.append(
        "**Strict validation** enforces exact-match criteria. A strict failure indicates"
    )
    lines.append(
        "the observed value does not precisely match the expected value. Use strict failures"
    )
    lines.append(
        "as blocking gates in automated pipelines (e.g., prevent deployment if strict validation fails)."
    )
    lines.append("")
    lines.append(
        "**Tolerant validation** allows values within acceptable thresholds (e.g., ±1% for numeric values,"
    )
    lines.append(
        "±1 day for dates). A tolerant failure indicates drift beyond monitoring thresholds but may not"
    )
    lines.append(
        "require immediate blocking. Use tolerant failures for alerts, monitoring dashboards, and drift detection."
    )
    lines.append("")
    lines.append(
        "**Deviation** quantifies the magnitude of difference between observed and expected values."
    )
    lines.append(
        "Larger deviations indicate more significant drift and may warrant investigation even if"
    )
    lines.append("tolerant validation passes.")
    lines.append("")

    # Footer
    lines.append("---")
    lines.append("")
    lines.append(
        "*Generated by `src/validation/render_dual_metrics_report.py` (offline-only, no PHI)*"
    )
    lines.append("")

    return "\n".join(lines)


def write_report(content: str, output_path: Path) -> None:
    """Write Markdown report to file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate dual-metrics Markdown summary report from QA artifacts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--qa-json",
        type=Path,
        help="Path to specific QA JSON artifact (if not provided, auto-detects newest)",
    )
    parser.add_argument(
        "--qa-dir",
        type=Path,
        default=Path("reports/qa"),
        help="Directory containing QA artifacts (default: reports/qa)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("docs/validation/DUAL_METRICS_SUMMARY.md"),
        help="Output path for Markdown report (default: docs/validation/DUAL_METRICS_SUMMARY.md)",
    )
    parser.add_argument(
        "--also-write-local",
        action="store_true",
        help="Also write a copy to reports/validation/DUAL_METRICS_SUMMARY_latest.md (gitignored)",
    )

    args = parser.parse_args()

    try:
        # Determine QA artifact to process
        if args.qa_json:
            qa_json_path = args.qa_json
            if not qa_json_path.exists():
                print(f"ERROR: QA artifact not found: {qa_json_path}", file=sys.stderr)
                return 1
        else:
            # Auto-detect newest
            if not args.qa_dir.exists():
                print(f"ERROR: QA directory not found: {args.qa_dir}", file=sys.stderr)
                print(
                    "Tip: Use --qa-dir to specify a different directory",
                    file=sys.stderr,
                )
                return 1

            qa_json_path = find_newest_qa_json(args.qa_dir)
            if qa_json_path is None:
                print(
                    f"ERROR: No QA_*.json files found in {args.qa_dir}", file=sys.stderr
                )
                print("Tip: Run 'make qa' to generate QA artifacts", file=sys.stderr)
                return 1

        print(f"Processing QA artifact: {qa_json_path}")

        # Load QA artifact
        qa_data = load_qa_artifact(qa_json_path)

        # Extract dual metrics
        dual_metrics = extract_dual_metrics(qa_data)

        # Generate report
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        git_hash = get_git_commit_hash()

        report_content = generate_markdown_report(
            qa_json_path=qa_json_path,
            qa_data=qa_data,
            dual_metrics=dual_metrics,
            timestamp=timestamp,
            git_hash=git_hash,
        )

        # Write primary output
        write_report(report_content, args.output)
        print(f"✓ Report written: {args.output}")

        # Write local copy if requested
        if args.also_write_local:
            local_path = Path("reports/validation/DUAL_METRICS_SUMMARY_latest.md")
            write_report(report_content, local_path)
            print(f"✓ Local copy written: {local_path}")

        # Print summary
        if dual_metrics:
            stats = compute_summary_stats(dual_metrics)
            print(f"\nSummary:")
            print(f"  Total metrics: {stats['total']}")
            print(f"  Strict failures: {stats['strict_fail']}")
            print(f"  Tolerant failures: {stats['tolerant_fail']}")
        else:
            print(f"\nNo dual metrics found in artifact")

        return 0

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
