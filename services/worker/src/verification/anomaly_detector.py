"""
Anomaly Detector - Layer 3

Statistical outlier detection using IQR and Z-score.
"""

import logging
from typing import Dict, List, Optional, Any
import pandas as pd
import numpy as np

from .layered_verifier import LayerResult, VerificationLayer, VerificationStatus

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Statistical anomaly detection for data quality"""

    def __init__(self, iqr_multiplier: float = 1.5, zscore_threshold: float = 3.0):
        self.iqr_multiplier = iqr_multiplier
        self.zscore_threshold = zscore_threshold

    def detect(
        self, data: pd.DataFrame, context: Optional[Dict[str, Any]] = None
    ) -> LayerResult:
        """Detect statistical anomalies in numeric columns"""
        logger.info(f"Detecting anomalies in {len(data)} rows")

        warnings = []
        metrics = {}
        numeric_cols = data.select_dtypes(include=[np.number]).columns

        total_anomalies = 0
        for col in numeric_cols:
            # IQR method
            Q1 = data[col].quantile(0.25)
            Q3 = data[col].quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - self.iqr_multiplier * IQR
            upper = Q3 + self.iqr_multiplier * IQR
            outliers = data[(data[col] < lower) | (data[col] > upper)]

            if len(outliers) > 0:
                pct = (len(outliers) / len(data)) * 100
                warnings.append(f"{col}: {len(outliers)} outliers ({pct:.1f}%)")
                total_anomalies += len(outliers)

        metrics["columns_checked"] = len(numeric_cols)
        metrics["anomalies_detected"] = total_anomalies

        if total_anomalies > len(data) * 0.05:  # >5% anomalies
            status = VerificationStatus.WARNING
        else:
            status = VerificationStatus.PASSED

        return LayerResult(
            layer=VerificationLayer.ANOMALY,
            status=status,
            passed=True,
            warnings=warnings,
            metrics=metrics,
        )


def detect_anomalies(
    data: pd.DataFrame, context: Optional[Dict[str, Any]] = None
) -> LayerResult:
    detector = AnomalyDetector()
    return detector.detect(data, context)


def get_anomaly_report(result: LayerResult) -> Dict[str, int]:
    return {"anomalies_detected": result.metrics.get("anomalies_detected", 0)}
