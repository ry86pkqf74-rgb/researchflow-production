"""Read-only validator for dataset lifecycle state markers.

This module validates LIFECYCLE_STATE.yaml files against the governance
rules defined in docs/governance/DATASET_LIFECYCLE_ENFORCEMENT.md.

Design Principles:
- Read-only: Never modifies files
- Declarative: Returns structured validation results
- Composable: Can validate single files or entire directories
- CI-friendly: Exit codes and JSON output for automation

See: docs/governance/DATASET_LIFECYCLE_ENFORCEMENT.md
"""

import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Union
from enum import Enum

from .lifecycle_states import (
    LifecycleState,
    AIApprovalMode,
    is_valid_transition,
    requires_attestation,
    validate_state_history,
    is_ai_stage,
    get_ai_tools_for_stage,
    get_phase_for_stage,
    AI_STAGES,
)
from .ai_approval_gate import AIApprovalGate, validate_ai_execution


class ValidationSeverity(Enum):
    """Severity levels for validation issues."""

    ERROR = "ERROR"  # Blocks progression
    WARNING = "WARNING"  # Should be addressed
    INFO = "INFO"  # Informational


@dataclass
class ValidationIssue:
    """A single validation issue."""

    severity: ValidationSeverity
    code: str
    message: str
    field: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "severity": self.severity.value,
            "code": self.code,
            "message": self.message,
            "field": self.field,
        }


@dataclass
class ValidationResult:
    """Result of validating a lifecycle state file."""

    path: Path
    valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    parsed_state: Optional[LifecycleState] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "path": str(self.path),
            "valid": self.valid,
            "issues": [i.to_dict() for i in self.issues],
            "parsed_state": self.parsed_state.value if self.parsed_state else None,
        }

    @property
    def has_errors(self) -> bool:
        """Check if any ERROR-level issues exist."""
        return any(i.severity == ValidationSeverity.ERROR for i in self.issues)

    @property
    def has_warnings(self) -> bool:
        """Check if any WARNING-level issues exist."""
        return any(i.severity == ValidationSeverity.WARNING for i in self.issues)


class LifecycleValidator:
    """Validator for dataset lifecycle state markers.

    This is a read-only validator that checks LIFECYCLE_STATE.yaml files
    for compliance with governance rules.
    """

    REQUIRED_FIELDS = [
        "dataset_name",
        "dataset_version",
        "dataset_path",
        "current_state",
        "state_entered_date",
        "state_entered_by",
    ]

    PHI_REQUIRED_FIELDS = [
        "phi_attestation.contains_phi",
        "phi_attestation.phi_acknowledged_by",
        "phi_attestation.phi_acknowledged_date",
    ]

    def __init__(self, repo_root: Optional[Path] = None):
        """Initialize validator.

        Args:
            repo_root: Repository root path. If None, infers from module location.
        """
        if repo_root is None:
            self.repo_root = Path(__file__).parent.parent.parent
        else:
            self.repo_root = Path(repo_root)

    def validate_file(self, path: Path) -> ValidationResult:
        """Validate a single LIFECYCLE_STATE.yaml file.

        Args:
            path: Path to the LIFECYCLE_STATE.yaml file

        Returns:
            ValidationResult with all issues found
        """
        issues: List[ValidationIssue] = []
        parsed_state: Optional[LifecycleState] = None

        # Check file exists
        if not path.exists():
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="FILE_NOT_FOUND",
                    message=f"Lifecycle state file not found: {path}",
                )
            )
            return ValidationResult(path=path, valid=False, issues=issues)

        # Parse YAML
        try:
            with open(path, "r") as f:
                data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="YAML_PARSE_ERROR",
                    message=f"Failed to parse YAML: {e}",
                )
            )
            return ValidationResult(path=path, valid=False, issues=issues)

        if data is None:
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="EMPTY_FILE",
                    message="Lifecycle state file is empty",
                )
            )
            return ValidationResult(path=path, valid=False, issues=issues)

        # Check required fields
        for field_name in self.REQUIRED_FIELDS:
            value = data.get(field_name)
            if value is None or (isinstance(value, str) and not value.strip()):
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="MISSING_REQUIRED_FIELD",
                        message=f"Required field is missing or empty: {field_name}",
                        field=field_name,
                    )
                )

        # Validate state value
        current_state_str = data.get("current_state", "")
        if current_state_str:
            try:
                parsed_state = LifecycleState.from_string(current_state_str)
            except ValueError as e:
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="INVALID_STATE",
                        message=str(e),
                        field="current_state",
                    )
                )

        # Check attestation for critical states
        if parsed_state and requires_attestation(parsed_state):
            attestation = data.get("state_attestation")
            if not attestation or (
                isinstance(attestation, str) and not attestation.strip()
            ):
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="MISSING_ATTESTATION",
                        message=f"State '{parsed_state.value}' requires human attestation",
                        field="state_attestation",
                    )
                )

        # Check PHI fields if in restricted path
        if "restricted" in str(path).lower():
            phi_data = data.get("phi_attestation", {})
            if phi_data.get("contains_phi", False):
                if not phi_data.get("phi_acknowledged_by"):
                    issues.append(
                        ValidationIssue(
                            severity=ValidationSeverity.ERROR,
                            code="MISSING_PHI_ACKNOWLEDGMENT",
                            message="PHI dataset requires phi_acknowledged_by",
                            field="phi_attestation.phi_acknowledged_by",
                        )
                    )
                if not phi_data.get("phi_acknowledged_date"):
                    issues.append(
                        ValidationIssue(
                            severity=ValidationSeverity.ERROR,
                            code="MISSING_PHI_DATE",
                            message="PHI dataset requires phi_acknowledged_date",
                            field="phi_attestation.phi_acknowledged_date",
                        )
                    )

        # Validate state history transitions
        history = data.get("state_history", [])
        if history:
            state_sequence = [
                h.get("state", "") for h in history if isinstance(h, dict)
            ]
            invalid_transitions = validate_state_history(state_sequence)
            for from_state, to_state, idx in invalid_transitions:
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="INVALID_TRANSITION",
                        message=f"Invalid state transition: {from_state} → {to_state} (at history index {idx})",
                        field="state_history",
                    )
                )

        # Check history consistency with current state
        if history and parsed_state:
            last_history_state = None
            for h in reversed(history):
                if isinstance(h, dict) and h.get("state"):
                    last_history_state = h.get("state")
                    break
            if last_history_state and last_history_state.upper() != parsed_state.value:
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.WARNING,
                        code="HISTORY_STATE_MISMATCH",
                        message=f"Last history state '{last_history_state}' doesn't match current_state '{parsed_state.value}'",
                        field="state_history",
                    )
                )

        # Determine overall validity
        has_errors = any(i.severity == ValidationSeverity.ERROR for i in issues)

        return ValidationResult(
            path=path,
            valid=not has_errors,
            issues=issues,
            parsed_state=parsed_state,
        )

    def validate_directory(self, directory: Path) -> List[ValidationResult]:
        """Validate all LIFECYCLE_STATE.yaml files in a directory tree.

        Args:
            directory: Root directory to search

        Returns:
            List of ValidationResult for each file found
        """
        results = []
        for yaml_path in directory.rglob("LIFECYCLE_STATE.yaml"):
            results.append(self.validate_file(yaml_path))
        return results

    def validate_data_directories(self) -> Dict[str, List[ValidationResult]]:
        """Validate all standard data directories.

        Returns:
            Dictionary mapping directory names to validation results
        """
        data_dir = self.repo_root / "data"
        results = {}

        for subdir in ["raw", "processed", "restricted", "interim"]:
            subdir_path = data_dir / subdir
            if subdir_path.exists():
                results[subdir] = self.validate_directory(subdir_path)
            else:
                results[subdir] = []

        return results

    def check_directory_has_lifecycle(self, directory: Path) -> ValidationResult:
        """Check if a dataset directory has a LIFECYCLE_STATE.yaml file.

        Args:
            directory: Dataset directory to check

        Returns:
            ValidationResult (ERROR if missing, then validates if present)
        """
        lifecycle_path = directory / "LIFECYCLE_STATE.yaml"

        if not lifecycle_path.exists():
            return ValidationResult(
                path=lifecycle_path,
                valid=False,
                issues=[
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="LIFECYCLE_FILE_MISSING",
                        message=f"Dataset directory missing LIFECYCLE_STATE.yaml: {directory}",
                    )
                ],
            )

        return self.validate_file(lifecycle_path)


@dataclass
class AIStageValidationResult:
    """Result of validating AI stage execution approval."""
    stage_id: int
    stage_name: str
    allowed: bool
    requires_approval: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    ai_tools: List[Dict] = field(default_factory=list)
    approval_mode: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "stageId": self.stage_id,
            "stageName": self.stage_name,
            "allowed": self.allowed,
            "requiresApproval": self.requires_approval,
            "issues": [i.to_dict() for i in self.issues],
            "aiTools": self.ai_tools,
            "approvalMode": self.approval_mode,
        }


class AIStageValidator:
    """Validator for AI stage execution approval.
    
    This validator checks that AI-powered stages have proper approval
    before execution, enforcing human oversight of AI operations.
    """

    def __init__(self, approval_gate: Optional[AIApprovalGate] = None):
        """Initialize validator.
        
        Args:
            approval_gate: AIApprovalGate instance. If None, creates new one.
        """
        self.gate = approval_gate or AIApprovalGate()

    def validate_stage_execution(
        self,
        stage_id: int,
        stage_name: str,
    ) -> AIStageValidationResult:
        """Validate if a stage can execute based on AI approval.
        
        Args:
            stage_id: Stage requesting execution
            stage_name: Human-readable stage name
            
        Returns:
            AIStageValidationResult with approval status
        """
        issues: List[ValidationIssue] = []
        
        if not is_ai_stage(stage_id):
            return AIStageValidationResult(
                stage_id=stage_id,
                stage_name=stage_name,
                allowed=True,
                requires_approval=False,
            )
        
        ai_tools = get_ai_tools_for_stage(stage_id)
        validation = validate_ai_execution(self.gate, stage_id, stage_name)
        
        if not validation["allowed"]:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                code="AI_APPROVAL_REQUIRED",
                message=f"Stage '{stage_name}' requires AI approval before execution",
                field="ai_approval",
            ))
        
        return AIStageValidationResult(
            stage_id=stage_id,
            stage_name=stage_name,
            allowed=validation["allowed"],
            requires_approval=validation.get("requires_approval", False),
            issues=issues,
            ai_tools=ai_tools,
            approval_mode=self.gate.mode.value,
        )

    def validate_phase_execution(self, phase_id: int) -> List[AIStageValidationResult]:
        """Validate all AI stages in a phase.
        
        Args:
            phase_id: Phase to validate (1-6)
            
        Returns:
            List of validation results for each AI stage in the phase
        """
        from .lifecycle_states import PHASE_STAGES
        
        results = []
        phase_stages = PHASE_STAGES.get(phase_id, frozenset())
        
        for stage_id in sorted(phase_stages):
            if is_ai_stage(stage_id):
                result = self.validate_stage_execution(
                    stage_id=stage_id,
                    stage_name=f"Stage {stage_id}",
                )
                results.append(result)
        
        return results

    def get_pending_approvals(self) -> List[Dict]:
        """Get list of AI stages pending approval.
        
        Returns:
            List of stage info dicts for unapproved AI stages
        """
        pending = []
        for stage_id in sorted(AI_STAGES):
            if not self.gate.is_approved(stage_id):
                pending.append({
                    "stageId": stage_id,
                    "stageName": f"Stage {stage_id}",
                    "aiTools": get_ai_tools_for_stage(stage_id),
                    "phase": get_phase_for_stage(stage_id),
                })
        return pending

    def get_approval_summary(self) -> Dict[str, Any]:
        """Get summary of AI approval state.
        
        Returns:
            Dict with counts and detailed approval info
        """
        stats = self.gate.get_approval_stats()
        return {
            "mode": stats["mode"],
            "approved": stats["approved"],
            "pending": stats["pending"],
            "total": stats["total"],
            "sessionApproved": stats["session_approved"],
            "pendingStages": self.get_pending_approvals(),
            "auditLog": self.gate.get_audit_log(),
        }


def validate_ai_stage(
    stage_id: int,
    stage_name: str,
    approval_gate: Optional[AIApprovalGate] = None,
) -> AIStageValidationResult:
    """Convenience function to validate AI stage execution.
    
    Args:
        stage_id: Stage to validate
        stage_name: Human-readable stage name
        approval_gate: Optional AIApprovalGate instance
        
    Returns:
        AIStageValidationResult
    """
    validator = AIStageValidator(approval_gate)
    return validator.validate_stage_execution(stage_id, stage_name)


def validate_lifecycle_file(path: Union[str, Path]) -> ValidationResult:
    """Convenience function to validate a single lifecycle file.

    Args:
        path: Path to LIFECYCLE_STATE.yaml

    Returns:
        ValidationResult
    """
    validator = LifecycleValidator()
    return validator.validate_file(Path(path))


def validate_all_data_directories(
    repo_root: Optional[Path] = None,
) -> Dict[str, List[ValidationResult]]:
    """Convenience function to validate all data directories.

    Args:
        repo_root: Repository root (optional)

    Returns:
        Dictionary of validation results by directory
    """
    validator = LifecycleValidator(repo_root)
    return validator.validate_data_directories()


def check_dataset_directories_have_lifecycle_markers(
    repo_root: Optional[Path] = None,
    require_markers_when_data_exists: bool = True,
    include_all_data_dirs: bool = False,
) -> Dict[str, Any]:
    """Check that dataset directories with content have lifecycle markers.

    This is the CI enforcement function. Behavior:
    - If a data subdirectory is empty or contains only .gitkeep → PASS (no marker required)
    - If a data subdirectory has content but no LIFECYCLE_STATE.yaml → FAIL
    - If a data subdirectory has content and a valid marker → PASS
    - If a data subdirectory has content and an invalid marker → FAIL

    GOVERNANCE: By default, only scans data/sample/ (safe for CI, no PHI).
    Use include_all_data_dirs=True for local full verification.

    Args:
        repo_root: Repository root path
        require_markers_when_data_exists: If True, fail when data exists without marker
        include_all_data_dirs: If True, scan all data/** dirs (local use only)

    Returns:
        Dictionary with 'valid', 'errors', 'warnings', 'checked_directories'
        NOTE: Output contains directory NAMES only, not full paths (governance safe)
    """
    validator = LifecycleValidator(repo_root)
    data_dir = validator.repo_root / "data"

    result = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "checked_directories": [],
        "skipped_empty": [],
        "scan_mode": "full" if include_all_data_dirs else "safe",
    }

    # GOVERNANCE: Default safe scan = sample only; opt-in for full scan
    if include_all_data_dirs:
        scan_subdirs = ["raw", "processed", "restricted", "interim", "sample"]
    else:
        scan_subdirs = ["sample"]  # Safe default: no PHI paths

    # Check each data subdirectory in scan scope
    for subdir_name in scan_subdirs:
        subdir_path = data_dir / subdir_name

        if not subdir_path.exists():
            result["skipped_empty"].append(subdir_name)  # Name only, not path
            continue

        # Find dataset directories (immediate subdirectories with content)
        for dataset_dir in subdir_path.iterdir():
            if not dataset_dir.is_dir():
                continue

            # Check if directory has meaningful content (not just .gitkeep)
            contents = list(dataset_dir.iterdir())
            meaningful_files = [
                f
                for f in contents
                if f.name != ".gitkeep" and not f.name.startswith(".")
            ]

            # GOVERNANCE: Use sanitized name (subdir/dataset) not full path
            sanitized_name = f"{subdir_name}/{dataset_dir.name}"

            if not meaningful_files:
                # Empty directory - no marker required
                result["skipped_empty"].append(sanitized_name)
                continue

            result["checked_directories"].append(sanitized_name)

            # Check for lifecycle marker
            lifecycle_path = dataset_dir / "LIFECYCLE_STATE.yaml"

            if not lifecycle_path.exists():
                if require_markers_when_data_exists:
                    result["valid"] = False
                    result["errors"].append(
                        {
                            "directory": sanitized_name,
                            "issue": "Dataset directory has content but no LIFECYCLE_STATE.yaml",
                            "suggestion": "Add LIFECYCLE_STATE.yaml using docs/templates/dataset/LIFECYCLE_STATE_TEMPLATE.yaml",
                        }
                    )
                else:
                    result["warnings"].append(
                        {
                            "directory": sanitized_name,
                            "issue": "Dataset directory missing lifecycle marker",
                        }
                    )
            else:
                # Validate the marker
                validation_result = validator.validate_file(lifecycle_path)
                if not validation_result.valid:
                    result["valid"] = False
                    for issue in validation_result.issues:
                        if issue.severity == ValidationSeverity.ERROR:
                            result["errors"].append(
                                {
                                    "directory": sanitized_name,
                                    "issue": f"{issue.code}: {issue.message}",
                                    "field": issue.field,
                                }
                            )
                        else:
                            result["warnings"].append(
                                {
                                    "directory": sanitized_name,
                                    "issue": f"{issue.code}: {issue.message}",
                                }
                            )

    return result


def main() -> int:
    """CLI entry point for lifecycle validation.

    Returns:
        Exit code (0 = success, 1 = errors found)
    """
    import argparse
    import json
    import sys

    parser = argparse.ArgumentParser(
        description="Validate dataset lifecycle markers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m src.governance.lifecycle_validator
  python -m src.governance.lifecycle_validator --json report.json
  python -m src.governance.lifecycle_validator --permissive
  python -m src.governance.lifecycle_validator --include-all-data  # Local full scan
        """,
    )
    parser.add_argument(
        "--json",
        metavar="FILE",
        help="Write JSON report to file",
    )
    parser.add_argument(
        "--permissive",
        action="store_true",
        help="Warn instead of fail when markers are missing (for pre-analysis mode)",
    )
    parser.add_argument(
        "--include-all-data",
        action="store_true",
        help="Scan all data/** directories (local use only, not for CI)",
    )
    parser.add_argument(
        "--repo-root",
        metavar="PATH",
        help="Repository root path (default: auto-detect)",
    )

    args = parser.parse_args()

    repo_root = Path(args.repo_root) if args.repo_root else None

    print("=== Dataset Lifecycle Marker Validation ===")
    scan_mode = (
        "FULL (all data/**)" if args.include_all_data else "SAFE (data/sample only)"
    )
    print(f"Scan mode: {scan_mode}")
    print()

    result = check_dataset_directories_have_lifecycle_markers(
        repo_root=repo_root,
        require_markers_when_data_exists=not args.permissive,
        include_all_data_dirs=args.include_all_data,
    )

    # Report results
    if result["skipped_empty"]:
        print(f"Skipped (empty): {len(result['skipped_empty'])} directories")

    if result["checked_directories"]:
        print(f"Checked: {len(result['checked_directories'])} directories with content")
        for d in result["checked_directories"]:
            print(f"  - {d}")
    else:
        print("No dataset directories with content found.")
        print("✓ Validation passes (pre-analysis mode: no data to validate)")

    print()

    if result["errors"]:
        print(f"❌ ERRORS: {len(result['errors'])}")
        for err in result["errors"]:
            print(f"  [{err['directory']}]")
            print(f"    {err['issue']}")
            if "suggestion" in err:
                print(f"    → {err['suggestion']}")
        print()

    if result["warnings"]:
        print(f"⚠️  WARNINGS: {len(result['warnings'])}")
        for warn in result["warnings"]:
            print(f"  [{warn['directory']}] {warn['issue']}")
        print()

    if result["valid"]:
        print("✓ Lifecycle marker validation PASSED")
    else:
        print("✗ Lifecycle marker validation FAILED")

    # Write JSON report if requested
    if args.json:
        with open(args.json, "w") as f:
            json.dump(result, f, indent=2)
        print(f"\nReport written to: {args.json}")

    return 0 if result["valid"] else 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
