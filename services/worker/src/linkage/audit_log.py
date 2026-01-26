"""
Immutable Audit Log for Linkage Decisions

This module implements an append-only audit trail for all linkage decisions.
The audit log is immutable (no updates/deletes) to ensure reproducibility and
compliance with data governance requirements.

Key Features:
- Append-only log (no modifications allowed)
- Cryptographic hash chain for tamper detection
- Linkage decision metadata (tolerance, confidence, validation status)
- Export to parquet for long-term archival

Author: Research Operating System
Date: 2025-12-22
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class AuditLogger:
    """Immutable audit logger for linkage decisions"""

    def __init__(
        self, log_file: Path = Path("data/processed/linkage/audit_log.parquet")
    ):
        """
        Initialize audit logger.

        Parameters
        ----------
        log_file : Path
            Path to audit log parquet file (created if doesn't exist)
        """
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

        # Load existing log if present
        if self.log_file.exists():
            self.log_df = pd.read_parquet(self.log_file)
            logger.info(f"Loaded existing audit log: {len(self.log_df)} entries")
        else:
            self.log_df = pd.DataFrame(
                columns=[
                    "audit_id",
                    "timestamp",
                    "linkage_id",
                    "source_id",
                    "target_id",
                    "source_type",
                    "target_type",
                    "days_gap",
                    "abs_days_gap",
                    "tolerance_days",
                    "link_confidence",
                    "validation_status",
                    "validation_checks",
                    "created_by",
                    "log_hash",
                    "prev_log_hash",
                ]
            )
            logger.info("Initialized new audit log")

        self.last_hash = self._get_last_hash()

    def _get_last_hash(self) -> str:
        """Get hash of most recent log entry (for hash chain)"""
        if len(self.log_df) == 0:
            return hashlib.sha256(b"GENESIS_BLOCK").hexdigest()[:16]
        return self.log_df.iloc[-1]["log_hash"]

    def _compute_log_hash(self, entry: Dict[str, any]) -> str:
        """
        Compute cryptographic hash of log entry.

        Hash includes:
        - All entry fields
        - Previous log hash (creates tamper-evident chain)
        """
        # Create deterministic string representation
        hash_input = json.dumps(entry, sort_keys=True, default=str)
        hash_input += self.last_hash

        # SHA-256 hash (truncated to 16 chars for readability)
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    def log_linkage_decision(
        self,
        linkage_id: str,
        source_id: str,
        target_id: str,
        source_type: str,
        target_type: str,
        days_gap: int,
        abs_days_gap: int,
        tolerance_days: int,
        link_confidence: float,
        validation_status: str = "PASSED",
        validation_checks: Optional[Dict[str, any]] = None,
        created_by: str = "linkage_engine_v1",
    ) -> str:
        """
        Log a linkage decision to the immutable audit trail.

        Parameters
        ----------
        linkage_id : str
            Unique linkage identifier
        source_id : str
            Source record ID (e.g., ct_id, fna_id)
        target_id : str
            Target record ID (e.g., pathology_id)
        source_type : str
            Source data type ('ct_scan', 'fna_biopsy', etc.)
        target_type : str
            Target data type ('pathology', 'surgery')
        days_gap : int
            Signed temporal gap (negative = source before target)
        abs_days_gap : int
            Absolute temporal gap
        tolerance_days : int
            Date tolerance window used
        link_confidence : float
            Confidence score (0.0-1.0)
        validation_status : str
            Validation outcome ('PASSED', 'FAILED', 'WARNING')
        validation_checks : dict, optional
            Validation check results (from LinkageValidator)
        created_by : str
            Software/user that created the link

        Returns
        -------
        str
            Audit ID for the logged entry
        """
        # Create audit entry
        audit_id = (
            f"AUDIT_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{len(self.log_df):06d}"
        )

        entry = {
            "audit_id": audit_id,
            "timestamp": datetime.utcnow(),
            "linkage_id": linkage_id,
            "source_id": source_id,
            "target_id": target_id,
            "source_type": source_type,
            "target_type": target_type,
            "days_gap": days_gap,
            "abs_days_gap": abs_days_gap,
            "tolerance_days": tolerance_days,
            "link_confidence": link_confidence,
            "validation_status": validation_status,
            "validation_checks": (
                json.dumps(validation_checks) if validation_checks else "{}"
            ),
            "created_by": created_by,
            "prev_log_hash": self.last_hash,
        }

        # Compute hash for this entry
        entry["log_hash"] = self._compute_log_hash(entry)

        # Append to log (immutable - no updates/deletes)
        self.log_df = pd.concat([self.log_df, pd.DataFrame([entry])], ignore_index=True)

        # Update last hash
        self.last_hash = entry["log_hash"]

        logger.debug(f"Logged linkage decision: {audit_id} ({linkage_id})")

        return audit_id

    def log_batch_linkages(
        self,
        linkage_df: pd.DataFrame,
        source_type: str,
        target_type: str,
        tolerance_days: int,
        validation_results: Optional[Dict[str, any]] = None,
        created_by: str = "linkage_engine_v1",
    ) -> List[str]:
        """
        Log a batch of linkages to audit trail.

        Parameters
        ----------
        linkage_df : pd.DataFrame
            Linkage table from linkage_engine
        source_type : str
            Source data type
        target_type : str
            Target data type
        tolerance_days : int
            Date tolerance window used
        validation_results : dict, optional
            Validation summary from LinkageValidator
        created_by : str
            Software/user that created the links

        Returns
        -------
        list of str
            Audit IDs for logged entries
        """
        logger.info(f"Logging batch of {len(linkage_df)} linkages to audit trail")

        audit_ids = []

        for _, row in linkage_df.iterrows():
            # Determine validation status
            validation_status = "PASSED"
            if validation_results and not validation_results.get(
                "all_checks_passed", True
            ):
                validation_status = "WARNING"

            # Extract source/target IDs (column names vary by source type)
            source_id_col = [
                col
                for col in row.index
                if col.endswith("_id")
                and "linkage" not in col
                and "pathology" not in col
            ][0]
            target_id_col = "pathology_id"

            audit_id = self.log_linkage_decision(
                linkage_id=row["linkage_id"],
                source_id=row[source_id_col],
                target_id=row[target_id_col],
                source_type=source_type,
                target_type=target_type,
                days_gap=int(row["days_gap"]),
                abs_days_gap=int(row["abs_days_gap"]),
                tolerance_days=tolerance_days,
                link_confidence=float(row["link_confidence"]),
                validation_status=validation_status,
                validation_checks=validation_results,
                created_by=created_by,
            )

            audit_ids.append(audit_id)

        logger.info(f"Logged {len(audit_ids)} linkage decisions")

        return audit_ids

    def save(self):
        """Save audit log to parquet (append-only, immutable)"""
        self.log_df.to_parquet(self.log_file, index=False)
        logger.info(f"Saved audit log to {self.log_file} ({len(self.log_df)} entries)")

    def verify_hash_chain(self) -> Dict[str, any]:
        """
        Verify integrity of audit log hash chain.

        Detects:
        - Modified entries (hash mismatch)
        - Deleted entries (broken chain)
        - Inserted entries (broken chain)

        Returns
        -------
        dict
            {
                'valid': bool,
                'total_entries': int,
                'verified_entries': int,
                'hash_mismatches': list of audit_ids,
                'chain_breaks': list of audit_ids
            }
        """
        logger.info("Verifying audit log hash chain integrity...")

        hash_mismatches = []
        chain_breaks = []

        prev_hash = hashlib.sha256(b"GENESIS_BLOCK").hexdigest()[:16]

        for idx, row in self.log_df.iterrows():
            # Verify hash chain continuity
            if row["prev_log_hash"] != prev_hash:
                chain_breaks.append(row["audit_id"])

            # Recompute hash for this entry
            entry = row.to_dict()
            expected_hash = entry["log_hash"]
            del entry["log_hash"]  # Remove hash before recomputing
            recomputed_hash = self._compute_log_hash(entry)

            if recomputed_hash != expected_hash:
                hash_mismatches.append(row["audit_id"])

            prev_hash = row["log_hash"]

        result = {
            "valid": len(hash_mismatches) == 0 and len(chain_breaks) == 0,
            "total_entries": len(self.log_df),
            "verified_entries": len(self.log_df)
            - len(hash_mismatches)
            - len(chain_breaks),
            "hash_mismatches": hash_mismatches,
            "chain_breaks": chain_breaks,
        }

        if result["valid"]:
            logger.info(
                f"✅ Audit log integrity: VERIFIED ({result['total_entries']} entries)"
            )
        else:
            logger.error(f"❌ Audit log integrity: FAILED")
            logger.error(f"  Hash mismatches: {len(hash_mismatches)}")
            logger.error(f"  Chain breaks: {len(chain_breaks)}")

        return result

    def get_audit_trail(
        self,
        linkage_id: Optional[str] = None,
        source_id: Optional[str] = None,
        source_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> pd.DataFrame:
        """
        Query audit trail with filters.

        Parameters
        ----------
        linkage_id : str, optional
            Filter by specific linkage ID
        source_id : str, optional
            Filter by source record ID
        source_type : str, optional
            Filter by source type ('ct_scan', 'fna_biopsy', etc.)
        start_date : datetime, optional
            Filter by timestamp >= start_date
        end_date : datetime, optional
            Filter by timestamp <= end_date

        Returns
        -------
        pd.DataFrame
            Filtered audit log entries
        """
        filtered = self.log_df.copy()

        if linkage_id:
            filtered = filtered[filtered["linkage_id"] == linkage_id]

        if source_id:
            filtered = filtered[filtered["source_id"] == source_id]

        if source_type:
            filtered = filtered[filtered["source_type"] == source_type]

        if start_date:
            filtered = filtered[filtered["timestamp"] >= start_date]

        if end_date:
            filtered = filtered[filtered["timestamp"] <= end_date]

        logger.info(f"Audit trail query returned {len(filtered)} entries")

        return filtered

    def export_audit_log(self, output_path: Path, format: str = "parquet"):
        """
        Export audit log to file.

        Parameters
        ----------
        output_path : Path
            Output file path
        format : str
            Export format ('parquet', 'csv', 'json')
        """
        if format == "parquet":
            self.log_df.to_parquet(output_path, index=False)
        elif format == "csv":
            self.log_df.to_csv(output_path, index=False)
        elif format == "json":
            self.log_df.to_json(output_path, orient="records", indent=2)
        else:
            raise ValueError(f"Unsupported format: {format}")

        logger.info(f"Exported audit log to {output_path} (format: {format})")

    def get_linkage_statistics(self) -> Dict[str, any]:
        """
        Get summary statistics from audit log.

        Returns
        -------
        dict
            {
                'total_linkages': int,
                'linkages_by_type': dict,
                'validation_status_counts': dict,
                'mean_confidence': float,
                'mean_abs_days_gap': float,
                'date_range': tuple (earliest, latest)
            }
        """
        return {
            "total_linkages": len(self.log_df),
            "linkages_by_type": self.log_df["source_type"].value_counts().to_dict(),
            "validation_status_counts": self.log_df["validation_status"]
            .value_counts()
            .to_dict(),
            "mean_confidence": float(self.log_df["link_confidence"].mean()),
            "mean_abs_days_gap": float(self.log_df["abs_days_gap"].mean()),
            "date_range": (
                (
                    self.log_df["timestamp"].min().isoformat(),
                    self.log_df["timestamp"].max().isoformat(),
                )
                if len(self.log_df) > 0
                else (None, None)
            ),
        }


def log_linkage_decision(*args, **kwargs):
    """Convenience function for logging single linkage decision"""
    logger = AuditLogger()
    audit_id = logger.log_linkage_decision(*args, **kwargs)
    logger.save()
    return audit_id


def get_audit_trail(*args, **kwargs):
    """Convenience function for querying audit trail"""
    logger = AuditLogger()
    return logger.get_audit_trail(*args, **kwargs)


def export_audit_log(*args, **kwargs):
    """Convenience function for exporting audit log"""
    logger = AuditLogger()
    logger.export_audit_log(*args, **kwargs)
