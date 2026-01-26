"""
Workflow Stages

This module imports all stage implementations to ensure they are
registered with the stage registry on module load.

Available stages:
- Stage 01: Upload Intake - file validation, checksum
- Stage 02: Literature Review - automated literature search and summary
- Stage 03: IRB Compliance Check
- Stage 04: Schema Validation - structure before PHI scan
- Stage 05: PHI Scan - detect protected health information
- Stage 06: Analysis - computational analysis with progress tracking
- Stage 07: Statistical Modeling - build and validate statistical models
- Stage 08: Data Validation - quality checks
- Stage 09: Interpretation - collaborative result interpretation
- Stage 10: Validation - research validation checklist
- Stage 11: Iteration - analysis iteration with AI routing
- Stage 12: Documentation - report and documentation generation
- Stage 13: Internal Review - AI-powered peer review simulation
- Stage 14: Ethical Review - compliance and ethical verification
- Stage 15: Artifact Bundling - package artifacts for sharing/archiving
- Stage 16: Collaboration Handoff - share with collaborators
- Stage 17: Archiving - long-term project archiving
- Stage 18: Impact Assessment - research impact metrics tracking
- Stage 19: Dissemination - publication and sharing preparation
- Stage 20: Conference Report - final output generation
"""

# Import all stage modules to trigger registration
from . import stage_01_upload
from . import stage_02_literature
from . import stage_03_irb
from . import stage_04_validate
from . import stage_05_phi
from . import stage_06_analysis
from . import stage_07_stats
from . import stage_08_validation
from . import stage_09_interpretation
from . import stage_10_validation
from . import stage_11_iteration
from . import stage_12_documentation
from . import stage_13_internal_review
from . import stage_14_ethical
from . import stage_15_bundling
from . import stage_16_handoff
from . import stage_17_archiving
from . import stage_18_impact
from . import stage_19_dissemination
from . import stage_20_conference

__all__ = [
    "stage_01_upload",
    "stage_02_literature",
    "stage_03_irb",
    "stage_04_validate",
    "stage_05_phi",
    "stage_06_analysis",
    "stage_07_stats",
    "stage_08_validation",
    "stage_09_interpretation",
    "stage_10_validation",
    "stage_11_iteration",
    "stage_12_documentation",
    "stage_13_internal_review",
    "stage_14_ethical",
    "stage_15_bundling",
    "stage_16_handoff",
    "stage_17_archiving",
    "stage_18_impact",
    "stage_19_dissemination",
    "stage_20_conference",
]
