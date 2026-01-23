"""
Simulation Module (Optional)

Imaging I/O and VTK volume rendering for surgical planning.

Based on document_pdf.pdf specification (pages 12-14).

OPTIONAL DEPENDENCIES:
    pip install SimpleITK vtk

This module is feature-flagged:
    ENABLE_SIMULATION=1

Usage:
    from simulation.imaging_io import load_volume, ImagingInput
    from simulation.vtk_render import render_volume_to_png

    volume = load_volume(ImagingInput(dicom_dir="/path/to/dicom"))
    render_volume_to_png(volume, "output.png")
"""

# Imports are conditional on dependencies being available
__all__ = []

try:
    from .imaging_io import load_volume, ImagingInput
    __all__.extend(["load_volume", "ImagingInput"])
except ImportError:
    pass

try:
    from .vtk_render import render_volume_to_png, sitk_to_numpy_zyx
    __all__.extend(["render_volume_to_png", "sitk_to_numpy_zyx"])
except ImportError:
    pass

try:
    from .planning_report import generate_planning_report
    __all__.extend(["generate_planning_report"])
except ImportError:
    pass
