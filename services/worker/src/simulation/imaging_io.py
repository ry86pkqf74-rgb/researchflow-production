"""
Imaging I/O

Load 3D volumes from DICOM series or NIfTI files.

Based on document_pdf.pdf specification (page 12).

Requirements:
    pip install SimpleITK

Usage:
    from simulation.imaging_io import load_volume, ImagingInput
    
    # Load from DICOM directory
    volume = load_volume(ImagingInput(dicom_dir="/path/to/dicom"))
    
    # Load from NIfTI file
    volume = load_volume(ImagingInput(nifti_path="/path/to/file.nii.gz"))
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

try:
    import SimpleITK as sitk
    SITK_AVAILABLE = True
except ImportError:
    sitk = None
    SITK_AVAILABLE = False


@dataclass(frozen=True)
class ImagingInput:
    """Input specification for imaging data."""
    dicom_dir: Optional[str] = None
    nifti_path: Optional[str] = None


def load_volume(inp: ImagingInput) -> "sitk.Image":
    """
    Load a 3D volume from DICOM series directory or a NIfTI file.
    
    Args:
        inp: ImagingInput with either dicom_dir or nifti_path
        
    Returns:
        SimpleITK Image object
        
    Raises:
        ImportError: If SimpleITK is not installed
        FileNotFoundError: If path doesn't exist
        ValueError: If no input provided
    """
    if not SITK_AVAILABLE:
        raise ImportError(
            "SimpleITK is required for imaging I/O. "
            "Install with: pip install SimpleITK"
        )
    
    if inp.dicom_dir:
        if not os.path.isdir(inp.dicom_dir):
            raise FileNotFoundError(f"DICOM dir not found: {inp.dicom_dir}")
        
        reader = sitk.ImageSeriesReader()
        dicom_names = reader.GetGDCMSeriesFileNames(inp.dicom_dir)
        reader.SetFileNames(dicom_names)
        # Enable metadata if needed:
        # reader.MetaDataDictionaryArrayUpdateOn()
        # reader.LoadPrivateTagsOn()
        return reader.Execute()
    
    if inp.nifti_path:
        if not os.path.isfile(inp.nifti_path):
            raise FileNotFoundError(f"NIfTI not found: {inp.nifti_path}")
        return sitk.ReadImage(inp.nifti_path)
    
    raise ValueError("No imaging input provided (need dicom_dir or nifti_path).")
