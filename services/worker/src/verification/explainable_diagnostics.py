"""
Explainable Diagnostics - Layer 5

AI-powered diagnostic analysis with human-readable explanations.
"""

import logging
from typing import Dict, List, Optional, Any
import pandas as pd

from .layered_verifier import LayerResult, VerificationLayer, VerificationStatus

logger = logging.getLogger(__name__)


class ExplainableDiagnostics:
    """AI-powered explainable diagnostics for verification failures"""

    def diagnose(
        self,
        data: pd.DataFrame,
        layer_results: Dict[VerificationLayer, LayerResult],
        context: Optional[Dict[str, Any]] = None,
    ) -> LayerResult:
        """Generate diagnostic analysis of verification failures"""
        logger.info("Running explainable diagnostics")

        explanations = []
        recommendations = []

        for layer, result in layer_results.items():
            if result.status in [VerificationStatus.FAILED, VerificationStatus.WARNING]:
                explanation = self._explain_failure(layer, result, data)
                explanations.append(explanation)

                recommendation = self._recommend_action(layer, result)
                recommendations.append(recommendation)

        metrics = {
            "layers_analyzed": len(layer_results),
            "failures_explained": len(explanations),
            "recommendations_generated": len(recommendations),
            "explanations": explanations,
            "recommendations": recommendations,
        }

        if not explanations:
            logger.info("✅ No failures to diagnose")
            return LayerResult(
                layer=VerificationLayer.DIAGNOSTIC,
                status=VerificationStatus.PASSED,
                passed=True,
                metrics=metrics,
            )

        return LayerResult(
            layer=VerificationLayer.DIAGNOSTIC,
            status=VerificationStatus.PASSED,
            passed=True,
            warnings=explanations,
            metrics=metrics,
        )

    def _explain_failure(
        self, layer: VerificationLayer, result: LayerResult, data: pd.DataFrame
    ) -> str:
        """Generate human-readable explanation"""
        if layer == VerificationLayer.SCHEMA:
            if "violation_summary" in result.metrics:
                violations = result.metrics["violation_summary"]
                columns = list(violations.keys())
                return f"Schema failed on {len(columns)} columns: {', '.join(columns)}"
            return "Schema validation failed"
        elif layer == VerificationLayer.CONCORDANCE:
            if "concordance_results" in result.metrics:
                results = result.metrics["concordance_results"]
                failed = {k: v for k, v in results.items() if v < 85.0}
                return f"Concordance failed for: {', '.join([f'{k} ({v:.1f}%)' for k, v in failed.items()])}"
            return "Concordance validation failed"
        elif layer == VerificationLayer.ANOMALY:
            count = result.metrics.get("anomalies_detected", 0)
            return f"Detected {count} statistical anomalies"
        elif layer == VerificationLayer.AUDIT:
            return "Audit trail integrity issue detected"
        return f"{layer.name} layer reported issues"

    def _recommend_action(self, layer: VerificationLayer, result: LayerResult) -> str:
        """Generate actionable recommendation"""
        recommendations = {
            VerificationLayer.SCHEMA: "Review data ingestion pipeline and validate source data",
            VerificationLayer.CONCORDANCE: "Investigate clinical discrepancies and linkage accuracy",
            VerificationLayer.ANOMALY: "Review flagged outliers for data entry errors",
            VerificationLayer.AUDIT: "Verify audit log integrity and check for tampering",
        }
        return recommendations.get(
            layer, "Review layer details and consult documentation"
        )


def generate_diagnostic_report(data: pd.DataFrame, layer_results: Dict) -> LayerResult:
    diagnostics = ExplainableDiagnostics()
    return diagnostics.diagnose(data, layer_results)


def get_failure_explanations(result: LayerResult) -> List[str]:
    return result.metrics.get("explanations", [])
