"""
Workflow Stages

This module imports all stage implementations to ensure they are
registered with the stage registry on module load.
"""

# Import all stage modules to trigger registration
from . import stage_03_irb
from . import stage_05_phi
from . import stage_08_validation

__all__ = [
    "stage_03_irb",
    "stage_05_phi",
    "stage_08_validation",
]
