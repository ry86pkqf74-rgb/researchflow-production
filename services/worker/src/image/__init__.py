"""
Image Processing Module

Image analysis and detection capabilities.
"""

from .detector import detect_image_features, ImageDetectionResult

__all__ = [
    'detect_image_features',
    'ImageDetectionResult',
]
