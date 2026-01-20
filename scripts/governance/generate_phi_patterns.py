#!/usr/bin/env python3
"""
PHI Pattern Code Generator

Generates TypeScript and Python code from the canonical PHI patterns JSON spec.
This ensures a single source of truth for PHI patterns across all services.

Usage:
    python generate_phi_patterns.py          # Generate output files
    python generate_phi_patterns.py --check  # Check if generated files match committed

Exit codes:
    0 - Success (or no diff in check mode)
    1 - Diff detected in check mode
    2 - Error (missing files, invalid JSON, etc.)
"""

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# Paths relative to repo root
REPO_ROOT = Path(__file__).parent.parent.parent
SPEC_PATH = REPO_ROOT / "shared" / "phi" / "phi_patterns.v1.json"
TS_OUTPUT_PATH = REPO_ROOT / "packages" / "phi-engine" / "src" / "patterns.generated.ts"
PY_OUTPUT_PATH = REPO_ROOT / "services" / "worker" / "src" / "validation" / "phi_patterns_generated.py"


def load_spec() -> dict[str, Any]:
    """Load and validate the canonical PHI patterns spec."""
    if not SPEC_PATH.exists():
        print(f"ERROR: Spec file not found: {SPEC_PATH}", file=sys.stderr)
        sys.exit(2)

    try:
        with open(SPEC_PATH, "r", encoding="utf-8") as f:
            spec = json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in spec file: {e}", file=sys.stderr)
        sys.exit(2)

    # Basic validation
    if "version" not in spec or "patterns" not in spec:
        print("ERROR: Spec missing required fields (version, patterns)", file=sys.stderr)
        sys.exit(2)

    return spec


def validate_regex(source: str, flags: str = "g") -> bool:
    """Validate regex pattern compiles in Python."""
    try:
        py_flags = 0
        if "i" in flags:
            py_flags |= re.IGNORECASE
        if "m" in flags:
            py_flags |= re.MULTILINE
        if "s" in flags:
            py_flags |= re.DOTALL
        re.compile(source, py_flags)
        return True
    except re.error as e:
        print(f"WARNING: Invalid regex '{source}': {e}", file=sys.stderr)
        return False


def generate_typescript(spec: dict[str, Any]) -> str:
    """Generate TypeScript output from spec."""
    timestamp = datetime.now(timezone.utc).isoformat()
    version = spec["version"]
    patterns = spec["patterns"]

    # Separate patterns by tier
    high_confidence = [p for p in patterns if "HIGH_CONFIDENCE" in p["tier"]]
    output_guard = [p for p in patterns if "OUTPUT_GUARD" in p["tier"]]

    lines = [
        "/**",
        " * PHI Pattern Definitions - AUTO-GENERATED",
        " *",
        f" * Source: shared/phi/phi_patterns.v1.json",
        f" * Generated: {timestamp}",
        f" * Version: {version}",
        " *",
        " * DO NOT EDIT MANUALLY - regenerate with:",
        " *   python scripts/governance/generate_phi_patterns.py",
        " */",
        "",
        "import type { PhiFinding } from './types';",
        "",
        "/**",
        " * Pattern definition for PHI detection",
        " */",
        "export interface PatternDefinition {",
        "  /** Unique pattern identifier */",
        "  id: string;",
        "  /** PHI type this pattern detects */",
        "  type: PhiFinding['type'];",
        "  /** Detection tiers this pattern belongs to */",
        "  tier: ('HIGH_CONFIDENCE' | 'OUTPUT_GUARD')[];",
        "  /** Regular expression for matching */",
        "  regex: RegExp;",
        "  /** HIPAA Safe Harbor identifier reference */",
        "  hipaaCategory: string;",
        "  /** Human-readable description */",
        "  description: string;",
        "  /** Base confidence score (0-1) */",
        "  baseConfidence: number;",
        "}",
        "",
    ]

    # Generate HIGH_CONFIDENCE patterns
    lines.append("/**")
    lines.append(" * HIGH_CONFIDENCE patterns - use for upload/egress gating")
    lines.append(" * These patterns have high precision to avoid false positives")
    lines.append(" */")
    lines.append("export const PHI_PATTERNS_HIGH_CONFIDENCE: PatternDefinition[] = [")
    for p in high_confidence:
        regex_flags = p["regex"].get("flags", "g")
        lines.append("  {")
        lines.append(f"    id: '{p['id']}',")
        lines.append(f"    type: '{p['category']}',")
        lines.append(f"    tier: {json.dumps(p['tier'])},")
        lines.append(f"    regex: /{p['regex']['source']}/{regex_flags},")
        lines.append(f"    hipaaCategory: '{p['hipaaCategory']}',")
        lines.append(f"    description: '{p['description']}',")
        lines.append(f"    baseConfidence: {p['baseConfidence']},")
        lines.append("  },")
    lines.append("];")
    lines.append("")

    # Generate OUTPUT_GUARD patterns (full set)
    lines.append("/**")
    lines.append(" * OUTPUT_GUARD patterns - use for export/output scanning")
    lines.append(" * More comprehensive than HIGH_CONFIDENCE, may have more false positives")
    lines.append(" */")
    lines.append("export const PHI_PATTERNS_OUTPUT_GUARD: PatternDefinition[] = [")
    for p in output_guard:
        regex_flags = p["regex"].get("flags", "g")
        lines.append("  {")
        lines.append(f"    id: '{p['id']}',")
        lines.append(f"    type: '{p['category']}',")
        lines.append(f"    tier: {json.dumps(p['tier'])},")
        lines.append(f"    regex: /{p['regex']['source']}/{regex_flags},")
        lines.append(f"    hipaaCategory: '{p['hipaaCategory']}',")
        lines.append(f"    description: '{p['description']}',")
        lines.append(f"    baseConfidence: {p['baseConfidence']},")
        lines.append("  },")
    lines.append("];")
    lines.append("")

    # Default export (backwards compatible)
    lines.append("/**")
    lines.append(" * Default PHI patterns - uses OUTPUT_GUARD for comprehensive detection")
    lines.append(" * @deprecated Use PHI_PATTERNS_HIGH_CONFIDENCE or PHI_PATTERNS_OUTPUT_GUARD")
    lines.append(" */")
    lines.append("export const PHI_PATTERNS: PatternDefinition[] = PHI_PATTERNS_OUTPUT_GUARD;")
    lines.append("")

    return "\n".join(lines)


def generate_python(spec: dict[str, Any]) -> str:
    """Generate Python output from spec."""
    timestamp = datetime.now(timezone.utc).isoformat()
    version = spec["version"]
    patterns = spec["patterns"]

    # Separate patterns by tier
    high_confidence = [p for p in patterns if "HIGH_CONFIDENCE" in p["tier"]]
    extended = [p for p in patterns if "OUTPUT_GUARD" in p["tier"] and "HIGH_CONFIDENCE" not in p["tier"]]

    lines = [
        '"""',
        "PHI Pattern Definitions - AUTO-GENERATED",
        "",
        f"Source: shared/phi/phi_patterns.v1.json",
        f"Generated: {timestamp}",
        f"Version: {version}",
        "",
        "DO NOT EDIT MANUALLY - regenerate with:",
        "    python scripts/governance/generate_phi_patterns.py",
        '"""',
        "",
        "import re",
        "from typing import List, Tuple",
        "",
        "",
        "# ---------------------------------------------------------------------------",
        "# Tier 1: HIGH_CONFIDENCE patterns (upload + egress safe)",
        "# ---------------------------------------------------------------------------",
        "",
        "PHI_PATTERNS_HIGH_CONFIDENCE: List[Tuple[str, re.Pattern]] = [",
    ]

    for p in high_confidence:
        regex_source = p["regex"]["source"]
        flags = p["regex"].get("flags", "g")
        py_flags = []
        if "i" in flags:
            py_flags.append("re.IGNORECASE")

        flags_str = " | ".join(py_flags) if py_flags else ""
        if flags_str:
            lines.append(f'    # {p["description"]}')
            lines.append(f'    ("{p["category"]}", re.compile(r"{regex_source}", {flags_str})),')
        else:
            lines.append(f'    # {p["description"]}')
            lines.append(f'    ("{p["category"]}", re.compile(r"{regex_source}")),')

    lines.append("]")
    lines.append("")
    lines.append("")
    lines.append("# ---------------------------------------------------------------------------")
    lines.append("# Tier 2: Extended patterns (output/export guarding; may false-positive)")
    lines.append("# ---------------------------------------------------------------------------")
    lines.append("")
    lines.append("PHI_PATTERNS_EXTENDED: List[Tuple[str, re.Pattern]] = [")

    for p in extended:
        regex_source = p["regex"]["source"]
        flags = p["regex"].get("flags", "g")
        py_flags = []
        if "i" in flags:
            py_flags.append("re.IGNORECASE")

        flags_str = " | ".join(py_flags) if py_flags else ""
        if flags_str:
            lines.append(f'    # {p["description"]}')
            lines.append(f'    ("{p["category"]}", re.compile(r"{regex_source}", {flags_str})),')
        else:
            lines.append(f'    # {p["description"]}')
            lines.append(f'    ("{p["category"]}", re.compile(r"{regex_source}")),')

    lines.append("]")
    lines.append("")
    lines.append("")
    lines.append("# Backwards-compatible alias used across the repo for upload/egress gating.")
    lines.append("PHI_PATTERNS: List[Tuple[str, re.Pattern]] = PHI_PATTERNS_HIGH_CONFIDENCE")
    lines.append("")
    lines.append("# Stricter set for output/export contexts.")
    lines.append("PHI_PATTERNS_OUTPUT_GUARD: List[Tuple[str, re.Pattern]] = (")
    lines.append("    PHI_PATTERNS_HIGH_CONFIDENCE + PHI_PATTERNS_EXTENDED")
    lines.append(")")
    lines.append("")
    lines.append("")
    lines.append("# Runtime validation")
    lines.append("for patterns in (PHI_PATTERNS_HIGH_CONFIDENCE, PHI_PATTERNS_EXTENDED):")
    lines.append("    for pattern_name, pattern_regex in patterns:")
    lines.append("        if not isinstance(pattern_regex, re.Pattern):")
    lines.append('            raise TypeError(')
    lines.append('                f"PHI pattern {pattern_name} must be a compiled regex Pattern"')
    lines.append("            )")
    lines.append("")

    return "\n".join(lines)


def write_output(path: Path, content: str) -> None:
    """Write content to file, creating directories if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated: {path}")


def normalize_timestamp(content: str) -> str:
    """Remove timestamps from generated content for comparison."""
    # Match ISO timestamps like 2026-01-20T17:59:45.393003+00:00
    return re.sub(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?",
        "<TIMESTAMP>",
        content
    )


def check_diff(path: Path, content: str) -> bool:
    """Check if file content matches generated content (ignoring timestamps)."""
    if not path.exists():
        print(f"DIFF: File does not exist: {path}", file=sys.stderr)
        return False

    with open(path, "r", encoding="utf-8") as f:
        existing = f.read()

    # Normalize timestamps for comparison
    existing_normalized = normalize_timestamp(existing)
    content_normalized = normalize_timestamp(content)

    if existing_normalized == content_normalized:
        return True

    # Show first difference (using normalized lines)
    existing_lines = existing_normalized.splitlines()
    content_lines = content_normalized.splitlines()

    for i, (e, c) in enumerate(zip(existing_lines, content_lines)):
        if e != c:
            print(f"DIFF at line {i + 1} in {path}:", file=sys.stderr)
            print(f"  existing: {e[:80]}", file=sys.stderr)
            print(f"  expected: {c[:80]}", file=sys.stderr)
            break

    return False


def main():
    parser = argparse.ArgumentParser(description="Generate PHI pattern code from canonical spec")
    parser.add_argument("--check", action="store_true", help="Check if generated files match committed")
    args = parser.parse_args()

    # Load spec
    spec = load_spec()
    print(f"Loaded spec version {spec['version']} with {len(spec['patterns'])} patterns")

    # Validate all patterns
    valid = True
    for p in spec["patterns"]:
        if not validate_regex(p["regex"]["source"], p["regex"].get("flags", "g")):
            valid = False
            print(f"  Invalid pattern: {p['id']}", file=sys.stderr)

    if not valid:
        print("WARNING: Some patterns failed validation", file=sys.stderr)

    # Generate outputs
    ts_content = generate_typescript(spec)
    py_content = generate_python(spec)

    if args.check:
        # Check mode - verify generated matches committed
        ts_match = check_diff(TS_OUTPUT_PATH, ts_content)
        py_match = check_diff(PY_OUTPUT_PATH, py_content)

        if ts_match and py_match:
            print("✓ Generated files match committed files")
            sys.exit(0)
        else:
            print("✗ Generated files differ from committed files", file=sys.stderr)
            print("  Run: python scripts/governance/generate_phi_patterns.py", file=sys.stderr)
            sys.exit(1)
    else:
        # Generate mode - write output files
        write_output(TS_OUTPUT_PATH, ts_content)
        write_output(PY_OUTPUT_PATH, py_content)
        print(f"\n✓ Generated {len(spec['patterns'])} patterns")


if __name__ == "__main__":
    main()
