"""
Workflow Stages

This module imports all stage implementations to ensure they are
registered with the stage registry on module load.

Available stages:
- Stage 01: Upload Intake - file validation, checksum
- Stage 03: IRB Compliance Check
- Stage 04: Schema Validation - structure before PHI scan
- Stage 05: PHI Scan - detect protected health information
- Stage 08: Data Validation - quality checks
- Stage 20: Conference Report - final output generation
"""

# Import all stage modules to trigger registration
from . import stage_01_upload
from . import stage_03_irb
from . import stage_04_validate
from . import stage_05_phi
from . import stage_08_validation
from . import stage_20_conference

__all__ = [
    "stage_01_upload",
    "stage_03_irb",
    "stage_04_validate",
    "stage_05_phi",
    "stage_08_validation",
    "stage_20_conference",
]
