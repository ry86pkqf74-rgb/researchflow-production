"""
Export Pipeline Integration

This module provides integration hooks for the export pipeline to run
accessibility validation. Supports STRICT and WARN modes.

Modes:
- STRICT: Block export on accessibility errors
- WARN: Allow export but include warnings in report

Mode can be controlled by:
- template.accessibility_mode
- LIVE mode templates can enforce STRICT

Last Updated: 2026-01-20
"""

import logging
import json
from enum import Enum
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime

from .checker import AccessibilityChecker
from .report import AccessibilityReport

logger = logging.getLogger(__name__)


class AccessibilityMode(Enum):
    """
    Accessibility validation modes for export.

    STRICT: Errors block export. Must fix all accessibility errors before export.
    WARN: Errors are logged but export proceeds. Report includes all issues.
    """

    STRICT = "strict"
    WARN = "warn"


class ExportAccessibilityError(Exception):
    """
    Exception raised when export fails accessibility validation in STRICT mode.

    Attributes:
        report: The AccessibilityReport that caused the failure
        message: Human-readable error message
    """

    def __init__(self, report: AccessibilityReport, message: str = ""):
        self.report = report
        self.message = message or (
            f"Export blocked: {len(report.issues)} accessibility error(s) found. "
            f"Fix all errors or switch to WARN mode."
        )
        super().__init__(self.message)

    def __str__(self) -> str:
        return f"ExportAccessibilityError: {self.message}"


def get_accessibility_mode(
    template: Optional[Dict[str, Any]] = None,
    is_live: bool = False,
    default_mode: AccessibilityMode = AccessibilityMode.WARN,
) -> AccessibilityMode:
    """
    Determine the accessibility mode based on template and context.

    In LIVE mode, templates can enforce STRICT mode for compliance.

    Args:
        template: Export template configuration
        is_live: Whether this is a LIVE (production) export
        default_mode: Default mode if not specified

    Returns:
        The AccessibilityMode to use
    """
    if template is None:
        return default_mode

    # Check template.accessibility_mode
    mode_str = template.get("accessibility_mode", "").lower()

    if mode_str == "strict":
        return AccessibilityMode.STRICT
    elif mode_str == "warn":
        # In LIVE mode, template may enforce strict even if warn is requested
        if is_live and template.get("live_enforce_strict", False):
            logger.info(
                "LIVE mode with live_enforce_strict=True: upgrading to STRICT mode"
            )
            return AccessibilityMode.STRICT
        return AccessibilityMode.WARN
    else:
        # No explicit mode set - check LIVE enforcement
        if is_live and template.get("live_enforce_strict", False):
            return AccessibilityMode.STRICT
        return default_mode


def validate_export_accessibility(
    content: Dict[str, Any],
    document_id: str = "",
    template: Optional[Dict[str, Any]] = None,
    is_live: bool = False,
    mode_override: Optional[AccessibilityMode] = None,
    artifact_dir: Optional[Path] = None,
) -> Tuple[AccessibilityReport, bool]:
    """
    Validate export document accessibility.

    This is the main entry point for the export pipeline integration.
    It runs accessibility checks and handles mode-based behavior.

    Args:
        content: Document content to validate
        document_id: Document identifier for the report
        template: Export template configuration (contains accessibility_mode)
        is_live: Whether this is a LIVE (production) export
        mode_override: Optional mode override (bypasses template lookup)
        artifact_dir: Optional directory to save report artifact

    Returns:
        Tuple of (AccessibilityReport, export_allowed: bool)

    Raises:
        ExportAccessibilityError: In STRICT mode when errors are found
    """
    # Determine mode
    if mode_override is not None:
        mode = mode_override
    else:
        mode = get_accessibility_mode(template, is_live)

    logger.info(
        f"Running accessibility validation: document_id={document_id}, mode={mode.value}"
    )

    # Create checker and run validation
    checker = AccessibilityChecker()
    report = checker.check_document(content, document_id=document_id)

    # Save report artifact if directory provided
    if artifact_dir is not None:
        _save_report_artifact(report, artifact_dir)

    # Handle mode-based behavior
    if mode == AccessibilityMode.STRICT:
        if not report.passed:
            error_count = sum(1 for i in report.issues if i.severity == "error")
            logger.error(
                f"STRICT mode: Export blocked due to {error_count} accessibility error(s)"
            )
            raise ExportAccessibilityError(report)
        else:
            logger.info("STRICT mode: Accessibility validation passed")
            return report, True

    else:  # WARN mode
        if not report.passed:
            error_count = sum(1 for i in report.issues if i.severity == "error")
            logger.warning(
                f"WARN mode: {error_count} accessibility error(s) found but export allowed"
            )
        else:
            logger.info("WARN mode: Accessibility validation passed")

        return report, True


def _save_report_artifact(
    report: AccessibilityReport,
    artifact_dir: Path,
) -> Path:
    """
    Save the accessibility report as an artifact.

    The artifact is saved with kind=accessibility_report and includes
    all report data in JSON format.

    Args:
        report: The AccessibilityReport to save
        artifact_dir: Directory to save the artifact

    Returns:
        Path to the saved artifact file
    """
    artifact_dir.mkdir(parents=True, exist_ok=True)

    # Generate artifact filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    artifact_id = report.get_artifact_id()
    filename = f"accessibility_report_{artifact_id}_{timestamp}.json"
    filepath = artifact_dir / filename

    # Write artifact
    artifact_data = report.to_dict()
    filepath.write_text(json.dumps(artifact_data, indent=2), encoding="utf-8")

    logger.info(f"Saved accessibility report artifact: {filepath}")

    return filepath


class ExportAccessibilityHook:
    """
    Hook class for integration with export pipeline.

    This class provides a standard interface for the export pipeline
    to call accessibility validation. It can be registered as a
    pre-export hook.

    Usage:
        hook = ExportAccessibilityHook(mode=AccessibilityMode.STRICT)
        try:
            hook.pre_export(content, document_id, template)
        except ExportAccessibilityError as e:
            # Handle blocked export
            pass
    """

    def __init__(
        self,
        mode: Optional[AccessibilityMode] = None,
        artifact_dir: Optional[Path] = None,
    ):
        """
        Initialize the export accessibility hook.

        Args:
            mode: Optional mode override. If None, uses template setting.
            artifact_dir: Optional directory for saving report artifacts.
        """
        self.mode = mode
        self.artifact_dir = artifact_dir
        self._last_report: Optional[AccessibilityReport] = None

    def pre_export(
        self,
        content: Dict[str, Any],
        document_id: str = "",
        template: Optional[Dict[str, Any]] = None,
        is_live: bool = False,
    ) -> AccessibilityReport:
        """
        Pre-export hook - called before export begins.

        Args:
            content: Document content to validate
            document_id: Document identifier
            template: Export template configuration
            is_live: Whether this is a LIVE export

        Returns:
            AccessibilityReport

        Raises:
            ExportAccessibilityError: In STRICT mode when errors are found
        """
        report, allowed = validate_export_accessibility(
            content=content,
            document_id=document_id,
            template=template,
            is_live=is_live,
            mode_override=self.mode,
            artifact_dir=self.artifact_dir,
        )

        self._last_report = report
        return report

    def get_last_report(self) -> Optional[AccessibilityReport]:
        """Get the most recent accessibility report."""
        return self._last_report

    def post_export(
        self,
        content: Dict[str, Any],
        export_result: Any,
        document_id: str = "",
    ) -> None:
        """
        Post-export hook - called after export completes.

        Can be used to log or attach the accessibility report to export metadata.

        Args:
            content: Original document content
            export_result: Result from export operation
            document_id: Document identifier
        """
        if self._last_report is not None:
            logger.info(
                f"Post-export accessibility summary for {document_id}: "
                f"passed={self._last_report.passed}, "
                f"issues={len(self._last_report.issues)}, "
                f"warnings={len(self._last_report.warnings)}"
            )


def create_export_hook(
    template: Optional[Dict[str, Any]] = None,
    artifact_dir: Optional[Path] = None,
) -> ExportAccessibilityHook:
    """
    Factory function to create an export accessibility hook.

    Args:
        template: Export template (used to determine default mode)
        artifact_dir: Directory for saving report artifacts

    Returns:
        Configured ExportAccessibilityHook instance
    """
    mode = get_accessibility_mode(template) if template else None
    return ExportAccessibilityHook(mode=mode, artifact_dir=artifact_dir)
