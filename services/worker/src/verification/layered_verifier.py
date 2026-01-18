"""
Layered Verification Framework

Orchestrates multi-layer quality assurance checks with progressive validation.
Each layer builds on the previous, providing defense-in-depth for data quality.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import pandas as pd
import json
from pathlib import Path

logger = logging.getLogger(__name__)


class VerificationLayer(Enum):
    """Verification layers in order of execution"""

    SCHEMA = 1
    CONCORDANCE = 2
    ANOMALY = 3
    AUDIT = 4
    DIAGNOSTIC = 5


class VerificationStatus(Enum):
    """Verification outcome status"""

    PASSED = "PASSED"
    WARNING = "WARNING"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


@dataclass
class LayerResult:
    """Result from a single verification layer"""

    layer: VerificationLayer
    status: VerificationStatus
    passed: bool
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    execution_time_ms: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class VerificationResult:
    """Complete verification result across all layers"""

    overall_status: VerificationStatus
    overall_passed: bool
    layers: Dict[VerificationLayer, LayerResult] = field(default_factory=dict)
    total_warnings: int = 0
    total_errors: int = 0
    execution_time_ms: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "overall_status": self.overall_status.value,
            "overall_passed": self.overall_passed,
            "total_warnings": self.total_warnings,
            "total_errors": self.total_errors,
            "execution_time_ms": self.execution_time_ms,
            "timestamp": self.timestamp.isoformat(),
            "layers": {
                layer.name: {
                    "status": result.status.value,
                    "passed": result.passed,
                    "warnings": result.warnings,
                    "errors": result.errors,
                    "metrics": result.metrics,
                    "execution_time_ms": result.execution_time_ms,
                    "timestamp": result.timestamp.isoformat(),
                }
                for layer, result in self.layers.items()
            },
        }

    def to_json(self, filepath: Optional[Path] = None) -> str:
        """Export to JSON"""
        json_str = json.dumps(self.to_dict(), indent=2, default=str)
        if filepath:
            filepath.write_text(json_str)
        return json_str


class LayeredVerifier:
    """
    Orchestrates layered verification with progressive quality gates.

    Verification Layers:
    1. Schema: Pandera schema validation (types, nulls, ranges)
    2. Concordance: Clinical agreement checks (CT-ETE vs Path-ETE, etc.)
    3. Anomaly: Statistical outlier detection (IQR, Z-score)
    4. Audit: Hash chain integrity verification
    5. Diagnostic: AI-powered explainable diagnostics

    Each layer can be configured to:
    - PASS: Continue to next layer
    - WARNING: Continue with warnings
    - FAIL: Stop verification pipeline
    """

    def __init__(
        self,
        stop_on_failure: bool = False,
        stop_on_warning: bool = False,
        enabled_layers: Optional[List[VerificationLayer]] = None,
    ):
        """
        Initialize layered verifier.

        Parameters
        ----------
        stop_on_failure : bool
            If True, stop verification on first FAILED layer
        stop_on_warning : bool
            If True, stop verification on first WARNING layer
        enabled_layers : list of VerificationLayer, optional
            Layers to run (default: all layers)
        """
        self.stop_on_failure = stop_on_failure
        self.stop_on_warning = stop_on_warning
        self.enabled_layers = enabled_layers or list(VerificationLayer)

        # Import layer implementations (avoid circular imports)
        from .schema_validator import SchemaValidator
        from .concordance_checker import ConcordanceChecker
        from .anomaly_detector import AnomalyDetector
        from .audit_verifier import AuditVerifier
        from .explainable_diagnostics import ExplainableDiagnostics

        self.validators = {
            VerificationLayer.SCHEMA: SchemaValidator(),
            VerificationLayer.CONCORDANCE: ConcordanceChecker(),
            VerificationLayer.ANOMALY: AnomalyDetector(),
            VerificationLayer.AUDIT: AuditVerifier(),
            VerificationLayer.DIAGNOSTIC: ExplainableDiagnostics(),
        }

        logger.info(
            f"Initialized LayeredVerifier with {len(self.enabled_layers)} layers"
        )

    def verify(
        self,
        data: pd.DataFrame,
        schema_name: Optional[str] = None,
        linkage_df: Optional[pd.DataFrame] = None,
        audit_log: Optional[pd.DataFrame] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> VerificationResult:
        """
        Run layered verification pipeline.

        Parameters
        ----------
        data : pd.DataFrame
            Primary data to verify
        schema_name : str, optional
            Pandera schema name for validation
        linkage_df : pd.DataFrame, optional
            Linkage table for concordance checks
        audit_log : pd.DataFrame, optional
            Audit log for hash chain verification
        context : dict, optional
            Additional context for verification (e.g., thresholds, parameters)

        Returns
        -------
        VerificationResult
            Complete verification result with all layer outcomes
        """
        start_time = datetime.utcnow()
        layer_results = {}

        logger.info("=" * 80)
        logger.info("STARTING LAYERED VERIFICATION")
        logger.info("=" * 80)
        logger.info(f"Data shape: {data.shape}")
        logger.info(f"Enabled layers: {[layer.name for layer in self.enabled_layers]}")

        # Run each enabled layer
        for layer in sorted(self.enabled_layers, key=lambda x: x.value):
            logger.info(f"\n--- Layer {layer.value}: {layer.name} ---")

            try:
                layer_start = datetime.utcnow()

                # Run layer-specific validation
                if layer == VerificationLayer.SCHEMA and schema_name:
                    result = self.validators[layer].validate(data, schema_name)
                elif layer == VerificationLayer.CONCORDANCE and linkage_df is not None:
                    result = self.validators[layer].check(data, linkage_df)
                elif layer == VerificationLayer.ANOMALY:
                    result = self.validators[layer].detect(data, context)
                elif layer == VerificationLayer.AUDIT and audit_log is not None:
                    result = self.validators[layer].verify(audit_log)
                elif layer == VerificationLayer.DIAGNOSTIC:
                    # Diagnostic layer uses results from previous layers
                    result = self.validators[layer].diagnose(
                        data, layer_results, context
                    )
                else:
                    logger.warning(
                        f"Layer {layer.name} skipped (missing required data)"
                    )
                    result = LayerResult(
                        layer=layer,
                        status=VerificationStatus.SKIPPED,
                        passed=True,
                        warnings=[f"Layer skipped: missing required data"],
                    )

                layer_end = datetime.utcnow()
                result.execution_time_ms = (
                    layer_end - layer_start
                ).total_seconds() * 1000
                layer_results[layer] = result

                # Log layer result
                status_emoji = (
                    "✅"
                    if result.passed
                    else ("⚠️" if result.status == VerificationStatus.WARNING else "❌")
                )
                logger.info(f"{status_emoji} {layer.name}: {result.status.value}")
                if result.warnings:
                    logger.warning(f"  Warnings: {len(result.warnings)}")
                if result.errors:
                    logger.error(f"  Errors: {len(result.errors)}")
                if result.metrics:
                    logger.info(f"  Metrics: {result.metrics}")

                # Check stop conditions
                if result.status == VerificationStatus.FAILED and self.stop_on_failure:
                    logger.error(f"Stopping verification: {layer.name} FAILED")
                    break
                if result.status == VerificationStatus.WARNING and self.stop_on_warning:
                    logger.warning(f"Stopping verification: {layer.name} WARNING")
                    break

            except Exception as e:
                logger.exception(f"Layer {layer.name} raised exception")
                layer_results[layer] = LayerResult(
                    layer=layer,
                    status=VerificationStatus.FAILED,
                    passed=False,
                    errors=[f"Exception: {str(e)}"],
                )
                if self.stop_on_failure:
                    break

        # Compute overall result
        end_time = datetime.utcnow()

        total_warnings = sum(len(r.warnings) for r in layer_results.values())
        total_errors = sum(len(r.errors) for r in layer_results.values())

        # Overall status logic
        has_failures = any(
            r.status == VerificationStatus.FAILED for r in layer_results.values()
        )
        has_warnings = any(
            r.status == VerificationStatus.WARNING for r in layer_results.values()
        )

        if has_failures:
            overall_status = VerificationStatus.FAILED
            overall_passed = False
        elif has_warnings:
            overall_status = VerificationStatus.WARNING
            overall_passed = True  # Warnings don't fail verification
        else:
            overall_status = VerificationStatus.PASSED
            overall_passed = True

        result = VerificationResult(
            overall_status=overall_status,
            overall_passed=overall_passed,
            layers=layer_results,
            total_warnings=total_warnings,
            total_errors=total_errors,
            execution_time_ms=(end_time - start_time).total_seconds() * 1000,
            timestamp=start_time,
        )

        logger.info("\n" + "=" * 80)
        logger.info(f"VERIFICATION COMPLETE: {overall_status.value}")
        logger.info("=" * 80)
        logger.info(f"Layers run: {len(layer_results)}")
        logger.info(f"Total warnings: {total_warnings}")
        logger.info(f"Total errors: {total_errors}")
        logger.info(f"Execution time: {result.execution_time_ms:.1f} ms")

        return result

    def verify_dataset(
        self,
        dataset_path: Path,
        schema_name: str,
        linkage_path: Optional[Path] = None,
        audit_log_path: Optional[Path] = None,
    ) -> VerificationResult:
        """
        Convenience method to verify a dataset from file.

        Parameters
        ----------
        dataset_path : Path
            Path to dataset parquet file
        schema_name : str
            Pandera schema name
        linkage_path : Path, optional
            Path to linkage table parquet file
        audit_log_path : Path, optional
            Path to audit log parquet file

        Returns
        -------
        VerificationResult
        """
        logger.info(f"Loading dataset: {dataset_path}")
        data = pd.read_parquet(dataset_path)

        linkage_df = None
        if linkage_path and linkage_path.exists():
            logger.info(f"Loading linkage table: {linkage_path}")
            linkage_df = pd.read_parquet(linkage_path)

        audit_log = None
        if audit_log_path and audit_log_path.exists():
            logger.info(f"Loading audit log: {audit_log_path}")
            audit_log = pd.read_parquet(audit_log_path)

        return self.verify(
            data=data,
            schema_name=schema_name,
            linkage_df=linkage_df,
            audit_log=audit_log,
        )


def run_verification_pipeline(
    data: pd.DataFrame,
    schema_name: str,
    linkage_df: Optional[pd.DataFrame] = None,
    audit_log: Optional[pd.DataFrame] = None,
    stop_on_failure: bool = True,
) -> VerificationResult:
    """
    Convenience function to run complete verification pipeline.

    Parameters
    ----------
    data : pd.DataFrame
        Data to verify
    schema_name : str
        Pandera schema name
    linkage_df : pd.DataFrame, optional
        Linkage table for concordance checks
    audit_log : pd.DataFrame, optional
        Audit log for verification
    stop_on_failure : bool
        Stop on first failure (default: True)

    Returns
    -------
    VerificationResult
    """
    verifier = LayeredVerifier(stop_on_failure=stop_on_failure)
    return verifier.verify(
        data=data, schema_name=schema_name, linkage_df=linkage_df, audit_log=audit_log
    )


def generate_qa_report(
    verification_result: VerificationResult, output_path: Optional[Path] = None
) -> str:
    """
    Generate human-readable QA report from verification result.

    Parameters
    ----------
    verification_result : VerificationResult
        Verification result to format
    output_path : Path, optional
        Path to save report (if specified)

    Returns
    -------
    str
        Formatted QA report
    """
    lines = []
    lines.append("=" * 80)
    lines.append("LAYERED VERIFICATION QA REPORT")
    lines.append("=" * 80)
    lines.append(f"Timestamp: {verification_result.timestamp.isoformat()}")
    lines.append(f"Overall Status: {verification_result.overall_status.value}")
    lines.append(
        f"Overall Passed: {'✅ YES' if verification_result.overall_passed else '❌ NO'}"
    )
    lines.append(f"Total Warnings: {verification_result.total_warnings}")
    lines.append(f"Total Errors: {verification_result.total_errors}")
    lines.append(f"Execution Time: {verification_result.execution_time_ms:.1f} ms")
    lines.append("")

    # Layer-by-layer results
    lines.append("LAYER RESULTS")
    lines.append("-" * 80)

    for layer in sorted(verification_result.layers.keys(), key=lambda x: x.value):
        result = verification_result.layers[layer]
        status_emoji = (
            "✅"
            if result.passed
            else ("⚠️" if result.status == VerificationStatus.WARNING else "❌")
        )

        lines.append(f"\n{status_emoji} Layer {layer.value}: {layer.name}")
        lines.append(f"  Status: {result.status.value}")
        lines.append(f"  Execution Time: {result.execution_time_ms:.1f} ms")

        if result.metrics:
            lines.append(f"  Metrics:")
            for key, value in result.metrics.items():
                lines.append(f"    - {key}: {value}")

        if result.warnings:
            lines.append(f"  Warnings ({len(result.warnings)}):")
            for warning in result.warnings[:5]:  # Show first 5
                lines.append(f"    - {warning}")
            if len(result.warnings) > 5:
                lines.append(f"    ... and {len(result.warnings) - 5} more")

        if result.errors:
            lines.append(f"  Errors ({len(result.errors)}):")
            for error in result.errors[:5]:  # Show first 5
                lines.append(f"    - {error}")
            if len(result.errors) > 5:
                lines.append(f"    ... and {len(result.errors) - 5} more")

    lines.append("\n" + "=" * 80)
    lines.append("END OF QA REPORT")
    lines.append("=" * 80)

    report = "\n".join(lines)

    if output_path:
        output_path.write_text(report)
        logger.info(f"QA report saved to: {output_path}")

    return report
