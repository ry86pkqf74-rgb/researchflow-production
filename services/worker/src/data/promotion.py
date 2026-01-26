"""Dataset Promotion - Quarantine to persistent store with capability gating.

Promotion flow:
1. Dataset lands in .tmp/quarantine/<dataset_id>/
2. Operator triggers promotion via require_capability("promote_dataset")
3. If authorized, copy to .tmp/datasets/<dataset_id>/
4. Update registry status to PROMOTED

STANDBY mode: Promotion permanently blocked (STANDBY_BLOCKED).
"""

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from src.governance.capabilities import (
    require_capability,
    DataAdmissibility,
    RosMode,
    get_current_mode,
)
from .registry import DatasetRegistry, DatasetRecord


@dataclass
class PromotionResult:
    """Result of dataset promotion attempt.

    Attributes:
        success: Whether promotion succeeded
        dataset_id: Dataset identifier
        promoted_path: Path to promoted dataset (if success)
        error_message: Error message (if failed)
        capability_decision: Capability decision details
    """

    success: bool
    dataset_id: str
    promoted_path: Optional[Path] = None
    error_message: Optional[str] = None
    capability_decision: Optional[dict] = None


def promote_dataset(
    dataset_id: str,
    admissibility: DataAdmissibility,
    attestation_complete: bool = False,
    registry: Optional[DatasetRegistry] = None,
    quarantine_root: Optional[Path] = None,
    datasets_root: Optional[Path] = None,
) -> PromotionResult:
    """Promote dataset from quarantine to persistent store.

    Requires:
    - require_capability("promote_dataset") authorization
    - Admissibility consistency (registry matches requested)
    - STANDBY mode check (promotion blocked in STANDBY)

    Args:
        dataset_id: Dataset identifier
        admissibility: Data admissibility category
        attestation_complete: Whether runtime attestation is complete
        registry: DatasetRegistry instance (default: .tmp/registry/datasets.jsonl)
        quarantine_root: Quarantine root directory (default: .tmp/quarantine)
        datasets_root: Datasets root directory (default: .tmp/datasets)

    Returns:
        PromotionResult
    """
    # Initialize defaults
    if registry is None:
        registry = DatasetRegistry()

    if quarantine_root is None:
        quarantine_root = Path(".tmp/quarantine")

    if datasets_root is None:
        datasets_root = Path(".tmp/datasets")

    # Check current mode
    mode = get_current_mode()

    # STANDBY check (promotion always blocked)
    if mode == RosMode.STANDBY:
        return PromotionResult(
            success=False,
            dataset_id=dataset_id,
            error_message=(
                "Dataset promotion is permanently blocked in STANDBY mode. "
                "Switch to SANDBOX mode to enable promotion."
            ),
            capability_decision={
                "allowed": False,
                "reason": "STANDBY mode blocks promotion",
                "mode": mode.value,
            },
        )

    # Check capability authorization
    decision = require_capability(
        capability_name="promote_dataset",
        admissibility=admissibility,
        attestation_complete=attestation_complete,
    )

    if not decision.allowed:
        return PromotionResult(
            success=False,
            dataset_id=dataset_id,
            error_message=f"Promotion denied: {decision.reason}",
            capability_decision={
                "allowed": decision.allowed,
                "reason": decision.reason,
                "reason_code": decision.reason_code,
                "required_action": decision.required_action,
                "mode": decision.mode.value,
            },
        )

    # Get dataset record from registry
    record = registry.get_dataset(dataset_id)
    if record is None:
        return PromotionResult(
            success=False,
            dataset_id=dataset_id,
            error_message=f"Dataset '{dataset_id}' not found in registry",
            capability_decision={
                "allowed": decision.allowed,
                "reason": decision.reason,
                "mode": decision.mode.value,
            },
        )

    # Check admissibility consistency
    if record.admissibility != admissibility.value:
        return PromotionResult(
            success=False,
            dataset_id=dataset_id,
            error_message=(
                f"Admissibility mismatch: registry has '{record.admissibility}', "
                f"but promotion requested '{admissibility.value}'"
            ),
            capability_decision={
                "allowed": decision.allowed,
                "reason": decision.reason,
                "mode": decision.mode.value,
            },
        )

    # Check if already promoted
    if record.status == "PROMOTED":
        return PromotionResult(
            success=False,
            dataset_id=dataset_id,
            error_message=f"Dataset '{dataset_id}' is already promoted",
            capability_decision={
                "allowed": decision.allowed,
                "reason": decision.reason,
                "mode": decision.mode.value,
            },
        )

    # Verify quarantine path exists
    quarantine_path = quarantine_root / dataset_id
    if not quarantine_path.exists():
        return PromotionResult(
            success=False,
            dataset_id=dataset_id,
            error_message=f"Quarantine path not found: {quarantine_path}",
            capability_decision={
                "allowed": decision.allowed,
                "reason": decision.reason,
                "mode": decision.mode.value,
            },
        )

    # Perform promotion (copy to persistent store)
    try:
        promoted_path = datasets_root / dataset_id
        promoted_path.mkdir(parents=True, exist_ok=True)

        # Copy all files from quarantine to promoted location
        for item in quarantine_path.iterdir():
            if item.is_file():
                shutil.copy2(item, promoted_path / item.name)
            elif item.is_dir():
                shutil.copytree(item, promoted_path / item.name, dirs_exist_ok=True)

        # Update registry status
        registry.update_status(
            dataset_id=dataset_id,
            new_status="PROMOTED",
            notes=f"Promoted via capability: {admissibility.value}",
        )

        return PromotionResult(
            success=True,
            dataset_id=dataset_id,
            promoted_path=promoted_path,
            capability_decision={
                "allowed": decision.allowed,
                "reason": decision.reason,
                "mode": decision.mode.value,
                "admissibility": admissibility.value,
            },
        )

    except Exception as e:
        return PromotionResult(
            success=False,
            dataset_id=dataset_id,
            error_message=f"Promotion failed: {str(e)}",
            capability_decision={
                "allowed": decision.allowed,
                "reason": decision.reason,
                "mode": decision.mode.value,
            },
        )
