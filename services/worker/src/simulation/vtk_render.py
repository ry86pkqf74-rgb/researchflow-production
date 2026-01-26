"""
VTK Volume Rendering

Minimal offscreen volume rendering to PNG via VTK.

Based on document_pdf.pdf specification (pages 13-14).

Requirements:
    pip install vtk SimpleITK numpy

Note: You will likely want to tune transfer functions per modality
(CT vs MRI), and/or render segmented masks as separate overlays.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

try:
    import numpy as np
    import vtk
    from vtk.util import numpy_support
    VTK_AVAILABLE = True
except ImportError:
    np = None
    vtk = None
    numpy_support = None
    VTK_AVAILABLE = False

if TYPE_CHECKING:
    import SimpleITK as sitk


def sitk_to_numpy_zyx(img: "sitk.Image") -> "np.ndarray":
    """
    Convert SimpleITK image to numpy array.
    
    SimpleITK returns array as [z, y, x].
    
    Args:
        img: SimpleITK Image
        
    Returns:
        Contiguous numpy array in ZYX order
    """
    import SimpleITK as sitk
    arr = sitk.GetArrayFromImage(img)
    return np.ascontiguousarray(arr)


def render_volume_to_png(volume: "sitk.Image", output_png: str) -> None:
    """
    Minimal offscreen volume render to a PNG via VTK.
    
    Args:
        volume: SimpleITK Image (3D volume)
        output_png: Output PNG file path
        
    Raises:
        ImportError: If VTK/numpy not installed
    """
    if not VTK_AVAILABLE:
        raise ImportError(
            "VTK and numpy are required for volume rendering. "
            "Install with: pip install vtk numpy"
        )
    
    arr_zyx = sitk_to_numpy_zyx(volume)
    z, y, x = arr_zyx.shape
    
    # Convert to VTK array
    vtk_arr = numpy_support.numpy_to_vtk(
        num_array=arr_zyx.ravel(order="C"),
        deep=True,
        array_type=vtk.VTK_FLOAT
    )
    
    # Create VTK image data
    image_data = vtk.vtkImageData()
    image_data.SetDimensions(x, y, z)
    image_data.GetPointData().SetScalars(vtk_arr)
    
    # Set spacing from SimpleITK (x, y, z order)
    sx, sy, sz = volume.GetSpacing()
    image_data.SetSpacing(sx, sy, sz)
    
    # Create volume mapper
    mapper = vtk.vtkGPUVolumeRayCastMapper()
    mapper.SetInputData(image_data)
    
    # Basic transfer functions (tune for CT HU ranges / MRI intensity)
    color_tf = vtk.vtkColorTransferFunction()
    opacity_tf = vtk.vtkPiecewiseFunction()
    
    # Generic intensity ramp
    minv = float(np.percentile(arr_zyx, 5))
    maxv = float(np.percentile(arr_zyx, 95))
    
    color_tf.AddRGBPoint(minv, 0.0, 0.0, 0.0)
    color_tf.AddRGBPoint(maxv, 1.0, 1.0, 1.0)
    
    opacity_tf.AddPoint(minv, 0.0)
    opacity_tf.AddPoint(maxv, 1.0)
    
    # Volume property
    prop = vtk.vtkVolumeProperty()
    prop.SetColor(color_tf)
    prop.SetScalarOpacity(opacity_tf)
    prop.ShadeOn()
    prop.SetInterpolationTypeToLinear()
    
    # Create volume actor
    vol = vtk.vtkVolume()
    vol.SetMapper(mapper)
    vol.SetProperty(prop)
    
    # Renderer and window
    ren = vtk.vtkRenderer()
    ren.AddVolume(vol)
    ren.ResetCamera()
    
    renwin = vtk.vtkRenderWindow()
    renwin.AddRenderer(ren)
    renwin.SetOffScreenRendering(1)
    renwin.SetSize(1024, 768)
    renwin.Render()
    
    # Capture to PNG
    w2if = vtk.vtkWindowToImageFilter()
    w2if.SetInput(renwin)
    w2if.Update()
    
    writer = vtk.vtkPNGWriter()
    writer.SetFileName(output_png)
    writer.SetInputData(w2if.GetOutput())
    writer.Write()
