"""src.governance.phi_scanner

CLI + library utilities for scanning files/directories for HIGH-confidence PHI/PII.

Why this exists:
- Referenced by docs (data/README.md) and n8n workflow templates
- Provides a single, reusable boundary check before ingesting anything into ROS
- Emits PHI-safe reports (hashes only; never prints raw matches)

Usage:
    # Scan a directory (default: fail non-zero if PHI detected)
    python -m src.governance.phi_scanner data/sample/

    # Scan a file and write a JSON report
    python -m src.governance.phi_scanner data/sample/heart_disease.csv --report reports/phi_scan_report.json

Notes:
- This scanner is designed for governance checks ("is there any obvious PHI?")
  and is intentionally conservative.
- It uses the project's PHIDetector patterns but defaults to HIGH severity
  indicators only (SSN/MRN/PHONE/EMAIL/LICENSE). Use flags to include medium/low.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd

from src.validation.phi_detector import PHIDetector, PHIType


# -----------------------------------------------------------------------------
# Data structures
# -----------------------------------------------------------------------------


@dataclass
class FilePHIScanFinding:
    """PHI scan results for a single file."""

    path: str
    detected: bool
    phi_types: List[str]
    severity: Dict[str, int]
    match_hashes: Dict[str, List[str]]
    notes: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "detected": self.detected,
            "phi_types": self.phi_types,
            "severity": self.severity,
            "match_hashes": self.match_hashes,
            "notes": self.notes,
        }


@dataclass
class PHIScanReport:
    """Aggregate PHI scan report."""

    target: str
    files_scanned: int
    files_flagged: int
    findings: List[FilePHIScanFinding]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target": self.target,
            "files_scanned": self.files_scanned,
            "files_flagged": self.files_flagged,
            "findings": [f.to_dict() for f in self.findings],
        }


# -----------------------------------------------------------------------------
# Core scanning helpers
# -----------------------------------------------------------------------------


_HIGH_SEVERITY_TYPES: set[PHIType] = {
    PHIType.SSN,
    PHIType.MRN,
    PHIType.PHONE,
    PHIType.EMAIL,
    PHIType.LICENSE,
}


def _sha256_short(text: str, n: int = 12) -> str:
    """Hash potentially sensitive text and return a short prefix for audit logs."""
    digest = hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()
    return digest[:n]


def _iter_files(target: Path) -> Iterable[Path]:
    """Yield files under a target (file or directory)."""
    if target.is_file():
        yield target
        return

    # Directory walk (skip hidden dirs)
    for p in sorted(target.rglob("*")):
        if p.is_dir():
            continue
        # Skip hidden files/dirs to reduce noise
        if any(part.startswith(".") for part in p.parts):
            continue
        yield p


def _is_supported_file(path: Path) -> bool:
    """Return True if file extension is supported by this scanner."""
    suffix = path.suffix.lower()
    return suffix in {
        ".csv",
        ".tsv",
        ".parquet",
        ".json",
        ".jsonl",
        ".txt",
        ".md",
        ".yaml",
        ".yml",
    }


def _scan_text_value(
    detector: PHIDetector,
    value: str,
    include_medium: bool,
    include_low: bool,
) -> Tuple[List[Tuple[PHIType, str]], Dict[str, int]]:
    """Scan a string and return detections and severity counts."""
    detections = detector.scan_value(value)

    kept: List[Tuple[PHIType, str]] = []
    severity_counts: Dict[str, int] = {"high": 0, "medium": 0, "low": 0}

    # We need to map PHIType -> severity from detector.patterns
    type_to_severity: Dict[PHIType, str] = {
        p.phi_type: p.severity for p in detector.patterns
    }

    for phi_type, match_text in detections:
        sev = type_to_severity.get(phi_type, "low")
        if sev == "high":
            kept.append((phi_type, match_text))
            severity_counts["high"] += 1
        elif sev == "medium" and include_medium:
            kept.append((phi_type, match_text))
            severity_counts["medium"] += 1
        elif sev == "low" and include_low:
            kept.append((phi_type, match_text))
            severity_counts["low"] += 1

    return kept, severity_counts


def _scan_json_obj(
    detector: PHIDetector,
    obj: Any,
    include_medium: bool,
    include_low: bool,
    max_values: int = 50_000,
) -> Tuple[List[Tuple[PHIType, str]], Dict[str, int]]:
    """Recursively scan JSON-like objects for string values."""
    detections: List[Tuple[PHIType, str]] = []
    severity_counts: Dict[str, int] = {"high": 0, "medium": 0, "low": 0}

    values_seen = 0

    def _walk(x: Any) -> None:
        nonlocal values_seen
        if values_seen >= max_values:
            return

        if x is None:
            return
        if isinstance(x, str):
            values_seen += 1
            dets, sev = _scan_text_value(detector, x, include_medium, include_low)
            detections.extend(dets)
            for k, v in sev.items():
                severity_counts[k] += v
            return
        if isinstance(x, (int, float, bool)):
            return
        if isinstance(x, list):
            for item in x:
                _walk(item)
            return
        if isinstance(x, dict):
            for k, v in x.items():
                # Scan keys as well (keys can leak PHI like "patient_email")
                if isinstance(k, str):
                    values_seen += 1
                    dets, sev = _scan_text_value(
                        detector, k, include_medium, include_low
                    )
                    detections.extend(dets)
                    for kk, vv in sev.items():
                        severity_counts[kk] += vv
                _walk(v)
            return

    _walk(obj)
    return detections, severity_counts


def scan_file(
    path: Path,
    detector: Optional[PHIDetector] = None,
    include_medium: bool = False,
    include_low: bool = False,
    max_bytes: int = 2_000_000,
    max_rows: int = 50_000,
) -> FilePHIScanFinding:
    """Scan a single file and return a PHI-safe finding.

    Args:
        path: File path
        detector: Optional PHIDetector instance
        include_medium: Include medium-severity patterns (dates, ZIP+4, account)
        include_low: Include low-severity patterns (URLs)
        max_bytes: Max bytes to read for text-like files
        max_rows: Max rows to read for CSV/TSV/parquet

    Returns:
        FilePHIScanFinding
    """
    detector = detector or PHIDetector()
    notes: List[str] = []

    if not _is_supported_file(path):
        return FilePHIScanFinding(
            path=str(path),
            detected=False,
            phi_types=[],
            severity={"high": 0, "medium": 0, "low": 0},
            match_hashes={},
            notes=["unsupported_file_type"],
        )

    suffix = path.suffix.lower()

    detections: List[Tuple[PHIType, str]] = []
    severity_counts: Dict[str, int] = {"high": 0, "medium": 0, "low": 0}

    try:
        if suffix in {".csv", ".tsv"}:
            sep = "\t" if suffix == ".tsv" else ","
            # Read limited rows for safety; a PHI scan isn't meant to fully load huge tables
            df = pd.read_csv(path, sep=sep, nrows=max_rows)
            # Scan values as strings by applying detector.scan_value per cell is costly.
            # We use detector.scan_series for each column.
            from src.validation.phi_detector import scan_dataframe

            result = scan_dataframe(df, detector=detector, scan_all_columns=True)
            # Convert PHIScanResult to detections-like output without raw matches
            if result.phi_detected:
                # Extract PHI types from detection_details keys
                # detection_details: {col: [(PHIType, matched_text), ...]}
                for col, det_list in result.detection_details.items():
                    for phi_type, match_text in det_list:
                        # Apply severity filters
                        dets, sev = _scan_text_value(
                            detector, match_text, include_medium, include_low
                        )
                        detections.extend(dets)
                        for k, v in sev.items():
                            severity_counts[k] += v
                notes.append(f"rows_scanned={len(df)}")
            else:
                notes.append(f"rows_scanned={len(df)}")

        elif suffix == ".parquet":
            df = pd.read_parquet(path)
            if len(df) > max_rows:
                df = df.head(max_rows)
                notes.append(f"truncated_rows_to={max_rows}")

            from src.validation.phi_detector import scan_dataframe

            result = scan_dataframe(df, detector=detector, scan_all_columns=True)
            if result.phi_detected:
                for col, det_list in result.detection_details.items():
                    for phi_type, match_text in det_list:
                        dets, sev = _scan_text_value(
                            detector, match_text, include_medium, include_low
                        )
                        detections.extend(dets)
                        for k, v in sev.items():
                            severity_counts[k] += v

        elif suffix in {".json", ".yaml", ".yml"}:
            # YAML support would require pyyaml; to avoid adding dependency, treat YAML as text.
            if suffix in {".yaml", ".yml"}:
                raw = path.read_bytes()[:max_bytes]
                text = raw.decode("utf-8", errors="ignore")
                detections, severity_counts = _scan_text_value(
                    detector, text, include_medium, include_low
                )
            else:
                data = json.loads(path.read_text(encoding="utf-8"))
                detections, severity_counts = _scan_json_obj(
                    detector, data, include_medium, include_low
                )

        elif suffix == ".jsonl":
            # Scan line-by-line JSON
            raw = path.read_text(encoding="utf-8", errors="ignore").splitlines()
            for i, line in enumerate(raw[:max_rows]):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    # Fallback to scanning raw line as text
                    dets, sev = _scan_text_value(
                        detector, line, include_medium, include_low
                    )
                    detections.extend(dets)
                    for k, v in sev.items():
                        severity_counts[k] += v
                    continue
                dets, sev = _scan_json_obj(detector, obj, include_medium, include_low)
                detections.extend(dets)
                for k, v in sev.items():
                    severity_counts[k] += v
            notes.append(f"lines_scanned={min(len(raw), max_rows)}")

        else:
            # text-like
            raw = path.read_bytes()[:max_bytes]
            text = raw.decode("utf-8", errors="ignore")
            dets, severity_counts = _scan_text_value(
                detector, text, include_medium, include_low
            )
            detections.extend(dets)
            notes.append(f"bytes_scanned={min(len(raw), max_bytes)}")

    except Exception as e:
        return FilePHIScanFinding(
            path=str(path),
            detected=False,
            phi_types=[],
            severity={"high": 0, "medium": 0, "low": 0},
            match_hashes={},
            notes=[f"error={type(e).__name__}", str(e)[:200]],
        )

    # Enforce high severity filter by default
    if not include_medium and not include_low:
        detections = [(t, m) for t, m in detections if t in _HIGH_SEVERITY_TYPES]

    # Build PHI-safe hashed output
    phi_types = sorted({t.value for t, _ in detections})
    match_hashes: Dict[str, List[str]] = {}
    for t, m in detections:
        match_hashes.setdefault(t.value, []).append(_sha256_short(m))

    detected = len(phi_types) > 0

    return FilePHIScanFinding(
        path=str(path),
        detected=detected,
        phi_types=phi_types,
        severity=severity_counts,
        match_hashes={k: sorted(list(set(v)))[:10] for k, v in match_hashes.items()},
        notes=notes,
    )


def scan_path(
    target: Path,
    include_medium: bool = False,
    include_low: bool = False,
    max_bytes: int = 2_000_000,
    max_rows: int = 50_000,
) -> PHIScanReport:
    """Scan a file or directory and return an aggregate report."""
    target = Path(target)
    detector = PHIDetector()

    findings: List[FilePHIScanFinding] = []

    for file_path in _iter_files(target):
        if not _is_supported_file(file_path):
            continue
        findings.append(
            scan_file(
                file_path,
                detector=detector,
                include_medium=include_medium,
                include_low=include_low,
                max_bytes=max_bytes,
                max_rows=max_rows,
            )
        )

    files_scanned = len(findings)
    files_flagged = sum(1 for f in findings if f.detected)

    return PHIScanReport(
        target=str(target),
        files_scanned=files_scanned,
        files_flagged=files_flagged,
        findings=findings,
    )


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Scan a file or directory for HIGH-confidence PHI/PII patterns (PHI-safe output).",
    )
    p.add_argument(
        "target",
        help="File or directory to scan",
    )
    p.add_argument(
        "--report",
        default=None,
        help="Write JSON report to this path (default: print to stdout)",
    )
    p.add_argument(
        "--include-medium",
        action="store_true",
        help="Include medium-severity patterns (dates, ZIP+4, account numbers)",
    )
    p.add_argument(
        "--include-low",
        action="store_true",
        help="Include low-severity patterns (URLs)",
    )
    p.add_argument(
        "--max-bytes",
        type=int,
        default=2_000_000,
        help="Max bytes to scan for text-like files (default: 2,000,000)",
    )
    p.add_argument(
        "--max-rows",
        type=int,
        default=50_000,
        help="Max rows/lines to scan for tabular/jsonl files (default: 50,000)",
    )
    p.add_argument(
        "--no-fail",
        action="store_true",
        help="Always exit 0 even if PHI detected (default: fail when PHI detected)",
    )
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = _build_parser().parse_args(argv)
    target = Path(args.target)

    if not target.exists():
        print(f"ERROR: Target not found: {target}", file=sys.stderr)
        return 2

    report = scan_path(
        target,
        include_medium=args.include_medium,
        include_low=args.include_low,
        max_bytes=args.max_bytes,
        max_rows=args.max_rows,
    )

    payload = report.to_dict()

    if args.report:
        out_path = Path(args.report)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    else:
        print(json.dumps(payload, indent=2))

    if report.files_flagged > 0 and not args.no_fail:
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
