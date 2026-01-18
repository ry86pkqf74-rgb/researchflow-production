"""Generate deterministic context packet for AI/chat session handoffs.

This module produces a structured context packet summarizing the repository's
governance state, current phase, and operator instructions for fresh AI sessions.

Designed for:
- Onboarding new collaborators
- Resuming work after extended breaks
- Providing Claude/GPT with comprehensive repository context
- Audit trail of governance state at specific timepoints

Guarantees:
- Deterministic output (no timestamps, stable ordering)
- Fully offline (no external dependencies)
- Version-controlled governance references only
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import date


class ContextPacketGenerator:
    """Generate deterministic context packets for repository handoffs."""

    # Version follows semantic versioning for context packet format
    VERSION = "1.0.0"

    def __init__(self, repo_root: Optional[Path] = None):
        """Initialize context packet generator.

        Args:
            repo_root: Path to repository root. If None, infers from module location.
        """
        if repo_root is None:
            # Infer repo root from this file's location
            self.repo_root = Path(__file__).parent.parent.parent
        else:
            self.repo_root = Path(repo_root)

        self.docs_dir = self.repo_root / "docs"
        self.checkpoints_dir = self.docs_dir / "checkpoints"
        self.governance_dir = self.docs_dir / "governance"

    def generate_markdown(self, output_path: Optional[Path] = None) -> str:
        """Generate context packet as Markdown.

        Args:
            output_path: Optional path to write output. If None, returns string only.

        Returns:
            Markdown content as string
        """
        sections = [
            self._header_section(),
            self._authoritative_docs_section(),
            self._freeze_state_section(),
            self._current_phase_section(),
            self._roadmap_section(),
            self._hygiene_targets_section(),
            self._validation_commands_section(),
            self._offline_statement_section(),
        ]

        content = "\n\n".join(sections)

        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(content, encoding="utf-8")

        return content

    def generate_json(self, output_path: Optional[Path] = None) -> Dict[str, Any]:
        """Generate context packet as JSON.

        Args:
            output_path: Optional path to write output. If None, returns dict only.

        Returns:
            Context packet as structured dict
        """
        packet = {
            "format_version": self.VERSION,
            "authoritative_docs": self._get_authoritative_docs(),
            "freeze_state": self._get_freeze_state(),
            "current_phase": self._get_current_phase(),
            "roadmap": self._get_roadmap(),
            "hygiene_targets": self._get_hygiene_targets(),
            "validation_commands": self._get_validation_commands(),
            "offline_policy": self._get_offline_policy(),
        }

        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(
                json.dumps(packet, indent=2, sort_keys=True), encoding="utf-8"
            )

        return packet

    # Section generators

    def _header_section(self) -> str:
        """Generate header section."""
        return f"""# Context Packet: Research Operating System Template

**Format Version:** {self.VERSION}
**Purpose:** AI/chat session handoff and operator onboarding
**Governance:** Deterministic, offline-first, version-controlled references only

---

## Overview

This context packet provides a comprehensive snapshot of the repository's
governance state, current phase, and operational procedures. Use this document
when:

- Starting a fresh AI chat session (Claude, GPT, etc.)
- Onboarding new collaborators to the project
- Resuming work after extended breaks
- Establishing audit trail for governance compliance

**Critical:** This is a **frozen snapshot**. Always verify against current
repository state if documents have been modified since generation."""

    def _authoritative_docs_section(self) -> str:
        """Generate authoritative docs section."""
        docs = self._get_authoritative_docs()

        lines = ["## Authoritative Documents to Read"]
        lines.append(
            "\nThese documents define governance policy and must be consulted:"
        )
        lines.append("\n### Core Governance\n")

        for doc in docs["core_governance"]:
            lines.append(f"- [`{doc}`]({doc})")

        lines.append("\n### Validation & Quality\n")
        for doc in docs["validation"]:
            lines.append(f"- [`{doc}`]({doc})")

        lines.append("\n### Key Checkpoints\n")
        for doc in docs["key_checkpoints"]:
            lines.append(f"- [`{doc}`]({doc})")

        return "\n".join(lines)

    def _freeze_state_section(self) -> str:
        """Generate freeze state section."""
        freeze = self._get_freeze_state()

        lines = ["## Current Freeze State"]
        lines.append("\n**Frozen Assets (DO NOT MODIFY):**\n")

        for item in freeze["frozen_assets"]:
            lines.append(f"- {item}")

        lines.append("\n**Modifiable Assets (PROCEED WITH CAUTION):**\n")
        for item in freeze["modifiable_with_caution"]:
            lines.append(f"- {item}")

        lines.append("\n**Freely Modifiable:**\n")
        for item in freeze["freely_modifiable"]:
            lines.append(f"- {item}")

        return "\n".join(lines)

    def _current_phase_section(self) -> str:
        """Generate current phase section."""
        phase = self._get_current_phase()

        lines = ["## Current Phase: Phase-3 Hardening"]
        lines.append(f"\n**Status:** {phase['status']}")
        lines.append(f"\n{phase['description']}\n")

        lines.append("### Allowed Actions\n")
        for action in phase["allowed_actions"]:
            lines.append(f"- ✅ {action}")

        lines.append("\n### Prohibited Actions\n")
        for action in phase["prohibited_actions"]:
            lines.append(f"- ❌ {action}")

        return "\n".join(lines)

    def _roadmap_section(self) -> str:
        """Generate roadmap section."""
        roadmap = self._get_roadmap()

        lines = ["## Roadmap: Remaining Commits"]

        for commit in roadmap["commits"]:
            status_icon = (
                "✅"
                if commit["status"] == "complete"
                else "🔄" if commit["status"] == "in-progress" else "⏳"
            )
            lines.append(f"\n### {status_icon} {commit['name']}")
            lines.append(f"\n**Status:** {commit['status']}")
            lines.append(f"**Description:** {commit['description']}\n")

            if commit.get("deliverables"):
                lines.append("**Deliverables:**")
                for deliverable in commit["deliverables"]:
                    lines.append(f"- {deliverable}")

        return "\n".join(lines)

    def _hygiene_targets_section(self) -> str:
        """Generate hygiene targets section."""
        targets = self._get_hygiene_targets()

        lines = ["## Key Make Targets"]
        lines.append("\n### Pre-Commit Hygiene\n")

        for target, desc in targets["pre_commit"].items():
            lines.append(f"- `make {target}`: {desc}")

        lines.append("\n### Testing & Validation\n")
        for target, desc in targets["testing"].items():
            lines.append(f"- `make {target}`: {desc}")

        lines.append("\n### Quality Gates\n")
        for target, desc in targets["quality"].items():
            lines.append(f"- `make {target}`: {desc}")

        return "\n".join(lines)

    def _validation_commands_section(self) -> str:
        """Generate validation commands section."""
        commands = self._get_validation_commands()

        lines = ["## Validation Commands"]
        lines.append("\n### Quick Validation\n")
        lines.append("```bash")
        for cmd in commands["quick"]:
            lines.append(cmd)
        lines.append("```")

        lines.append("\n### Full Validation\n")
        lines.append("```bash")
        for cmd in commands["full"]:
            lines.append(cmd)
        lines.append("```")

        lines.append("\n### Expected Output\n")
        for output in commands["expected_output"]:
            lines.append(f"- {output}")

        return "\n".join(lines)

    def _offline_statement_section(self) -> str:
        """Generate offline/PHI statement."""
        policy = self._get_offline_policy()

        lines = ["## Offline & PHI Policy"]
        lines.append(f"\n{policy['statement']}\n")

        lines.append("### Requirements\n")
        for req in policy["requirements"]:
            lines.append(f"- {req}")

        lines.append("\n### Prohibited\n")
        for prohibition in policy["prohibited"]:
            lines.append(f"- ❌ {prohibition}")

        return "\n".join(lines)

    # Data getters (deterministic, stable ordering)

    def _get_authoritative_docs(self) -> Dict[str, List[str]]:
        """Get authoritative document paths (deterministic ordering)."""
        return {
            "core_governance": sorted(
                [
                    "docs/governance/APPROVAL_GATES.md",
                    "docs/governance/CHANGE_CONTROL.md",
                    "docs/governance/PHI_BOUNDARIES.md",
                    "docs/validation/VALIDATION_POLICY.md",
                ]
            ),
            "validation": sorted(
                [
                    "docs/validation/QA_ARTIFACT_CONTRACT.md",
                    "docs/system/PYTHON_VERSION_POLICY.md",
                ]
            ),
            "key_checkpoints": sorted(
                [
                    "docs/checkpoints/CHECKPOINT_20251224_MANUSCRIPT_COMPLETE.md",
                    "docs/checkpoints/CHECKPOINT_20251222_AI_GOVERNANCE_FREEZE.md",
                    "docs/checkpoints/CHECKPOINT_20251222_DEPENDENCY_FREEZE.md",
                ]
            ),
        }

    def _get_freeze_state(self) -> Dict[str, List[str]]:
        """Get current freeze state (deterministic ordering)."""
        return {
            "frozen_assets": sorted(
                [
                    "Manuscript draft v1.0.0 (manuscripts/draft_v1.0.0.md)",
                    "Figure captions (reports/publication/figures/FIGURE_CAPTIONS.md)",
                    "Methods section (manuscripts/methods_v1.0.0.md)",
                    "Results section (manuscripts/results_v1.0.0.md)",
                    "Python interpreter pinned to 3.11.5 (.python-version, pyproject.toml)",
                    "Dependencies frozen (pyproject.toml: pandas==2.2.0, pandera==0.18.0)",
                ]
            ),
            "modifiable_with_caution": sorted(
                [
                    "Governance policies (require approval, see docs/governance/APPROVAL_GATES.md)",
                    "Schema definitions (require validation, see schemas/pandera/)",
                    "QA validation logic (require testing, see automations/validate_qa_artifacts.py)",
                ]
            ),
            "freely_modifiable": sorted(
                [
                    "Documentation improvements (docs/**/*.md, except frozen checkpoints)",
                    "Test additions (tests/**/*.py, must not break existing tests)",
                    "Utility scripts (automations/**, src/utils/**, must remain offline)",
                    "Infrastructure hardening (validation, CI/CD, determinism improvements)",
                ]
            ),
        }

    def _get_current_phase(self) -> Dict[str, Any]:
        """Get current phase details."""
        return {
            "name": "Phase-3 Hardening",
            "status": "In Progress (Commits 1-2 complete, Commit 3 in development)",
            "description": (
                "Infrastructure hardening phase following manuscript completion. "
                "Focus: reproducibility guarantees, validation determinism, "
                "governance enforcement, offline-first principles."
            ),
            "allowed_actions": sorted(
                [
                    "Add validation infrastructure (dual metrics, fingerprinting, etc.)",
                    "Improve determinism (stable sorting, fixed seeds, explicit timestamps)",
                    "Strengthen governance (approval gates, override logging, audit trails)",
                    "Enhance documentation (policies, runbooks, troubleshooting guides)",
                    "Add tests (unit, integration, determinism verification)",
                    "Improve CI/CD (enforcement, reproducibility checks)",
                ]
            ),
            "prohibited_actions": sorted(
                [
                    "Modify frozen manuscript content (draft_v1.0.0.md, figure captions)",
                    "Change frozen figure outputs without governance approval",
                    "Add new Python dependencies (Phase-3 is dependency-freeze)",
                    "Modify core analysis logic without SAP amendment",
                    "Bypass approval gates or validation checks",
                    "Introduce non-deterministic behavior",
                ]
            ),
        }

    def _get_roadmap(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get roadmap for remaining commits."""
        return {
            "commits": [
                {
                    "name": "Commit 1: Python Interpreter Pinning",
                    "status": "complete",
                    "description": "Pin Python 3.11.5 for reproducibility",
                    "deliverables": [
                        ".python-version file",
                        "pyproject.toml requires-python constraint",
                        "Makefile enforcement",
                        "docs/system/PYTHON_VERSION_POLICY.md",
                        "tests/test_python_version_enforcement.py",
                    ],
                },
                {
                    "name": "Commit 2: Dual Strict/Tolerant Validation Metrics",
                    "status": "complete",
                    "description": "Add dual metrics for strict gates + monitoring",
                    "deliverables": [
                        "src/validation/metrics_dual_eval.py",
                        "tests/test_metrics_dual_eval.py (32 tests)",
                        "tests/test_validate_qa_artifacts_dual.py (13 tests)",
                        "src/schemas/jsonschema/qa_metrics.schema.json update",
                        "docs/validation/VALIDATION_POLICY.md",
                        "docs/governance/APPROVAL_GATES.md update",
                    ],
                },
                {
                    "name": "Commit 3: Context Packet Generator",
                    "status": "in-progress",
                    "description": "Deterministic context packets for AI handoffs",
                    "deliverables": [
                        "src/governance/context_packet.py",
                        "tests/test_context_packet.py",
                        "make context-packet target",
                        "docs/governance/CONTEXT_PACKET_USAGE.md",
                        "Output: docs/handoffs/context_packet_v1.0.0.md",
                    ],
                },
                {
                    "name": "Commit 4: Parquet Fingerprinting",
                    "status": "not-started",
                    "description": "Add cryptographic fingerprinting for drift detection",
                    "deliverables": [
                        "src/validation/parquet_fingerprint.py",
                        "tests/test_parquet_fingerprint.py",
                        "make fingerprint-check target",
                        "docs/validation/DRIFT_DETECTION_POLICY.md",
                    ],
                },
                {
                    "name": "Commit 5: Schema Version Metadata",
                    "status": "not-started",
                    "description": "Embed schema versions in Parquet metadata",
                    "deliverables": [
                        "src/validation/schema_version_metadata.py",
                        "Update all Pandera schemas with __version__",
                        "tests/test_schema_versioning.py",
                        "make check-schema-versions target",
                    ],
                },
            ],
        }

    def _get_hygiene_targets(self) -> Dict[str, Dict[str, str]]:
        """Get key Make targets (deterministic ordering)."""
        return {
            "pre_commit": {
                "bootstrap": "Install dependencies with version check",
                "check-python-version": "Verify Python 3.11.5 runtime",
            },
            "testing": {
                "qa": "Generate and validate QA artifacts",
                "validate-qa-dual": "Validate with dual metrics reporting",
                "verify-quick": "Quick verification without AI QA",
            },
            "quality": {
                "schema-check": "Validate Pandera schemas",
                "check-sample-heart-disease": "Validate heart disease sample data",
            },
        }

    def _get_validation_commands(self) -> Dict[str, Any]:
        """Get validation command sequences."""
        return {
            "quick": [
                "# Quick validation (< 30 seconds)",
                "make check-python-version",
                "python -m pytest tests/test_metrics_dual_eval.py -q",
                "python -m pytest tests/test_python_version_enforcement.py -q",
            ],
            "full": [
                "# Full validation (~ 15-20 seconds)",
                "make check-python-version",
                "python -m pytest -q",
                "make qa",
            ],
            "expected_output": [
                "Python version check: ✓ or skip if not 3.11.5",
                "Dual metrics tests: 32 passed",
                "Full test suite: 172 passed, 21 skipped",
                "QA validation: ✓ Validation PASSED",
            ],
        }

    def _get_offline_policy(self) -> Dict[str, Any]:
        """Get offline and PHI policy statements."""
        return {
            "statement": (
                "**CRITICAL: This repository operates under strict offline-first "
                "and PHI-protection policies.** All analysis must be reproducible "
                "using only local resources. No PHI/PII may be committed to version "
                "control or transmitted to external APIs."
            ),
            "requirements": sorted(
                [
                    "All dependencies must be pinned and vendorable",
                    "No external API calls in production code",
                    "All data in data/ must be .gitignored (except sanitized samples)",
                    "PHI detection must run on all outputs before commit",
                    "Redaction logs required for any data exports",
                ]
            ),
            "prohibited": sorted(
                [
                    "API calls to external services (OpenAI, Claude, etc.)",
                    "Committing PHI/PII to version control",
                    "Using unpinned or non-vendorable dependencies",
                    "Modifying frozen manuscript content",
                    "Bypassing validation or approval gates",
                ]
            ),
        }


def main():
    """CLI entry point for context packet generation."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate deterministic context packet for repository handoffs"
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "json", "both"],
        default="markdown",
        help="Output format (default: markdown)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory (default: docs/handoffs/)",
    )
    parser.add_argument(
        "--version-suffix",
        type=str,
        default="v1.0.0",
        help="Version suffix for output filename (default: v1.0.0)",
    )

    args = parser.parse_args()

    # Determine output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        generator = ContextPacketGenerator()
        output_dir = generator.repo_root / "docs" / "handoffs"

    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate output(s)
    generator = ContextPacketGenerator()

    if args.format in ("markdown", "both"):
        md_path = output_dir / f"context_packet_{args.version_suffix}.md"
        generator.generate_markdown(md_path)
        print(f"✓ Generated Markdown: {md_path}")

    if args.format in ("json", "both"):
        json_path = output_dir / f"context_packet_{args.version_suffix}.json"
        generator.generate_json(json_path)
        print(f"✓ Generated JSON: {json_path}")


if __name__ == "__main__":
    main()
