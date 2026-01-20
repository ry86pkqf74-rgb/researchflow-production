"""
Stage Registry

This module provides a decorator-based registry for workflow stages.
Stages register themselves using @register_stage and can be retrieved
by stage_id for execution.
"""

import logging
from typing import Dict, List, Optional, Type

from .types import Stage

logger = logging.getLogger("workflow_engine.registry")

# Global registry mapping stage_id -> Stage class
_stage_registry: Dict[int, Type[Stage]] = {}


def register_stage(cls: Type[Stage]) -> Type[Stage]:
    """Decorator to register a stage class in the global registry.

    Usage:
        @register_stage
        class MyStage:
            stage_id = 3
            stage_name = "IRB Compliance Check"

            async def execute(self, context: StageContext) -> StageResult:
                ...

    Args:
        cls: The stage class to register

    Returns:
        The original class (unmodified)

    Raises:
        ValueError: If stage_id is already registered or invalid
    """
    if not hasattr(cls, 'stage_id'):
        raise ValueError(f"Stage class {cls.__name__} must have a 'stage_id' attribute")

    if not hasattr(cls, 'stage_name'):
        raise ValueError(f"Stage class {cls.__name__} must have a 'stage_name' attribute")

    stage_id = cls.stage_id

    if not isinstance(stage_id, int) or stage_id < 1 or stage_id > 19:
        raise ValueError(f"stage_id must be an integer between 1 and 19, got {stage_id}")

    if stage_id in _stage_registry:
        existing = _stage_registry[stage_id]
        raise ValueError(
            f"Stage {stage_id} already registered by {existing.__name__}, "
            f"cannot register {cls.__name__}"
        )

    _stage_registry[stage_id] = cls
    logger.debug(f"Registered stage {stage_id}: {cls.stage_name}")

    return cls


def get_stage(stage_id: int) -> Optional[Type[Stage]]:
    """Retrieve a registered stage class by its ID.

    Args:
        stage_id: The numeric stage identifier (1-19)

    Returns:
        The registered Stage class, or None if not found
    """
    return _stage_registry.get(stage_id)


def list_stages() -> List[Dict[str, any]]:
    """List all registered stages.

    Returns:
        List of dicts with stage_id, stage_name, and class_name
    """
    stages = []
    for stage_id in sorted(_stage_registry.keys()):
        cls = _stage_registry[stage_id]
        stages.append({
            "stage_id": stage_id,
            "stage_name": cls.stage_name,
            "class_name": cls.__name__,
        })
    return stages


def clear_registry() -> None:
    """Clear all registered stages. Primarily for testing."""
    _stage_registry.clear()
    logger.debug("Stage registry cleared")
